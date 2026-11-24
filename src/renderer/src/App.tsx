import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CodeIcon from '@mui/icons-material/Code';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PushPinIcon from '@mui/icons-material/PushPin';
import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import {
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { PipelineDTO, SavePipelineInput } from '../../shared/types';
import { HistoryTab } from './components/HistoryTab';
import { PipelineEditorDialog } from './components/PipelineEditorDialog';
import { PipelinesTab } from './components/PipelinesTab';
import { ProjectSidebar } from './components/ProjectSidebar';
import { RunnerConsole } from './components/RunnerConsole';
import { ScanProgressBanner } from './components/ScanProgressBanner';
import { ScriptsTab } from './components/ScriptsTab';
import { SettingsDialog } from './components/SettingsDialog';
import { TopBar } from './components/TopBar';
import { UpdateBanner } from './components/UpdateBanner';
import { useNexusStore } from './store/useNexusStore';
import { createNexusTheme } from './theme';

export function App() {
  const themeMode = useNexusStore((s) => s.themeMode);
  const projects = useNexusStore((s) => s.projects);
  const selectedProjectId = useNexusStore((s) => s.selectedProjectId);
  const currentTarget = useNexusStore((s) => s.currentTarget);
  const isScanning = useNexusStore((s) => s.isScanning);
  const workspaceHistory = useNexusStore((s) => s.workspaceHistory);
  const detectedTools = useNexusStore((s) => s.detectedTools);
  const tabIndex = useNexusStore((s) => s.activeTab);

  const initApp = useNexusStore((s) => s.initApp);
  const applyLaunchOptions = useNexusStore((s) => s.applyLaunchOptions);
  const scanTarget = useNexusStore((s) => s.scanTarget);
  const pickAndScanFolder = useNexusStore((s) => s.pickAndScanFolder);
  const savePipeline = useNexusStore((s) => s.savePipeline);
  const setSettingsOpen = useNexusStore((s) => s.setSettingsOpen);
  const setTabIndex = useNexusStore((s) => s.setActiveTab);
  const handleScanProgress = useNexusStore((s) => s.handleScanProgress);
  const handleRunLog = useNexusStore((s) => s.handleRunLog);
  const handleRunStatus = useNexusStore((s) => s.handleRunStatus);
  const handleStepStatus = useNexusStore((s) => s.handleStepStatus);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<PipelineDTO | null>(null);
  const [prefillScripts, setPrefillScripts] = useState<string[] | undefined>(undefined);
  const [ideMenuAnchor, setIdeMenuAnchor] = useState<HTMLElement | null>(null);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<HTMLElement | null>(null);

  const ideTools = useMemo(
    () => detectedTools.filter((t) => t.category === 'ide'),
    [detectedTools]
  );
  const aiCliTools = useMemo(
    () => detectedTools.filter((t) => t.category === 'ai_cli'),
    [detectedTools]
  );

  const theme = useMemo(() => createNexusTheme(themeMode), [themeMode]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    const offScan = window.nexus.onScanProgress(handleScanProgress);
    const offLog = window.nexus.onRunLog(handleRunLog);
    const offStatus = window.nexus.onRunStatus(handleRunStatus);
    const offStep = window.nexus.onStepStatus(handleStepStatus);
    const offOpenTarget = window.nexus.onOpenTarget((targetPath) => {
      void scanTarget(targetPath);
    });
    const offLaunchOptions = window.nexus.onLaunchOptions((options) => {
      void applyLaunchOptions(options);
    });

    void initApp();

    return () => {
      offScan();
      offLog();
      offStatus();
      offStep();
      offOpenTarget();
      offLaunchOptions();
    };
  }, [
    applyLaunchOptions,
    handleRunLog,
    handleRunStatus,
    handleScanProgress,
    handleStepStatus,
    initApp,
    scanTarget
  ]);

  const handleOpenNewPipeline = (scriptsPrefill?: string[]): void => {
    setEditingPipeline(null);
    setPrefillScripts(scriptsPrefill);
    setEditorOpen(true);
  };

  const handleEditPipeline = (pipeline: PipelineDTO): void => {
    setEditingPipeline(pipeline);
    setPrefillScripts(undefined);
    setEditorOpen(true);
  };

  const handleSavePipeline = async (input: SavePipelineInput): Promise<void> => {
    await savePipeline(input);
    setTabIndex(1);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.default'
        }}
      >
        <TopBar />
        <UpdateBanner />
        <ScanProgressBanner />

        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <ProjectSidebar />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
              {!currentTarget && !isScanning ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    maxWidth: 660,
                    mx: 'auto',
                    mt: 4
                  }}
                >
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Bem-vindo ao Nexus
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Abra uma pasta com vários projetos (ex: <code>C:\Projetos\Pessoais</code>) ou
                    um projeto individual — ou digite <code>nexus .</code> direto na barra de
                    endereço do Windows Explorer.
                  </Typography>

                  <Stack direction="row" spacing={1.5} sx={{ mb: workspaceHistory.length > 0 ? 3 : 0 }}>
                    <Button
                      variant="contained"
                      startIcon={<FolderOpenIcon />}
                      onClick={() => void pickAndScanFolder()}
                    >
                      Selecionar Pasta
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      onClick={() => setSettingsOpen(true)}
                    >
                      Configurar Inicialização e CLI
                    </Button>
                  </Stack>

                  {workspaceHistory.length > 0 && (
                    <>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                        Workspaces salvos e recentes
                      </Typography>
                      <List dense disablePadding>
                        {workspaceHistory.slice(0, 6).map((item) => (
                          <ListItemButton
                            key={item.id}
                            onClick={() => void scanTarget(item.path)}
                            sx={{ borderRadius: 1 }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              {item.isPinned ? (
                                <PushPinIcon fontSize="small" color="primary" />
                              ) : (
                                <FolderIcon fontSize="small" color="action" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={item.name}
                              secondary={item.path}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </>
                  )}
                </Paper>
              ) : !selectedProject ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    {isScanning ? 'Analisando pasta...' : 'Nenhum projeto selecionado'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isScanning
                      ? 'Consultando diretórios e lendo package.json...'
                      : 'Selecione um projeto na barra lateral ou abra outra pasta.'}
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 2
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="h5" fontWeight={700}>
                            {selectedProject.name}
                          </Typography>
                          {selectedProject.version && (
                            <Chip size="small" label={`v${selectedProject.version}`} />
                          )}
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={selectedProject.packageManager}
                          />
                          {!selectedProject.hasNodeModules && (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label="sem node_modules"
                            />
                          )}
                        </Box>
                        {selectedProject.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {selectedProject.description}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {selectedProject.path}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {ideTools.length <= 1 ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CodeIcon />}
                            onClick={() =>
                              void (ideTools[0]
                                ? window.nexus.openWithTool(ideTools[0].id, selectedProject.path)
                                : window.nexus.openInVSCode(selectedProject.path))
                            }
                          >
                            {ideTools[0]?.name ?? 'VS Code'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<CodeIcon />}
                              endIcon={<ArrowDropDownIcon />}
                              onClick={(e) => setIdeMenuAnchor(e.currentTarget)}
                            >
                              Abrir em IDE
                            </Button>
                            <Menu
                              anchorEl={ideMenuAnchor}
                              open={Boolean(ideMenuAnchor)}
                              onClose={() => setIdeMenuAnchor(null)}
                            >
                              {ideTools.map((tool) => (
                                <MenuItem
                                  key={tool.id}
                                  onClick={() => {
                                    setIdeMenuAnchor(null);
                                    void window.nexus.openWithTool(tool.id, selectedProject.path);
                                  }}
                                >
                                  {tool.name}
                                </MenuItem>
                              ))}
                            </Menu>
                          </>
                        )}

                        {aiCliTools.length > 0 && (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              startIcon={<AutoAwesomeIcon />}
                              endIcon={<ArrowDropDownIcon />}
                              onClick={(e) => setAiMenuAnchor(e.currentTarget)}
                            >
                              IA ({aiCliTools.length})
                            </Button>
                            <Menu
                              anchorEl={aiMenuAnchor}
                              open={Boolean(aiMenuAnchor)}
                              onClose={() => setAiMenuAnchor(null)}
                            >
                              {aiCliTools.map((tool) => (
                                <MenuItem
                                  key={tool.id}
                                  onClick={() => {
                                    setAiMenuAnchor(null);
                                    void window.nexus.openWithTool(tool.id, selectedProject.path);
                                  }}
                                >
                                  Abrir com {tool.name} ({tool.commandName})
                                </MenuItem>
                              ))}
                            </Menu>
                          </>
                        )}

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<TerminalIcon />}
                          onClick={() => void window.nexus.openInTerminal(selectedProject.path)}
                        >
                          Terminal
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<FolderOpenIcon />}
                          onClick={() => void window.nexus.openInExplorer(selectedProject.path)}
                        >
                          Explorer
                        </Button>
                      </Stack>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Tabs
                      value={tabIndex}
                      onChange={(_e, next: number) => setTabIndex(next)}
                      sx={{ minHeight: 38 }}
                    >
                      <Tab label={`Scripts (${selectedProject.scripts.length})`} sx={{ minHeight: 38 }} />
                      <Tab label="Pipelines" sx={{ minHeight: 38 }} />
                      <Tab label="Histórico" sx={{ minHeight: 38 }} />
                    </Tabs>
                  </Paper>

                  {tabIndex === 0 && (
                    <ScriptsTab
                      project={selectedProject}
                      onCreatePipelineFromScripts={(scripts) => handleOpenNewPipeline(scripts)}
                    />
                  )}
                  {tabIndex === 1 && (
                    <PipelinesTab
                      projectId={selectedProject.id}
                      onCreateNew={() => handleOpenNewPipeline()}
                      onEdit={handleEditPipeline}
                    />
                  )}
                  {tabIndex === 2 && <HistoryTab />}
                </Box>
              )}
            </Box>

            <RunnerConsole />
          </Box>
        </Box>

        {selectedProject && (
          <PipelineEditorDialog
            open={editorOpen}
            projectId={selectedProject.id}
            scripts={selectedProject.scripts}
            initialPipeline={editingPipeline}
            prefillScripts={prefillScripts}
            onClose={() => setEditorOpen(false)}
            onSave={handleSavePipeline}
          />
        )}

        <SettingsDialog />
      </Box>
    </ThemeProvider>
  );
}
