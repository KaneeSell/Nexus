import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type {
  CliLaunchOptions,
  ExecutionRunDTO,
  OnErrorAction,
  PackageManager,
  PipelineDTO,
  RunExecutionOptions,
  RunScriptsBatchInput,
  RunStatus,
  SavePipelineInput,
  StartupMode,
  StepKind,
  WorkspaceHistoryDTO,
  WorkspaceScanOptions
} from '../../shared/types';
import { getPrisma, resolveDatabasePath } from '../db/prisma';
import { ProcessRunner, type ExecutableStep } from '../engine/processRunner';
import { scanWorkspace } from '../scanner/workspaceScanner';
import { getCliStatus, installCliToPath, uninstallCliFromPath } from '../system/cliManager';
import { detectInstalledTools, openTerminalAt, openWithTool } from '../system/toolDetector';
import {
  checkForUpdates,
  dismissUpdateNotice,
  downloadAndInstallUpdate
} from '../system/updateChecker';

const runner = new ProcessRunner();

function mapPipeline(row: {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: string;
    order: number;
    name: string;
    kind: string;
    command: string;
    onErrorAction: string;
    onErrorCommand: string | null;
    onSuccessCommand: string | null;
    enabled: boolean;
  }>;
}): PipelineDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    steps: row.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        order: s.order,
        name: s.name,
        kind: (s.kind === 'command' ? 'command' : 'script') as StepKind,
        command: s.command,
        onErrorAction: (['stop', 'continue', 'run_command'].includes(s.onErrorAction)
          ? s.onErrorAction
          : 'stop') as OnErrorAction,
        onErrorCommand: s.onErrorCommand,
        onSuccessCommand: s.onSuccessCommand,
        enabled: s.enabled
      }))
  };
}

async function fetchWorkspaceHistory(): Promise<WorkspaceHistoryDTO[]> {
  const prisma = getPrisma();
  const rows = await prisma.workspaceHistory.findMany({
    orderBy: [{ isPinned: 'desc' }, { lastOpenedAt: 'desc' }],
    take: 20
  });
  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    name: r.name,
    lastOpenedAt: r.lastOpenedAt.toISOString(),
    isPinned: r.isPinned
  }));
}

async function resolveDefaultTargetFromSettings(): Promise<string | null> {
  const prisma = getPrisma();
  const [startupSetting, defaultPathSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'startupMode' } }),
    prisma.appSetting.findUnique({ where: { key: 'defaultWorkspacePath' } })
  ]);

  const startupMode = (startupSetting?.value as StartupMode | undefined) ?? 'last';
  if (startupMode === 'empty') {
    return null;
  }
  if (startupMode === 'fixed') {
    const fixedPath = defaultPathSetting?.value?.trim();
    return fixedPath || null;
  }

  const last = await prisma.workspaceHistory.findFirst({
    orderBy: [{ isPinned: 'desc' }, { lastOpenedAt: 'desc' }]
  });
  return last?.path ?? null;
}

export function registerIpcHandlers(
  getPrimaryWindow: () => BrowserWindow | null,
  getLaunchOptionsForWebContents: (webContentsId: number) => CliLaunchOptions | null
): void {
  const broadcastToRenderers = (channel: string, payload: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  };

  ipcMain.handle('workspace:getInitialLaunch', async (event) => {
    const cliOptions = getLaunchOptionsForWebContents(event.sender.id);
    if (cliOptions) {
      if (!cliOptions.targetPath && !cliOptions.openConfig) {
        const fallbackTarget = await resolveDefaultTargetFromSettings();
        return { ...cliOptions, targetPath: fallbackTarget };
      }
      return cliOptions;
    }

    const defaultTarget = await resolveDefaultTargetFromSettings();
    return defaultTarget ? { targetPath: defaultTarget } : null;
  });

  ipcMain.handle('workspace:getInitialTarget', async (event) => {
    const cliOptions = getLaunchOptionsForWebContents(event.sender.id);
    if (cliOptions?.targetPath) return cliOptions.targetPath;
    return resolveDefaultTargetFromSettings();
  });

  ipcMain.handle(
    'workspace:scan',
    async (event, targetPath: string, options?: WorkspaceScanOptions) => {
      const senderWin = BrowserWindow.fromWebContents(event.sender);
      return scanWorkspace(
        targetPath,
        (progress) => {
          if (senderWin && !senderWin.isDestroyed()) {
            senderWin.webContents.send('workspace:scan-progress', progress);
          }
        },
        options
      );
    }
  );

  ipcMain.handle('workspace:pickFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? getPrimaryWindow();
    const result = win
      ? await dialog.showOpenDialog(win, {
          properties: ['openDirectory'],
          title: 'Selecionar pasta do projeto ou workspace'
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Selecionar pasta do projeto ou workspace'
        });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('workspace:getHistory', async () => {
    return fetchWorkspaceHistory();
  });

  ipcMain.handle('workspace:togglePin', async (_event, id: string) => {
    const prisma = getPrisma();
    const current = await prisma.workspaceHistory.findUnique({ where: { id } });
    if (current) {
      await prisma.workspaceHistory.update({
        where: { id },
        data: { isPinned: !current.isPinned }
      });
    }
    return fetchWorkspaceHistory();
  });

  ipcMain.handle('workspace:removeHistory', async (_event, id: string) => {
    const prisma = getPrisma();
    await prisma.workspaceHistory.deleteMany({ where: { id } });
    return fetchWorkspaceHistory();
  });

  ipcMain.handle('pipeline:list', async (_event, projectId: string) => {
    const prisma = getPrisma();
    const rows = await prisma.pipeline.findMany({
      where: { projectId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' }
    });
    return rows.map(mapPipeline);
  });

  ipcMain.handle('pipeline:save', async (_event, input: SavePipelineInput) => {
    const prisma = getPrisma();
    const stepsData = input.steps.map((s, idx) => ({
      order: idx,
      name: s.name.trim() || s.command.trim(),
      kind: s.kind,
      command: s.command.trim(),
      onErrorAction: s.onErrorAction,
      onErrorCommand: s.onErrorCommand?.trim() || null,
      onSuccessCommand: s.onSuccessCommand?.trim() || null,
      enabled: s.enabled
    }));

    if (input.id) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.pipelineStep.deleteMany({ where: { pipelineId: input.id } });
        return tx.pipeline.update({
          where: { id: input.id },
          data: {
            name: input.name.trim(),
            description: input.description?.trim() ?? '',
            steps: { create: stepsData }
          },
          include: { steps: { orderBy: { order: 'asc' } } }
        });
      });
      return mapPipeline(updated);
    }

    const created = await prisma.pipeline.create({
      data: {
        projectId: input.projectId,
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        steps: { create: stepsData }
      },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
    return mapPipeline(created);
  });

  ipcMain.handle('pipeline:delete', async (_event, pipelineId: string) => {
    const prisma = getPrisma();
    await prisma.pipeline.delete({ where: { id: pipelineId } });
  });

  const callbacks = {
    onLog: (event: unknown) => broadcastToRenderers('runner:log', event),
    onRunStatus: (event: unknown) => broadcastToRenderers('runner:status', event),
    onStepStatus: (event: unknown) => broadcastToRenderers('runner:step-status', event)
  };

  ipcMain.handle(
    'runner:runScript',
    async (
      _event,
      input: {
        projectId: string;
        projectPath: string;
        packageManager: PackageManager;
        scriptName: string;
      } & RunExecutionOptions
    ) => {
      const runId = await runner.startExecution({
        projectId: input.projectId,
        projectPath: input.projectPath,
        packageManager: input.packageManager,
        pipelineId: null,
        title: `Script: ${input.scriptName}`,
        steps: [
          {
            name: input.scriptName,
            kind: 'script',
            command: input.scriptName,
            onErrorAction: 'stop'
          }
        ],
        continueOnError: input.continueOnError,
        dryRun: input.dryRun,
        envProfile: input.envProfile,
        callbacks
      });
      return { runId };
    }
  );

  ipcMain.handle('runner:runScriptsBatch', async (_event, input: RunScriptsBatchInput) => {
    const steps: ExecutableStep[] = input.scripts.map((scriptName) => ({
      name: scriptName,
      kind: 'script',
      command: scriptName,
      onErrorAction: 'stop'
    }));

    const runId = await runner.startExecution({
      projectId: input.projectId,
      projectPath: input.projectPath,
      packageManager: input.packageManager,
      pipelineId: null,
      title: input.title?.trim() || `Lote (${input.scripts.length} scripts)`,
      steps,
      continueOnError: input.continueOnError,
      dryRun: input.dryRun,
      envProfile: input.envProfile,
      callbacks
    });
    return { runId };
  });

  ipcMain.handle(
    'runner:runPipeline',
    async (_event, pipelineId: string, options?: RunExecutionOptions) => {
      const prisma = getPrisma();
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          project: true,
          steps: {
            where: { enabled: true },
            orderBy: { order: 'asc' }
          }
        }
      });

      if (!pipeline) {
        throw new Error('Pipeline não encontrado.');
      }
      if (pipeline.steps.length === 0) {
        throw new Error('Este pipeline não possui nenhuma etapa habilitada.');
      }

      const steps: ExecutableStep[] = pipeline.steps.map((s) => ({
        name: s.name,
        kind: (s.kind === 'command' ? 'command' : 'script') as StepKind,
        command: s.command,
        onErrorAction: (['stop', 'continue', 'run_command'].includes(s.onErrorAction)
          ? s.onErrorAction
          : 'stop') as OnErrorAction,
        onErrorCommand: s.onErrorCommand,
        onSuccessCommand: s.onSuccessCommand
      }));

      const runId = await runner.startExecution({
        projectId: pipeline.projectId,
        projectPath: pipeline.project.path,
        packageManager: (pipeline.project.packageManager || 'npm') as PackageManager,
        pipelineId: pipeline.id,
        title: `Pipeline: ${pipeline.name}`,
        steps,
        continueOnError: options?.continueOnError,
        dryRun: options?.dryRun,
        envProfile: options?.envProfile,
        callbacks
      });

      return { runId };
    }
  );

  ipcMain.handle('runner:cancel', async (_event, runId: string) => {
    return runner.cancelRun(runId);
  });

  ipcMain.handle('runner:getHistory', async (_event, projectId: string) => {
    const prisma = getPrisma();
    const rows = await prisma.executionRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 30
    });
    return rows.map(
      (r): ExecutionRunDTO => ({
        id: r.id,
        projectId: r.projectId,
        pipelineId: r.pipelineId,
        title: r.title,
        status: r.status as RunStatus,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        logs: r.logs
      })
    );
  });

  ipcMain.handle('system:openInVSCode', async (_event, targetPath: string) => {
    await openWithTool('vscode', targetPath);
  });

  ipcMain.handle('system:openInExplorer', async (_event, targetPath: string) => {
    await shell.openPath(targetPath);
  });

  ipcMain.handle('system:openInTerminal', async (_event, targetPath: string) => {
    await openTerminalAt(targetPath);
  });

  ipcMain.handle('system:getDetectedTools', async (_event, refresh?: boolean) => {
    return detectInstalledTools(Boolean(refresh));
  });

  ipcMain.handle('system:openWithTool', async (_event, toolId: string, targetPath: string) => {
    await openWithTool(toolId, targetPath);
  });

  ipcMain.handle('settings:get', async (_event, key: string) => {
    const prisma = getPrisma();
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    const prisma = getPrisma();
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  });

  ipcMain.handle('system:getCliStatus', async () => getCliStatus());
  ipcMain.handle('system:installCli', async () => installCliToPath());
  ipcMain.handle('system:uninstallCli', async () => uninstallCliFromPath());

  ipcMain.handle('system:getAppInfo', async () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    dbPath: resolveDatabasePath(),
    userDataPath: app.getPath('userData')
  }));

  ipcMain.handle('system:checkForUpdates', async (_event, force?: boolean) => {
    return checkForUpdates(Boolean(force));
  });

  ipcMain.handle(
    'system:dismissUpdateNotice',
    async (_event, version: string, hours: number) => {
      await dismissUpdateNotice(version, hours);
    }
  );

  ipcMain.handle(
    'system:downloadAndInstallUpdate',
    async (_event, downloadUrl: string, assetName?: string | null) => {
      return downloadAndInstallUpdate(downloadUrl, assetName);
    }
  );

  ipcMain.handle('system:openExternalUrl', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
