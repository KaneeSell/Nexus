import { spawn, execFile, type ChildProcess } from 'child_process';
import type {
  OnErrorAction,
  PackageManager,
  RunExecutionOptions,
  RunLogEvent,
  RunStatus,
  RunStatusEvent,
  StepKind,
  StepStatusEvent
} from '../../shared/types';
import { getPrisma } from '../db/prisma';
import { loadEnvProfile } from './envLoader';

export interface ExecutableStep {
  name: string;
  kind: StepKind;
  command: string;
  onErrorAction: OnErrorAction;
  onErrorCommand?: string | null;
  onSuccessCommand?: string | null;
}

export interface RunnerCallbacks {
  onLog: (event: RunLogEvent) => void;
  onRunStatus: (event: RunStatusEvent) => void;
  onStepStatus: (event: StepStatusEvent) => void;
}

interface ActiveExecution {
  runId: string;
  cancelled: boolean;
  currentChild: ChildProcess | null;
}

export function buildPackageScriptCommand(packageManager: PackageManager, scriptName: string): string {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm run ${scriptName}`;
    case 'yarn':
      return `yarn ${scriptName}`;
    case 'bun':
      return `bun run ${scriptName}`;
    case 'npm':
    default:
      return process.platform === 'win32' ? `npm.cmd run ${scriptName}` : `npm run ${scriptName}`;
  }
}

function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => resolve());
      return;
    }
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore already exited
      }
    }
    resolve();
  });
}

export class ProcessRunner {
  private activeRuns = new Map<string, ActiveExecution>();

  async startExecution(
    params: {
      projectId: string;
      projectPath: string;
      packageManager: PackageManager;
      pipelineId: string | null;
      title: string;
      steps: ExecutableStep[];
      callbacks: RunnerCallbacks;
    } & RunExecutionOptions
  ): Promise<string> {
    const prisma = getPrisma();
    const runRecord = await prisma.executionRun.create({
      data: {
        projectId: params.projectId,
        pipelineId: params.pipelineId,
        title: params.dryRun ? `[DRY-RUN] ${params.title}` : params.title,
        status: 'running',
        logs: ''
      }
    });

    const execution: ActiveExecution = {
      runId: runRecord.id,
      cancelled: false,
      currentChild: null
    };
    this.activeRuns.set(runRecord.id, execution);

    params.callbacks.onRunStatus({
      runId: runRecord.id,
      projectId: params.projectId,
      pipelineId: params.pipelineId,
      title: runRecord.title,
      status: 'running',
      startedAt: runRecord.startedAt.toISOString(),
      finishedAt: null
    });

    void this.executeSequence(execution, {
      ...params,
      title: runRecord.title
    }).catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      await this.finishRun(
        execution,
        params.projectId,
        params.pipelineId,
        runRecord.title,
        runRecord.startedAt,
        'failed',
        `[ERRO INTERNO] ${msg}\n`,
        params.callbacks
      );
    });

    return runRecord.id;
  }

  async cancelRun(runId: string): Promise<boolean> {
    const execution = this.activeRuns.get(runId);
    if (!execution) return false;
    execution.cancelled = true;
    if (execution.currentChild?.pid) {
      await killProcessTree(execution.currentChild.pid);
    }
    return true;
  }

  private async executeSequence(
    execution: ActiveExecution,
    params: {
      projectId: string;
      projectPath: string;
      packageManager: PackageManager;
      pipelineId: string | null;
      title: string;
      steps: ExecutableStep[];
      callbacks: RunnerCallbacks;
      continueOnError?: boolean;
      dryRun?: boolean;
      envProfile?: string | null;
    }
  ): Promise<void> {
    let fullLogs = '';
    const appendLog = (stepIndex: number | null, stream: RunLogEvent['stream'], chunk: string): void => {
      fullLogs += chunk;
      params.callbacks.onLog({
        runId: execution.runId,
        stepIndex,
        stream,
        chunk,
        timestamp: new Date().toISOString()
      });
    };

    const startedAt = new Date();
    let finalStatus: RunStatus = 'success';

    const envInfo = loadEnvProfile(params.projectPath, params.envProfile);
    if (params.envProfile) {
      if (envInfo.loadedFile) {
        appendLog(
          null,
          'system',
          `[env] Variáveis carregadas de ${envInfo.loadedFile} (${Object.keys(envInfo.vars).length} chave(s)).\n`
        );
      } else {
        appendLog(
          null,
          'system',
          `[env] Perfil "${params.envProfile}" informado, mas nenhum arquivo .env.${params.envProfile} ou .env foi encontrado.\n`
        );
      }
    }

    if (params.dryRun) {
      appendLog(null, 'system', `[DRY-RUN] Simulando plano de execução (nenhum comando será executado):\n`);
      for (let i = 0; i < params.steps.length; i += 1) {
        const step = params.steps[i];
        const shellCommand =
          step.kind === 'script'
            ? buildPackageScriptCommand(params.packageManager, step.command)
            : step.command;
        const effectiveErrorAction = params.continueOnError ? 'continue (override)' : step.onErrorAction;

        params.callbacks.onStepStatus({
          runId: execution.runId,
          stepIndex: i,
          stepName: step.name,
          status: 'skipped'
        });

        appendLog(
          i,
          'system',
          `  ${i + 1}. ${step.name}\n     comando: ${shellCommand}\n     onError: ${effectiveErrorAction}${step.onErrorCommand ? ` (${step.onErrorCommand})` : ''}${step.onSuccessCommand ? `\n     onSuccess: ${step.onSuccessCommand}` : ''}\n`
        );
      }

      await this.finishRun(
        execution,
        params.projectId,
        params.pipelineId,
        params.title,
        startedAt,
        'success',
        fullLogs,
        params.callbacks
      );
      return;
    }

    for (let i = 0; i < params.steps.length; i += 1) {
      if (execution.cancelled) {
        finalStatus = 'cancelled';
        params.callbacks.onStepStatus({
          runId: execution.runId,
          stepIndex: i,
          stepName: params.steps[i].name,
          status: 'cancelled'
        });
        continue;
      }

      const step = params.steps[i];
      const shellCommand =
        step.kind === 'script'
          ? buildPackageScriptCommand(params.packageManager, step.command)
          : step.command;

      params.callbacks.onStepStatus({
        runId: execution.runId,
        stepIndex: i,
        stepName: step.name,
        status: 'running'
      });
      appendLog(i, 'system', `\n▶ [${i + 1}/${params.steps.length}] ${step.name} -> ${shellCommand}\n`);

      const exitCode = await this.spawnCommand(
        execution,
        shellCommand,
        params.projectPath,
        envInfo.vars,
        (stream, chunk) => appendLog(i, stream, chunk)
      );

      if (execution.cancelled) {
        params.callbacks.onStepStatus({
          runId: execution.runId,
          stepIndex: i,
          stepName: step.name,
          status: 'cancelled',
          exitCode
        });
        appendLog(i, 'system', `■ Etapa cancelada pelo usuário.\n`);
        finalStatus = 'cancelled';
        continue;
      }

      if (exitCode === 0) {
        params.callbacks.onStepStatus({
          runId: execution.runId,
          stepIndex: i,
          stepName: step.name,
          status: 'success',
          exitCode
        });
        appendLog(i, 'system', `✓ Etapa concluída com sucesso (código 0).\n`);

        if (step.onSuccessCommand?.trim()) {
          appendLog(i, 'system', `↳ Executando ação de sucesso: ${step.onSuccessCommand}\n`);
          const hookCode = await this.spawnCommand(
            execution,
            step.onSuccessCommand,
            params.projectPath,
            envInfo.vars,
            (stream, chunk) => appendLog(i, stream, chunk)
          );
          if (hookCode !== 0 && !execution.cancelled) {
            appendLog(i, 'stderr', `⚠ Ação de sucesso retornou código ${hookCode}.\n`);
          }
        }
      } else {
        params.callbacks.onStepStatus({
          runId: execution.runId,
          stepIndex: i,
          stepName: step.name,
          status: 'failed',
          exitCode
        });
        appendLog(i, 'stderr', `✗ Etapa falhou com código ${exitCode ?? 'desconhecido'}.\n`);

        if (params.continueOnError) {
          appendLog(i, 'system', `↳ Continuando (--continue-on-error ativo).\n`);
          finalStatus = 'failed';
          continue;
        }

        if (step.onErrorAction === 'run_command' && step.onErrorCommand?.trim()) {
          appendLog(i, 'system', `↳ Executando fallback de erro: ${step.onErrorCommand}\n`);
          const fallbackCode = await this.spawnCommand(
            execution,
            step.onErrorCommand,
            params.projectPath,
            envInfo.vars,
            (stream, chunk) => appendLog(i, stream, chunk)
          );
          appendLog(
            i,
            fallbackCode === 0 ? 'system' : 'stderr',
            `↳ Fallback finalizado com código ${fallbackCode ?? 'desconhecido'}.\n`
          );
          finalStatus = 'failed';
          break;
        }

        if (step.onErrorAction === 'continue') {
          appendLog(i, 'system', `↳ Configurado para continuar mesmo com erro.\n`);
          finalStatus = 'failed';
          continue;
        }

        finalStatus = 'failed';
        break;
      }
    }

    await this.finishRun(
      execution,
      params.projectId,
      params.pipelineId,
      params.title,
      startedAt,
      finalStatus,
      fullLogs,
      params.callbacks
    );
  }

  private spawnCommand(
    execution: ActiveExecution,
    command: string,
    cwd: string,
    extraEnv: Record<string, string>,
    onOutput: (stream: 'stdout' | 'stderr', chunk: string) => void
  ): Promise<number | null> {
    return new Promise((resolve) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
        env: {
          ...process.env,
          ...extraEnv,
          FORCE_COLOR: '0'
        }
      });

      execution.currentChild = child;

      child.stdout?.on('data', (data: Buffer) => {
        onOutput('stdout', data.toString('utf-8'));
      });

      child.stderr?.on('data', (data: Buffer) => {
        onOutput('stderr', data.toString('utf-8'));
      });

      child.on('error', (err) => {
        onOutput('stderr', `${err.message}\n`);
      });

      child.on('close', (code) => {
        if (execution.currentChild === child) {
          execution.currentChild = null;
        }
        resolve(code);
      });
    });
  }

  private async finishRun(
    execution: ActiveExecution,
    projectId: string,
    pipelineId: string | null,
    title: string,
    startedAt: Date,
    status: RunStatus,
    logs: string,
    callbacks: RunnerCallbacks
  ): Promise<void> {
    this.activeRuns.delete(execution.runId);
    const finishedAt = new Date();
    const prisma = getPrisma();

    await prisma.executionRun.update({
      where: { id: execution.runId },
      data: {
        status,
        finishedAt,
        logs
      }
    });

    callbacks.onRunStatus({
      runId: execution.runId,
      projectId,
      pipelineId,
      title,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString()
    });
  }
}
