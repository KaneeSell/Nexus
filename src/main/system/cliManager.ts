import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import type { CliStatusDTO } from '../../shared/types';

function resolveCliBinDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin');
  }
  return path.resolve(__dirname, '../../bin');
}

function resolveLinuxSymlinkPath(): string {
  return path.join(os.homedir(), '.local', 'bin', 'nexus');
}

function resolveLinuxTargetScript(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'nexus');
  }
  return path.resolve(__dirname, '../../bin/nexus.mjs');
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

function normalizePathEntry(entry: string): string {
  return entry.trim().replace(/[\\/]+$/, '').toLowerCase();
}

async function getUserPathEntries(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  const raw = await runPowerShell("[Environment]::GetEnvironmentVariable('Path', 'User')");
  if (!raw) return [];
  return raw
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

async function setUserPathEntries(entries: string[]): Promise<void> {
  if (process.platform !== 'win32') return;
  const joined = entries.join(';').replace(/'/g, "''");
  await runPowerShell(`[Environment]::SetEnvironmentVariable('Path', '${joined}', 'User')`);
}

export async function getCliStatus(): Promise<CliStatusDTO> {
  if (process.platform === 'linux') {
    const symlinkPath = resolveLinuxSymlinkPath();
    const targetScript = resolveLinuxTargetScript();
    let installed = false;
    try {
      const linkTarget = fs.readlinkSync(symlinkPath);
      installed = path.resolve(path.dirname(symlinkPath), linkTarget) === path.resolve(targetScript);
    } catch {
      installed = fs.existsSync(symlinkPath);
    }
    return {
      installed,
      binDir: path.dirname(symlinkPath),
      commandPath: symlinkPath,
      isPackaged: app.isPackaged
    };
  }

  const binDir = resolveCliBinDir();
  const commandPath = path.join(binDir, 'nexus.cmd');
  const commandExists = fs.existsSync(commandPath);

  if (process.platform !== 'win32') {
    return {
      installed: false,
      binDir,
      commandPath,
      isPackaged: app.isPackaged
    };
  }

  try {
    const entries = await getUserPathEntries();
    const targetNorm = normalizePathEntry(binDir);
    const inPath = entries.some((entry) => normalizePathEntry(entry) === targetNorm);
    return {
      installed: inPath && commandExists,
      binDir,
      commandPath,
      isPackaged: app.isPackaged
    };
  } catch {
    return {
      installed: false,
      binDir,
      commandPath,
      isPackaged: app.isPackaged
    };
  }
}

export async function installCliToPath(): Promise<CliStatusDTO> {
  if (process.platform === 'linux') {
    const symlinkPath = resolveLinuxSymlinkPath();
    const targetScript = resolveLinuxTargetScript();
    fs.mkdirSync(path.dirname(symlinkPath), { recursive: true });
    if (fs.existsSync(targetScript)) {
      fs.chmodSync(targetScript, 0o755);
    }
    try {
      fs.unlinkSync(symlinkPath);
    } catch {
      // ignore if missing
    }
    fs.symlinkSync(targetScript, symlinkPath);
    return getCliStatus();
  }

  const binDir = resolveCliBinDir();
  if (process.platform === 'win32') {
    const entries = await getUserPathEntries();
    const targetNorm = normalizePathEntry(binDir);
    const exists = entries.some((entry) => normalizePathEntry(entry) === targetNorm);
    if (!exists) {
      await setUserPathEntries([...entries, binDir]);
    }
  }
  return getCliStatus();
}

export async function uninstallCliFromPath(): Promise<CliStatusDTO> {
  if (process.platform === 'linux') {
    const symlinkPath = resolveLinuxSymlinkPath();
    try {
      fs.unlinkSync(symlinkPath);
    } catch {
      // ignore if missing
    }
    return getCliStatus();
  }

  const binDir = resolveCliBinDir();
  if (process.platform === 'win32') {
    const entries = await getUserPathEntries();
    const targetNorm = normalizePathEntry(binDir);
    const filtered = entries.filter((entry) => normalizePathEntry(entry) !== targetNorm);
    await setUserPathEntries(filtered);
  }
  return getCliStatus();
}
