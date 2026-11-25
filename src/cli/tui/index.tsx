import './esmShim';
import { spawn } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { render } from 'ink';
import {
  disconnectPrisma,
  ensureDatabaseReady,
  getPrisma,
  resolveDatabasePath
} from '../../main/db/prisma';
import { ProcessRunner, type ExecutableStep } from '../../main/engine/processRunner';
import { syncDatabase } from '../../main/scanner/dbSync';
import {
  detectInstalledTools,
  openTerminalAt,
  openWithTool
} from '../../main/system/toolDetector';
import type {
  CliLaunchOptions,
  OnErrorAction,
  PackageManager,
  StepKind
} from '../../shared/types';
import { getNexusVersion } from '../../shared/version';
import {
  NexusTuiApp,
  type TuiCommandItem,
  type TuiController,
  type TuiHistoryItem,
  type TuiInitialData,
  type TuiPipelineItem,
  type TuiProjectItem,
  type TuiRunnerCallbacks
} from './NexusTuiApp';

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
const runner = new ProcessRunner();

function getCurrentDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

async function loadInitialTuiData(): Promise<TuiInitialData> {
  const version = getNexusVersion();
  const dbPath = resolveDatabasePath();
  const detectedTools = await detectInstalledTools().catch(() => []);

  try {
    await ensureDatabaseReady();
    const prisma = getPrisma();

    const [projectRows, pipelineRows, commandRows, recentRuns] = await Promise.all([
      prisma.projectRecord.findMany({
        include: {
          _count: {
            select: { commands: true, pipelines: true, runs: true }
          }
        },
        orderBy: [{ lastScannedAt: 'desc' }, { name: 'asc' }]
      }),
      prisma.pipeline.findMany({
        include: {
          project: true,
          steps: { orderBy: { order: 'asc' } }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.projectCommand.findMany({
        include: { project: true },
        orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }]
      }),
      prisma.executionRun.findMany({
        include: { project: true },
        orderBy: { startedAt: 'desc' },
        take: 20
      })
    ]);

    const projects: TuiProjectItem[] = projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      adapterType: p.adapterType,
      packageManager: p.packageManager,
      commandCount: p._count.commands,
      pipelineCount: p._count.pipelines,
      runCount: p._count.runs,
      existsOnDisk: fs.existsSync(p.path),
      lastScannedAt: p.lastScannedAt.toISOString()
    }));

    const pipelines: TuiPipelineItem[] = pipelineRows.map((pl) => ({
      id: pl.id,
      projectId: pl.projectId,
      projectName: pl.project.name,
      projectPath: pl.project.path,
      name: pl.name,
      description: pl.description,
      steps: pl.steps.map((s) => ({
        order: s.order,
        name: s.name,
        kind: s.kind,
        command: s.command,
        onErrorAction: s.onErrorAction,
        onSuccessCommand: s.onSuccessCommand,
        enabled: s.enabled
      }))
    }));

    const commands: TuiCommandItem[] = commandRows.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      projectName: c.project.name,
      projectPath: c.project.path,
      packageManager: c.project.packageManager,
      name: c.name,
      command: c.command,
      source: c.source
    }));

    const history: TuiHistoryItem[] = recentRuns.map((run) => ({
      id: run.id,
      projectName: run.project.name,
      title: run.title,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      logs: run.logs
    }));

    return {
      version,
      dbPath,
      projects,
      pipelines,
      commands,
      history,
      detectedTools,
      stats: {
        projectCount: projects.length,
        pipelineCount: pipelines.length,
        commandCount: commands.length,
        runCount: recentRuns.length,
        isPreview: projects.length === 0
      }
    };
  } catch {
    return {
      version,
      dbPath,
      projects: [],
      pipelines: [],
      commands: [],
      history: [],
      detectedTools,
      stats: {
        projectCount: 0,
        pipelineCount: 0,
        commandCount: 0,
        runCount: 0,
        isPreview: true
      }
    };
  }
}

function openDesktopGui(targetPath?: string | null): void {
  const launchOptions: CliLaunchOptions = {
    targetPath: targetPath ? path.resolve(targetPath) : process.cwd()
  };
  const encoded = Buffer.from(JSON.stringify(launchOptions), 'utf-8').toString('base64');
  const electronArgs = [`--nexus-launch=${encoded}`];

  const packagedExe = process.env.NEXUS_APP_EXE;
  if (packagedExe && fs.existsSync(packagedExe)) {
    const child = spawn(packagedExe, electronArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();
    return;
  }

  const electronBinary = nodeRequire('electron') as string;
  const mainEntry = path.resolve(getCurrentDir(), '../main/index.js');
  const child = spawn(electronBinary, [mainEntry, ...electronArgs], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();
}

export async function startNexusTui(options?: { autoSync?: boolean }): Promise<void> {
  const initialData = await loadInitialTuiData();
  let activeRunId: string | null = null;

  const controller: TuiController = {
    onReloadData: async () => loadInitialTuiData(),

    onSync: async (onProgress) => {
      await ensureDatabaseReady();
      const summary = await syncDatabase({ onProgress });
      const data = await loadInitialTuiData();
      return { summary, data };
    },

    onRunPipeline: async (pipelineId: string, callbacks: TuiRunnerCallbacks) => {
      const prisma = getPrisma();
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          project: true,
          steps: {
            where: { enabled: true },
            orderBy: { order: 'asc' }
          }
        }
      });
      if (!pipeline) throw new Error('Pipeline não encontrado no SQLite.');
      if (pipeline.steps.length === 0) throw new Error('Pipeline sem etapas habilitadas.');

      const steps: ExecutableStep[] = pipeline.steps.map((s) => ({
        name: s.name,
        kind: (s.kind === 'command' ? 'command' : 'script') as StepKind,
        command: s.command,
        onErrorAction: (['stop', 'continue', 'run_command'].includes(s.onErrorAction)
          ? s.onErrorAction
          : 'stop') as OnErrorAction,
        onErrorCommand: s.onErrorCommand,
        onSuccessCommand: s.onSuccessCommand
      }));

      const runId = await runner.startExecution({
        projectId: pipeline.projectId,
        projectPath: pipeline.project.path,
        packageManager: (pipeline.project.packageManager || 'npm') as PackageManager,
        pipelineId: pipeline.id,
        title: `Pipeline: ${pipeline.name}`,
        steps,
        callbacks: {
          onLog: callbacks.onLog,
          onStepStatus: callbacks.onStepStatus,
          onRunStatus: (event) => {
            activeRunId = event.status === 'running' ? event.runId : null;
            callbacks.onRunStatus(event);
          }
        }
      });
      activeRunId = runId;
      return runId;
    },

    onRunCommand: async (cmd: TuiCommandItem, callbacks: TuiRunnerCallbacks) => {
      const runId = await runner.startExecution({
        projectId: cmd.projectId,
        projectPath: cmd.projectPath,
        packageManager: (cmd.packageManager || 'npm') as PackageManager,
        pipelineId: null,
        title: `Script: ${cmd.name} (${cmd.projectName})`,
        steps: [
          {
            name: cmd.name,
            kind: 'script',
            command: cmd.name,
            onErrorAction: 'stop'
          }
        ],
        callbacks: {
          onLog: callbacks.onLog,
          onStepStatus: callbacks.onStepStatus,
          onRunStatus: (event) => {
            activeRunId = event.status === 'running' ? event.runId : null;
            callbacks.onRunStatus(event);
          }
        }
      });
      activeRunId = runId;
      return runId;
    },

    onCancelRun: async (runId: string) => runner.cancelRun(runId),

    onOpenGui: (targetPath?: string | null) => {
      openDesktopGui(targetPath);
    },

    onOpenTool: async (toolId: string, targetPath: string) => {
      if (toolId === 'terminal') {
        await openTerminalAt(targetPath);
        return;
      }
      await openWithTool(toolId, targetPath);
    }
  };

  const instance = render(
    <NexusTuiApp
      initialData={initialData}
      controller={controller}
      autoSync={Boolean(options?.autoSync)}
    />,
    { exitOnCtrlC: false }
  );
  await instance.waitUntilExit();
  if (activeRunId) {
    await runner.cancelRun(activeRunId);
  }
  await disconnectPrisma();
}

const isDirectEntry =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectEntry) {
  void startNexusTui();
}
