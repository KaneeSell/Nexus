import path from 'path';
import { app, BrowserWindow, shell } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import type { CliLaunchOptions } from '../shared/types';
import { disconnectPrisma, ensureDatabaseReady } from './db/prisma';
import { registerIpcHandlers } from './ipc/registerHandlers';

const windows = new Set<BrowserWindow>();
const launchOptionsByWebContentsId = new Map<number, CliLaunchOptions>();

function parseLaunchFromArgv(argv: string[]): {
  launchOptions: CliLaunchOptions | null;
  newWindow: boolean;
} {
  const newWindow = argv.includes('--new-window') || argv.includes('-n');

  const launchFlag = argv.find((arg) => arg.startsWith('--nexus-launch='));
  if (launchFlag) {
    const encoded = launchFlag.slice('--nexus-launch='.length).trim();
    try {
      const json = Buffer.from(encoded, 'base64').toString('utf-8');
      const parsed = JSON.parse(json) as CliLaunchOptions;
      return { launchOptions: parsed, newWindow };
    } catch {
      // ignore malformed payload and fall back to --target
    }
  }

  const targetFlag = argv.find((arg) => arg.startsWith('--target='));
  if (targetFlag) {
    const value = targetFlag.slice('--target='.length).trim().replace(/^"(.*)"$/, '$1');
    if (value) {
      return {
        launchOptions: { targetPath: path.resolve(value) },
        newWindow
      };
    }
  }

  return { launchOptions: null, newWindow };
}

const initialParsed = parseLaunchFromArgv(process.argv);

function getPrimaryWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  for (const win of windows) {
    if (!win.isDestroyed()) return win;
  }
  return null;
}

function createMainWindow(launchOptions: CliLaunchOptions | null = null): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'Nexus — Orquestrador de Projetos',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  const webContentsId = win.webContents.id;
  windows.add(win);
  if (launchOptions) {
    launchOptionsByWebContentsId.set(webContentsId, launchOptions);
  }

  win.on('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    launchOptionsByWebContentsId.delete(webContentsId);
    windows.delete(win);
  });

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const { launchOptions, newWindow } = parseLaunchFromArgv(commandLine);

    if (newWindow) {
      createMainWindow(launchOptions);
      return;
    }

    const targetWin = getPrimaryWindow();
    if (targetWin) {
      if (targetWin.isMinimized()) targetWin.restore();
      targetWin.focus();
      if (launchOptions) {
        targetWin.webContents.send('workspace:launch-options', launchOptions);
      }
    } else {
      createMainWindow(launchOptions);
    }
  });

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.nexus.orchestrator');

    await ensureDatabaseReady();

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    registerIpcHandlers(
      () => getPrimaryWindow(),
      (webContentsId: number) => launchOptionsByWebContentsId.get(webContentsId) ?? null
    );

    createMainWindow(initialParsed.launchOptions);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', async () => {
    await disconnectPrisma();
  });
}
