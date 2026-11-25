import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generatePipelineScript,
  normalizeExportOptions,
  resolveExportStepCommand,
  suggestExportFilename,
  type PipelineExportInput
} from '../../../src/main/engine/pipelineExporter';

const createdDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-export-test-'));
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

function makeInput(overrides: Partial<PipelineExportInput> = {}): PipelineExportInput {
  return {
    pipelineName: 'CI/CD (Prod)',
    description: 'Build & test pipeline',
    projectName: 'nexus-app',
    projectPath: 'F:\\Projects\\nexus-app',
    packageManager: 'npm',
    steps: [
      {
        name: 'Typecheck',
        kind: 'script',
        command: 'typecheck',
        onErrorAction: 'stop',
        onSuccessCommand: 'echo "typecheck ok"',
        enabled: true
      },
      {
        name: 'Disabled Step',
        kind: 'script',
        command: 'noop',
        onErrorAction: 'stop',
        enabled: false
      },
      {
        name: '   ',
        kind: 'command',
        command: 'echo Lint & Check (100%)',
        onErrorAction: 'continue',
        enabled: true
      },
      {
        name: 'Build',
        kind: 'script',
        command: 'build',
        onErrorAction: 'run_command',
        onErrorCommand: 'echo fallback',
        enabled: true
      },
      {
        name: 'Fallback No Cmd',
        kind: 'command',
        command: 'echo final',
        onErrorAction: 'run_command',
        onErrorCommand: '   ',
        onSuccessCommand: '   ',
        enabled: true
      },
      {
        name: 'Plain Stop Step',
        kind: 'script',
        command: 'test',
        onErrorAction: 'stop',
        enabled: true
      }
    ],
    ...overrides
  };
}

describe('normalizeExportOptions, suggestExportFilename & resolveExportStepCommand', () => {
  it('normalizes defaults for rich and raw styles and explicit overrides', () => {
    expect(normalizeExportOptions()).toEqual({
      style: 'rich',
      confirmBeforeRun: true,
      pauseOnFinish: true,
      includeColors: true,
      useProjectDir: true,
      saveLogFile: false,
      envProfile: null,
      customHeader: null
    });

    expect(
      normalizeExportOptions({
        style: 'raw',
        envProfile: '  staging  ',
        customHeader: '   '
      })
    ).toEqual({
      style: 'raw',
      confirmBeforeRun: false,
      pauseOnFinish: false,
      includeColors: false,
      useProjectDir: true,
      saveLogFile: false,
      envProfile: 'staging',
      customHeader: null
    });
  });

  it('generates sanitized filenames with the requested extension', () => {
    expect(suggestExportFilename('CI/CD Produção!', 'bat')).toBe('ci-cd-producao.bat');
    expect(suggestExportFilename('Deploy Staging', 'ps1')).toBe('deploy-staging.ps1');
    expect(suggestExportFilename('!!!', 'sh')).toBe('pipeline.sh');
  });

  it('resolves script and command steps across package managers and formats', () => {
    expect(resolveExportStepCommand({ kind: 'command', command: '  echo hi  ' }, 'npm', 'bat')).toBe(
      'echo hi'
    );
    expect(resolveExportStepCommand({ kind: 'script', command: 'build' }, 'pnpm', 'bat')).toBe(
      'pnpm run build'
    );
    expect(resolveExportStepCommand({ kind: 'script', command: 'build' }, 'yarn', 'ps1')).toBe(
      'yarn build'
    );
    expect(resolveExportStepCommand({ kind: 'script', command: 'build' }, 'bun', 'sh')).toBe(
      'bun run build'
    );
    expect(resolveExportStepCommand({ kind: 'script', command: 'build' }, 'npm', 'bat')).toBe(
      'npm.cmd run build'
    );
    expect(resolveExportStepCommand({ kind: 'script', command: 'build' }, 'npm', 'sh')).toBe(
      'npm run build'
    );
  });
});

describe('generatePipelineScript (rich & raw)', () => {
  it('throws when no enabled steps exist', () => {
    expect(() =>
      generatePipelineScript(
        makeInput({
          steps: [
            {
              name: 'Off',
              kind: 'command',
              command: 'echo off',
              onErrorAction: 'stop',
              enabled: false
            }
          ]
        }),
        'bat'
      )
    ).toThrow(/nenhuma etapa habilitada/i);
  });

  it('generates rich and raw .bat scripts with all customization options', () => {
    const richDefault = generatePipelineScript(makeInput(), 'bat');
    expect(richDefault.includes('\r\n')).toBe(true);
    expect(richDefault).toContain('O QUE ESTE SCRIPT FAZ');
    expect(richDefault).toContain('echo prompt $E');
    expect(richDefault).toContain('echo Lint ^& Check ^(100%%^)');
    expect(richDefault).toContain('Descricao:');

    const richCustom = generatePipelineScript(makeInput({ description: '' }), 'bat', {
      style: 'rich',
      confirmBeforeRun: false,
      pauseOnFinish: false,
      includeColors: false,
      useProjectDir: false,
      saveLogFile: true,
      envProfile: 'staging',
      customHeader: 'Pre-deploy'
    });
    expect(richCustom).not.toContain('echo prompt $E');
    expect(richCustom).not.toContain('pushd');
    expect(richCustom).toContain('Nota     :');
    expect(richCustom).toContain('Pre-deploy');
    expect(richCustom).toContain('Perfil   :');
    expect(richCustom).toContain('staging');
    expect(richCustom).toContain('>> "%LOG_FILE%" 2>&1');
    expect(richCustom).toContain('SKIP_CONFIRM=1');
    expect(richCustom).toContain('NO_PAUSE=1');

    const rawMinimal = generatePipelineScript(makeInput(), 'bat', {
      style: 'raw',
      useProjectDir: false
    });
    expect(rawMinimal).toContain('call npm.cmd run typecheck');
    expect(rawMinimal).not.toContain('O QUE ESTE SCRIPT FAZ');
    expect(rawMinimal).not.toContain('pushd');
    expect(rawMinimal).not.toContain('pause');

    const rawFull = generatePipelineScript(makeInput(), 'bat', {
      style: 'raw',
      confirmBeforeRun: true,
      pauseOnFinish: true,
      useProjectDir: true,
      saveLogFile: true,
      envProfile: 'prod',
      customHeader: 'Raw header'
    });
    expect(rawFull).toContain('REM Raw header');
    expect(rawFull).toContain('pushd');
    expect(rawFull).toContain('.env.prod');
    expect(rawFull).toContain('>> "%LOG_FILE%" 2>&1');
    expect(rawFull).toContain('Pressione ENTER para executar');
    expect(rawFull).toContain('pause');
  });

  it('generates rich and raw .ps1 scripts with all customization options', () => {
    const richDefault = generatePipelineScript(
      makeInput({ pipelineName: "O'Brien CI", description: undefined }),
      'ps1'
    );
    expect(richDefault.includes('\r\n')).toBe(true);
    expect(richDefault).toContain("$PipelineName = 'O''Brien CI'");
    expect(richDefault).toContain('$esc = [char]27');

    const richCustom = generatePipelineScript(makeInput(), 'ps1', {
      style: 'rich',
      confirmBeforeRun: false,
      pauseOnFinish: false,
      includeColors: false,
      useProjectDir: false,
      saveLogFile: true,
      envProfile: 'staging',
      customHeader: 'PS note'
    });
    expect(richCustom).not.toContain('$esc = [char]27');
    expect(richCustom).not.toContain('Push-Location');
    expect(richCustom).toContain('Start-Transcript');
    expect(richCustom).toContain('.env.staging');
    expect(richCustom).toContain('PS note');

    const rawMinimal = generatePipelineScript(makeInput(), 'ps1', {
      style: 'raw',
      useProjectDir: false
    });
    expect(rawMinimal).toContain('npm.cmd run typecheck');
    expect(rawMinimal).not.toContain('O QUE ESTE SCRIPT FAZ');
    expect(rawMinimal).not.toContain('Push-Location');

    const rawFull = generatePipelineScript(makeInput(), 'ps1', {
      style: 'raw',
      confirmBeforeRun: true,
      pauseOnFinish: true,
      useProjectDir: true,
      saveLogFile: true,
      envProfile: 'prod',
      customHeader: 'PS raw note'
    });
    expect(rawFull).toContain('# PS raw note');
    expect(rawFull).toContain('Push-Location');
    expect(rawFull).toContain('Start-Transcript');
    expect(rawFull).toContain('.env.prod');
    expect(rawFull).toContain('Read-Host');
  });

  it('generates rich and raw .sh scripts with all customization options', () => {
    const richDefault = generatePipelineScript(
      makeInput({ pipelineName: "CI 'Linux'", description: undefined }),
      'sh'
    );
    expect(richDefault.startsWith('#!/usr/bin/env bash\n')).toBe(true);
    expect(richDefault.includes('\r\n')).toBe(false);
    expect(richDefault).toContain("PIPELINE_NAME='CI '\\''Linux'\\'''");

    const richCustom = generatePipelineScript(makeInput(), 'sh', {
      style: 'rich',
      confirmBeforeRun: false,
      pauseOnFinish: false,
      includeColors: false,
      useProjectDir: false,
      saveLogFile: true,
      envProfile: 'staging',
      customHeader: 'SH note'
    });
    expect(richCustom).not.toContain('\\033[38;2');
    expect(richCustom).not.toContain('cd "$PROJECT_PATH"');
    expect(richCustom).toContain('tee -a');
    expect(richCustom).toContain('.env.staging');
    expect(richCustom).toContain('SH note');

    const rawMinimal = generatePipelineScript(makeInput(), 'sh', {
      style: 'raw',
      useProjectDir: false
    });
    expect(rawMinimal).toContain('npm run typecheck');
    expect(rawMinimal).not.toContain('O QUE ESTE SCRIPT FAZ');
    expect(rawMinimal).not.toContain('cd ');

    const rawFull = generatePipelineScript(makeInput(), 'sh', {
      style: 'raw',
      confirmBeforeRun: true,
      pauseOnFinish: true,
      useProjectDir: true,
      saveLogFile: true,
      envProfile: 'prod',
      customHeader: 'SH raw note'
    });
    expect(rawFull).toContain('# SH raw note');
    expect(rawFull).toContain('tee -a');
    expect(rawFull).toContain('.env.prod');
    expect(rawFull).toContain('read -r -p');
  });

  if (process.platform === 'win32') {
    it('executes rich and raw .bat scripts in real cmd.exe including env loading and log file', () => {
      const dir = makeTempDir();
      fs.writeFileSync(path.join(dir, '.env.test'), 'NEXUS_TEST_VAR=hello_env\n', 'utf-8');

      // 1. Rich script with dry-run, continue, onSuccess, and failure
      const okScript = generatePipelineScript(
        {
          pipelineName: 'Real Test (CMD)',
          description: 'Executes in cmd.exe',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Greet (Step 1)',
              kind: 'command',
              command: 'echo step-one-output',
              onErrorAction: 'stop',
              onSuccessCommand: 'echo hook-success',
              enabled: true
            },
            {
              name: 'Warn Continue',
              kind: 'command',
              command: 'cmd /c exit 2',
              onErrorAction: 'continue',
              enabled: true
            },
            {
              name: 'Final Echo',
              kind: 'command',
              command: 'echo final-output',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'bat'
      );
      const okFile = path.join(dir, 'ok-pipeline.bat');
      fs.writeFileSync(okFile, okScript, 'utf-8');

      const dryOut = execFileSync('cmd.exe', ['/c', okFile, '--dry-run', '--no-pause'], {
        encoding: 'utf-8'
      });
      expect(dryOut).toContain('[DRY-RUN]');
      expect(dryOut).toContain('$ echo step-one-output');
      expect(dryOut).not.toContain('▶ [1/3]');

      let failedAsExpected = false;
      try {
        execFileSync('cmd.exe', ['/c', okFile, '--yes', '--no-pause'], {
          encoding: 'utf-8'
        });
      } catch (err) {
        failedAsExpected = true;
        const execErr = err as { status: number; stdout: string };
        expect(execErr.status).toBe(1);
        expect(execErr.stdout).toContain('step-one-output');
        expect(execErr.stdout).toContain('hook-success');
        expect(execErr.stdout).toContain('[WARN]');
        expect(execErr.stdout).toContain('final-output');
      }
      expect(failedAsExpected).toBe(true);

      // 2. Rich portable script with no colors, envProfile, and saveLogFile
      const richLogged = generatePipelineScript(
        {
          pipelineName: 'Logged Env Run',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Print Env',
              kind: 'command',
              command: 'echo ENV_IS_%NEXUS_TEST_VAR%',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'bat',
        {
          style: 'rich',
          confirmBeforeRun: false,
          pauseOnFinish: false,
          includeColors: false,
          useProjectDir: false,
          saveLogFile: true,
          envProfile: 'test'
        }
      );
      const loggedFile = path.join(dir, 'logged.bat');
      fs.writeFileSync(loggedFile, richLogged, 'utf-8');
      const loggedOut = execFileSync('cmd.exe', ['/c', loggedFile], {
        cwd: dir,
        encoding: 'utf-8'
      });
      expect(loggedOut).toContain('Status: SUCESSO');
      const logContent = fs.readFileSync(path.join(dir, 'logged-env-run.log'), 'utf-8');
      expect(logContent).toContain('ENV_IS_hello_env');

      // 3. Raw script executes directly and exits 0
      const rawScript = generatePipelineScript(
        {
          pipelineName: 'Raw Pass',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Only Step',
              kind: 'command',
              command: 'echo raw-pass-ok',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'bat',
        { style: 'raw' }
      );
      const rawFile = path.join(dir, 'raw.bat');
      fs.writeFileSync(rawFile, rawScript, 'utf-8');
      const rawOut = execFileSync('cmd.exe', ['/c', rawFile], { encoding: 'utf-8' });
      expect(rawOut).toContain('raw-pass-ok');

      // 4. run_command fallback stops subsequent steps
      const failScript = generatePipelineScript(
        {
          pipelineName: 'Fallback Fail',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Failing Step',
              kind: 'command',
              command: 'cmd /c exit 3',
              onErrorAction: 'run_command',
              onErrorCommand: 'echo fallback-ran',
              enabled: true
            },
            {
              name: 'Never Runs',
              kind: 'command',
              command: 'echo should-not-run',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'bat'
      );
      const failFile = path.join(dir, 'fail.bat');
      fs.writeFileSync(failFile, failScript, 'utf-8');
      let ranFallback = false;
      try {
        execFileSync('cmd.exe', ['/c', failFile, '--yes', '--no-pause'], {
          encoding: 'utf-8'
        });
      } catch (err) {
        ranFallback = true;
        const execErr = err as { status: number; stdout: string };
        expect(execErr.status).toBe(1);
        expect(execErr.stdout).toContain('fallback-ran');
        expect(execErr.stdout).not.toContain('▶ [2/2]');
        expect(execErr.stdout).toContain('[SKIPPED]');
        expect(execErr.stdout).toMatch(/\d+\.\d{2}s/);
      }
      expect(ranFallback).toBe(true);
    });
  } else {
    it('executes rich and raw .sh scripts in real bash for dry-run and success', () => {
      const dir = makeTempDir();
      const richSh = generatePipelineScript(
        {
          pipelineName: 'Bash Test',
          description: 'Runs on bash',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Plain Step',
              kind: 'command',
              command: 'echo sh-rich-ok',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'sh'
      );
      const richFile = path.join(dir, 'rich.sh');
      fs.writeFileSync(richFile, richSh, 'utf-8');
      fs.chmodSync(richFile, 0o755);

      const dryOut = execFileSync('bash', [richFile, '--dry-run', '--no-pause'], {
        encoding: 'utf-8'
      });
      expect(dryOut).toContain('[DRY-RUN]');

      const runOut = execFileSync('bash', [richFile, '--yes', '--no-pause'], {
        encoding: 'utf-8'
      });
      expect(runOut).toContain('sh-rich-ok');
      expect(runOut).toContain('Status: SUCESSO');

      const rawSh = generatePipelineScript(
        {
          pipelineName: 'Bash Raw',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Raw Step',
              kind: 'command',
              command: 'echo sh-raw-ok',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'sh',
        { style: 'raw' }
      );
      const rawFile = path.join(dir, 'raw.sh');
      fs.writeFileSync(rawFile, rawSh, 'utf-8');
      fs.chmodSync(rawFile, 0o755);

      const rawOut = execFileSync('bash', [rawFile], { encoding: 'utf-8' });
      expect(rawOut).toContain('sh-raw-ok');
    });
  }
});
