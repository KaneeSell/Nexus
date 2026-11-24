import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SyncProgressInfo, SyncSummary } from '../../main/scanner/dbSync';
import type {
  DetectedToolDTO,
  RunLogEvent,
  RunStatusEvent,
  StepStatusEvent
} from '../../shared/types';

export interface TuiProjectItem {
  id: string;
  name: string;
  path: string;
  adapterType: string;
  packageManager: string;
  commandCount: number;
  pipelineCount: number;
  runCount: number;
  existsOnDisk: boolean;
  lastScannedAt: string;
}

export interface TuiPipelineStepItem {
  order: number;
  name: string;
  kind: string;
  command: string;
  onErrorAction: string;
  onSuccessCommand: string | null;
  enabled: boolean;
}

export interface TuiPipelineItem {
  id: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  name: string;
  description: string;
  steps: TuiPipelineStepItem[];
}

export interface TuiCommandItem {
  id: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  packageManager: string;
  name: string;
  command: string;
  source: string;
}

export interface TuiHistoryItem {
  id: string;
  projectName: string;
  title: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  logs: string;
}

export interface TuiInitialData {
  version: string;
  dbPath: string;
  projects: TuiProjectItem[];
  pipelines: TuiPipelineItem[];
  commands: TuiCommandItem[];
  history: TuiHistoryItem[];
  detectedTools: DetectedToolDTO[];
  stats: {
    projectCount: number;
    pipelineCount: number;
    commandCount: number;
    runCount: number;
    isPreview: boolean;
  };
}

export interface TuiRunnerCallbacks {
  onLog: (event: RunLogEvent) => void;
  onRunStatus: (event: RunStatusEvent) => void;
  onStepStatus: (event: StepStatusEvent) => void;
}

export interface TuiController {
  onReloadData: () => Promise<TuiInitialData>;
  onSync: (
    onProgress: (info: SyncProgressInfo) => void
  ) => Promise<{ summary: SyncSummary; data: TuiInitialData }>;
  onRunPipeline: (pipelineId: string, callbacks: TuiRunnerCallbacks) => Promise<string>;
  onRunCommand: (command: TuiCommandItem, callbacks: TuiRunnerCallbacks) => Promise<string>;
  onCancelRun: (runId: string) => Promise<boolean>;
  onOpenGui: (targetPath?: string | null) => void;
  onOpenTool: (toolId: string, targetPath: string) => Promise<void>;
}

type TabKey = 'projects' | 'pipelines' | 'commands' | 'history';

const LOGO_LINES = [
  '███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗',
  '████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝',
  '██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗',
  '██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║',
  '██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║',
  '╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝'
];

const SHIMMER_PALETTE = ['#7C9CFF', '#60A5FA', '#38BDF8', '#34D399', '#A78BFA', '#60A5FA'];
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const PREVIEW_PROJECTS: TuiProjectItem[] = [
  {
    id: 'preview-1',
    name: 'nexus-core-api',
    path: 'C:\\Projetos\\nexus-core-api',
    adapterType: 'node',
    packageManager: 'pnpm',
    commandCount: 4,
    pipelineCount: 2,
    runCount: 14,
    existsOnDisk: true,
    lastScannedAt: new Date().toISOString()
  },
  {
    id: 'preview-2',
    name: 'nexus-web-dashboard',
    path: 'C:\\Projetos\\nexus-web-dashboard',
    adapterType: 'node',
    packageManager: 'npm',
    commandCount: 3,
    pipelineCount: 1,
    runCount: 8,
    existsOnDisk: true,
    lastScannedAt: new Date().toISOString()
  }
];

const PREVIEW_PIPELINES: TuiPipelineItem[] = [
  {
    id: 'prev-pl-1',
    projectId: 'preview-1',
    projectName: 'nexus-core-api',
    projectPath: 'C:\\Projetos\\nexus-core-api',
    name: 'CI/CD Full Check',
    description: 'Validação de tipos, testes e build de produção',
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
        name: 'Build Final',
        kind: 'script',
        command: 'build',
        onErrorAction: 'stop',
        onSuccessCommand: null,
        enabled: true
      }
    ]
  }
];

const PREVIEW_COMMANDS: TuiCommandItem[] = [
  {
    id: 'prev-cmd-1',
    projectId: 'preview-1',
    projectName: 'nexus-core-api',
    projectPath: 'C:\\Projetos\\nexus-core-api',
    packageManager: 'pnpm',
    name: 'dev',
    command: 'tsx watch src/index.ts',
    source: 'package.json (preview)'
  },
  {
    id: 'prev-cmd-2',
    projectId: 'preview-2',
    projectName: 'nexus-web-dashboard',
    projectPath: 'C:\\Projetos\\nexus-web-dashboard',
    packageManager: 'npm',
    name: 'build',
    command: 'vite build',
    source: 'package.json (preview)'
  }
];

const PREVIEW_HISTORY: TuiHistoryItem[] = [
  {
    id: 'prev-run-1',
    projectName: 'nexus-core-api',
    title: 'Pipeline: CI/CD Full Check',
    status: 'success',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    logs: '✓ Etapa concluída com sucesso (código 0).'
  }
];

function renderProgressBar(percent: number, width = 16): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${clamped}%`;
}

function errorBadgeColor(action: string): string {
  if (action === 'continue') return '#FBBF24';
  if (action === 'run_command') return '#38BDF8';
  return '#F87171';
}

function statusBadgeColor(status: string): string {
  if (status === 'success' || status === 'ready') return '#34D399';
  if (status === 'failed') return '#F87171';
  if (status === 'cancelled' || status === 'skipped') return '#FBBF24';
  return '#60A5FA';
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return 'em andamento';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function NexusTuiApp({
  initialData,
  controller,
  autoSync = false
}: {
  initialData: TuiInitialData;
  controller: TuiController;
  autoSync?: boolean;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { isRawModeSupported } = useStdin();

  const [data, setData] = useState<TuiInitialData>(initialData);
  const [tick, setTick] = useState(0);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootDone, setBootDone] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('projects');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [syncing, setSyncing] = useState(false);
  const [syncPercent, setSyncPercent] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [statusToast, setStatusToast] = useState<{ text: string; color: string } | null>(null);

  const [commandMode, setCommandMode] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const [runnerOpen, setRunnerOpen] = useState(false);
  const [activeRun, setActiveRun] = useState<RunStatusEvent | null>(null);
  const [stepStatuses, setStepStatuses] = useState<StepStatusEvent[]>([]);
  const [runLogs, setRunLogs] = useState<RunLogEvent[]>([]);
  const activeRunRef = useRef<RunStatusEvent | null>(null);
  activeRunRef.current = activeRun;

  const showToast = useCallback((text: string, color = '#34D399') => {
    setStatusToast({ text, color });
  }, []);

  const projects = useMemo(() => {
    const base = data.stats.isPreview ? PREVIEW_PROJECTS : data.projects;
    const q = filterQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.packageManager.toLowerCase().includes(q)
    );
  }, [data.projects, data.stats.isPreview, filterQuery]);

  const pipelines = useMemo(() => {
    const base = data.stats.isPreview ? PREVIEW_PIPELINES : data.pipelines;
    const q = filterQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        pl.projectName.toLowerCase().includes(q) ||
        pl.description.toLowerCase().includes(q)
    );
  }, [data.pipelines, data.stats.isPreview, filterQuery]);

  const commands = useMemo(() => {
    const base = data.stats.isPreview ? PREVIEW_COMMANDS : data.commands;
    const q = filterQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.command.toLowerCase().includes(q) ||
        c.projectName.toLowerCase().includes(q)
    );
  }, [data.commands, data.stats.isPreview, filterQuery]);

  const history = useMemo(() => {
    const base = data.stats.isPreview ? PREVIEW_HISTORY : data.history;
    const q = filterQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.projectName.toLowerCase().includes(q) ||
        h.status.toLowerCase().includes(q)
    );
  }, [data.history, data.stats.isPreview, filterQuery]);

  const activeItems = useMemo(() => {
    if (activeTab === 'projects') return projects;
    if (activeTab === 'pipelines') return pipelines;
    if (activeTab === 'commands') return commands;
    return history;
  }, [activeTab, projects, pipelines, commands, history]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 120);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bootDone) return;
    const bootTimer = setInterval(() => {
      setBootProgress((prev) => {
        const next = Math.min(100, prev + 22);
        if (next >= 100) {
          setBootDone(true);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(bootTimer);
  }, [bootDone]);

  useEffect(() => {
    if (!statusToast) return;
    const timeout = setTimeout(() => setStatusToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [statusToast]);

  useEffect(() => {
    if (selectedIndex >= activeItems.length) {
      setSelectedIndex(Math.max(0, activeItems.length - 1));
    }
  }, [activeItems.length, selectedIndex]);

  const triggerSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncPercent(0);
    setSyncMessage('Sincronizando workspaces...');
    try {
      const result = await controller.onSync((info) => {
        setSyncMessage(info.message);
        const pct = Math.round((info.current / Math.max(info.total, 1)) * 100);
        setSyncPercent(pct);
      });
      setData(result.data);
      const missingMsg =
        result.summary.missingProjects.length > 0
          ? ` (${result.summary.missingProjects.length} ausente(s) no disco)`
          : '';
      showToast(
        `✓ Sync concluído: ${result.summary.updatedProjects} projeto(s)${missingMsg}`,
        '#34D399'
      );
    } catch (err) {
      showToast(
        `✗ Falha no sync: ${err instanceof Error ? err.message : String(err)}`,
        '#F87171'
      );
    } finally {
      setSyncing(false);
    }
  }, [controller, showToast, syncing]);

  const autoSyncTriggered = useRef(false);
  useEffect(() => {
    if (autoSync && bootDone && !autoSyncTriggered.current) {
      autoSyncTriggered.current = true;
      void triggerSync();
    }
  }, [autoSync, bootDone, triggerSync]);

  const createRunnerCallbacks = useCallback((): TuiRunnerCallbacks => {
    return {
      onLog: (event) => {
        setRunLogs((prev) => [...prev.slice(-200), event]);
      },
      onStepStatus: (event) => {
        setStepStatuses((prev) => {
          const filtered = prev.filter((s) => s.stepIndex !== event.stepIndex);
          return [...filtered, event].sort((a, b) => a.stepIndex - b.stepIndex);
        });
      },
      onRunStatus: (event) => {
        setActiveRun(event);
        if (event.status !== 'running') {
          void controller.onReloadData().then((fresh) => setData(fresh));
        }
      }
    };
  }, [controller]);

  const startPipelineExecution = useCallback(
    async (pl: TuiPipelineItem) => {
      if (data.stats.isPreview || pl.id.startsWith('prev-')) {
        showToast('Modo PREVIEW: pressione r para sincronizar projetos reais primeiro.', '#FBBF24');
        return;
      }
      if (activeRunRef.current?.status === 'running') {
        showToast('Já existe uma execução ativa. Pressione c para cancelar.', '#FBBF24');
        return;
      }
      setRunLogs([]);
      setStepStatuses([]);
      setRunnerOpen(true);
      try {
        await controller.onRunPipeline(pl.id, createRunnerCallbacks());
      } catch (err) {
        showToast(`✗ ${err instanceof Error ? err.message : String(err)}`, '#F87171');
      }
    },
    [controller, createRunnerCallbacks, data.stats.isPreview, showToast]
  );

  const startCommandExecution = useCallback(
    async (cmd: TuiCommandItem) => {
      if (data.stats.isPreview || cmd.id.startsWith('prev-')) {
        showToast('Modo PREVIEW: pressione r para sincronizar projetos reais primeiro.', '#FBBF24');
        return;
      }
      if (activeRunRef.current?.status === 'running') {
        showToast('Já existe uma execução ativa. Pressione c para cancelar.', '#FBBF24');
        return;
      }
      setRunLogs([]);
      setStepStatuses([]);
      setRunnerOpen(true);
      try {
        await controller.onRunCommand(cmd, createRunnerCallbacks());
      } catch (err) {
        showToast(`✗ ${err instanceof Error ? err.message : String(err)}`, '#F87171');
      }
    },
    [controller, createRunnerCallbacks, data.stats.isPreview, showToast]
  );

  const resolveSelectedProjectPath = useCallback((): string | null => {
    if (activeTab === 'projects') return projects[selectedIndex]?.path ?? null;
    if (activeTab === 'pipelines') return pipelines[selectedIndex]?.projectPath ?? null;
    if (activeTab === 'commands') return commands[selectedIndex]?.projectPath ?? null;
    return projects[0]?.path ?? null;
  }, [activeTab, commands, pipelines, projects, selectedIndex]);

  const executeSlashCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setFilterQuery('');
        return;
      }
      if (!trimmed.startsWith('/')) {
        setFilterQuery(trimmed);
        setSelectedIndex(0);
        return;
      }

      const [cmdName, ...rest] = trimmed.slice(1).split(/\s+/);
      const arg = rest.join(' ').trim();
      switch (cmdName.toLowerCase()) {
        case 'sync':
          void triggerSync();
          break;
        case 'clear':
          setFilterQuery('');
          showToast('Filtro limpo.', '#38BDF8');
          break;
        case 'filter':
          setFilterQuery(arg);
          setSelectedIndex(0);
          break;
        case 'gui':
          controller.onOpenGui(resolveSelectedProjectPath());
          showToast('✓ Abrindo Nexus Electron...', '#34D399');
          break;
        case 'open': {
          const targetDir = resolveSelectedProjectPath() ?? process.cwd();
          const available = data.detectedTools;
          if (!arg) {
            const ids = available.map((t) => t.id).join(', ');
            showToast(
              ids
                ? `Uso: /open <ferramenta> (detectadas: ${ids}, terminal)`
                : 'Uso: /open terminal',
              '#38BDF8'
            );
            break;
          }
          const needle = arg.toLowerCase();
          if (needle === 'terminal') {
            void controller
              .onOpenTool('terminal', targetDir)
              .then(() => showToast(`✓ Terminal aberto em ${targetDir}`, '#34D399'))
              .catch((err) =>
                showToast(`✗ ${err instanceof Error ? err.message : String(err)}`, '#F87171')
              );
            break;
          }
          const matchedTool =
            available.find((t) => t.id.toLowerCase() === needle) ??
            available.find(
              (t) =>
                t.name.toLowerCase().includes(needle) ||
                t.commandName.toLowerCase() === needle
            );
          if (!matchedTool) {
            showToast(`Ferramenta "${arg}" não detectada neste PC.`, '#F87171');
            break;
          }
          void controller
            .onOpenTool(matchedTool.id, targetDir)
            .then(() => showToast(`✓ Abrindo ${matchedTool.name}...`, '#34D399'))
            .catch((err) =>
              showToast(`✗ ${err instanceof Error ? err.message : String(err)}`, '#F87171')
            );
          break;
        }
        case 'run': {
          if (!arg) {
            showToast('Uso: /run <nome-do-pipeline-ou-script>', '#FBBF24');
            break;
          }
          const needle = arg.toLowerCase();
          const matchedPl =
            data.pipelines.find((p) => p.name.toLowerCase() === needle) ??
            data.pipelines.find((p) => p.name.toLowerCase().includes(needle));
          if (matchedPl) {
            void startPipelineExecution(matchedPl);
            break;
          }
          const matchedCmd =
            data.commands.find((c) => c.name.toLowerCase() === needle) ??
            data.commands.find((c) => c.name.toLowerCase().includes(needle));
          if (matchedCmd) {
            void startCommandExecution(matchedCmd);
            break;
          }
          showToast(`Alvo "${arg}" não encontrado no banco.`, '#F87171');
          break;
        }
        case 'help':
          showToast('Cmds: /sync · /run <nome> · /open <app> · /filter <txt> · /gui · /quit', '#38BDF8');
          break;
        case 'quit':
        case 'exit':
          exit();
          break;
        default:
          showToast(`Comando desconhecido: /${cmdName} (use /help)`, '#FBBF24');
          break;
      }
    },
    [
      controller,
      data.commands,
      data.detectedTools,
      data.pipelines,
      exit,
      resolveSelectedProjectPath,
      showToast,
      startCommandExecution,
      startPipelineExecution,
      triggerSync
    ]
  );

  useInput(
    (input, key) => {
      if (!bootDone) {
        setBootProgress(100);
        setBootDone(true);
        return;
      }

      if (key.ctrl && input === 'c') {
        if (activeRunRef.current?.status === 'running') {
          void controller.onCancelRun(activeRunRef.current.runId);
          showToast('Cancelando execução...', '#FBBF24');
          return;
        }
        exit();
        return;
      }

      if (commandMode) {
        if (key.escape) {
          setCommandMode(false);
          setCommandInput('');
          return;
        }
        if (key.return) {
          const submitted = commandInput;
          setCommandMode(false);
          setCommandInput('');
          executeSlashCommand(submitted);
          return;
        }
        if (key.backspace || key.delete) {
          setCommandInput((prev) => {
            const next = prev.slice(0, -1);
            if (!next.startsWith('/')) {
              setFilterQuery(next);
            }
            return next;
          });
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setCommandInput((prev) => {
            const next = prev + input;
            if (!next.startsWith('/')) {
              setFilterQuery(next);
              setSelectedIndex(0);
            }
            return next;
          });
        }
        return;
      }

      if (input === 'q') {
        exit();
        return;
      }

      if (key.escape) {
        if (filterQuery) {
          setFilterQuery('');
          return;
        }
        exit();
        return;
      }

      if (input === '/') {
        setCommandMode(true);
        setCommandInput('');
        return;
      }

      if (key.tab) {
        const order: TabKey[] = ['projects', 'pipelines', 'commands', 'history'];
        const next = order[(order.indexOf(activeTab) + 1) % order.length];
        setActiveTab(next);
        setSelectedIndex(0);
        return;
      }

      if (input === '1') {
        setActiveTab('projects');
        setSelectedIndex(0);
        return;
      }
      if (input === '2') {
        setActiveTab('pipelines');
        setSelectedIndex(0);
        return;
      }
      if (input === '3') {
        setActiveTab('commands');
        setSelectedIndex(0);
        return;
      }
      if (input === '4') {
        setActiveTab('history');
        setSelectedIndex(0);
        return;
      }

      if (input === 'r') {
        void triggerSync();
        return;
      }

      if (input === 'g') {
        controller.onOpenGui(resolveSelectedProjectPath());
        showToast('✓ Abrindo interface gráfica Electron...', '#34D399');
        return;
      }

      if (input === 'o') {
        const ids = data.detectedTools
          .filter((t) => t.category !== 'terminal')
          .map((t) => t.id)
          .join(', ');
        showToast(`Ferramentas: ${ids ? `${ids}, ` : ''}terminal`, '#38BDF8');
        setCommandMode(true);
        setCommandInput('/open ');
        return;
      }

      if (input === 'c' && activeRunRef.current?.status === 'running') {
        void controller.onCancelRun(activeRunRef.current.runId);
        showToast('Cancelando execução...', '#FBBF24');
        return;
      }

      if (input === 'x' && runnerOpen && activeRunRef.current?.status !== 'running') {
        setRunnerOpen(false);
        return;
      }

      if (key.return) {
        if (activeTab === 'pipelines') {
          const pl = pipelines[selectedIndex];
          if (pl) void startPipelineExecution(pl);
        } else if (activeTab === 'commands') {
          const cmd = commands[selectedIndex];
          if (cmd) void startCommandExecution(cmd);
        } else if (activeTab === 'projects') {
          const proj = projects[selectedIndex];
          if (proj) {
            setFilterQuery(proj.name);
            setActiveTab('commands');
            setSelectedIndex(0);
          }
        }
        return;
      }

      if (key.downArrow || input === 'j') {
        if (activeItems.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % activeItems.length);
        }
        return;
      }

      if (key.upArrow || input === 'k') {
        if (activeItems.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
        }
      }
    },
    { isActive: Boolean(isRawModeSupported) }
  );

  const spinner = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];
  const terminalCols = stdout.columns ?? 100;
  const compactMode = terminalCols < 88;
  const revealLines = bootDone
    ? LOGO_LINES.length
    : Math.max(1, Math.ceil((bootProgress / 100) * LOGO_LINES.length));

  const visibleLogLines = useMemo(() => {
    const joined = runLogs.map((l) => ({ stream: l.stream, chunk: l.chunk }));
    const lines: Array<{ stream: RunLogEvent['stream']; text: string }> = [];
    for (const entry of joined) {
      for (const line of entry.chunk.split(/\r?\n/)) {
        if (line.trim().length > 0) {
          lines.push({ stream: entry.stream, text: line });
        }
      }
    }
    return lines.slice(-8);
  }, [runLogs]);

  if (!bootDone) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="#7C9CFF"
          paddingX={2}
          paddingY={1}
        >
          {LOGO_LINES.slice(0, revealLines).map((line, idx) => (
            <Text key={idx} color={SHIMMER_PALETTE[(idx + tick) % SHIMMER_PALETTE.length]} bold>
              {line}
            </Text>
          ))}
          <Box marginTop={1} gap={2}>
            <Text color="#38BDF8" bold>
              {spinner} Inicializando Nexus CLI...
            </Text>
            <Text color="#A78BFA">{renderProgressBar(bootProgress, 20)}</Text>
          </Box>
          <Text dimColor>Pressione qualquer tecla para pular</Text>
        </Box>
      </Box>
    );
  }

  const maxVisibleRows = runnerOpen ? 7 : 10;
  const windowStart = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxVisibleRows / 2), Math.max(0, activeItems.length - maxVisibleRows))
  );
  const visibleItems = activeItems.slice(windowStart, windowStart + maxVisibleRows);

  const selectedProject = activeTab === 'projects' ? projects[selectedIndex] ?? null : null;
  const selectedPipeline = activeTab === 'pipelines' ? pipelines[selectedIndex] ?? null : null;
  const selectedCommand = activeTab === 'commands' ? commands[selectedIndex] ?? null : null;
  const selectedHistory = activeTab === 'history' ? history[selectedIndex] ?? null : null;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {/* Header animado */}
      <Box
        borderStyle="round"
        borderColor="#7C9CFF"
        paddingX={2}
        paddingY={1}
        flexDirection={compactMode ? 'column' : 'row'}
        justifyContent="space-between"
        gap={2}
      >
        <Box flexDirection="column">
          {LOGO_LINES.map((line, idx) => {
            const color = SHIMMER_PALETTE[(idx + Math.floor(tick / 2)) % SHIMMER_PALETTE.length];
            return (
              <Text key={idx} color={color} bold>
                {line}
              </Text>
            );
          })}
        </Box>

        <Box flexDirection="column" justifyContent="space-between" flexGrow={1}>
          <Box justifyContent="space-between" gap={1}>
            <Text bold color="#E2E8F0">
              Nexus Terminal Orchestrator{' '}
              <Text color="#7C9CFF">v{data.version}</Text>
            </Text>
            {data.stats.isPreview ? (
              <Text color="#0B0F17" backgroundColor="#FBBF24" bold>
                {' PREVIEW '}
              </Text>
            ) : (
              <Text color="#0B0F17" backgroundColor="#34D399" bold>
                {' DB LIVE '}
              </Text>
            )}
          </Box>

          <Box marginTop={1} flexDirection="column">
            {syncing ? (
              <Text color="#38BDF8" bold>
                {spinner} {syncMessage || 'Sincronizando...'} {renderProgressBar(syncPercent, 12)}
              </Text>
            ) : statusToast ? (
              <Text color={statusToast.color} bold>
                {statusToast.text}
              </Text>
            ) : (
              <Text color={tick % 8 < 4 ? '#34D399' : '#6EE7B7'}>
                {tick % 8 < 4 ? '●' : '◉'} SQLite conectado{' '}
                <Text dimColor>({data.dbPath})</Text>
              </Text>
            )}

            <Box marginTop={1} gap={2} flexWrap="wrap">
              <Text color="#7C9CFF" bold>
                {data.stats.projectCount} <Text color="#94A3B8">projeto(s)</Text>
              </Text>
              <Text color="#38BDF8" bold>
                {data.stats.pipelineCount} <Text color="#94A3B8">pipeline(s)</Text>
              </Text>
              <Text color="#34D399" bold>
                {data.stats.commandCount} <Text color="#94A3B8">comando(s)</Text>
              </Text>
              <Text color="#A78BFA" bold>
                {data.stats.runCount} <Text color="#94A3B8">execução(ões)</Text>
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Barra de Abas + Filtro ativo */}
      <Box marginTop={1} paddingX={1} justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Box gap={2} alignItems="center">
          {(
            [
              { key: 'projects', label: `1 · Projetos (${projects.length})` },
              { key: 'pipelines', label: `2 · Pipelines (${pipelines.length})` },
              { key: 'commands', label: `3 · Comandos (${commands.length})` },
              { key: 'history', label: `4 · Histórico (${history.length})` }
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Text
                key={tab.key}
                bold={active}
                color={active ? '#0B0F17' : '#94A3B8'}
                backgroundColor={active ? '#38BDF8' : undefined}
              >
                {active ? ` ${tab.label} ` : tab.label}
              </Text>
            );
          })}
        </Box>

        {filterQuery ? (
          <Text color="#FBBF24">
            Filtro: <Text bold>"{filterQuery}"</Text> <Text dimColor>(Esc limpar)</Text>
          </Text>
        ) : null}
      </Box>

      {/* Painel Principal 2 Colunas */}
      <Box marginTop={1} flexDirection={compactMode ? 'column' : 'row'} gap={1} minHeight={runnerOpen ? 9 : 12}>
        {/* Coluna Esquerda: Lista */}
        <Box
          width={compactMode ? '100%' : '42%'}
          borderStyle="round"
          borderColor="#334155"
          flexDirection="column"
          paddingX={1}
          paddingY={0}
        >
          <Text bold color="#7C9CFF">
            {activeTab === 'projects'
              ? 'Projetos Cadastrados'
              : activeTab === 'pipelines'
                ? 'Pipelines Salvos'
                : activeTab === 'commands'
                  ? 'Scripts & Comandos'
                  : 'Histórico de Execuções'}
          </Text>

          <Box flexDirection="column" marginTop={1}>
            {visibleItems.length === 0 ? (
              <Text dimColor>
                {filterQuery
                  ? 'Nenhum item corresponde ao filtro.'
                  : 'Nenhum registro encontrado no banco.'}
              </Text>
            ) : (
              visibleItems.map((item, visibleIdx) => {
                const realIdx = windowStart + visibleIdx;
                const isSelected = realIdx === selectedIndex;
                const cursor = isSelected ? (tick % 4 < 2 ? '❯' : '›') : ' ';
                const label =
                  activeTab === 'projects'
                    ? (item as TuiProjectItem).name
                    : activeTab === 'pipelines'
                      ? (item as TuiPipelineItem).name
                      : activeTab === 'commands'
                        ? `${(item as TuiCommandItem).name} (${(item as TuiCommandItem).projectName})`
                        : (item as TuiHistoryItem).title;
                const badge =
                  activeTab === 'projects'
                    ? `[${(item as TuiProjectItem).packageManager}]`
                    : activeTab === 'pipelines'
                      ? `${(item as TuiPipelineItem).steps.length} etapas`
                      : activeTab === 'commands'
                        ? `[${(item as TuiCommandItem).packageManager}]`
                        : `[${(item as TuiHistoryItem).status}]`;

                return (
                  <Box key={item.id} justifyContent="space-between" gap={1}>
                    <Text bold={isSelected} color={isSelected ? '#38BDF8' : '#E2E8F0'}>
                      {cursor} {label}
                    </Text>
                    <Text color={isSelected ? '#7C9CFF' : '#64748B'}>{badge}</Text>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* Coluna Direita: Inspetor */}
        <Box
          flexGrow={1}
          borderStyle="round"
          borderColor="#334155"
          flexDirection="column"
          paddingX={2}
          paddingY={0}
        >
          <Text bold color="#34D399">
            Detalhes
          </Text>

          {activeTab === 'projects' && selectedProject && (
            <Box flexDirection="column" marginTop={1}>
              <Box gap={1}>
                <Text bold color="#F8FAFC">
                  {selectedProject.name}{' '}
                  <Text color="#7C9CFF">({selectedProject.adapterType})</Text>
                </Text>
                {!selectedProject.existsOnDisk && (
                  <Text color="#F87171">[ausente no disco]</Text>
                )}
              </Box>
              <Text dimColor>{selectedProject.path}</Text>
              <Box marginTop={1} gap={2} flexWrap="wrap">
                <Text color="#38BDF8">
                  Gerenciador: <Text bold>{selectedProject.packageManager}</Text>
                </Text>
                <Text color="#34D399">
                  Comandos: <Text bold>{selectedProject.commandCount}</Text>
                </Text>
                <Text color="#A78BFA">
                  Pipelines: <Text bold>{selectedProject.pipelineCount}</Text>
                </Text>
                <Text color="#FBBF24">
                  Runs: <Text bold>{selectedProject.runCount}</Text>
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  Pressione <Text color="#38BDF8">Enter</Text> para filtrar os comandos deste projeto ou{' '}
                  <Text color="#7C9CFF">g</Text> para abrir no Electron.
                </Text>
              </Box>
            </Box>
          )}

          {activeTab === 'pipelines' && selectedPipeline && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="#F8FAFC">
                {selectedPipeline.name}{' '}
                <Text color="#7C9CFF">· {selectedPipeline.projectName}</Text>
              </Text>
              {selectedPipeline.description ? (
                <Text dimColor>{selectedPipeline.description}</Text>
              ) : null}
              <Box flexDirection="column" marginTop={1}>
                {selectedPipeline.steps.slice(0, 6).map((st, idx) => (
                  <Box key={`${st.name}-${idx}`} gap={1}>
                    <Text color={st.enabled ? '#34D399' : '#64748B'}>
                      {idx + 1}. [{st.enabled ? '✓' : ' '}]
                    </Text>
                    <Text bold={st.enabled} dimColor={!st.enabled}>
                      {st.name}
                    </Text>
                    <Text dimColor>({st.kind}: {st.command})</Text>
                    <Text color={errorBadgeColor(st.onErrorAction)}>
                      [{st.onErrorAction}]
                    </Text>
                  </Box>
                ))}
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  Pressione <Text color="#38BDF8">Enter</Text> para executar este pipeline ao vivo.
                </Text>
              </Box>
            </Box>
          )}

          {activeTab === 'commands' && selectedCommand && (
            <Box flexDirection="column" marginTop={1}>
              <Box gap={1}>
                <Text bold color="#F8FAFC">
                  {selectedCommand.name}
                </Text>
                <Text color="#7C9CFF">· {selectedCommand.projectName}</Text>
                <Text color="#34D399">[{selectedCommand.packageManager}]</Text>
              </Box>
              <Text dimColor>{selectedCommand.source} · {selectedCommand.projectPath}</Text>
              <Box marginTop={1}>
                <Text color="#38BDF8">$ {selectedCommand.command}</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  Pressione <Text color="#38BDF8">Enter</Text> para executar este comando ao vivo.
                </Text>
              </Box>
            </Box>
          )}

          {activeTab === 'history' && selectedHistory && (
            <Box flexDirection="column" marginTop={1}>
              <Box gap={1}>
                <Text color={statusBadgeColor(selectedHistory.status)} bold>
                  [{selectedHistory.status.toUpperCase()}]
                </Text>
                <Text bold color="#F8FAFC">
                  {selectedHistory.title}
                </Text>
              </Box>
              <Text color="#7C9CFF">
                {selectedHistory.projectName} ·{' '}
                {new Date(selectedHistory.startedAt).toLocaleString('pt-BR')} ·{' '}
                {formatDuration(selectedHistory.startedAt, selectedHistory.finishedAt)}
              </Text>
              <Box marginTop={1} flexDirection="column">
                {(selectedHistory.logs || '(Sem logs gravados)')
                  .split(/\r?\n/)
                  .filter((l) => l.trim().length > 0)
                  .slice(-5)
                  .map((line, i) => (
                    <Text key={i} dimColor>
                      {line}
                    </Text>
                  ))}
              </Box>
            </Box>
          )}

          {!selectedProject && !selectedPipeline && !selectedCommand && !selectedHistory && (
            <Box marginTop={1}>
              <Text dimColor>Selecione um item à esquerda para visualizar os detalhes.</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Console ao vivo durante/após execução */}
      {runnerOpen && (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={activeRun?.status === 'running' ? '#38BDF8' : '#334155'}
          flexDirection="column"
          paddingX={2}
          paddingY={0}
        >
          <Box justifyContent="space-between" gap={1}>
            <Text bold color={activeRun?.status === 'running' ? '#38BDF8' : '#E2E8F0'}>
              {activeRun?.status === 'running' ? `${spinner} ` : ''}
              {activeRun?.title ?? 'Execução'}
            </Text>
            <Box gap={2}>
              {activeRun && (
                <Text color={statusBadgeColor(activeRun.status)} bold>
                  [{activeRun.status.toUpperCase()}]
                </Text>
              )}
              <Text dimColor>
                {activeRun?.status === 'running' ? 'c/Ctrl+C cancelar' : 'x fechar console'}
              </Text>
            </Box>
          </Box>

          {stepStatuses.length > 0 && (
            <Box gap={2} flexWrap="wrap">
              {stepStatuses.map((st) => (
                <Text key={st.stepIndex} color={statusBadgeColor(st.status)}>
                  {st.stepIndex + 1}.{st.stepName}:{st.status}
                </Text>
              ))}
            </Box>
          )}

          <Box flexDirection="column" marginTop={0}>
            {visibleLogLines.length === 0 ? (
              <Text dimColor>Aguardando saída do processo...</Text>
            ) : (
              visibleLogLines.map((line, i) => (
                <Text
                  key={i}
                  color={
                    line.stream === 'stderr'
                      ? '#FCA5A5'
                      : line.stream === 'system'
                        ? '#7DD3FC'
                        : '#E2E8F0'
                  }
                >
                  {line.text}
                </Text>
              ))
            )}
          </Box>
        </Box>
      )}

      {/* Barra de Filtro / Slash Command ou Rodapé de atalhos */}
      <Box
        marginTop={1}
        borderStyle="single"
        borderColor={commandMode ? '#38BDF8' : '#1E293B'}
        paddingX={2}
        justifyContent="space-between"
        flexWrap="wrap"
      >
        {commandMode ? (
          <Text color="#38BDF8" bold>
            ❯ {commandInput}
            <Text color="#7C9CFF">{tick % 4 < 2 ? '█' : ' '}</Text>
            <Text dimColor>  (digite para filtrar ou /sync, /run, /gui, /clear, /help)</Text>
          </Text>
        ) : isRawModeSupported ? (
          <>
            <Text dimColor>
              <Text color="#38BDF8" bold>↑↓/jk</Text> navegar ·{' '}
              <Text color="#38BDF8" bold>Tab/1-4</Text> abas ·{' '}
              <Text color="#38BDF8" bold>Enter</Text> rodar ·{' '}
              <Text color="#38BDF8" bold>/</Text> buscar/cmd ·{' '}
              <Text color="#38BDF8" bold>r</Text> sync ·{' '}
              <Text color="#38BDF8" bold>o</Text> abrir app ·{' '}
              <Text color="#38BDF8" bold>g</Text> GUI ·{' '}
              <Text color="#38BDF8" bold>q</Text> sair
            </Text>
            <Text dimColor>
              Desktop: <Text color="#7C9CFF">nexus .</Text>
            </Text>
          </>
        ) : (
          <Text color="#FBBF24">
            Sem TTY interativo — abra no Windows Terminal/PowerShell/CMD para usar o teclado
          </Text>
        )}
      </Box>
    </Box>
  );
}
