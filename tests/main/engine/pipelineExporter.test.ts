import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generatePipelineScript,
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
      }
    ],
    ...overrides
  };
}

describe('suggestExportFilename & resolveExportStepCommand', () => {
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

describe('generatePipelineScript', () => {
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

  it('generates CRLF Windows Batch (.bat) with overview, pause prompt, and escaped chars', () => {
    const bat = generatePipelineScript(makeInput(), 'bat');
    expect(bat.includes('\r\n')).toBe(true);
    expect(bat).toContain('@echo off');
    expect(bat).toContain('O QUE ESTE SCRIPT FAZ');
    expect(bat).toContain('Pressione ENTER para executar');
    expect(bat).toContain('npm.cmd run typecheck');
    expect(bat).toContain('echo Lint ^& Check ^(100%%^)');
    expect(bat).toContain('Descricao:');
    expect(bat).toContain('RESUMO FINAL');

    const batNoDesc = generatePipelineScript(makeInput({ description: '' }), 'bat');
    expect(batNoDesc).not.toContain('Descricao:');
  });

  it('generates CRLF PowerShell (.ps1) with overview, single-quote escaping, and pause', () => {
    const ps1 = generatePipelineScript(
      makeInput({
        pipelineName: "O'Brien CI",
        description: undefined
      }),
      'ps1'
    );
    expect(ps1.includes('\r\n')).toBe(true);
    expect(ps1).toContain("$PipelineName = 'O''Brien CI'");
    expect(ps1).toContain('O QUE ESTE SCRIPT FAZ');
    expect(ps1).toContain('Pressione ENTER para executar');
    expect(ps1).toContain('npm.cmd run typecheck');
    expect(ps1).toContain('RESUMO FINAL');
  });

  it('generates LF Bash (.sh) with shebang, overview, and pause', () => {
    const sh = generatePipelineScript(
      makeInput({
        pipelineName: "CI 'Linux'",
        description: undefined
      }),
      'sh'
    );
    expect(sh.startsWith('#!/usr/bin/env bash\n')).toBe(true);
    expect(sh.includes('\r\n')).toBe(false);
    expect(sh).toContain("PIPELINE_NAME='CI '\\''Linux'\\'''");
    expect(sh).toContain('npm run typecheck');
    expect(sh).toContain('O QUE ESTE SCRIPT FAZ');
    expect(sh).toContain('RESUMO FINAL');
  });

  if (process.platform === 'win32') {
    it('executes generated .bat scripts in real cmd.exe for dry-run, success, continue, and failure', () => {
      const dir = makeTempDir();

      // 1. Success + continue + onSuccess + dry-run
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

      // 2. Pure success returns exit code 0
      const cleanScript = generatePipelineScript(
        {
          pipelineName: 'Clean Pass',
          projectName: 'temp-proj',
          projectPath: dir,
          packageManager: 'npm',
          steps: [
            {
              name: 'Only Step',
              kind: 'command',
              command: 'echo clean-pass-ok',
              onErrorAction: 'stop',
              enabled: true
            }
          ]
        },
        'bat'
      );
      const cleanFile = path.join(dir, 'clean.bat');
      fs.writeFileSync(cleanFile, cleanScript, 'utf-8');
      const cleanOut = execFileSync('cmd.exe', ['/c', cleanFile, '--yes', '--no-pause'], {
        encoding: 'utf-8'
      });
      expect(cleanOut).toContain('clean-pass-ok');
      expect(cleanOut).toContain('Status: SUCESSO');

      // 3. run_command fallback stops subsequent steps
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
  }
});
