import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultExecCommand,
  executeCreateProject,
  type ScaffolderFsOps
} from '../../../src/main/creator/projectScaffolder';
import type { CreateProjectInput, CreateProjectProgressEvent } from '../../../src/shared/types';

function createMemoryFs(initialDirs: string[] = ['C:\\Projects'], initialFiles: Record<string, string> = {}): {
  fsOps: ScaffolderFsOps;
  dirs: Set<string>;
  files: Map<string, string>;
} {
  const dirs = new Set<string>(initialDirs);
  const files = new Map<string, string>(Object.entries(initialFiles));

  const fsOps: ScaffolderFsOps = {
    existsSync: (p) => dirs.has(p) || files.has(p),
    mkdirSync: (p) => {
      dirs.add(p);
    },
    rmSync: (p) => {
      dirs.delete(p);
      files.delete(p);
    },
    readFileSync: (p) => files.get(p) ?? '',
    writeFileSync: (p, content) => {
      files.set(p, content);
    }
  };

  return { fsOps, dirs, files };
}

describe('projectScaffolder', () => {
  it('fails gracefully when parentDir does not exist or targetDir already exists', async () => {
    const { fsOps } = createMemoryFs(['C:\\Projects', path.join('C:\\Projects', 'existing')]);
    const events: CreateProjectProgressEvent[] = [];

    const missingParent = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'app',
        parentDir: 'C:\\DoesNotExist',
        stack: {
          platform: 'backend',
          language: 'typescript',
          frameworkId: 'hono',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      (e) => events.push(e),
      { fsOps }
    );
    expect(missingParent.ok).toBe(false);
    expect(missingParent.error).toContain('não existe');

    const alreadyExists = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'existing',
        parentDir: 'C:\\Projects',
        stack: {
          platform: 'backend',
          language: 'typescript',
          frameworkId: 'hono',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      undefined,
      { fsOps }
    );
    expect(alreadyExists.ok).toBe(false);
    expect(alreadyExists.error).toContain('Já existe');
  });

  it('clones GitHub template, removes .git, updates package.json name, installs deps and runs git init', async () => {
    const targetDir = path.join('C:\\Projects', 'my-tpl');
    const { fsOps, dirs, files } = createMemoryFs(['C:\\Projects']);
    const execCommand = vi.fn(async (cmd: string, _cwd: string, onChunk: (s: 'stdout' | 'stderr', c: string) => void) => {
      onChunk('stdout', `ran ${cmd}\n`);
      if (cmd.startsWith('git clone')) {
        dirs.add(targetDir);
        dirs.add(path.join(targetDir, '.git'));
        files.set(path.join(targetDir, 'package.json'), JSON.stringify({ name: 'old-name', version: '1.0.0' }));
      }
      return { exitCode: 0 };
    });

    const input: CreateProjectInput = {
      mode: 'github-template',
      projectName: 'my-tpl',
      parentDir: 'C:\\Projects',
      initGit: true,
      installDeps: true,
      packageManager: 'npm',
      templateRepo: {
        fullName: 'KaneeSell/template-next-prisma-auth-mui',
        cloneUrl: 'https://github.com/KaneeSell/template-next-prisma-auth-mui.git',
        defaultBranch: 'main'
      }
    };

    const events: CreateProjectProgressEvent[] = [];
    const res = await executeCreateProject(input, (e) => events.push(e), { execCommand, fsOps });

    expect(res.ok).toBe(true);
    expect(dirs.has(path.join(targetDir, '.git'))).toBe(false);
    expect(JSON.parse(files.get(path.join(targetDir, 'package.json'))!).name).toBe('my-tpl');
    expect(events.some((e) => e.phase === 'done')).toBe(true);
  });

  it('handles clone failure, invalid template package.json, and post-clone command failure', async () => {
    const { fsOps, dirs, files } = createMemoryFs(['C:\\Projects']);
    const failClone = vi.fn(async () => ({ exitCode: 128 }));
    const resCloneFail = await executeCreateProject(
      {
        mode: 'public-template',
        projectName: 'bad-clone',
        parentDir: 'C:\\Projects',
        templateRepo: { fullName: 'a/b', cloneUrl: 'https://x/y.git', defaultBranch: 'main' }
      },
      undefined,
      { execCommand: failClone, fsOps }
    );
    expect(resCloneFail.ok).toBe(false);

    const targetDir = path.join('C:\\Projects', 'bad-install');
    let call = 0;
    const failInstall = vi.fn(async (_cmd: string, _cwd: string, onChunk: (s: 'stdout' | 'stderr', c: string) => void) => {
      call += 1;
      if (call === 1) {
        dirs.add(targetDir);
        files.set(path.join(targetDir, 'package.json'), '{broken-json');
        return { exitCode: 0 };
      }
      onChunk('stderr', 'install error\n');
      return { exitCode: 1 };
    });

    const resInstallFail = await executeCreateProject(
      {
        mode: 'github-template',
        projectName: 'bad-install',
        parentDir: 'C:\\Projects',
        installDeps: true,
        templateRepo: { fullName: 'a/b', cloneUrl: 'https://x/y.git', defaultBranch: 'main' }
      },
      undefined,
      { execCommand: failInstall, fsOps }
    );
    expect(resInstallFail.ok).toBe(false);
    expect(resInstallFail.error).toContain('Falha na etapa');
  });

  it('scaffolds stack with parent CLI + generated files + project commands, and handles errors', async () => {
    const { fsOps, files } = createMemoryFs(['C:\\Projects']);
    const execOk = vi.fn(async (cmd: string, _cwd: string, onChunk: (s: 'stdout' | 'stderr', c: string) => void) => {
      onChunk('stdout', `ok: ${cmd}\n`);
      return { exitCode: 0 };
    });

    const okRes = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'next-sqlite',
        parentDir: 'C:\\Projects',
        initGit: true,
        installDeps: true,
        stack: {
          platform: 'web',
          language: 'typescript',
          frameworkId: 'nextjs',
          database: 'sqlite',
          orm: 'prisma',
          styling: 'tailwind',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      undefined,
      { execCommand: okResExec(execOk), fsOps }
    );
    expect(okRes.ok).toBe(true);
    expect(files.has(path.join('C:\\Projects', 'next-sqlite', 'prisma', 'schema.prisma'))).toBe(true);

    // Parent scaffold failure
    const failParent = vi.fn(async () => ({ exitCode: 2 }));
    const resParentFail = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'fail-next',
        parentDir: 'C:\\Projects',
        stack: {
          platform: 'web',
          language: 'typescript',
          frameworkId: 'nextjs',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      undefined,
      { execCommand: failParent, fsOps }
    );
    expect(resParentFail.ok).toBe(false);
    expect(resParentFail.error).toContain('Falha ao criar estrutura base');

    // Direct-file stack (no parent scaffold) + command failure
    const failCmd = vi.fn(async () => ({ exitCode: 3 }));
    const resCmdFail = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'fail-hono',
        parentDir: 'C:\\Projects',
        installDeps: true,
        stack: {
          platform: 'backend',
          language: 'typescript',
          frameworkId: 'hono',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      undefined,
      { execCommand: failCmd, fsOps }
    );
    expect(resCmdFail.ok).toBe(false);
    expect(resCmdFail.error).toContain('Falha na etapa');

    // Caught validation throw inside try/catch (Error and non-Error)
    const invalidRes = await executeCreateProject({
      mode: 'stack',
      projectName: 'x',
      parentDir: ''
    });
    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.error).toContain('pasta de destino');

    const nonErrorThrow = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'x',
        parentDir: 'C:\\Projects',
        stack: {
          platform: 'backend',
          language: 'python',
          frameworkId: 'django',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      undefined,
      {
        fsOps: {
          ...fsOps,
          existsSync: () => {
            throw 'string-failure';
          }
        }
      }
    );
    expect(nonErrorThrow.ok).toBe(false);
    expect(nonErrorThrow.error).toBe('string-failure');

    // Clone without .git and without package.json
    const cleanTplRes = await executeCreateProject(
      {
        mode: 'public-template',
        projectName: 'clean-tpl',
        parentDir: 'C:\\Projects',
        templateRepo: { fullName: 'a/b', cloneUrl: 'https://x/y.git', defaultBranch: 'main' }
      },
      undefined,
      { execCommand: okResExec(execOk), fsOps }
    );
    expect(cleanTplRes.ok).toBe(true);

    // Stack with 0 generated files (django + none) where parent command creates targetDir
    const djangoDir = path.join('C:\\Projects', 'django-app');
    const execCreatesDir = vi.fn(async () => {
      fsOps.mkdirSync(djangoDir, { recursive: true });
      return { exitCode: 0 };
    });
    const djangoRes = await executeCreateProject(
      {
        mode: 'stack',
        projectName: 'django-app',
        parentDir: 'C:\\Projects',
        stack: {
          platform: 'backend',
          language: 'python',
          frameworkId: 'django',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          packageManager: 'npm',
          versionMode: 'latest'
        }
      },
      undefined,
      { execCommand: okResExec(execCreatesDir), fsOps }
    );
    expect(djangoRes.ok).toBe(true);
  });

  it('executes real shell command via defaultExecCommand', async () => {
    const chunks: string[] = [];
    const res = await defaultExecCommand('node -e "console.log(123); console.error(456)"', process.cwd(), (_s, c) => {
      chunks.push(c);
    });
    expect(res.exitCode).toBe(0);
    expect(chunks.join('')).toContain('123');
    expect(chunks.join('')).toContain('456');

    const errRes = await defaultExecCommand(
      'node -v',
      'Z:\\nonexistent-cwd-for-nexus-test-12345',
      (_s, c) => {
        chunks.push(c);
      }
    );
    expect(errRes.exitCode).toBe(1);

    const failExitRes = await defaultExecCommand(
      'node -e "process.exit(2)"',
      process.cwd(),
      (_s, c) => {
        chunks.push(c);
      }
    );
    expect(failExitRes.exitCode).toBe(1);
  });
});

function okResExec(fn: ReturnType<typeof vi.fn>) {
  return fn as unknown as Parameters<typeof executeCreateProject>[2] extends { execCommand?: infer T } ? T : never;
}
