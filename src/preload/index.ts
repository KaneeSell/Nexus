import { contextBridge, ipcRenderer } from 'electron';
import type {
  CliLaunchOptions,
  CreateProjectProgressEvent,
  NexusAPI,
  RunLogEvent,
  RunStatusEvent,
  ScanProgressEvent,
  StepStatusEvent
} from '../shared/types';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const nexusApi: NexusAPI = {
  getInitialTarget: () => ipcRenderer.invoke('workspace:getInitialTarget'),
  getInitialLaunch: () => ipcRenderer.invoke('workspace:getInitialLaunch'),
  scanWorkspace: (targetPath, options) => ipcRenderer.invoke('workspace:scan', targetPath, options),
  pickFolder: () => ipcRenderer.invoke('workspace:pickFolder'),
  getWorkspaceHistory: () => ipcRenderer.invoke('workspace:getHistory'),
  togglePinWorkspace: (id) => ipcRenderer.invoke('workspace:togglePin', id),
  removeWorkspaceHistory: (id) => ipcRenderer.invoke('workspace:removeHistory', id),

  listPipelines: (projectId) => ipcRenderer.invoke('pipeline:list', projectId),
  savePipeline: (input) => ipcRenderer.invoke('pipeline:save', input),
  deletePipeline: (pipelineId) => ipcRenderer.invoke('pipeline:delete', pipelineId),
  previewExportPipeline: (pipelineId, format, options) =>
    ipcRenderer.invoke('pipeline:previewExport', pipelineId, format, options),
  exportPipeline: (pipelineId, format, options) =>
    ipcRenderer.invoke('pipeline:export', pipelineId, format, options),

  runScript: (input) => ipcRenderer.invoke('runner:runScript', input),
  runScriptsBatch: (input) => ipcRenderer.invoke('runner:runScriptsBatch', input),
  runPipeline: (pipelineId, options) => ipcRenderer.invoke('runner:runPipeline', pipelineId, options),
  cancelRun: (runId) => ipcRenderer.invoke('runner:cancel', runId),
  getRunHistory: (projectId) => ipcRenderer.invoke('runner:getHistory', projectId),

  openInVSCode: (targetPath) => ipcRenderer.invoke('system:openInVSCode', targetPath),
  openInExplorer: (targetPath) => ipcRenderer.invoke('system:openInExplorer', targetPath),
  openInTerminal: (targetPath) => ipcRenderer.invoke('system:openInTerminal', targetPath),
  getDetectedTools: (refresh) => ipcRenderer.invoke('system:getDetectedTools', refresh),
  openWithTool: (toolId, targetPath) => ipcRenderer.invoke('system:openWithTool', toolId, targetPath),

  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getCliStatus: () => ipcRenderer.invoke('system:getCliStatus'),
  installCli: () => ipcRenderer.invoke('system:installCli'),
  uninstallCli: () => ipcRenderer.invoke('system:uninstallCli'),
  getAppInfo: () => ipcRenderer.invoke('system:getAppInfo'),
  checkForUpdates: (force) => ipcRenderer.invoke('system:checkForUpdates', force),
  dismissUpdateNotice: (version, hours) =>
    ipcRenderer.invoke('system:dismissUpdateNotice', version, hours),
  downloadAndInstallUpdate: (downloadUrl, assetName) =>
    ipcRenderer.invoke('system:downloadAndInstallUpdate', downloadUrl, assetName),
  openExternalUrl: (url) => ipcRenderer.invoke('system:openExternalUrl', url),

  getFrameworkCatalog: () => ipcRenderer.invoke('creator:getCatalog'),
  fetchLiveStackMeta: (frameworkIds, forceRefresh) =>
    ipcRenderer.invoke('creator:fetchLiveMeta', frameworkIds, forceRefresh),
  listUserGitHubTemplates: (username, options) =>
    ipcRenderer.invoke('creator:listUserTemplates', username, options),
  searchPublicGitHubTemplates: (query, options) =>
    ipcRenderer.invoke('creator:searchPublicTemplates', query, options),
  previewProjectPlan: (input) => ipcRenderer.invoke('creator:previewPlan', input),
  createProject: (input) => ipcRenderer.invoke('creator:createProject', input),
  onCreateProjectProgress: (cb) =>
    subscribe<CreateProjectProgressEvent>('creator:progress', cb),

  onScanProgress: (cb) => subscribe<ScanProgressEvent>('workspace:scan-progress', cb),
  onRunLog: (cb) => subscribe<RunLogEvent>('runner:log', cb),
  onRunStatus: (cb) => subscribe<RunStatusEvent>('runner:status', cb),
  onStepStatus: (cb) => subscribe<StepStatusEvent>('runner:step-status', cb),
  onOpenTarget: (cb) => subscribe<string>('workspace:open-target', cb),
  onLaunchOptions: (cb) => subscribe<CliLaunchOptions>('workspace:launch-options', cb)
};

contextBridge.exposeInMainWorld('nexus', nexusApi);
