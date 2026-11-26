import { spawn } from 'child_process';
import type { CreateProjectInput, PreflightToolStatus } from '../../shared/types';

export interface PreflightDeps {
  runVersionCheck?: (tool: string) => Promise<string | null>;
}

export function defaultRunVersionCheck(
  tool: string,
  opts: { timeoutMs?: number; spawnFn?: typeof spawn } = {}
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 3500;
  const spawnFn = opts.spawnFn ?? spawn;
  return new Promise((resolve) => {
    const args = tool === 'go' ? ['version'] : ['--version'];
    const child = spawnFn(tool, args, {
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, timeoutMs);

    child.stdout.on('data', (buf: Buffer) => {
      output += buf.toString('utf-8');
    });
    child.stderr.on('data', (buf: Buffer) => {
      output += buf.toString('utf-8');
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve(null);
        return;
      }
      const firstLine = output.split(/\r?\n/)[0]?.trim() || 'ok';
      resolve(firstLine);
    });
  });
}

export function getRequiredToolsForInput(
  input: CreateProjectInput
): Array<{ tool: string; required: boolean }> {
  const map = new Map<string, boolean>();
  const add = (tool: string, required: boolean): void => {
    const prev = map.get(tool);
    map.set(tool, Boolean(prev) || required);
  };

  if (input.mode === 'github-template' || input.mode === 'public-template') {
    add('git', true);
    if (input.installDeps) {
      add(input.packageManager ?? 'npm', true);
    }
    return Array.from(map.entries()).map(([tool, required]) => ({ tool, required }));
  }

  const stack = input.stack;
  if (stack) {
    const lang = stack.language;
    if (lang === 'typescript' || lang === 'javascript') {
      add('node', true);
      if (input.installDeps !== false) {
        add(stack.packageManager, true);
      }
    } else if (lang === 'python') {
      add('python', true);
    } else if (lang === 'php') {
      add('composer', true);
    } else if (lang === 'go') {
      add('go', true);
    } else if (lang === 'rust') {
      add('cargo', true);
    } else if (lang === 'csharp') {
      add('dotnet', true);
    } else if (lang === 'dart') {
      add('flutter', true);
    }
  }

  if (input.initGit) {
    add('git', true);
  }

  return Array.from(map.entries()).map(([tool, required]) => ({ tool, required }));
}

export async function checkCreatorPreflight(
  input: CreateProjectInput,
  deps: PreflightDeps = {}
): Promise<PreflightToolStatus[]> {
  const runVersionCheck = deps.runVersionCheck ?? defaultRunVersionCheck;
  const tools = getRequiredToolsForInput(input);

  return Promise.all(
    tools.map(async ({ tool, required }) => {
      const version = await runVersionCheck(tool);
      return {
        tool,
        available: version !== null,
        version,
        required
      };
    })
  );
}
