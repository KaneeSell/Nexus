import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNexusVersion, resolvePackageVersion } from '../../src/shared/version';

const createdDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ver-test-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllGlobals();
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('resolvePackageVersion & getNexusVersion', () => {
  it('returns injected build-time version when provided or defined globally', () => {
    expect(resolvePackageVersion({ injectedVersion: ' 1.2.3 ' })).toBe('1.2.3');

    vi.stubGlobal('__NEXUS_VERSION__', '9.8.7');
    expect(getNexusVersion()).toBe('9.8.7');
  });

  it('falls back to candidate package.json files when injected version is empty', () => {
    const dir = makeTempDir();
    const missingPkg = path.join(dir, 'missing', 'package.json');
    const invalidPkg = path.join(dir, 'invalid.json');
    const blankPkg = path.join(dir, 'blank.json');
    const validPkg = path.join(dir, 'valid.json');

    fs.writeFileSync(invalidPkg, '{ broken json', 'utf-8');
    fs.writeFileSync(blankPkg, JSON.stringify({ version: '   ' }), 'utf-8');
    fs.writeFileSync(validPkg, JSON.stringify({ version: ' 2.4.6 ' }), 'utf-8');

    expect(
      resolvePackageVersion({
        injectedVersion: '   ',
        fallbackPaths: [missingPkg, invalidPkg, blankPkg, validPkg]
      })
    ).toBe('2.4.6');
  });

  it('returns 0.0.0 when no fallback candidate has a valid version', () => {
    const dir = makeTempDir();
    const noVerPkg = path.join(dir, 'nover.json');
    fs.writeFileSync(noVerPkg, JSON.stringify({ name: 'x' }), 'utf-8');

    expect(
      resolvePackageVersion({
        injectedVersion: '',
        fallbackPaths: [noVerPkg]
      })
    ).toBe('0.0.0');
  });

  it('resolves version from repo package.json in dev/test when __NEXUS_VERSION__ is unset', () => {
    const repoPkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')
    ) as { version: string };
    expect(getNexusVersion()).toBe(repoPkg.version);
  });
});
