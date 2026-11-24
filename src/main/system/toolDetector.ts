import { execFile, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { DetectedToolDTO, ExternalToolCategory } from '../../shared/types';

interface ToolCandidate {
  id: string;
  name: string;
  category: ExternalToolCategory;
  commands: string[];
  commandName: string;
  windowsPaths?: () => string[];
  linuxPaths?: () => string[];
}

function getLocalAppData(): string {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
}

function getAppData(): string {
  return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
}

function getProgramFiles(): string {
  return process.env.ProgramFiles || 'C:\\Program Files';
}

const TOOL_CATALOG: ToolCandidate[] = [
  {
    id: 'vscode',
    name: 'VS Code',
    category: 'ide',
    commands: process.platform === 'win32' ? ['code.cmd', 'code'] : ['code'],
    commandName: 'code',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(getLocalAppData(), 'Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join(getProgramFiles(), 'Microsoft VS Code', 'Code.exe')
    ]
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    category: 'ide',
    commands: process.platform === 'win32' ? ['antigravity.cmd', 'antigravity', 'agy'] : ['antigravity', 'agy'],
    commandName: 'antigravity',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Programs', 'antigravity', 'Antigravity.exe'),
      path.join(getLocalAppData(), 'Programs', 'Antigravity', 'Antigravity.exe'),
      path.join(getProgramFiles(), 'Antigravity', 'Antigravity.exe')
    ]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'ide',
    commands: process.platform === 'win32' ? ['cursor.cmd', 'cursor'] : ['cursor'],
    commandName: 'cursor',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Programs', 'cursor', 'Cursor.exe'),
      path.join(getLocalAppData(), 'Programs', 'Cursor', 'Cursor.exe')
    ]
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    category: 'ide',
    commands: process.platform === 'win32' ? ['windsurf.cmd', 'windsurf'] : ['windsurf'],
    commandName: 'windsurf',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Programs', 'Windsurf', 'Windsurf.exe')
    ]
  },
  {
    id: 'zed',
    name: 'Zed',
    category: 'ide',
    commands: ['zed'],
    commandName: 'zed',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Programs', 'Zed', 'Zed.exe')
    ]
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    category: 'ide',
    commands: process.platform === 'win32' ? ['webstorm64.exe', 'webstorm'] : ['webstorm'],
    commandName: 'webstorm'
  },
  {
    id: 'claude',
    name: 'Claude Code',
    category: 'ai_cli',
    commands: ['claude'],
    commandName: 'claude',
    windowsPaths: () => [
      path.join(os.homedir(), '.local', 'bin', 'claude.exe'),
      path.join(getAppData(), 'npm', 'claude.cmd')
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    category: 'ai_cli',
    commands: process.platform === 'win32' ? ['gemini.cmd', 'gemini'] : ['gemini'],
    commandName: 'gemini',
    windowsPaths: () => [
      path.join(getAppData(), 'npm', 'gemini.cmd')
    ]
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    category: 'ai_cli',
    commands: ['codex'],
    commandName: 'codex',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'),
      path.join(getAppData(), 'npm', 'codex.cmd')
    ]
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    category: 'ai_cli',
    commands: ['copilot'],
    commandName: 'copilot',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'GitHubCopilotCLI', 'copilot.exe')
    ]
  },
  {
    id: 'aider',
    name: 'Aider',
    category: 'ai_cli',
    commands: ['aider'],
    commandName: 'aider'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    category: 'ai_cli',
    commands: ['opencode'],
    commandName: 'opencode'
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    category: 'ai_cli',
    commands: ['qwen'],
    commandName: 'qwen'
  },
  {
    id: 'wt',
    name: 'Windows Terminal',
    category: 'terminal',
    commands: ['wt.exe', 'wt'],
    commandName: 'wt',
    windowsPaths: () => [
      path.join(getLocalAppData(), 'Microsoft', 'WindowsApps', 'wt.exe')
    ]
  },
  {
    id: 'pwsh',
    name: 'PowerShell 7',
    category: 'terminal',
    commands: ['pwsh.exe', 'pwsh'],
    commandName: 'pwsh'
  },
  {
    id: 'powershell',
    name: 'Windows PowerShell',
    category: 'terminal',
    commands: ['powershell.exe'],
    commandName: 'powershell',
    windowsPaths: () => [
      path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      )
    ]
  },
  {
    id: 'cmd',
    name: 'Prompt de Comando (CMD)',
    category: 'terminal',
    commands: ['cmd.exe'],
    commandName: 'cmd',
    windowsPaths: () => [
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe')
    ]
  },
  {
    id: 'gnome-terminal',
    name: 'GNOME Terminal',
    category: 'terminal',
    commands: ['gnome-terminal'],
    commandName: 'gnome-terminal'
  },
  {
    id: 'konsole',
    name: 'Konsole',
    category: 'terminal',
    commands: ['konsole'],
    commandName: 'konsole'
  },
  {
    id: 'x-terminal-emulator',
    name: 'Terminal do Sistema',
    category: 'terminal',
    commands: ['x-terminal-emulator'],
    commandName: 'x-terminal-emulator'
  }
];

let cachedTools: DetectedToolDTO[] | null = null;

function resolveInPath(command: string): Promise<string | null> {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  return new Promise((resolve) => {
    execFile(finder, [command], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      const firstLine = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      resolve(firstLine || null);
    });
  });
}

async function detectCandidate(candidate: ToolCandidate): Promise<DetectedToolDTO | null> {
  if (process.platform === 'win32' && candidate.windowsPaths) {
    for (const p of candidate.windowsPaths()) {
      if (fs.existsSync(p)) {
        return {
          id: candidate.id,
          name: candidate.name,
          category: candidate.category,
          executable: p,
          commandName: candidate.commandName
        };
      }
    }
  }

  if (process.platform === 'linux' && candidate.linuxPaths) {
    for (const p of candidate.linuxPaths()) {
      if (fs.existsSync(p)) {
        return {
          id: candidate.id,
          name: candidate.name,
          category: candidate.category,
          executable: p,
          commandName: candidate.commandName
        };
      }
    }
  }

  for (const cmd of candidate.commands) {
    if (process.platform !== 'win32' && (cmd.endsWith('.exe') || cmd.endsWith('.cmd'))) {
      continue;
    }
    const found = await resolveInPath(cmd);
    if (found) {
      return {
        id: candidate.id,
        name: candidate.name,
        category: candidate.category,
        executable: found,
        commandName: candidate.commandName
      };
    }
  }

  return null;
}

export async function detectInstalledTools(forceRefresh = false): Promise<DetectedToolDTO[]> {
  if (cachedTools && !forceRefresh) {
    return cachedTools;
  }

  const results = await Promise.all(TOOL_CATALOG.map((candidate) => detectCandidate(candidate)));
  cachedTools = results.filter((item): item is DetectedToolDTO => item !== null);
  return cachedTools;
}

function spawnDetached(
  command: string,
  args: string[],
  cwd: string,
  useShell = false
): void {
  const child = spawn(command, args, {
    cwd,
    shell: useShell,
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();
}

export async function openTerminalAt(targetPath: string, initialCommand?: string): Promise<void> {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Diretório não encontrado: ${resolved}`);
  }

  const tools = await detectInstalledTools();

  if (process.platform === 'win32') {
    const wt = tools.find((t) => t.id === 'wt');
    if (wt) {
      const wtArgs = initialCommand
        ? ['-d', resolved, 'cmd.exe', '/k', initialCommand]
        : ['-d', resolved];
      spawnDetached(wt.executable, wtArgs, resolved, false);
      return;
    }

    const cmdArgs = initialCommand
      ? ['/c', 'start', '""', 'cmd.exe', '/k', initialCommand]
      : ['/c', 'start', '""', 'cmd.exe'];
    spawnDetached('cmd.exe', cmdArgs, resolved, false);
    return;
  }

  const linuxTerm = tools.find((t) => t.category === 'terminal');
  if (linuxTerm) {
    const termArgs = initialCommand ? ['-e', 'bash', '-lc', `${initialCommand}; exec bash`] : [];
    spawnDetached(linuxTerm.executable, termArgs, resolved, false);
  }
}

export async function openWithTool(toolId: string, targetPath: string): Promise<void> {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Diretório não encontrado: ${resolved}`);
  }

  const tools = await detectInstalledTools();
  const tool = tools.find((t) => t.id.toLowerCase() === toolId.toLowerCase());
  if (!tool) {
    throw new Error(`Ferramenta "${toolId}" não foi encontrada neste computador.`);
  }

  if (tool.category === 'ide') {
    const lower = tool.executable.toLowerCase();
    const isScriptShim = lower.endsWith('.cmd') || lower.endsWith('.bat') || lower.endsWith('.ps1');
    spawnDetached(
      isScriptShim ? `"${tool.executable}"` : tool.executable,
      [isScriptShim ? `"${resolved}"` : resolved],
      resolved,
      isScriptShim
    );
    return;
  }

  if (tool.category === 'ai_cli') {
    const cmdToRun =
      process.platform === 'win32' && tool.executable.toLowerCase().endsWith('.cmd')
        ? `"${tool.executable}"`
        : tool.commandName;
    await openTerminalAt(resolved, cmdToRun);
    return;
  }

  if (tool.id === 'wt') {
    spawnDetached(tool.executable, ['-d', resolved], resolved, false);
    return;
  }

  if (tool.id === 'pwsh' || tool.id === 'powershell') {
    spawnDetached('cmd.exe', ['/c', 'start', '""', tool.executable, '-NoExit'], resolved, false);
    return;
  }

  if (tool.id === 'cmd') {
    spawnDetached('cmd.exe', ['/c', 'start', '""', 'cmd.exe'], resolved, false);
    return;
  }

  await openTerminalAt(resolved);
}
