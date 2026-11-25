import { describe, expect, it } from 'vitest';
import {
  formatCliHelp,
  isTerminalOnlyArgs,
  parseCliArgs,
  shouldLaunchTui
} from '../../src/shared/cliArgs';

describe('parseCliArgs', () => {
  it('returns default values when called with no arguments', () => {
    expect(parseCliArgs([])).toEqual({
      subcommand: null,
      targetPath: null,
      runTarget: null,
      exportTarget: null,
      exportFormat: null,
      outputPath: null,
      newWindow: false,
      gui: false,
      sync: false,
      project: null,
      tab: null,
      depth: null,
      openConfig: false,
      theme: null,
      runScript: null,
      runPipeline: null,
      headless: false,
      dryRun: false,
      continueOnError: false,
      envProfile: null,
      list: false,
      showScripts: false,
      showPipelines: false,
      historyLimit: null,
      json: false,
      dbPath: false,
      doctor: false,
      version: false,
      help: false
    });
  });

  it('parses all flags, aliases, inline values, and ignores empty/unknown tokens', () => {
    const parsed = parseCliArgs([
      '',
      '-h',
      '-v',
      '-n',
      '-g',
      '-s',
      '--refresh',
      '-p=api',
      '--tab',
      'PIPELINES',
      '--depth',
      '99',
      '--config',
      '--theme',
      'LIGHT',
      '-r',
      'dev',
      '-P=CI/CD',
      '--no-ui',
      '--dry-run',
      '--continue-on-error',
      '--env',
      'staging',
      '-l',
      '--scripts',
      '--pipelines',
      '--history=25',
      '--json',
      '--db-path',
      '--doctor',
      '--unknown-flag',
      './workspace'
    ]);

    expect(parsed).toMatchObject({
      help: true,
      version: true,
      newWindow: true,
      gui: true,
      sync: true,
      project: 'api',
      tab: 'pipelines',
      depth: 5,
      openConfig: true,
      theme: 'light',
      runScript: 'dev',
      runPipeline: 'CI/CD',
      headless: true,
      dryRun: true,
      continueOnError: true,
      envProfile: 'staging',
      list: true,
      showScripts: true,
      showPipelines: true,
      historyLimit: 25,
      json: true,
      dbPath: true,
      doctor: true,
      targetPath: './workspace'
    });
  });

  it('parses long flag forms and validates tab, theme, depth, and history edge cases', () => {
    expect(parseCliArgs(['--help', '--version', '--new-window', '--gui', '--sync'])).toMatchObject({
      help: true,
      version: true,
      newWindow: true,
      gui: true,
      sync: true
    });

    expect(
      parseCliArgs([
        '--project',
        'web',
        '--tab=scripts',
        '--depth=0',
        '--theme=dark',
        '--run',
        'build',
        '--pipeline',
        'release',
        '--headless',
        '--list'
      ])
    ).toMatchObject({
      project: 'web',
      tab: 'scripts',
      depth: 1,
      theme: 'dark',
      runScript: 'build',
      runPipeline: 'release',
      headless: true,
      list: true
    });

    expect(parseCliArgs(['--tab=history']).tab).toBe('history');
    expect(parseCliArgs(['-t', 'scripts']).tab).toBe('scripts');
    expect(parseCliArgs(['--tab=invalid', '--theme=sepia', '--depth=abc']).depth).toBeNull();
    expect(parseCliArgs(['--tab', '--theme', '--depth']).tab).toBeNull();
    expect(parseCliArgs(['--project', '--run', '--pipeline', '--env']).project).toBeNull();
    expect(parseCliArgs(['--project', '-v']).project).toBeNull();

    expect(parseCliArgs(['--history']).historyLimit).toBe(10);
    expect(parseCliArgs(['--history', '5']).historyLimit).toBe(5);
    expect(parseCliArgs(['--history', '0']).historyLimit).toBe(1);
    expect(parseCliArgs(['--history=abc']).historyLimit).toBe(10);
    expect(parseCliArgs(['--history', '--json']).historyLimit).toBe(10);
  });

  it('parses subcommands and positional arguments', () => {
    expect(parseCliArgs(['run', 'CI/CD', './apps/api'])).toMatchObject({
      subcommand: 'run',
      runTarget: 'CI/CD',
      targetPath: './apps/api'
    });
    expect(parseCliArgs(['run'])).toMatchObject({
      subcommand: 'run',
      runTarget: null,
      targetPath: null
    });

    expect(parseCliArgs(['ls', './repo'])).toMatchObject({ subcommand: 'ls', targetPath: './repo' });
    expect(parseCliArgs(['ls'])).toMatchObject({ subcommand: 'ls', targetPath: null });
    expect(parseCliArgs(['pin', './repo'])).toMatchObject({ subcommand: 'pin', targetPath: './repo' });
    expect(parseCliArgs(['projects', './repo'])).toMatchObject({
      subcommand: 'projects',
      targetPath: './repo'
    });

    expect(parseCliArgs(['scripts', 'api'])).toMatchObject({
      subcommand: 'scripts',
      project: 'api'
    });
    expect(parseCliArgs(['pipelines', '-p', 'web', 'ignored'])).toMatchObject({
      subcommand: 'pipelines',
      project: 'web'
    });
    expect(parseCliArgs(['history'])).toMatchObject({
      subcommand: 'history',
      project: null
    });
    expect(parseCliArgs(['doctor']).subcommand).toBe('doctor');
    expect(parseCliArgs(['tui']).subcommand).toBe('tui');

    expect(
      parseCliArgs(['export', 'CI/CD', './dist/ci.ps1', '-f', '.PS1'])
    ).toMatchObject({
      subcommand: 'export',
      exportTarget: 'CI/CD',
      exportFormat: 'ps1',
      outputPath: './dist/ci.ps1'
    });
    expect(
      parseCliArgs(['export', 'Deploy', '--format=sh', '-o', './deploy.sh'])
    ).toMatchObject({
      subcommand: 'export',
      exportTarget: 'Deploy',
      exportFormat: 'sh',
      outputPath: './deploy.sh'
    });
    expect(
      parseCliArgs(['export', '--format=bat', '--out', './ci.bat'])
    ).toMatchObject({
      subcommand: 'export',
      exportTarget: null,
      exportFormat: 'bat',
      outputPath: './ci.bat'
    });
    expect(
      parseCliArgs(['export', '-f', 'invalid', '--format', '--out'])
    ).toMatchObject({
      subcommand: 'export',
      exportFormat: null,
      outputPath: null
    });
  });
});

describe('isTerminalOnlyArgs & shouldLaunchTui', () => {
  it('identifies terminal-only arguments and dry-run behavior', () => {
    expect(isTerminalOnlyArgs(parseCliArgs(['--help']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--version']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--db-path']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--doctor']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--list']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--scripts']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--pipelines']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--history']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--headless']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['projects']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['scripts']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['pipelines']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['history']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['run', 'build']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['ls']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['pin']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['doctor']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['export', 'CI/CD']))).toBe(true);

    expect(isTerminalOnlyArgs(parseCliArgs(['--dry-run']))).toBe(true);
    expect(isTerminalOnlyArgs(parseCliArgs(['--dry-run', '--gui']))).toBe(false);
    expect(isTerminalOnlyArgs(parseCliArgs(['.']))).toBe(false);
  });

  it('decides when to launch TUI vs GUI', () => {
    expect(shouldLaunchTui(parseCliArgs([]))).toBe(true);
    expect(shouldLaunchTui(parseCliArgs(['--sync']))).toBe(true);
    expect(shouldLaunchTui(parseCliArgs(['tui']))).toBe(true);

    expect(shouldLaunchTui(parseCliArgs(['--gui']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['projects']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['.']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--new-window']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--project', 'api']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--tab', 'scripts']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--depth', '2']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--config']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--theme', 'dark']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--run', 'dev']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--pipeline', 'ci']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--continue-on-error']))).toBe(false);
    expect(shouldLaunchTui(parseCliArgs(['--env', 'prod']))).toBe(false);
  });

  it('formats CLI help text', () => {
    const help = formatCliHelp();
    expect(help).toContain('Nexus CLI');
    expect(help).toContain('nexus projects');
    expect(help).toContain('export <pipeline>');
    expect(help).toContain('--sync');
  });
});
