import type { CliTab } from './cliArgs';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type OnErrorAction = 'stop' | 'continue' | 'run_command';

export type StepKind = 'script' | 'command';

export type RunStatus = 'running' | 'success' | 'failed' | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export type StartupMode = 'last' | 'fixed' | 'empty';

export type ExternalToolCategory = 'ide' | 'ai_cli' | 'terminal';

export interface DetectedToolDTO {
  id: string;
  name: string;
  category: ExternalToolCategory;
  executable: string;
  commandName: string;
}

export interface ProjectScript {
  name: string;
  command: string;
}

export interface ScannedProject {
  id: string;
  name: string;
  path: string;
  adapterType: string;
  packageManager: PackageManager;
  version?: string;
  description?: string;
  hasNodeModules: boolean;
  scripts: ProjectScript[];
  lastScannedAt: string;
}

export type ScanPhase = 'starting' | 'listing' | 'inspecting' | 'syncing' | 'done' | 'error';

export interface ScanProgressEvent {
  phase: ScanPhase;
  message: string;
  current: number;
  total: number;
}

export interface WorkspaceScanOptions {
  depth?: number;
}

export interface WorkspaceScanResult {
  targetPath: string;
  mode: 'single' | 'multi' | 'empty';
  projects: ScannedProject[];
}

export interface PipelineStepDTO {
  id: string;
  order: number;
  name: string;
  kind: StepKind;
  command: string;
  onErrorAction: OnErrorAction;
  onErrorCommand: string | null;
  onSuccessCommand: string | null;
  enabled: boolean;
}

export interface PipelineDTO {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  steps: PipelineStepDTO[];
}

export interface SavePipelineStepInput {
  id?: string;
  name: string;
  kind: StepKind;
  command: string;
  onErrorAction: OnErrorAction;
  onErrorCommand?: string | null;
  onSuccessCommand?: string | null;
  enabled: boolean;
}

export interface SavePipelineInput {
  id?: string;
  projectId: string;
  name: string;
  description?: string;
  steps: SavePipelineStepInput[];
}

export interface ExecutionRunDTO {
  id: string;
  projectId: string;
  pipelineId: string | null;
  title: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  logs: string;
}

export interface RunLogEvent {
  runId: string;
  stepIndex: number | null;
  stream: 'stdout' | 'stderr' | 'system';
  chunk: string;
  timestamp: string;
}

export interface RunStatusEvent {
  runId: string;
  projectId: string;
  pipelineId: string | null;
  title: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
}

export interface StepStatusEvent {
  runId: string;
  stepIndex: number;
  stepName: string;
  status: StepStatus;
  exitCode?: number | null;
}

export interface WorkspaceHistoryDTO {
  id: string;
  path: string;
  name: string;
  lastOpenedAt: string;
  isPinned: boolean;
}

export interface CliStatusDTO {
  installed: boolean;
  binDir: string;
  commandPath: string;
  isPackaged: boolean;
}

export interface AppInfoDTO {
  version: string;
  isPackaged: boolean;
  dbPath: string;
  userDataPath: string;
}

export interface UpdateInfoDTO {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  downloadUrl: string | null;
  assetName: string | null;
  publishedAt: string | null;
  dismissedUntil: string | null;
  shouldNotify: boolean;
}

export interface AppSettingsDTO {
  themeMode: 'dark' | 'light';
  startupMode: StartupMode;
  defaultWorkspacePath: string;
}

export interface RunExecutionOptions {
  continueOnError?: boolean;
  dryRun?: boolean;
  envProfile?: string | null;
}

export interface RunScriptsBatchInput extends RunExecutionOptions {
  projectId: string;
  projectPath: string;
  packageManager: PackageManager;
  scripts: string[];
  title?: string;
}

export interface CliLaunchOptions {
  targetPath: string | null;
  project?: string | null;
  tab?: CliTab | null;
  depth?: number | null;
  openConfig?: boolean;
  theme?: 'dark' | 'light' | null;
  runScript?: string | null;
  runPipeline?: string | null;
  dryRun?: boolean;
  continueOnError?: boolean;
  envProfile?: string | null;
}

export interface NexusAPI {
  getInitialTarget: () => Promise<string | null>;
  getInitialLaunch: () => Promise<CliLaunchOptions | null>;
  scanWorkspace: (targetPath: string, options?: WorkspaceScanOptions) => Promise<WorkspaceScanResult>;
  pickFolder: () => Promise<string | null>;
  getWorkspaceHistory: () => Promise<WorkspaceHistoryDTO[]>;
  togglePinWorkspace: (id: string) => Promise<WorkspaceHistoryDTO[]>;
  removeWorkspaceHistory: (id: string) => Promise<WorkspaceHistoryDTO[]>;

  listPipelines: (projectId: string) => Promise<PipelineDTO[]>;
  savePipeline: (input: SavePipelineInput) => Promise<PipelineDTO>;
  deletePipeline: (pipelineId: string) => Promise<void>;

  runScript: (
    input: {
      projectId: string;
      projectPath: string;
      packageManager: PackageManager;
      scriptName: string;
    } & RunExecutionOptions
  ) => Promise<{ runId: string }>;
  runScriptsBatch: (input: RunScriptsBatchInput) => Promise<{ runId: string }>;
  runPipeline: (pipelineId: string, options?: RunExecutionOptions) => Promise<{ runId: string }>;
  cancelRun: (runId: string) => Promise<boolean>;
  getRunHistory: (projectId: string) => Promise<ExecutionRunDTO[]>;

  openInVSCode: (targetPath: string) => Promise<void>;
  openInExplorer: (targetPath: string) => Promise<void>;
  openInTerminal: (targetPath: string) => Promise<void>;
  getDetectedTools: (refresh?: boolean) => Promise<DetectedToolDTO[]>;
  openWithTool: (toolId: string, targetPath: string) => Promise<void>;

  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  getCliStatus: () => Promise<CliStatusDTO>;
  installCli: () => Promise<CliStatusDTO>;
  uninstallCli: () => Promise<CliStatusDTO>;
  getAppInfo: () => Promise<AppInfoDTO>;
  checkForUpdates: (force?: boolean) => Promise<UpdateInfoDTO>;
  dismissUpdateNotice: (version: string, hours: number) => Promise<void>;
  downloadAndInstallUpdate: (
    downloadUrl: string,
    assetName?: string | null
  ) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  openExternalUrl: (url: string) => Promise<void>;

  onScanProgress: (cb: (event: ScanProgressEvent) => void) => () => void;
  onRunLog: (cb: (event: RunLogEvent) => void) => () => void;
  onRunStatus: (cb: (event: RunStatusEvent) => void) => () => void;
  onStepStatus: (cb: (event: StepStatusEvent) => void) => () => void;
  onOpenTarget: (cb: (targetPath: string) => void) => () => void;
  onLaunchOptions: (cb: (options: CliLaunchOptions) => void) => () => void;
}
