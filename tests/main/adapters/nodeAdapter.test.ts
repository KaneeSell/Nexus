import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NodePackageAdapter } from '../../../src/main/adapters/nodeAdapter';

const createdDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-adapter-test-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('NodePackageAdapter', () => {
  const adapter = new NodePackageAdapter();

  it('detects whether package.json exists', async () => {
    const dir = makeTempDir();
    expect(await adapter.detect(dir)).toBe(false);

    fs.writeFileSync(path.join(dir, 'package.json'), '{}', 'utf-8');
    expect(await adapter.detect(dir)).toBe(true);
  });

  it('detects packageManager from package.json field', async () => {
    const cases = [
      ['pnpm@9.0.0', 'pnpm'],
      ['yarn@4.1.0', 'yarn'],
      ['bun@1.1.0', 'bun'],
      ['npm@10.5.0', 'npm']
    ] as const;

    for (const [pmField, expected] of cases) {
      const dir = makeTempDir();
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'app',
          version: '1.2.3',
          description: 'desc',
          packageManager: pmField,
          scripts: { dev: 'vite', build: 'vite build' }
        }),
        'utf-8'
      );

      const info = await adapter.inspect(dir);
      expect(info).toEqual({
        name: 'app',
        path: dir,
        adapterType: 'node',
        packageManager: expected,
        version: '1.2.3',
        description: 'desc',
        hasNodeModules: false,
        scripts: [
          { name: 'dev', command: 'vite' },
          { name: 'build', command: 'vite build' }
        ]
      });
    }
  });

  it('detects packageManager from lockfiles and defaults to npm', async () => {
    const lockCases = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['bun.lockb', 'bun'],
      ['bun.lock', 'bun'],
      [null, 'npm']
    ] as const;

    for (const [lockFile, expected] of lockCases) {
      const dir = makeTempDir();
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          lockFile === null ? { name: '   ' } : { name: '   ', packageManager: 'unknown@1.0.0' }
        ),
        'utf-8'
      );
      if (lockFile) {
        fs.writeFileSync(path.join(dir, lockFile), '', 'utf-8');
      }
      fs.mkdirSync(path.join(dir, 'node_modules'));

      const info = await adapter.inspect(dir);
      expect(info).toMatchObject({
        name: path.basename(dir),
        packageManager: expected,
        hasNodeModules: true,
        scripts: []
      });
    }
  });

  it('returns null when package.json is missing or invalid JSON', async () => {
    const dir = makeTempDir();
    expect(await adapter.inspect(dir)).toBeNull();

    fs.writeFileSync(path.join(dir, 'package.json'), '{ invalid json', 'utf-8');
    expect(await adapter.inspect(dir)).toBeNull();
  });
});
