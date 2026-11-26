import type { CliTab } from './cliArgs';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type OnErrorAction = 'stop' | 'continue' | 'run_command';

export type StepKind = 'script' | 'command';

export type RunStatus = 'running' | 'success' | 'failed' | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export type StartupMode = 'last' | 'fixed' | 'empty';

export type PipelineExportFormat = 'bat' | 'ps1' | 'sh';

export type PipelineExportStyle = 'rich' | 'raw';

export interface PipelineExportOptions {
  style?: PipelineExportStyle;
  confirmBeforeRun?: boolean;
  pauseOnFinish?: boolean;
  includeColors?: boolean;
  useProjectDir?: boolean;
  saveLogFile?: boolean;
  envProfile?: string | null;
  customHeader?: string | null;
}

export interface ExportPipelineResult {
  canceled: boolean;
  filePath?: string;
  format?: PipelineExportFormat;
}

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
  platform: string;
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

export type ProjectPlatform = 'web' | 'backend' | 'desktop' | 'mobile' | 'cli';

export type ProjectLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'php'
  | 'java'
  | 'csharp'
  | 'dart';

export type DatabaseOptionId = 'none' | 'sqlite' | 'postgresql' | 'mysql' | 'mongodb' | 'supabase';

export type OrmOptionId =
  | 'none'
  | 'prisma'
  | 'drizzle'
  | 'typeorm'
  | 'mongoose'
  | 'sqlalchemy'
  | 'sqlmodel'
  | 'django-orm'
  | 'eloquent'
  | 'sqlx'
  | 'gorm'
  | 'ef-core';

export type StylingOptionId = 'none' | 'tailwind' | 'mui' | 'css-modules';

export type AuthOptionId = 'none' | 'authjs' | 'better-auth' | 'jwt';

export type LinterOptionId = 'none' | 'eslint-prettier' | 'biome';

export type LicenseOptionId = 'none' | 'mit' | 'apache-2.0';

export type ProjectVersionMode = 'latest' | 'pinned';

export type RegistryProvider = 'npm' | 'pypi' | 'crates' | 'packagist' | 'github';

export interface FrameworkCatalogItem {
  id: string;
  name: string;
  tagline: string;
  platforms: ProjectPlatform[];
  languages: ProjectLanguage[];
  category: string;
  popularityScore: number;
  recommended?: boolean;
  registrySource: {
    provider: RegistryProvider;
    packageName: string;
  };
  supportedDatabases: DatabaseOptionId[];
  supportedOrms: OrmOptionId[];
  supportedStyling: StylingOptionId[];
  supportedAuth: AuthOptionId[];
  supportedPackageManagers: PackageManager[];
  githubSearchKeywords: string[];
  defaultPort?: number;
}

export interface LivePackageMeta {
  frameworkId: string;
  packageName: string;
  provider: RegistryProvider;
  latestVersion: string | null;
  monthlyDownloads: number | null;
  description: string | null;
  homepage: string | null;
  source: 'live' | 'fallback';
  fetchedAt: string;
}

export interface GitHubTemplateDTO {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  language: string | null;
  stars: number;
  topics: string[];
  updatedAt: string;
  isTemplate: boolean;
  isDetectedTemplate: boolean;
  isPrivate: boolean;
}

export type CreateProjectMode = 'stack' | 'github-template' | 'public-template';

export interface StackSelectionInput {
  platform: ProjectPlatform;
  language: ProjectLanguage;
  frameworkId: string;
  database: DatabaseOptionId;
  orm: OrmOptionId;
  styling: StylingOptionId;
  auth: AuthOptionId;
  packageManager: PackageManager;
  versionMode: ProjectVersionMode;
  pinnedVersion?: string | null;
  includeDocker?: boolean;
  includeTests?: boolean;
  linter?: LinterOptionId;
  license?: LicenseOptionId;
  includeCi?: boolean;
  description?: string;
  author?: string;
}

export interface StackPresetItem {
  id: string;
  name: string;
  description: string;
  badge: string;
  stack: StackSelectionInput;
}

export interface PreflightToolStatus {
  tool: string;
  available: boolean;
  version: string | null;
  required: boolean;
}

export interface CreateProjectInput {
  mode: CreateProjectMode;
  projectName: string;
  parentDir: string;
  initGit?: boolean;
  installDeps?: boolean;
  packageManager?: PackageManager;
  stack?: StackSelectionInput;
  templateRepo?: {
    fullName: string;
    cloneUrl: string;
    defaultBranch: string;
  };
}

export interface ScaffoldCommandStep {
  label: string;
  command: string;
  cwd: 'parent' | 'project';
}

export interface ScaffoldGeneratedFile {
  relativePath: string;
  content: string;
}

export interface ScaffoldPlanPreview {
  targetDir: string;
  sanitizedName: string;
  commands: ScaffoldCommandStep[];
  files: ScaffoldGeneratedFile[];
  notes: string[];
}

export type CreateProjectPhase =
  | 'validating'
  | 'cloning'
  | 'scaffolding'
  | 'writing-files'
  | 'installing'
  | 'git-init'
  | 'done'
  | 'error';

export interface CreateProjectProgressEvent {
  phase: CreateProjectPhase;
  message: string;
  stepIndex: number;
  totalSteps: number;
  stream?: 'stdout' | 'stderr' | 'system';
  chunk?: string;
}

export interface CreateProjectResult {
  ok: boolean;
  projectPath?: string;
  error?: string;
  notes?: string[];
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

  getFrameworkCatalog: () => Promise<FrameworkCatalogItem[]>;
  fetchLiveStackMeta: (
    frameworkIds: string[],
    forceRefresh?: boolean
  ) => Promise<Record<string, LivePackageMeta>>;
  listUserGitHubTemplates: (
    username: string,
    options?: { includeAllRepos?: boolean; token?: string | null; forceRefresh?: boolean }
  ) => Promise<GitHubTemplateDTO[]>;
  searchPublicGitHubTemplates: (
    query: string,
    options?: { token?: string | null; forceRefresh?: boolean }
  ) => Promise<GitHubTemplateDTO[]>;
  previewProjectPlan: (input: CreateProjectInput) => Promise<ScaffoldPlanPreview>;
  checkCreatorPreflight: (input: CreateProjectInput) => Promise<PreflightToolStatus[]>;
  createProject: (input: CreateProjectInput) => Promise<CreateProjectResult>;
  onCreateProjectProgress: (cb: (event: CreateProjectProgressEvent) => void) => () => void;

  onScanProgress: (cb: (event: ScanProgressEvent) => void) => () => void;
  onRunLog: (cb: (event: RunLogEvent) => void) => () => void;
  onRunStatus: (cb: (event: RunStatusEvent) => void) => () => void;
  onStepStatus: (cb: (event: StepStatusEvent) => void) => () => void;
  onOpenTarget: (cb: (targetPath: string) => void) => () => void;
  onLaunchOptions: (cb: (options: CliLaunchOptions) => void) => () => void;
}
