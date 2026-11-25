import { execFile, spawn } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  formatCliHelp,
  isTerminalOnlyArgs,
  parseCliArgs,
  shouldLaunchTui,
  type ParsedCliArgs
} from '../shared/cliArgs';
import { getNexusVersion } from '../shared/version';
import type {
  CliLaunchOptions,
  OnErrorAction,
  PackageManager,
  PipelineExportFormat,
  ScannedProject,
  StepKind
} from '../shared/types';
import {
  disconnectPrisma,
  ensureDatabaseReady,
  getPrisma,
  resolveDatabasePath
} from '../main/db/prisma';
import {
  generatePipelineScript,
  suggestExportFilename
} from '../main/engine/pipelineExporter';
import { ProcessRunner, type ExecutableStep } from '../main/engine/processRunner';
import { syncDatabase } from '../main/scanner/dbSync';
import { scanWorkspace } from '../main/scanner/workspaceScanner';

const nodeRequire = createRequire(__filename);

function checkCommandVersion(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { shell: process.platform === 'win32', windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(stdout.trim().split(/\r?\n/)[0] || 'ok');
    });
  });
}

function selectProjectFromScan(
  projects: ScannedProject[],
  projectQuery: string | null
): ScannedProject | null {
  if (projects.length === 0) return null;
  if (!projectQuery) return projects[0];

  const q = projectQuery.trim().toLowerCase();
  return (
    projects.find((p) => p.name.toLowerCase() === q) ??
    projects.find((p) => path.basename(p.path).toLowerCase() === q) ??
    projects.find((p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)) ??
    null
  );
}

async function handleDoctor(jsonOutput: boolean): Promise<number> {
  const dbPath = resolveDatabasePath();
  let sqliteOk = false;
  let sqliteError: string | null = null;
  try {
    await ensureDatabaseReady();
    await getPrisma().$queryRawUnsafe('SELECT 1');
    sqliteOk = true;
  } catch (err) {
    sqliteError = err instanceof Error ? err.message : String(err);
  }

  const [npmVer, pnpmVer, yarnVer, bunVer, whereNexus] = await Promise.all([
    checkCommandVersion(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['-v']),
    checkCommandVersion(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['-v']),
    checkCommandVersion(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', ['-v']),
    checkCommandVersion('bun', ['-v']),
    checkCommandVersion(process.platform === 'win32' ? 'where.exe' : 'which', ['nexus'])
  ]);

  const report = {
    version: getNexusVersion(),
    platform: process.platform,
    node: process.version,
    packageManagers: {
      npm: npmVer,
      pnpm: pnpmVer,
      yarn: yarnVer,
      bun: bunVer
    },
    nexusInPath: whereNexus,
    sqlite: {
      ok: sqliteOk,
      path: dbPath,
      error: sqliteError
    }
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Nexus Doctor (v${report.version})`);
    console.log(`- Plataforma: ${report.platform}`);
    console.log(`- Node.js: ${report.node}`);
    console.log(
      `- Gerenciadores: npm=${npmVer ?? 'não encontrado'}, pnpm=${pnpmVer ?? '-'}, yarn=${yarnVer ?? '-'}, bun=${bunVer ?? '-'}`
    );
    console.log(`- CLI no PATH: ${whereNexus ?? 'não encontrado'}`);
    console.log(`- SQLite (${dbPath}): ${sqliteOk ? 'OK' : `ERRO (${sqliteError})`}`);
  }

  return sqliteOk ? 0 : 1;
}

async function handlePin(targetPath: string, jsonOutput: boolean): Promise<number> {
  await ensureDatabaseReady();
  const prisma = getPrisma();
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    const msg = `Pasta não encontrada: ${resolved}`;
    if (jsonOutput) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  const record = await prisma.workspaceHistory.upsert({
    where: { path: resolved },
    update: {
      name: path.basename(resolved) || resolved,
      isPinned: true,
      lastOpenedAt: new Date()
    },
    create: {
      path: resolved,
      name: path.basename(resolved) || resolved,
      isPinned: true,
      lastOpenedAt: new Date()
    }
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ ok: true, workspace: record }, null, 2));
  } else {
    console.log(`Workspace fixado nos favoritos: ${record.name} (${record.path})`);
  }
  return 0;
}

async function maybeRunSync(args: ParsedCliArgs): Promise<void> {
  if (!args.sync) return;
  if (!args.json) {
    process.stdout.write('[Nexus] Sincronizando banco SQLite...\n');
  }
  const summary = await syncDatabase({
    targetPath: args.targetPath,
    projectQuery: args.project,
    depth: args.depth ?? undefined
  });
  if (!args.json) {
    console.log(
      `[Nexus] Sync concluído: ${summary.updatedProjects} projeto(s) atualizado(s)` +
        (summary.missingProjects.length > 0
          ? `, ${summary.missingProjects.length} ausente(s) no disco`
          : '') +
        '.'
    );
  }
}

function matchDbProject<T extends { name: string; path: string }>(
  projects: T[],
  query: string | null
): T | null {
  if (projects.length === 0) return null;
  if (!query) return null;
  const q = query.trim().toLowerCase();
  return (
    projects.find((p) => p.name.toLowerCase() === q) ??
    projects.find((p) => path.basename(p.path).toLowerCase() === q) ??
    projects.find((p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)) ??
    null
  );
}

async function handleDbProjects(args: ParsedCliArgs): Promise<number> {
  await ensureDatabaseReady();
  await maybeRunSync(args);
  const prisma = getPrisma();

  const rows = await prisma.projectRecord.findMany({
    include: {
      _count: { select: { commands: true, pipelines: true, runs: true } }
    },
    orderBy: [{ lastScannedAt: 'desc' }, { name: 'asc' }]
  });

  const mapped = rows.map((p) => ({
    id: p.id,
    name: p.name,
    path: p.path,
    adapterType: p.adapterType,
    packageManager: p.packageManager,
    commandsCount: p._count.commands,
    pipelinesCount: p._count.pipelines,
    runsCount: p._count.runs,
    existsOnDisk: fs.existsSync(p.path),
    lastScannedAt: p.lastScannedAt.toISOString()
  }));

  if (args.json) {
    console.log(JSON.stringify({ projects: mapped }, null, 2));
  } else if (mapped.length === 0) {
    console.log('Nenhum projeto cadastrado no SQLite. Use `nexus projects --sync` em uma pasta ou `nexus .`.');
  } else {
    console.log(`Projetos cadastrados no SQLite (${mapped.length}):`);
    for (const p of mapped) {
      const missingTag = p.existsOnDisk ? '' : ' [ausente no disco]';
      console.log(
        `  - ${p.name} [${p.packageManager}] (${p.commandsCount} cmd, ${p.pipelinesCount} pipeline)${missingTag} -> ${p.path}`
      );
    }
  }
  return 0;
}

async function handleDbScripts(args: ParsedCliArgs): Promise<number> {
  await ensureDatabaseReady();
  await maybeRunSync(args);
  const prisma = getPrisma();

  const projects = await prisma.projectRecord.findMany({
    include: { commands: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  const filtered = args.project
    ? (() => {
        const matched = matchDbProject(projects, args.project);
        return matched ? [matched] : [];
      })()
    : projects;

  if (args.project && filtered.length === 0) {
    const msg = `Nenhum projeto cadastrado no SQLite corresponde a "${args.project}".`;
    if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          projects: filtered.map((p) => ({
            id: p.id,
            name: p.name,
            path: p.path,
            packageManager: p.packageManager,
            scripts: p.commands.map((c) => ({
              name: c.name,
              command: c.command,
              source: c.source
            }))
          }))
        },
        null,
        2
      )
    );
  } else if (filtered.length === 0) {
    console.log('Nenhum projeto cadastrado no SQLite. Rode `nexus scripts --sync` em um workspace.');
  } else {
    for (const p of filtered) {
      console.log(`Comandos de ${p.name} [${p.packageManager}] (${p.commands.length}):`);
      if (p.commands.length === 0) {
        console.log('  (nenhum comando salvo — rode com --sync para atualizar do package.json)');
      } else {
        for (const cmd of p.commands) {
          console.log(`  - ${cmd.name}: ${cmd.command}`);
        }
      }
    }
  }
  return 0;
}

async function handleDbPipelines(args: ParsedCliArgs): Promise<number> {
  await ensureDatabaseReady();
  await maybeRunSync(args);
  const prisma = getPrisma();

  const projects = await prisma.projectRecord.findMany({
    include: {
      pipelines: {
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { updatedAt: 'desc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  const filtered = args.project
    ? (() => {
        const matched = matchDbProject(projects, args.project);
        return matched ? [matched] : [];
      })()
    : projects;

  if (args.project && filtered.length === 0) {
    const msg = `Nenhum projeto cadastrado no SQLite corresponde a "${args.project}".`;
    if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  const allPipelines = filtered.flatMap((p) =>
    p.pipelines.map((pl) => ({
      ...pl,
      projectName: p.name,
      projectPath: p.path
    }))
  );

  if (args.json) {
    console.log(JSON.stringify({ pipelines: allPipelines }, null, 2));
  } else if (allPipelines.length === 0) {
    console.log('Nenhum pipeline salvo no SQLite para o filtro informado.');
  } else {
    console.log(`Pipelines salvos no SQLite (${allPipelines.length}):`);
    for (const pl of allPipelines) {
      console.log(`  • ${pl.name} [${pl.projectName}] (${pl.steps.length} etapa(s))`);
      for (const st of pl.steps) {
        console.log(
          `      ${st.order + 1}. [${st.enabled ? 'x' : ' '}] ${st.name} (${st.kind}: ${st.command}) [onError: ${st.onErrorAction}]`
        );
      }
    }
  }
  return 0;
}

async function handleDbHistory(args: ParsedCliArgs): Promise<number> {
  await ensureDatabaseReady();
  await maybeRunSync(args);
  const prisma = getPrisma();

  let projectIdFilter: string | undefined;
  if (args.project) {
    const projects = await prisma.projectRecord.findMany();
    const matched = matchDbProject(projects, args.project);
    if (!matched) {
      const msg = `Nenhum projeto cadastrado no SQLite corresponde a "${args.project}".`;
      if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
      else console.error(msg);
      return 1;
    }
    projectIdFilter = matched.id;
  }

  const runs = await prisma.executionRun.findMany({
    where: projectIdFilter ? { projectId: projectIdFilter } : undefined,
    include: { project: true },
    orderBy: { startedAt: 'desc' },
    take: args.historyLimit ?? 15
  });

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          runs: runs.map((r) => ({
            id: r.id,
            project: r.project.name,
            title: r.title,
            status: r.status,
            startedAt: r.startedAt.toISOString(),
            finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null
          }))
        },
        null,
        2
      )
    );
  } else if (runs.length === 0) {
    console.log('Nenhuma execução registrada no SQLite.');
  } else {
    console.log(`Últimas ${runs.length} execução(ões) no SQLite:`);
    for (const r of runs) {
      console.log(
        `  - [${r.status}] ${r.title} (${r.project.name}) • ${r.startedAt.toLocaleString('pt-BR')}`
      );
    }
  }
  return 0;
}

async function handleExportPipeline(args: ParsedCliArgs): Promise<number> {
  await ensureDatabaseReady();
  await maybeRunSync(args);

  const targetName = args.exportTarget ?? args.runPipeline;
  if (!targetName) {
    const msg = 'Informe o nome do pipeline: `nexus export <pipeline> [--format bat|ps1|sh] [--out arquivo]`.';
    if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  const prisma = getPrisma();
  const projects = await prisma.projectRecord.findMany({
    include: {
      pipelines: {
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { updatedAt: 'desc' }
      }
    },
    orderBy: { lastScannedAt: 'desc' }
  });

  const candidateProjects = args.project
    ? (() => {
        const matched = matchDbProject(projects, args.project);
        return matched ? [matched] : [];
      })()
    : projects;

  const needle = targetName.trim().toLowerCase();
  let matchedProject: (typeof projects)[number] | null = null;
  let matchedPipeline: (typeof projects)[number]['pipelines'][number] | null = null;

  for (const proj of candidateProjects) {
    const found =
      proj.pipelines.find((pl) => pl.name.toLowerCase() === needle) ??
      proj.pipelines.find((pl) => pl.name.toLowerCase().includes(needle));
    if (found) {
      matchedProject = proj;
      matchedPipeline = found;
      break;
    }
  }

  if (!matchedProject || !matchedPipeline) {
    const msg = `Pipeline "${targetName}" não encontrado no SQLite.`;
    if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  const format: PipelineExportFormat =
    args.exportFormat ?? (process.platform === 'win32' ? 'bat' : 'sh');

  const content = generatePipelineScript(
    {
      pipelineName: matchedPipeline.name,
      description: matchedPipeline.description,
      projectName: matchedProject.name,
      projectPath: matchedProject.path,
      packageManager: (matchedProject.packageManager || 'npm') as PackageManager,
      steps: matchedPipeline.steps.map((s) => ({
        name: s.name,
        kind: (s.kind === 'command' ? 'command' : 'script') as StepKind,
        command: s.command,
        onErrorAction: (['stop', 'continue', 'run_command'].includes(s.onErrorAction)
          ? s.onErrorAction
          : 'stop') as OnErrorAction,
        onErrorCommand: s.onErrorCommand,
        onSuccessCommand: s.onSuccessCommand,
        enabled: s.enabled
      }))
    },
    format
  );

  const outFile = args.outputPath
    ? path.resolve(process.cwd(), args.outputPath)
    : path.join(matchedProject.path, suggestExportFilename(matchedPipeline.name, format));

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, content, 'utf-8');
  if (format === 'sh' && process.platform !== 'win32') {
    fs.chmodSync(outFile, 0o755);
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          pipeline: matchedPipeline.name,
          project: matchedProject.name,
          format,
          filePath: outFile
        },
        null,
        2
      )
    );
  } else {
    console.log(`Pipeline "${matchedPipeline.name}" exportado (${format}) para: ${outFile}`);
  }
  return 0;
}

async function runStepsInTerminal(params: {
  projectId: string;
  projectName: string;
  projectPath: string;
  packageManager: PackageManager;
  pipelineId: string | null;
  title: string;
  steps: ExecutableStep[];
  args: ParsedCliArgs;
}): Promise<number> {
  const runner = new ProcessRunner();
  return new Promise<number>((resolve) => {
    const collectedLogs: string[] = [];

    void runner.startExecution({
      projectId: params.projectId,
      projectPath: params.projectPath,
      packageManager: params.packageManager,
      pipelineId: params.pipelineId,
      title: params.title,
      steps: params.steps,
      continueOnError: params.args.continueOnError,
      dryRun: params.args.dryRun,
      envProfile: params.args.envProfile,
      callbacks: {
        onLog: (event) => {
          if (params.args.json) {
            collectedLogs.push(event.chunk);
          } else if (event.stream === 'stderr') {
            process.stderr.write(event.chunk);
          } else {
            process.stdout.write(event.chunk);
          }
        },
        onStepStatus: () => {},
        onRunStatus: (event) => {
          if (event.status !== 'running') {
            if (params.args.json) {
              console.log(
                JSON.stringify(
                  {
                    runId: event.runId,
                    project: params.projectName,
                    title: event.title,
                    status: event.status,
                    startedAt: event.startedAt,
                    finishedAt: event.finishedAt,
                    logs: collectedLogs.join('')
                  },
                  null,
                  2
                )
              );
            } else {
              console.log(`\n[Nexus] Execução finalizada: ${event.status.toUpperCase()}`);
            }
            resolve(event.status === 'success' ? 0 : 1);
          }
        }
      }
    });
  });
}

async function handleDbFirstRun(args: ParsedCliArgs): Promise<number | null> {
  await ensureDatabaseReady();
  await maybeRunSync(args);

  const targetName = args.runPipeline ?? args.runScript ?? args.runTarget;
  if (!targetName) return null;

  const prisma = getPrisma();
  const projects = await prisma.projectRecord.findMany({
    include: {
      commands: true,
      pipelines: {
        include: { steps: { orderBy: { order: 'asc' } } }
      }
    },
    orderBy: { lastScannedAt: 'desc' }
  });

  if (projects.length === 0) return null;

  const needle = targetName.trim().toLowerCase();
  const cwdResolved = path.resolve(process.cwd()).toLowerCase();

  const candidateProjects = args.project
    ? (() => {
        const m = matchDbProject(projects, args.project);
        return m ? [m] : [];
      })()
    : [
        ...projects.filter((p) => path.resolve(p.path).toLowerCase() === cwdResolved),
        ...projects.filter((p) => path.resolve(p.path).toLowerCase() !== cwdResolved)
      ];

  for (const proj of candidateProjects) {
    if (!args.runScript) {
      const matchedPipeline =
        proj.pipelines.find((pl) => pl.name.toLowerCase() === needle) ??
        proj.pipelines.find((pl) => pl.name.toLowerCase().includes(needle));
      if (matchedPipeline) {
        const steps: ExecutableStep[] = matchedPipeline.steps
          .filter((s) => s.enabled)
          .map((s) => ({
            name: s.name,
            kind: (s.kind === 'command' ? 'command' : 'script') as StepKind,
            command: s.command,
            onErrorAction: (['stop', 'continue', 'run_command'].includes(s.onErrorAction)
              ? s.onErrorAction
              : 'stop') as OnErrorAction,
            onErrorCommand: s.onErrorCommand,
            onSuccessCommand: s.onSuccessCommand
          }));

        if (steps.length === 0) {
          const msg = `Pipeline "${matchedPipeline.name}" não possui etapas ativas.`;
          if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
          else console.error(msg);
          return 1;
        }

        return runStepsInTerminal({
          projectId: proj.id,
          projectName: proj.name,
          projectPath: proj.path,
          packageManager: proj.packageManager as PackageManager,
          pipelineId: matchedPipeline.id,
          title: `Pipeline: ${matchedPipeline.name}`,
          steps,
          args
        });
      }
    }

    if (!args.runPipeline) {
      const matchedCmd = proj.commands.find((c) => c.name.toLowerCase() === needle);
      if (matchedCmd) {
        return runStepsInTerminal({
          projectId: proj.id,
          projectName: proj.name,
          projectPath: proj.path,
          packageManager: proj.packageManager as PackageManager,
          pipelineId: null,
          title: `Script: ${matchedCmd.name}`,
          steps: [
            {
              name: matchedCmd.name,
              kind: 'script',
              command: matchedCmd.name,
              onErrorAction: 'stop'
            }
          ],
          args
        });
      }
    }
  }

  return null;
}

async function handleHeadlessExecution(
  args: ParsedCliArgs,
  project: ScannedProject
): Promise<number> {
  const prisma = getPrisma();

  let title = '';
  let pipelineId: string | null = null;
  let steps: ExecutableStep[] = [];

  const targetPipelineName = args.runPipeline ?? (args.subcommand === 'run' ? args.runTarget : null);

  if (targetPipelineName) {
    const pipelines = await prisma.pipeline.findMany({
      where: { projectId: project.id },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
    const needle = targetPipelineName.trim().toLowerCase();
    const matched =
      pipelines.find((p) => p.name.toLowerCase() === needle) ??
      pipelines.find((p) => p.name.toLowerCase().includes(needle));

    if (matched) {
      pipelineId = matched.id;
      title = `Pipeline: ${matched.name}`;
      steps = matched.steps
        .filter((s) => s.enabled)
        .map((s) => ({
          name: s.name,
          kind: (s.kind === 'command' ? 'command' : 'script') as StepKind,
          command: s.command,
          onErrorAction: (['stop', 'continue', 'run_command'].includes(s.onErrorAction)
            ? s.onErrorAction
            : 'stop') as OnErrorAction,
          onErrorCommand: s.onErrorCommand,
          onSuccessCommand: s.onSuccessCommand
        }));
    } else if (args.subcommand === 'run') {
      const scriptMatch = project.scripts.find((s) => s.name.toLowerCase() === needle);
      if (scriptMatch) {
        title = `Script: ${scriptMatch.name}`;
        steps = [
          {
            name: scriptMatch.name,
            kind: 'script',
            command: scriptMatch.name,
            onErrorAction: 'stop'
          }
        ];
      }
    }

    if (steps.length === 0) {
      const msg = `Pipeline/script "${targetPipelineName}" não encontrado ou sem etapas ativas no projeto "${project.name}".`;
      if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
      else console.error(msg);
      return 1;
    }
  } else if (args.runScript) {
    const scriptName = args.runScript.trim();
    title = `Script: ${scriptName}`;
    steps = [
      {
        name: scriptName,
        kind: 'script',
        command: scriptName,
        onErrorAction: 'stop'
      }
    ];
  } else {
    const msg = 'Informe --run <script>, --pipeline <nome> ou `nexus run <nome>` para execução headless.';
    if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  return runStepsInTerminal({
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    packageManager: project.packageManager as PackageManager,
    pipelineId,
    title,
    steps,
    args
  });
}

async function runTerminalMode(args: ParsedCliArgs): Promise<number> {
  if (args.help) {
    console.log(formatCliHelp());
    return 0;
  }

  if (args.version) {
    const version = getNexusVersion();
    if (args.json) console.log(JSON.stringify({ name: 'nexus', version }));
    else console.log(`nexus v${version}`);
    return 0;
  }

  if (args.dbPath) {
    const dbPath = resolveDatabasePath();
    if (args.json) console.log(JSON.stringify({ dbPath }));
    else console.log(dbPath);
    return 0;
  }

  if (args.doctor || args.subcommand === 'doctor') {
    return handleDoctor(args.json);
  }

  if (args.subcommand === 'projects') {
    return handleDbProjects(args);
  }

  if (args.subcommand === 'scripts') {
    return handleDbScripts(args);
  }

  if (args.subcommand === 'pipelines') {
    return handleDbPipelines(args);
  }

  if (args.subcommand === 'history') {
    return handleDbHistory(args);
  }

  if (args.subcommand === 'export') {
    return handleExportPipeline(args);
  }

  if (
    (args.subcommand === 'run' || args.runPipeline || args.runScript) &&
    !args.targetPath
  ) {
    const dbRunCode = await handleDbFirstRun(args);
    if (dbRunCode !== null) {
      return dbRunCode;
    }
  }

  const resolvedTarget = path.resolve(process.cwd(), args.targetPath || '.');

  if (args.subcommand === 'pin') {
    return handlePin(resolvedTarget, args.json);
  }

  await ensureDatabaseReady();
  const scanResult = await scanWorkspace(resolvedTarget, () => {}, {
    depth: args.depth ?? undefined
  });

  if (args.list || args.subcommand === 'ls') {
    if (args.json) {
      console.log(JSON.stringify(scanResult, null, 2));
    } else {
      console.log(`Workspace: ${scanResult.targetPath} (${scanResult.projects.length} projeto(s))`);
      for (const p of scanResult.projects) {
        console.log(
          `  - ${p.name} [${p.packageManager}] (${p.scripts.length} scripts) -> ${p.path}`
        );
      }
    }
    return 0;
  }

  const project = selectProjectFromScan(scanResult.projects, args.project);
  if (!project) {
    const msg = args.project
      ? `Nenhum projeto encontrado correspondendo a "${args.project}" em ${resolvedTarget}.`
      : `Nenhum projeto Node.js encontrado em ${resolvedTarget}.`;
    if (args.json) console.log(JSON.stringify({ ok: false, error: msg }));
    else console.error(msg);
    return 1;
  }

  if (args.showScripts) {
    if (args.json) {
      console.log(
        JSON.stringify({ project: project.name, path: project.path, scripts: project.scripts }, null, 2)
      );
    } else {
      console.log(`Scripts de ${project.name} (${project.packageManager}):`);
      if (project.scripts.length === 0) {
        console.log('  (nenhum script definido no package.json)');
      } else {
        for (const s of project.scripts) {
          console.log(`  - ${s.name}: ${s.command}`);
        }
      }
    }
    return 0;
  }

  if (args.showPipelines) {
    const pipelines = await getPrisma().pipeline.findMany({
      where: { projectId: project.id },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' }
    });
    if (args.json) {
      console.log(JSON.stringify({ project: project.name, pipelines }, null, 2));
    } else {
      console.log(`Pipelines de ${project.name} (${pipelines.length}):`);
      for (const pl of pipelines) {
        console.log(`  • ${pl.name} (${pl.steps.length} etapa(s))`);
        for (const st of pl.steps) {
          console.log(
            `      ${st.order + 1}. [${st.enabled ? 'x' : ' '}] ${st.name} (${st.kind}: ${st.command}) [onError: ${st.onErrorAction}]`
          );
        }
      }
    }
    return 0;
  }

  if (args.historyLimit !== null) {
    const runs = await getPrisma().executionRun.findMany({
      where: { projectId: project.id },
      orderBy: { startedAt: 'desc' },
      take: args.historyLimit
    });
    if (args.json) {
      console.log(JSON.stringify({ project: project.name, runs }, null, 2));
    } else {
      console.log(`Últimas ${runs.length} execução(ões) de ${project.name}:`);
      for (const r of runs) {
        console.log(
          `  - [${r.status}] ${r.title} (${r.startedAt.toISOString()})`
        );
      }
    }
    return 0;
  }

  return handleHeadlessExecution(args, project);
}

function launchGui(args: ParsedCliArgs): void {
  const targetPath = args.targetPath
    ? path.resolve(process.cwd(), args.targetPath)
    : args.project ||
        args.tab ||
        args.runScript ||
        args.runPipeline ||
        args.depth ||
        args.envProfile
      ? process.cwd()
      : null;

  const launchOptions: CliLaunchOptions = {
    targetPath,
    project: args.project,
    tab: args.tab,
    depth: args.depth,
    openConfig: args.openConfig,
    theme: args.theme,
    runScript: args.runScript,
    runPipeline: args.runPipeline,
    dryRun: args.dryRun,
    continueOnError: args.continueOnError,
    envProfile: args.envProfile
  };

  const encoded = Buffer.from(JSON.stringify(launchOptions), 'utf-8').toString('base64');
  const electronArgs: string[] = [`--nexus-launch=${encoded}`];
  if (args.newWindow) {
    electronArgs.push('--new-window');
  }

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
  const mainEntry = path.resolve(__dirname, '../main/index.js');
  const child = spawn(electronBinary, [mainEntry, ...electronArgs], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (isTerminalOnlyArgs(args)) {
    try {
      const code = await runTerminalMode(args);
      await disconnectPrisma();
      process.exit(code);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (args.json) {
        console.log(JSON.stringify({ ok: false, error: msg }));
      } else {
        console.error(`[Nexus CLI Erro] ${msg}`);
      }
      await disconnectPrisma();
      process.exit(1);
    }
    return;
  }

  if (shouldLaunchTui(args)) {
    try {
      const tuiEntry = pathToFileURL(path.join(__dirname, 'tui.mjs')).href;
      const tuiMod = (await import(tuiEntry)) as {
        startNexusTui: (options?: { autoSync?: boolean }) => Promise<void>;
      };
      await tuiMod.startNexusTui({ autoSync: args.sync });
      await disconnectPrisma();
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Nexus TUI Erro] ${msg}`);
      await disconnectPrisma();
      process.exit(1);
    }
    return;
  }

  launchGui(args);
  process.exit(0);
}

void main();
