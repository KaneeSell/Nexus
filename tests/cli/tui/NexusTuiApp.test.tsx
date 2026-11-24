import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NexusTuiApp,
  type TuiCommandItem,
  type TuiController,
  type TuiHistoryItem,
  type TuiInitialData,
  type TuiPipelineItem,
  type TuiProjectItem,
  type TuiRunnerCallbacks
} from '../../../src/cli/tui/NexusTuiApp';
import type { DetectedToolDTO } from '../../../src/shared/types';
import { flushInk, renderInk, type RenderInkResult } from '../../helpers/renderInk';

function makeTools(): DetectedToolDTO[] {
  return [
    {
      id: 'vscode',
      name: 'VS Code',
      category: 'ide',
      executable: 'C:\\VSCode\\Code.exe',
      commandName: 'code'
    },
    {
      id: 'wt',
      name: 'Windows Terminal',
      category: 'terminal',
      executable: 'wt.exe',
      commandName: 'wt'
    }
  ];
}

function makeProjects(count = 2): TuiProjectItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `proj-${idx + 1}`,
    name: idx === 0 ? 'nexus-api' : idx === 1 ? 'nexus-web' : `service-${idx + 1}`,
    path: `F:\\Projects\\proj-${idx + 1}`,
    adapterType: 'node',
    packageManager: idx % 2 === 0 ? 'pnpm' : 'npm',
    commandCount: 2,
    pipelineCount: 1,
    runCount: idx + 1,
    existsOnDisk: idx !== 1,
    lastScannedAt: '2026-11-24T12:00:00.000Z'
  }));
}

function makePipelines(): TuiPipelineItem[] {
  return [
    {
      id: 'pl-1',
      projectId: 'proj-1',
      projectName: 'nexus-api',
      projectPath: 'F:\\Projects\\proj-1',
      name: 'CI Pipeline',
      description: 'Build and test pipeline',
      steps: [
        {
          order: 0,
          name: 'Typecheck',
          kind: 'script',
          command: 'typecheck',
          onErrorAction: 'stop',
          onSuccessCommand: null,
          enabled: true
        },
        {
          order: 1,
          name: 'Lint',
          kind: 'script',
          command: 'lint',
          onErrorAction: 'continue',
          onSuccessCommand: null,
          enabled: false
        },
        {
          order: 2,
          name: 'Fallback Step',
          kind: 'command',
          command: 'echo ok',
          onErrorAction: 'run_command',
          onSuccessCommand: 'echo done',
          enabled: true
        }
      ]
    },
    {
      id: 'pl-2',
      projectId: 'proj-2',
      projectName: 'nexus-web',
      projectPath: 'F:\\Projects\\proj-2',
      name: 'Deploy Prod',
      description: '',
      steps: []
    }
  ];
}

function makeCommands(): TuiCommandItem[] {
  return [
    {
      id: 'cmd-1',
      projectId: 'proj-1',
      projectName: 'nexus-api',
      projectPath: 'F:\\Projects\\proj-1',
      packageManager: 'pnpm',
      name: 'dev',
      command: 'tsx watch src/index.ts',
      source: 'package.json'
    },
    {
      id: 'cmd-2',
      projectId: 'proj-2',
      projectName: 'nexus-web',
      projectPath: 'F:\\Projects\\proj-2',
      packageManager: 'npm',
      name: 'build-prod',
      command: 'vite build',
      source: 'package.json'
    }
  ];
}

function makeHistory(): TuiHistoryItem[] {
  return [
    {
      id: 'run-1',
      projectName: 'nexus-api',
      title: 'Pipeline: CI Pipeline',
      status: 'success',
      startedAt: '2026-11-24T12:00:00.000Z',
      finishedAt: '2026-11-24T12:00:02.500Z',
      logs: 'step 1 ok\n\nstep 2 ok'
    },
    {
      id: 'run-2',
      projectName: 'nexus-web',
      title: 'Script: build',
      status: 'failed',
      startedAt: '2026-11-24T12:05:00.000Z',
      finishedAt: '2026-11-24T12:05:00.350Z',
      logs: ''
    },
    {
      id: 'run-3',
      projectName: 'nexus-api',
      title: 'Script: dev',
      status: 'cancelled',
      startedAt: '2026-11-24T12:10:00.000Z',
      finishedAt: null,
      logs: 'cancelled by user'
    },
    {
      id: 'run-4',
      projectName: 'nexus-api',
      title: 'Script: test',
      status: 'running',
      startedAt: '2026-11-24T12:11:00.000Z',
      finishedAt: null,
      logs: 'running...'
    }
  ];
}

function makeInitialData(overrides: Partial<TuiInitialData> = {}): TuiInitialData {
  const projects = overrides.projects ?? makeProjects();
  const pipelines = overrides.pipelines ?? makePipelines();
  const commands = overrides.commands ?? makeCommands();
  const history = overrides.history ?? makeHistory();
  return {
    version: '0.1.0',
    dbPath: 'F:\\Nexus\\prisma\\dev.db',
    projects,
    pipelines,
    commands,
    history,
    detectedTools: overrides.detectedTools ?? makeTools(),
    stats: overrides.stats ?? {
      projectCount: projects.length,
      pipelineCount: pipelines.length,
      commandCount: commands.length,
      runCount: history.length,
      isPreview: false
    }
  };
}

function makeController(
  data: TuiInitialData,
  overrides: Partial<TuiController> = {}
): TuiController {
  return {
    onReloadData: vi.fn(async () => data),
    onSync: vi.fn(async (onProgress) => {
      onProgress({ message: 'Scanning...', current: 1, total: 2 });
      return {
        summary: {
          scannedWorkspaces: 1,
          updatedProjects: data.projects.length,
          missingProjects: [],
          errors: []
        },
        data
      };
    }),
    onRunPipeline: vi.fn(async () => 'run-pl-1'),
    onRunCommand: vi.fn(async () => 'run-cmd-1'),
    onCancelRun: vi.fn(async () => true),
    onOpenGui: vi.fn(),
    onOpenTool: vi.fn(async () => {}),
    ...overrides
  };
}

let activeRender: RenderInkResult | null = null;

afterEach(() => {
  vi.useRealTimers();
  if (activeRender) {
    activeRender.unmount();
    activeRender = null;
  }
});

describe('NexusTuiApp', () => {
  it('regression: handles keypresses during boot and across commands without React Hook Error #321', async () => {
    const data = makeInitialData();
    const controller = makeController(data);
    activeRender = await renderInk(<NexusTuiApp initialData={data} controller={controller} />);

    expect(activeRender.lastFrame()).toContain('Inicializando Nexus CLI');

    // First keypress skips boot screen without throwing Invalid Hook Call
    await activeRender.press(' ');
    expect(activeRender.lastFrame()).toContain('DB LIVE');

    // Subsequent keypresses (the exact scenario that threw React Error #321 before fix)
    await activeRender.press('j');
    await activeRender.press('k');
    await activeRender.press('\t');
    await activeRender.press('/');
    await activeRender.press('a');
    await activeRender.press('\u001B');
    expect(activeRender.lastFrame()).toContain('Pipelines Salvos');
  });

  it('completes boot animation automatically via timer and runs autoSync when enabled', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
    });
    const data = makeInitialData();
    let resolveSync: ((v: { summary: { scannedWorkspaces: number; updatedProjects: number; missingProjects: string[]; errors: string[] }; data: TuiInitialData }) => void) | null = null;
    const controller = makeController(data, {
      onSync: vi.fn(
        (onProgress) =>
          new Promise((resolve) => {
            onProgress({ message: 'Auto-syncing...', current: 1, total: 2 });
            resolveSync = resolve;
          })
      )
    });

    activeRender = await renderInk(
      <NexusTuiApp initialData={data} controller={controller} autoSync />
    );

    await vi.advanceTimersByTimeAsync(600);
    await flushInk();

    expect(controller.onSync).toHaveBeenCalledTimes(1);
    expect(activeRender.lastFrame()).toContain('Auto-syncing...');

    // Pressing 'r' while already syncing should be ignored
    await activeRender.press('r');
    expect(controller.onSync).toHaveBeenCalledTimes(1);

    resolveSync!({
      summary: {
        scannedWorkspaces: 1,
        updatedProjects: 2,
        missingProjects: ['F:\\Missing'],
        errors: []
      },
      data
    });
    await flushInk();
    expect(activeRender.lastFrame()).toContain('1 ausente(s) no disco');

    // Toast disappears after 3200ms and tick alternates pulse/cursor icons
    await vi.advanceTimersByTimeAsync(3300);
    await flushInk();
    expect(activeRender.lastFrame()).toContain('SQLite conectado');
  });

  it('supports compact layout, undefined stdout.columns, non-TTY warning, and PREVIEW mode guards', async () => {
    const previewData = makeInitialData({
      projects: [],
      pipelines: [],
      commands: [],
      history: [],
      detectedTools: [],
      stats: {
        projectCount: 0,
        pipelineCount: 0,
        commandCount: 0,
        runCount: 0,
        isPreview: true
      }
    });
    const controller = makeController(previewData);

    activeRender = await renderInk(
      <NexusTuiApp initialData={previewData} controller={controller} />,
      { columns: 80, isTTY: false }
    );
    expect(activeRender.lastFrame()).toContain('Inicializando Nexus CLI');
    activeRender.unmount();

    // Non-TTY after boot via fake timers
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
    });
    activeRender = await renderInk(
      <NexusTuiApp initialData={previewData} controller={controller} />,
      { hasColumns: false, isTTY: false }
    );
    await vi.advanceTimersByTimeAsync(600);
    await flushInk();
    expect(activeRender.lastFrame()).toContain('PREVIEW');
    expect(activeRender.lastFrame()).toContain('Sem TTY interativo');
    activeRender.unmount();
    vi.useRealTimers();

    // Interactive PREVIEW mode guards
    activeRender = await renderInk(
      <NexusTuiApp initialData={previewData} controller={controller} />,
      { columns: 80, isTTY: true }
    );
    await activeRender.press(' ');
    await activeRender.press('2');
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Modo PREVIEW');

    await activeRender.press('3');
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Modo PREVIEW');

    // 'o' when there are no non-terminal tools
    await activeRender.press('o');
    expect(activeRender.lastFrame()).toContain('Ferramentas: terminal');
    await activeRender.press('\r');
  });

  it('navigates all 4 tabs, scrolling window, selection bounds, and empty filtered states', async () => {
    const manyProjects = makeProjects(12);
    const data = makeInitialData({ projects: manyProjects });
    const controller = makeController(data);

    activeRender = await renderInk(<NexusTuiApp initialData={data} controller={controller} />);
    await activeRender.press(' ');

    // Scroll down with downArrow and j, then up with upArrow and k
    for (let i = 0; i < 8; i += 1) {
      await activeRender.press('\u001B[B');
    }
    expect(activeRender.lastFrame()).toContain('service-9');
    await activeRender.press('\u001B[A');
    await activeRender.press('j');
    await activeRender.press('k');

    // Missing on disk badge on proj-2
    await activeRender.press('1');
    await activeRender.press('j');
    expect(activeRender.lastFrame()).toContain('[ausente no disco]');

    // Enter on project switches to Commands tab filtered by project name
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Scripts & Comandos');
    expect(activeRender.lastFrame()).toContain('Filtro: "nexus-web"');

    // Escape clears active filter instead of exiting
    await activeRender.press('\u001B');
    expect(activeRender.lastFrame()).not.toContain('Filtro:');

    // Switch through tabs 1..4 and Tab cycling
    await activeRender.press('2');
    expect(activeRender.lastFrame()).toContain('Build and test pipeline');
    await activeRender.press('j');
    expect(activeRender.lastFrame()).toContain('Deploy Prod');

    await activeRender.press('4');
    expect(activeRender.lastFrame()).toContain('step 2 ok');
    await activeRender.press('j');
    expect(activeRender.lastFrame()).toContain('(Sem logs gravados)');
    await activeRender.press('j');
    expect(activeRender.lastFrame()).toContain('em andamento');

    await activeRender.press('\t'); // wraps from history -> projects
    expect(activeRender.lastFrame()).toContain('Projetos Cadastrados');

    // Filter with zero matches resets selection and shows empty state
    await activeRender.press('/');
    for (const ch of 'zzznomatch') {
      await activeRender.press(ch);
    }
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Nenhum item corresponde ao filtro.');
    expect(activeRender.lastFrame()).toContain('Selecione um item à esquerda');

    // Arrow keys on empty activeItems should not crash
    await activeRender.press('j');
    await activeRender.press('k');

    // Hotkey 'g' on empty projects (resolveSelectedProjectPath returns null)
    await activeRender.press('g');
    expect(controller.onOpenGui).toHaveBeenCalledWith(null);

    // Clear filter with slash command
    await activeRender.press('/');
    for (const ch of '/clear') {
      await activeRender.press(ch);
    }
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Filtro limpo.');
  });

  it('handles command mode typing, backspace, escape, empty submit, and all slash commands', async () => {
    const data = makeInitialData();
    const controller = makeController(data, {
      onOpenTool: vi.fn(async (toolId: string) => {
        if (toolId === 'terminal') throw new Error('no terminal');
        throw 'string-tool-error';
      }),
      onSync: vi.fn(async () => {
        throw new Error('sync boom');
      })
    });

    activeRender = await renderInk(<NexusTuiApp initialData={data} controller={controller} />);
    await activeRender.press(' ');

    // Typing filter + backspace (non-slash updates filterQuery)
    await activeRender.press('/');
    await activeRender.press('w');
    await activeRender.press('e');
    await activeRender.press('\u007F'); // backspace
    expect(activeRender.lastFrame()).toContain('Filtro: "w"');
    // Ignored ctrl+x inside commandMode
    await activeRender.press('\u0018');
    // Submit empty after deleting last char
    await activeRender.press('\u007F');
    await activeRender.press('\r');

    // Cancel command mode with Esc
    await activeRender.press('/');
    await activeRender.press('x');
    await activeRender.press('\u001B');
    expect(activeRender.lastFrame()).toContain('Filtro: "x"');
    await activeRender.press('\u001B'); // clear filter

    // /sync error branch (Error instance)
    await activeRender.press('/');
    for (const ch of '/sync') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('Falha no sync: sync boom');

    // Backspace while inside slash command keeps leading '/'
    await activeRender.press('/');
    await activeRender.press('/');
    await activeRender.press('a');
    await activeRender.press('\u007F');
    await activeRender.press('\u001B');

    // Unmapped key is safely ignored
    await activeRender.press('z');

    // Sync with empty progress message (rendered while pending) and zero missingProjects
    let finishSync!: (v: {
      summary: {
        scannedWorkspaces: number;
        updatedProjects: number;
        missingProjects: string[];
        errors: string[];
      };
      data: TuiInitialData;
    }) => void;
    (controller.onSync as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (onProgress: (info: { message: string; current: number; total: number }) => void) => {
        onProgress({ message: '', current: 0, total: 0 });
        return new Promise((resolve) => {
          finishSync = resolve;
        });
      }
    );
    await activeRender.press('r');
    expect(activeRender.lastFrame()).toContain('Sincronizando...');
    finishSync({
      summary: { scannedWorkspaces: 1, updatedProjects: 2, missingProjects: [], errors: [] },
      data
    });
    await flushInk();
    expect(activeRender.lastFrame()).toContain('Sync concluído: 2 projeto(s)');

    // Non-Error sync rejection
    (controller.onSync as ReturnType<typeof vi.fn>).mockRejectedValueOnce('raw sync fail');
    await activeRender.press('r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('Falha no sync: raw sync fail');

    // /filter and /gui across tabs
    await activeRender.press('/');
    for (const ch of '/filter api') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('nexus-api');

    await activeRender.press('/');
    for (const ch of '/gui') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(controller.onOpenGui).toHaveBeenCalledWith('F:\\Projects\\proj-1');

    // /open variations
    await activeRender.press('/');
    for (const ch of '/open') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Uso: /open <ferramenta>');

    // /open terminal failure (Error + non-Error)
    await activeRender.press('/');
    for (const ch of '/open terminal') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('no terminal');

    (controller.onOpenTool as ReturnType<typeof vi.fn>).mockRejectedValueOnce('term str err');
    await activeRender.press('/');
    for (const ch of '/open terminal') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('term str err');

    // /open terminal success
    (controller.onOpenTool as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await activeRender.press('/');
    for (const ch of '/open terminal') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('Terminal aberto');

    // /open tool failure (string rejection and Error instance) and success
    await activeRender.press('/');
    for (const ch of '/open code') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('string-tool-error');

    (controller.onOpenTool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('tool error instance')
    );
    await activeRender.press('/');
    for (const ch of '/open code') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('tool error instance');

    (controller.onOpenTool as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await activeRender.press('/');
    for (const ch of '/open vs code') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('Abrindo VS Code');

    // /open unknown tool
    await activeRender.press('/');
    for (const ch of '/open nonexistent') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('não detectada');

    // /open with empty detectedTools
    const noToolsData = makeInitialData({ detectedTools: [] });
    activeRender.unmount();
    activeRender = await renderInk(<NexusTuiApp initialData={noToolsData} controller={controller} />);
    await activeRender.press(' ');
    await activeRender.press('/');
    for (const ch of '/open') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Uso: /open terminal');

    // /help and unknown slash command
    await activeRender.press('/');
    for (const ch of '/help') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Cmds: /sync');

    await activeRender.press('/');
    for (const ch of '/unknown') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Comando desconhecido: /unknown');
  });

  it('executes pipelines and commands live, updates logs/steps, cancels, and reloads', async () => {
    const data = makeInitialData();
    let capturedCallbacks: TuiRunnerCallbacks | null = null;
    const controller = makeController(data, {
      onRunPipeline: vi.fn(async (_id, cbs) => {
        capturedCallbacks = cbs;
        cbs.onRunStatus({
          runId: 'run-live-1',
          projectId: 'proj-1',
          pipelineId: 'pl-1',
          title: 'Pipeline: CI Pipeline',
          status: 'running',
          startedAt: new Date().toISOString(),
          finishedAt: null
        });
        return 'run-live-1';
      }),
      onRunCommand: vi.fn(async (_cmd, cbs) => {
        capturedCallbacks = cbs;
        cbs.onRunStatus({
          runId: 'run-live-2',
          projectId: 'proj-1',
          pipelineId: null,
          title: 'Script: dev',
          status: 'running',
          startedAt: new Date().toISOString(),
          finishedAt: null
        });
        return 'run-live-2';
      })
    });

    activeRender = await renderInk(<NexusTuiApp initialData={data} controller={controller} />);
    await activeRender.press(' ');

    // 'o' shortcut with non-terminal tools pre-fills /open
    await activeRender.press('o');
    expect(activeRender.lastFrame()).toContain('❯ /open ');
    await activeRender.press('\u001B');

    // 'g' on pipelines & commands & history tabs
    await activeRender.press('2');
    await activeRender.press('g');
    expect(controller.onOpenGui).toHaveBeenCalledWith('F:\\Projects\\proj-1');
    await activeRender.press('3');
    await activeRender.press('g');
    await activeRender.press('4');
    await activeRender.press('g');
    await activeRender.press('\r'); // Enter on history tab is a safe no-op

    // /run with missing arg and not found
    await activeRender.press('/');
    for (const ch of '/run') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Uso: /run');

    await activeRender.press('/');
    for (const ch of '/run nope') await activeRender.press(ch);
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Alvo "nope" não encontrado');

    // /run partial pipeline match
    await activeRender.press('/');
    for (const ch of '/run ci pipe') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(controller.onRunPipeline).toHaveBeenCalledWith('pl-1', expect.any(Object));
    expect(activeRender.lastFrame()).toContain('Aguardando saída do processo');

    // Attempting to start another pipeline or command while running is blocked
    await activeRender.press('2');
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Já existe uma execução ativa');
    await activeRender.press('3');
    await activeRender.press('\r');
    expect(activeRender.lastFrame()).toContain('Já existe uma execução ativa');

    // Stream step statuses (out of order + update existing) and logs (stdout, stderr, system, blank)
    capturedCallbacks!.onStepStatus({
      runId: 'run-live-1',
      stepIndex: 1,
      stepName: 'Build',
      status: 'pending'
    });
    capturedCallbacks!.onStepStatus({
      runId: 'run-live-1',
      stepIndex: 0,
      stepName: 'Lint',
      status: 'running'
    });
    capturedCallbacks!.onStepStatus({
      runId: 'run-live-1',
      stepIndex: 0,
      stepName: 'Lint',
      status: 'success'
    });
    capturedCallbacks!.onLog({
      runId: 'run-live-1',
      stepIndex: 0,
      stream: 'system',
      chunk: 'Starting...\n   \n',
      timestamp: new Date().toISOString()
    });
    capturedCallbacks!.onLog({
      runId: 'run-live-1',
      stepIndex: 0,
      stream: 'stdout',
      chunk: 'Compiled OK\n',
      timestamp: new Date().toISOString()
    });
    capturedCallbacks!.onLog({
      runId: 'run-live-1',
      stepIndex: 0,
      stream: 'stderr',
      chunk: 'Minor warning\n',
      timestamp: new Date().toISOString()
    });
    await flushInk();
    expect(activeRender.lastFrame()).toContain('1.Lint:success');
    expect(activeRender.lastFrame()).toContain('Compiled OK');
    expect(activeRender.lastFrame()).toContain('Minor warning');

    // Cancel via 'c' and via Ctrl+C
    await activeRender.press('c');
    expect(controller.onCancelRun).toHaveBeenCalledWith('run-live-1');
    await activeRender.press('\u0003');
    expect(controller.onCancelRun).toHaveBeenCalledTimes(2);

    // Finish run triggers onReloadData
    capturedCallbacks!.onRunStatus({
      runId: 'run-live-1',
      projectId: 'proj-1',
      pipelineId: 'pl-1',
      title: 'Pipeline: CI Pipeline',
      status: 'cancelled',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    });
    await flushInk();
    expect(controller.onReloadData).toHaveBeenCalled();

    // Close console with 'x'
    await activeRender.press('x');
    expect(activeRender.lastFrame()).not.toContain('x fechar console');

    // Run command via Enter on Commands tab & /run partial command match
    await activeRender.press('3');
    await activeRender.press('\r');
    await flushInk();
    expect(controller.onRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cmd-1' }),
      expect.any(Object)
    );
    capturedCallbacks!.onRunStatus({
      runId: 'run-live-2',
      projectId: 'proj-1',
      pipelineId: null,
      title: 'Script: dev',
      status: 'success',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    });
    await flushInk();

    await activeRender.press('/');
    for (const ch of '/run build-pr') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(controller.onRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cmd-2' }),
      expect.any(Object)
    );

    // Finish and test error paths for pipeline & command execution
    capturedCallbacks!.onRunStatus({
      runId: 'run-live-2',
      projectId: 'proj-1',
      pipelineId: null,
      title: 'Script: build-prod',
      status: 'success',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    });
    await flushInk();

    (controller.onRunPipeline as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('pl boom')
    );
    await activeRender.press('2');
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('pl boom');

    (controller.onRunPipeline as ReturnType<typeof vi.fn>).mockRejectedValueOnce('pl str boom');
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('pl str boom');

    (controller.onRunCommand as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('cmd boom')
    );
    await activeRender.press('3');
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('cmd boom');

    (controller.onRunCommand as ReturnType<typeof vi.fn>).mockRejectedValueOnce('cmd str boom');
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('cmd str boom');
  });

  it('handles empty non-preview database states across all tabs and null activeRun fallback', async () => {
    const emptyLiveData = makeInitialData({
      projects: [],
      pipelines: [],
      commands: [],
      history: [],
      stats: {
        projectCount: 0,
        pipelineCount: 0,
        commandCount: 0,
        runCount: 0,
        isPreview: false
      }
    });
    const controller = makeController(emptyLiveData);
    activeRender = await renderInk(
      <NexusTuiApp initialData={emptyLiveData} controller={controller} />
    );
    await activeRender.press(' ');

    expect(activeRender.lastFrame()).toContain('Nenhum registro encontrado no banco.');

    // Projects tab empty Enter + g + /open fallback to process.cwd()
    await activeRender.press('\r');
    await activeRender.press('g');
    await activeRender.press('/');
    for (const ch of '/open terminal') await activeRender.press(ch);
    await activeRender.press('\r');
    await flushInk();
    expect(controller.onOpenTool).toHaveBeenCalledWith('terminal', process.cwd());

    // Pipelines, Commands, History tabs empty Enter + g
    await activeRender.press('2');
    await activeRender.press('\r');
    await activeRender.press('g');
    await activeRender.press('3');
    await activeRender.press('\r');
    await activeRender.press('g');
    await activeRender.press('4');
    await activeRender.press('g');
    expect(controller.onOpenGui).toHaveBeenCalledWith(null);

    // Trigger runnerOpen with activeRun === null by rejecting onRunPipeline without calling onRunStatus
    const plData = makeInitialData();
    const pendingController = makeController(plData, {
      onRunPipeline: vi.fn(async () => {
        throw new Error('early fail');
      })
    });
    activeRender.unmount();
    activeRender = await renderInk(
      <NexusTuiApp initialData={plData} controller={pendingController} />
    );
    await activeRender.press(' ');
    await activeRender.press('2');
    await activeRender.press('\r');
    await flushInk();
    expect(activeRender.lastFrame()).toContain('Execução');
  });

  it('exits via q, Esc, Ctrl+C (when idle), /quit, and /exit', { timeout: 15000 }, async () => {
    const data = makeInitialData();
    const controller = makeController(data);

    const exitActions: Array<() => Promise<void>> = [
      async () => {
        await activeRender!.press('q');
      },
      async () => {
        await activeRender!.press('\u001B');
      },
      async () => {
        await activeRender!.press('\u0003');
      },
      async () => {
        await activeRender!.press('/');
        for (const ch of '/quit') await activeRender!.press(ch);
        await activeRender!.press('\r');
      },
      async () => {
        await activeRender!.press('/');
        for (const ch of '/exit') await activeRender!.press(ch);
        await activeRender!.press('\r');
      }
    ];

    for (const action of exitActions) {
      activeRender = await renderInk(<NexusTuiApp initialData={data} controller={controller} />);
      const exitPromise = activeRender.instance.waitUntilExit();
      await activeRender.press(' ');
      await action();
      await expect(exitPromise).resolves.toBeUndefined();
      activeRender.unmount();
      activeRender = null;
    }
  });
});
