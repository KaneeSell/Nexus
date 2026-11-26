import { expect, test } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const cliEntry = path.resolve('out/cli/index.js');

function runCli(args: string[], dbPath: string, cwd?: string): string {
  const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
  return execFileSync(process.execPath, [cliEntry, ...args], {
    cwd: cwd ?? process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: dbUrl
    },
    encoding: 'utf-8'
  });
}

test.describe('Nexus CLI E2E', () => {
  let tempRoot: string;
  let dbPath: string;
  let sampleProjectDir: string;

  test.beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-e2e-cli-'));
    dbPath = path.join(tempRoot, 'cli-e2e.db');
    sampleProjectDir = path.join(tempRoot, 'sample-api');
    fs.mkdirSync(sampleProjectDir, { recursive: true });
    fs.writeFileSync(
      path.join(sampleProjectDir, 'package.json'),
      JSON.stringify(
        {
          name: 'sample-api',
          version: '1.2.3',
          scripts: {
            dev: 'node index.js',
            test: 'echo ok'
          }
        },
        null,
        2
      )
    );
  });

  test.afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('prints package version matching package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8')) as {
      version: string;
    };
    const out = runCli(['--version'], dbPath).trim();
    expect(out).toContain(pkg.version);
  });

  test('prints help with core subcommands', () => {
    const out = runCli(['--help'], dbPath);
    expect(out).toContain('projects');
    expect(out).toContain('scripts');
    expect(out).toContain('pipelines');
    expect(out).toContain('export');
    expect(out).toContain('doctor');
  });

  test('scans a project with ls --json and syncs with projects --sync --json', () => {
    const lsOut = runCli(['ls', sampleProjectDir, '--json'], dbPath);
    const lsJson = JSON.parse(lsOut) as { projects: Array<{ name: string; scripts: Array<{ name: string }> }> };
    expect(lsJson.projects[0]?.name).toBe('sample-api');
    expect(lsJson.projects[0]?.scripts.map((s) => s.name)).toContain('dev');

    const syncOut = runCli(['projects', '--sync', '--json'], dbPath, sampleProjectDir);
    const synced = JSON.parse(syncOut) as { projects?: Array<{ name: string }> };
    expect(synced.projects?.some((p) => p.name === 'sample-api')).toBe(true);
  });

  test('runs doctor command cleanly', () => {
    const out = runCli(['doctor'], dbPath);
    expect(out).toContain('Node.js');
  });
});
