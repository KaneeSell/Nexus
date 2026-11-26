import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';
import {
  checkCreatorPreflight,
  defaultRunVersionCheck,
  getRequiredToolsForInput
} from '../../../src/main/creator/preflightCheck';
import type { CreateProjectInput } from '../../../src/shared/types';

function stackInput(
  language: NonNullable<CreateProjectInput['stack']>['language'],
  overrides: Partial<CreateProjectInput> = {}
): CreateProjectInput {
  return {
    mode: 'stack',
    projectName: 'demo',
    parentDir: 'C:\\P',
    installDeps: true,
    initGit: true,
    stack: {
      platform: 'backend',
      language,
      frameworkId: 'hono',
      database: 'none',
      orm: 'none',
      styling: 'none',
      auth: 'none',
      packageManager: 'pnpm',
      versionMode: 'latest'
    },
    ...overrides
  };
}

describe('preflightCheck', () => {
  it('resolves required tools for template and all language modes', () => {
    expect(
      getRequiredToolsForInput({
        mode: 'github-template',
        projectName: 'tpl',
        parentDir: 'C:\\P',
        installDeps: true
      }).map((t) => t.tool)
    ).toEqual(['git', 'npm']);

    expect(
      getRequiredToolsForInput({
        mode: 'public-template',
        projectName: 'tpl',
        parentDir: 'C:\\P',
        installDeps: false
      }).map((t) => t.tool)
    ).toEqual(['git']);

    expect(getRequiredToolsForInput(stackInput('typescript')).map((t) => t.tool)).toEqual([
      'node',
      'pnpm',
      'git'
    ]);
    expect(
      getRequiredToolsForInput(stackInput('javascript', { installDeps: false, initGit: false })).map(
        (t) => t.tool
      )
    ).toEqual(['node']);
    expect(getRequiredToolsForInput(stackInput('python', { initGit: false })).map((t) => t.tool)).toEqual([
      'python'
    ]);
    expect(getRequiredToolsForInput(stackInput('php', { initGit: false })).map((t) => t.tool)).toEqual([
      'composer'
    ]);
    expect(getRequiredToolsForInput(stackInput('go', { initGit: false })).map((t) => t.tool)).toEqual([
      'go'
    ]);
    expect(getRequiredToolsForInput(stackInput('rust', { initGit: false })).map((t) => t.tool)).toEqual([
      'cargo'
    ]);
    expect(getRequiredToolsForInput(stackInput('csharp', { initGit: false })).map((t) => t.tool)).toEqual([
      'dotnet'
    ]);
    expect(getRequiredToolsForInput(stackInput('dart', { initGit: false })).map((t) => t.tool)).toEqual([
      'flutter'
    ]);
    expect(getRequiredToolsForInput(stackInput('java', { initGit: false }))).toEqual([]);
    expect(
      getRequiredToolsForInput({ mode: 'stack', projectName: 'x', parentDir: 'C:\\P' })
    ).toEqual([]);
  });

  it('checks tool availability via injectable runner and defaultRunVersionCheck', async () => {
    const statuses = await checkCreatorPreflight(stackInput('typescript'), {
      runVersionCheck: async (tool) => (tool === 'node' ? 'v22.0.0' : null)
    });

    expect(statuses).toEqual([
      { tool: 'node', available: true, version: 'v22.0.0', required: true },
      { tool: 'pnpm', available: false, version: null, required: true },
      { tool: 'git', available: false, version: null, required: true }
    ]);

    const realNode = await defaultRunVersionCheck('node');
    expect(realNode).toMatch(/^v\d+/);

    const missingTool = await defaultRunVersionCheck('definitely-missing-nexus-tool-xyz-999');
    expect(missingTool).toBeNull();

    // Cover child error event and timeout branches
    const errChild = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    errChild.stdout = new EventEmitter();
    errChild.stderr = new EventEmitter();
    errChild.kill = () => {};
    const errPromise = defaultRunVersionCheck('node', {
      spawnFn: (() => errChild) as never
    });
    errChild.emit('error', new Error('spawn failed'));
    expect(await errPromise).toBeNull();

    let killed = false;
    const slowChild = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    slowChild.stdout = new EventEmitter();
    slowChild.stderr = new EventEmitter();
    slowChild.kill = () => {
      killed = true;
    };
    const timeoutRes = await defaultRunVersionCheck('node', {
      timeoutMs: 10,
      spawnFn: (() => slowChild) as never
    });
    expect(timeoutRes).toBeNull();
    expect(killed).toBe(true);

    // Cover empty stdout with exit code 0 ('ok' fallback) + stderr chunk
    const emptyChild = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    emptyChild.stdout = new EventEmitter();
    emptyChild.stderr = new EventEmitter();
    emptyChild.kill = () => {};
    const okFallbackPromise = defaultRunVersionCheck('node', {
      spawnFn: (() => emptyChild) as never
    });
    emptyChild.stderr.emit('data', Buffer.from('  '));
    emptyChild.emit('close', 0);
    expect(await okFallbackPromise).toBe('ok');
  });

  it('handles go version arg and default checkCreatorPreflight deps', async () => {
    const goVer = await defaultRunVersionCheck('go');
    expect(goVer === null || goVer.includes('go')).toBe(true);

    const defaultRes = await checkCreatorPreflight({
      mode: 'stack',
      projectName: 'x',
      parentDir: 'C:\\P',
      installDeps: false,
      stack: {
        platform: 'cli',
        language: 'javascript',
        frameworkId: 'node-cli',
        database: 'none',
        orm: 'none',
        styling: 'none',
        auth: 'none',
        packageManager: 'npm',
        versionMode: 'latest'
      }
    });
    expect(defaultRes[0].tool).toBe('node');
    expect(defaultRes[0].available).toBe(true);
  });
});
