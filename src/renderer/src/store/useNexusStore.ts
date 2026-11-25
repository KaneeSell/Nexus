import { create } from 'zustand';
import type {
  AppInfoDTO,
  CliLaunchOptions,
  CliStatusDTO,
  DetectedToolDTO,
  ExecutionRunDTO,
  ExportPipelineResult,
  PipelineDTO,
  PipelineExportFormat,
  PipelineExportOptions,
  RunExecutionOptions,
  RunLogEvent,
  RunStatusEvent,
  SavePipelineInput,
  ScannedProject,
  ScanProgressEvent,
  StartupMode,
  StepStatusEvent,
  UpdateInfoDTO,
  WorkspaceHistoryDTO,
  WorkspaceScanOptions,
  WorkspaceScanResult
} from '../../../shared/types';

export interface ActiveRunState {
  runId: string;
  projectId: string;
  pipelineId: string | null;
  title: string;
  status: RunStatusEvent['status'];
  startedAt: string;
  finishedAt: string | null;
}

interface NexusState {
  themeMode: 'dark' | 'light';
  startupMode: StartupMode;
  defaultWorkspacePath: string;
  cliStatus: CliStatusDTO | null;
  appInfo: AppInfoDTO | null;
  detectedTools: DetectedToolDTO[];
  updateInfo: UpdateInfoDTO | null;
  checkingUpdates: boolean;
  installingUpdate: boolean;
  updateError: string | null;
  settingsOpen: boolean;
  activeTab: number;

  currentTarget: string | null;
  workspaceMode: WorkspaceScanResult['mode'];
  projects: ScannedProject[];
  selectedProjectId: string | null;
  isScanning: boolean;
  scanProgress: ScanProgressEvent | null;
  scanError: string | null;
  workspaceHistory: WorkspaceHistoryDTO[];

  pipelines: PipelineDTO[];
  runHistory: ExecutionRunDTO[];
  loadingProjectData: boolean;

  activeRun: ActiveRunState | null;
  activeStepStatuses: StepStatusEvent[];
  logs: RunLogEvent[];
  consoleExpanded: boolean;

  initApp: () => Promise<void>;
  applyLaunchOptions: (options: CliLaunchOptions) => Promise<void>;
  loadSettings: () => Promise<void>;
  saveStartupConfig: (mode: StartupMode, defaultPath: string) => Promise<void>;
  installCli: () => Promise<void>;
  uninstallCli: () => Promise<void>;
  checkForUpdates: (force?: boolean) => Promise<void>;
  dismissUpdate: (hours: number) => Promise<void>;
  installUpdate: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  setActiveTab: (tabIndex: number) => void;

  setThemeMode: (mode: 'dark' | 'light') => Promise<void>;
  toggleTheme: () => Promise<void>;
  scanTarget: (targetPath: string, options?: WorkspaceScanOptions) => Promise<void>;
  pickAndScanFolder: () => Promise<void>;
  togglePinWorkspace: (id: string) => Promise<void>;
  removeWorkspaceHistory: (id: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  refreshProjectData: (projectId: string) => Promise<void>;
  savePipeline: (input: SavePipelineInput) => Promise<PipelineDTO>;
  deletePipeline: (pipelineId: string, projectId: string) => Promise<void>;
  previewExportPipeline: (
    pipelineId: string,
    format: PipelineExportFormat,
    options?: PipelineExportOptions
  ) => Promise<string>;
  exportPipeline: (
    pipelineId: string,
    format: PipelineExportFormat,
    options?: PipelineExportOptions
  ) => Promise<ExportPipelineResult>;

  runSingleScript: (
    project: ScannedProject,
    scriptName: string,
    options?: RunExecutionOptions
  ) => Promise<void>;
  runScriptsBatch: (project: ScannedProject, scripts: string[]) => Promise<void>;
  runPipeline: (pipelineId: string, options?: RunExecutionOptions) => Promise<void>;
  cancelActiveRun: () => Promise<void>;
  clearLogs: () => void;
  setConsoleExpanded: (expanded: boolean) => void;

  handleScanProgress: (event: ScanProgressEvent) => void;
  handleRunLog: (event: RunLogEvent) => void;
  handleRunStatus: (event: RunStatusEvent) => void;
  handleStepStatus: (event: StepStatusEvent) => void;
}

function tabToIndex(tab: CliLaunchOptions['tab']): number | null {
  if (tab === 'scripts') return 0;
  if (tab === 'pipelines') return 1;
  if (tab === 'history') return 2;
  return null;
}

function findMatchingProject(
  projects: ScannedProject[],
  query: string | null | undefined
): ScannedProject | null {
  if (projects.length === 0) return null;
  if (!query) return projects[0];

  const q = query.trim().toLowerCase();
  return (
    projects.find((p) => p.name.toLowerCase() === q) ??
    projects.find((p) => p.path.toLowerCase().endsWith(`\\${q}`) || p.path.toLowerCase().endsWith(`/${q}`)) ??
    projects.find((p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)) ??
    projects[0]
  );
}

export const useNexusStore = create<NexusState>((set, get) => ({
  themeMode: 'dark',
  startupMode: 'last',
  defaultWorkspacePath: '',
  cliStatus: null,
  appInfo: null,
  detectedTools: [],
  updateInfo: null,
  checkingUpdates: false,
  installingUpdate: false,
  updateError: null,
  settingsOpen: false,
  activeTab: 0,

  currentTarget: null,
  workspaceMode: 'empty',
  projects: [],
  selectedProjectId: null,
  isScanning: false,
  scanProgress: null,
  scanError: null,
  workspaceHistory: [],

  pipelines: [],
  runHistory: [],
  loadingProjectData: false,

  activeRun: null,
  activeStepStatuses: [],
  logs: [],
  consoleExpanded: false,

  initApp: async () => {
    const [
      savedTheme,
      savedStartupMode,
      savedDefaultPath,
      initialLaunch,
      history,
      cliStatus,
      appInfo,
      detectedTools
    ] = await Promise.all([
      window.nexus.getSetting('themeMode'),
      window.nexus.getSetting('startupMode'),
      window.nexus.getSetting('defaultWorkspacePath'),
      window.nexus.getInitialLaunch(),
      window.nexus.getWorkspaceHistory(),
      window.nexus.getCliStatus(),
      window.nexus.getAppInfo(),
      window.nexus.getDetectedTools()
    ]);

    const startupMode: StartupMode =
      savedStartupMode === 'fixed' || savedStartupMode === 'empty' ? savedStartupMode : 'last';

    set({
      themeMode: savedTheme === 'light' ? 'light' : 'dark',
      startupMode,
      defaultWorkspacePath: savedDefaultPath ?? '',
      workspaceHistory: history,
      cliStatus,
      appInfo,
      detectedTools
    });

    if (initialLaunch) {
      await get().applyLaunchOptions(initialLaunch);
    }

    void get().checkForUpdates(false);
  },

  applyLaunchOptions: async (options) => {
    if (options.theme) {
      set({ themeMode: options.theme });
    }
    if (options.openConfig) {
      set({ settingsOpen: true });
    }
    const desiredTab = tabToIndex(options.tab);
    if (desiredTab !== null) {
      set({ activeTab: desiredTab });
    }

    if (options.targetPath) {
      await get().scanTarget(options.targetPath, {
        depth: options.depth ?? undefined
      });
    }

    const matchedProject = findMatchingProject(get().projects, options.project);
    if (matchedProject && matchedProject.id !== get().selectedProjectId) {
      await get().selectProject(matchedProject.id);
    }

    const activeProject = matchedProject ?? get().projects.find((p) => p.id === get().selectedProjectId) ?? null;
    if (!activeProject) return;

    const runOpts: RunExecutionOptions = {
      dryRun: options.dryRun,
      continueOnError: options.continueOnError,
      envProfile: options.envProfile
    };

    if (options.runPipeline) {
      const needle = options.runPipeline.trim().toLowerCase();
      const pipeline =
        get().pipelines.find((p) => p.name.toLowerCase() === needle) ??
        get().pipelines.find((p) => p.name.toLowerCase().includes(needle));
      if (pipeline) {
        if (desiredTab === null) set({ activeTab: 1 });
        await get().runPipeline(pipeline.id, runOpts);
      }
      return;
    }

    if (options.runScript) {
      if (desiredTab === null) set({ activeTab: 0 });
      await get().runSingleScript(activeProject, options.runScript, runOpts);
    }
  },

  loadSettings: async () => {
    const [savedTheme, savedStartupMode, savedDefaultPath, cliStatus, appInfo] = await Promise.all([
      window.nexus.getSetting('themeMode'),
      window.nexus.getSetting('startupMode'),
      window.nexus.getSetting('defaultWorkspacePath'),
      window.nexus.getCliStatus(),
      window.nexus.getAppInfo()
    ]);

    const startupMode: StartupMode =
      savedStartupMode === 'fixed' || savedStartupMode === 'empty' ? savedStartupMode : 'last';

    set({
      themeMode: savedTheme === 'light' ? 'light' : 'dark',
      startupMode,
      defaultWorkspacePath: savedDefaultPath ?? '',
      cliStatus,
      appInfo
    });
  },

  saveStartupConfig: async (mode, defaultPath) => {
    await Promise.all([
      window.nexus.setSetting('startupMode', mode),
      window.nexus.setSetting('defaultWorkspacePath', defaultPath.trim())
    ]);
    set({
      startupMode: mode,
      defaultWorkspacePath: defaultPath.trim()
    });
  },

  installCli: async () => {
    const cliStatus = await window.nexus.installCli();
    set({ cliStatus });
  },

  uninstallCli: async () => {
    const cliStatus = await window.nexus.uninstallCli();
    set({ cliStatus });
  },

  checkForUpdates: async (force = false) => {
    set({ checkingUpdates: true, updateError: null });
    try {
      const updateInfo = await window.nexus.checkForUpdates(force);
      set({ updateInfo, checkingUpdates: false });
    } catch (err) {
      set({
        checkingUpdates: false,
        updateError: force
          ? err instanceof Error
            ? err.message
            : String(err)
          : null
      });
    }
  },

  dismissUpdate: async (hours: number) => {
    const current = get().updateInfo;
    if (!current) return;
    await window.nexus.dismissUpdateNotice(current.latestVersion, hours);
    set({
      updateInfo: {
        ...current,
        shouldNotify: false,
        dismissedUntil: new Date(Date.now() + hours * 3600 * 1000).toISOString()
      }
    });
  },

  installUpdate: async () => {
    const info = get().updateInfo;
    if (!info) return;
    if (!info.downloadUrl) {
      await window.nexus.openExternalUrl(info.releaseUrl);
      return;
    }
    set({ installingUpdate: true, updateError: null });
    try {
      const res = await window.nexus.downloadAndInstallUpdate(info.downloadUrl, info.assetName);
      if (!res.ok) {
        set({ updateError: res.error ?? 'Falha ao iniciar o instalador.' });
      }
    } catch (err) {
      set({ updateError: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ installingUpdate: false });
    }
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  setActiveTab: (tabIndex) => set({ activeTab: tabIndex }),

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    await window.nexus.setSetting('themeMode', mode);
  },

  toggleTheme: async () => {
    const next = get().themeMode === 'dark' ? 'light' : 'dark';
    await get().setThemeMode(next);
  },

  scanTarget: async (targetPath, options) => {
    set({
      isScanning: true,
      scanError: null,
      currentTarget: targetPath,
      scanProgress: {
        phase: 'starting',
        message: `Iniciando leitura de ${targetPath}...`,
        current: 0,
        total: 1
      }
    });

    try {
      const result = await window.nexus.scanWorkspace(targetPath, options);
      const history = await window.nexus.getWorkspaceHistory();
      const firstId = result.projects[0]?.id ?? null;

      set({
        currentTarget: result.targetPath,
        workspaceMode: result.mode,
        projects: result.projects,
        selectedProjectId: firstId,
        workspaceHistory: history,
        isScanning: false
      });

      if (firstId) {
        await get().refreshProjectData(firstId);
      } else {
        set({ pipelines: [], runHistory: [] });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        isScanning: false,
        scanError: message,
        scanProgress: {
          phase: 'error',
          message,
          current: 0,
          total: 1
        }
      });
    }
  },

  pickAndScanFolder: async () => {
    const picked = await window.nexus.pickFolder();
    if (picked) {
      await get().scanTarget(picked);
    }
  },

  togglePinWorkspace: async (id) => {
    const history = await window.nexus.togglePinWorkspace(id);
    set({ workspaceHistory: history });
  },

  removeWorkspaceHistory: async (id) => {
    const history = await window.nexus.removeWorkspaceHistory(id);
    set({ workspaceHistory: history });
  },

  selectProject: async (projectId) => {
    set({ selectedProjectId: projectId });
    await get().refreshProjectData(projectId);
  },

  refreshProjectData: async (projectId) => {
    set({ loadingProjectData: true });
    try {
      const [pipelines, runHistory] = await Promise.all([
        window.nexus.listPipelines(projectId),
        window.nexus.getRunHistory(projectId)
      ]);
      if (get().selectedProjectId === projectId) {
        set({ pipelines, runHistory, loadingProjectData: false });
      }
    } catch {
      set({ loadingProjectData: false });
    }
  },

  savePipeline: async (input) => {
    const saved = await window.nexus.savePipeline(input);
    const current = get().pipelines;
    const exists = current.some((p) => p.id === saved.id);
    set({
      pipelines: exists
        ? current.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...current]
    });
    return saved;
  },

  deletePipeline: async (pipelineId, projectId) => {
    await window.nexus.deletePipeline(pipelineId);
    if (get().selectedProjectId === projectId) {
      set({
        pipelines: get().pipelines.filter((p) => p.id !== pipelineId)
      });
    }
  },

  previewExportPipeline: async (pipelineId, format, options) => {
    return window.nexus.previewExportPipeline(pipelineId, format, options);
  },

  exportPipeline: async (pipelineId, format, options) => {
    return window.nexus.exportPipeline(pipelineId, format, options);
  },

  runSingleScript: async (project, scriptName, options) => {
    set({ logs: [], activeStepStatuses: [], consoleExpanded: true });
    await window.nexus.runScript({
      projectId: project.id,
      projectPath: project.path,
      packageManager: project.packageManager,
      scriptName,
      ...options
    });
  },

  runScriptsBatch: async (project, scripts) => {
    if (scripts.length === 0) return;
    set({ logs: [], activeStepStatuses: [], consoleExpanded: true });
    await window.nexus.runScriptsBatch({
      projectId: project.id,
      projectPath: project.path,
      packageManager: project.packageManager,
      scripts
    });
  },

  runPipeline: async (pipelineId, options) => {
    set({ logs: [], activeStepStatuses: [], consoleExpanded: true });
    await window.nexus.runPipeline(pipelineId, options);
  },

  cancelActiveRun: async () => {
    const runId = get().activeRun?.runId;
    if (runId) {
      await window.nexus.cancelRun(runId);
    }
  },

  clearLogs: () => set({ logs: [] }),

  setConsoleExpanded: (expanded) => set({ consoleExpanded: expanded }),

  handleScanProgress: (event) => {
    set({ scanProgress: event });
  },

  handleRunLog: (event) => {
    const current = get().activeRun;
    if (!current || current.runId === event.runId) {
      set((state) => ({
        logs: [...state.logs.slice(-1500), event]
      }));
    }
  },

  handleRunStatus: (event) => {
    set({
      activeRun: event,
      consoleExpanded: true
    });

    if (event.status !== 'running') {
      const selectedId = get().selectedProjectId;
      if (selectedId && selectedId === event.projectId) {
        void get().refreshProjectData(selectedId);
      }
    }
  },

  handleStepStatus: (event) => {
    set((state) => {
      const filtered = state.activeStepStatuses.filter((s) => s.stepIndex !== event.stepIndex);
      return {
        activeStepStatuses: [...filtered, event].sort((a, b) => a.stepIndex - b.stepIndex)
      };
    });
  }
}));
