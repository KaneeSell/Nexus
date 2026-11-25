import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildGithubTemplateSearchQuery,
  getAvailableAuth,
  getAvailableDatabases,
  getAvailableFrameworks,
  getAvailableLanguages,
  getAvailableOrms,
  getAvailableStyling,
  getFrameworkById,
  PLATFORM_OPTIONS,
  sanitizeProjectName
} from '../../../shared/projectCatalog';
import type {
  AuthOptionId,
  CreateProjectInput,
  CreateProjectMode,
  CreateProjectProgressEvent,
  CreateProjectResult,
  DatabaseOptionId,
  GitHubTemplateDTO,
  LivePackageMeta,
  OrmOptionId,
  PackageManager,
  ProjectLanguage,
  ProjectPlatform,
  ProjectVersionMode,
  ScaffoldPlanPreview,
  StylingOptionId
} from '../../../shared/types';
import { useNexusStore } from '../store/useNexusStore';

function formatDownloads(n: number | null): string | null {
  if (n === null || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M/mês`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k/mês`;
  return `${n}/mês`;
}

export function NewProjectDialog() {
  const open = useNexusStore((s) => s.newProjectOpen);
  const setOpen = useNexusStore((s) => s.setNewProjectOpen);
  const currentTarget = useNexusStore((s) => s.currentTarget);
  const defaultWorkspacePath = useNexusStore((s) => s.defaultWorkspacePath);
  const githubUsername = useNexusStore((s) => s.githubUsername);
  const scanTarget = useNexusStore((s) => s.scanTarget);

  const [modeTab, setModeTab] = useState<number>(0);

  // Stack selection state
  const [platform, setPlatform] = useState<ProjectPlatform>('web');
  const [language, setLanguage] = useState<ProjectLanguage>('typescript');
  const [frameworkId, setFrameworkId] = useState<string>('nextjs');
  const [database, setDatabase] = useState<DatabaseOptionId>('sqlite');
  const [orm, setOrm] = useState<OrmOptionId>('prisma');
  const [styling, setStyling] = useState<StylingOptionId>('tailwind');
  const [auth, setAuth] = useState<AuthOptionId>('none');
  const [packageManager, setPackageManager] = useState<PackageManager>('npm');
  const [versionMode, setVersionMode] = useState<ProjectVersionMode>('latest');
  const [pinnedVersion, setPinnedVersion] = useState<string>('');
  const [includeDocker, setIncludeDocker] = useState<boolean>(false);
  const [includeTests, setIncludeTests] = useState<boolean>(false);

  // Live registry metadata
  const [liveMeta, setLiveMeta] = useState<Record<string, LivePackageMeta>>({});
  const [loadingMeta, setLoadingMeta] = useState<boolean>(false);

  // User GitHub templates state
  const [userSearchName, setUserSearchName] = useState<string>(githubUsername || 'KaneeSell');
  const [includeAllRepos, setIncludeAllRepos] = useState<boolean>(false);
  const [userTemplates, setUserTemplates] = useState<GitHubTemplateDTO[]>([]);
  const [loadingUserTemplates, setLoadingUserTemplates] = useState<boolean>(false);
  const [userTemplatesError, setUserTemplatesError] = useState<string | null>(null);
  const [selectedUserTemplate, setSelectedUserTemplate] = useState<GitHubTemplateDTO | null>(null);

  // Public GitHub templates state
  const [publicQuery, setPublicQuery] = useState<string>('nextjs prisma sqlite typescript');
  const [publicTemplates, setPublicTemplates] = useState<GitHubTemplateDTO[]>([]);
  const [loadingPublicTemplates, setLoadingPublicTemplates] = useState<boolean>(false);
  const [publicTemplatesError, setPublicTemplatesError] = useState<string | null>(null);
  const [selectedPublicTemplate, setSelectedPublicTemplate] = useState<GitHubTemplateDTO | null>(
    null
  );

  // Shared destination & execution state
  const [projectName, setProjectName] = useState<string>('meu-novo-projeto');
  const [parentDir, setParentDir] = useState<string>('');
  const [initGit, setInitGit] = useState<boolean>(true);
  const [installDeps, setInstallDeps] = useState<boolean>(true);
  const [autoOpenInNexus, setAutoOpenInNexus] = useState<boolean>(true);

  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewPlan, setPreviewPlan] = useState<ScaffoldPlanPreview | null>(null);

  const [creating, setCreating] = useState<boolean>(false);
  const [progress, setProgress] = useState<CreateProjectProgressEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<CreateProjectResult | null>(null);

  const availableLanguages = useMemo(() => getAvailableLanguages(platform), [platform]);
  const availableFrameworks = useMemo(
    () => getAvailableFrameworks(platform, language),
    [platform, language]
  );
  const selectedFramework = useMemo(() => getFrameworkById(frameworkId), [frameworkId]);
  const availableDatabases = useMemo(() => getAvailableDatabases(frameworkId), [frameworkId]);
  const availableOrms = useMemo(
    () => getAvailableOrms(frameworkId, database),
    [frameworkId, database]
  );
  const availableStyling = useMemo(() => getAvailableStyling(frameworkId), [frameworkId]);
  const availableAuth = useMemo(() => getAvailableAuth(frameworkId), [frameworkId]);

  const sanitizedName = useMemo(() => sanitizeProjectName(projectName), [projectName]);

  // Keep parentDir & githubUsername synced when opening dialog
  useEffect(() => {
    if (!open) return;
    setParentDir((prev) => prev || currentTarget || defaultWorkspacePath || '');
    setUserSearchName(githubUsername || 'KaneeSell');
    setResult(null);
    setProgress(null);
    setLogs([]);
  }, [open, currentTarget, defaultWorkspacePath, githubUsername]);

  // Progressive cascading auto-corrections
  useEffect(() => {
    if (!availableLanguages.some((l) => l.id === language)) {
      setLanguage(availableLanguages[0]?.id ?? 'typescript');
    }
  }, [availableLanguages, language]);

  useEffect(() => {
    if (!availableFrameworks.some((f) => f.id === frameworkId)) {
      setFrameworkId(availableFrameworks[0]?.id ?? 'nextjs');
    }
  }, [availableFrameworks, frameworkId]);

  useEffect(() => {
    if (!availableDatabases.some((d) => d.id === database)) {
      setDatabase(availableDatabases[0]?.id ?? 'none');
    }
  }, [availableDatabases, database]);

  useEffect(() => {
    if (!availableOrms.some((o) => o.id === orm)) {
      setOrm(availableOrms[0]?.id ?? 'none');
    }
  }, [availableOrms, orm]);

  useEffect(() => {
    if (!availableStyling.some((s) => s.id === styling)) {
      setStyling(availableStyling[0]?.id ?? 'none');
    }
  }, [availableStyling, styling]);

  useEffect(() => {
    if (!availableAuth.some((a) => a.id === auth)) {
      setAuth(availableAuth[0]?.id ?? 'none');
    }
  }, [availableAuth, auth]);

  useEffect(() => {
    if (selectedFramework && !selectedFramework.supportedPackageManagers.includes(packageManager)) {
      setPackageManager(selectedFramework.supportedPackageManagers[0] ?? 'npm');
    }
  }, [selectedFramework, packageManager]);

  // Fetch live package versions for visible frameworks
  const loadLiveMetaForVisible = useCallback(
    async (force = false) => {
      const ids = availableFrameworks.map((f) => f.id);
      if (ids.length === 0) return;
      setLoadingMeta(true);
      try {
        const fetched = await window.nexus.fetchLiveStackMeta(ids, force);
        setLiveMeta((prev) => ({ ...prev, ...fetched }));
      } catch {
        // ignore transient network failures
      } finally {
        setLoadingMeta(false);
      }
    },
    [availableFrameworks]
  );

  useEffect(() => {
    if (open && modeTab === 0) {
      void loadLiveMetaForVisible(false);
    }
  }, [open, modeTab, loadLiveMetaForVisible]);

  // Load user's GitHub templates when opening Tab 2
  const loadUserTemplates = useCallback(
    async (force = false) => {
      setLoadingUserTemplates(true);
      setUserTemplatesError(null);
      try {
        const repos = await window.nexus.listUserGitHubTemplates(userSearchName, {
          includeAllRepos,
          forceRefresh: force
        });
        setUserTemplates(repos);
        if (repos.length > 0 && !selectedUserTemplate) {
          setSelectedUserTemplate(repos[0]);
        }
      } catch (err) {
        setUserTemplatesError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingUserTemplates(false);
      }
    },
    [userSearchName, includeAllRepos, selectedUserTemplate]
  );

  useEffect(() => {
    if (open && modeTab === 1) {
      void loadUserTemplates(false);
    }
  }, [open, modeTab, loadUserTemplates]);

  const runPublicSearch = useCallback(
    async (queryToRun: string, force = false) => {
      setLoadingPublicTemplates(true);
      setPublicTemplatesError(null);
      try {
        const repos = await window.nexus.searchPublicGitHubTemplates(queryToRun, {
          forceRefresh: force
        });
        setPublicTemplates(repos);
      } catch (err) {
        setPublicTemplatesError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingPublicTemplates(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open && modeTab === 2 && publicTemplates.length === 0 && !loadingPublicTemplates) {
      void runPublicSearch(publicQuery, false);
    }
  }, [open, modeTab, publicTemplates.length, loadingPublicTemplates, publicQuery, runPublicSearch]);

  // Listen to creation progress events
  useEffect(() => {
    if (!open) return;
    const off = window.nexus.onCreateProjectProgress((ev) => {
      setProgress(ev);
      if (ev.chunk) {
        setLogs((prev) => [...prev.slice(-250), ev.chunk!]);
      }
    });
    return off;
  }, [open]);

  const activeMode: CreateProjectMode =
    modeTab === 1 ? 'github-template' : modeTab === 2 ? 'public-template' : 'stack';

  const currentInput: CreateProjectInput = useMemo(() => {
    const template =
      activeMode === 'github-template'
        ? selectedUserTemplate
        : activeMode === 'public-template'
          ? selectedPublicTemplate
          : null;

    return {
      mode: activeMode,
      projectName,
      parentDir,
      initGit,
      installDeps,
      packageManager,
      stack:
        activeMode === 'stack'
          ? {
              platform,
              language,
              frameworkId,
              database,
              orm,
              styling,
              auth,
              packageManager,
              versionMode,
              pinnedVersion: pinnedVersion.trim() || liveMeta[frameworkId]?.latestVersion || null,
              includeDocker,
              includeTests
            }
          : undefined,
      templateRepo: template
        ? {
            fullName: template.fullName,
            cloneUrl: template.cloneUrl,
            defaultBranch: template.defaultBranch
          }
        : undefined
    };
  }, [
    activeMode,
    projectName,
    parentDir,
    initGit,
    installDeps,
    packageManager,
    platform,
    language,
    frameworkId,
    database,
    orm,
    styling,
    auth,
    versionMode,
    pinnedVersion,
    liveMeta,
    includeDocker,
    includeTests,
    selectedUserTemplate,
    selectedPublicTemplate
  ]);

  useEffect(() => {
    if (!open || !previewOpen || !parentDir.trim()) return;
    let cancelled = false;
    void window.nexus
      .previewProjectPlan(currentInput)
      .then((plan) => {
        if (!cancelled) setPreviewPlan(plan);
      })
      .catch(() => {
        if (!cancelled) setPreviewPlan(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, previewOpen, currentInput, parentDir]);

  const handlePickParentDir = async (): Promise<void> => {
    const picked = await window.nexus.pickFolder();
    if (picked) {
      setParentDir(picked);
    }
  };

  const handleSearchTemplatesForStack = (): void => {
    const query = buildGithubTemplateSearchQuery({
      platform,
      language,
      frameworkId,
      database,
      orm,
      styling,
      auth
    });
    setPublicQuery(query);
    setModeTab(2);
    void runPublicSearch(query, false);
  };

  const canCreate =
    !creating &&
    Boolean(projectName.trim()) &&
    Boolean(parentDir.trim()) &&
    (activeMode === 'stack' ||
      (activeMode === 'github-template' && Boolean(selectedUserTemplate)) ||
      (activeMode === 'public-template' && Boolean(selectedPublicTemplate)));

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    setResult(null);
    setLogs([]);
    setProgress({
      phase: 'validating',
      message: 'Iniciando criação do projeto...',
      stepIndex: 0,
      totalSteps: 1
    });

    try {
      const res = await window.nexus.createProject(currentInput);
      setResult(res);
      if (res.ok && res.projectPath && autoOpenInNexus) {
        await scanTarget(res.projectPath);
        setOpen(false);
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setCreating(false);
    }
  };

  const renderTemplateCard = (
    repo: GitHubTemplateDTO,
    selected: boolean,
    onSelect: () => void
  ) => (
    <Card
      key={repo.id}
      variant="outlined"
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper'
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {repo.fullName}
              </Typography>
              {repo.isTemplate ? (
                <Chip size="small" color="success" label="Template oficial" />
              ) : repo.isDetectedTemplate ? (
                <Chip size="small" color="primary" variant="outlined" label="Template detectado" />
              ) : null}
              {repo.isPrivate && <Chip size="small" variant="outlined" label="Privado" />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {repo.description || 'Sem descrição'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
            {repo.language && <Chip size="small" label={repo.language} variant="outlined" />}
            {repo.stars > 0 && (
              <Chip
                size="small"
                icon={<StarIcon fontSize="small" />}
                label={repo.stars.toLocaleString('pt-BR')}
                variant="outlined"
              />
            )}
            <Tooltip title="Abrir no GitHub">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void window.nexus.openExternalUrl(repo.htmlUrl);
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </CardActionArea>
    </Card>
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!creating) setOpen(false);
      }}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Criar Novo Projeto
            </Typography>
          </Box>
          <Tabs value={modeTab} onChange={(_e, v: number) => setModeTab(v)}>
            <Tab label="Montar Stack" />
            <Tab icon={<GitHubIcon fontSize="small" />} iconPosition="start" label="Meus Templates" />
            <Tab icon={<PublicIcon fontSize="small" />} iconPosition="start" label="Templates Públicos" />
          </Tabs>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {modeTab === 0 && (
            <>
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  1. PLATAFORMA
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {PLATFORM_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.id}
                      label={opt.label}
                      color={platform === opt.id ? 'primary' : 'default'}
                      variant={platform === opt.id ? 'filled' : 'outlined'}
                      onClick={() => setPlatform(opt.id)}
                    />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  2. LINGUAGEM DISPONÍVEL
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {availableLanguages.map((opt) => (
                    <Chip
                      key={opt.id}
                      label={opt.label}
                      color={language === opt.id ? 'primary' : 'default'}
                      variant={language === opt.id ? 'filled' : 'outlined'}
                      onClick={() => setLanguage(opt.id)}
                    />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    3. FRAMEWORK / RUNTIME (VERSÃO ATUALIZADA VIA API)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={loadingMeta ? <CircularProgress size={14} /> : <RefreshIcon />}
                    onClick={() => void loadLiveMetaForVisible(true)}
                    disabled={loadingMeta}
                  >
                    Atualizar versões
                  </Button>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.25
                  }}
                >
                  {availableFrameworks.map((fw) => {
                    const meta = liveMeta[fw.id];
                    const downloadsLabel = formatDownloads(meta?.monthlyDownloads ?? null);
                    const isSelected = frameworkId === fw.id;
                    return (
                      <Card
                        key={fw.id}
                        variant="outlined"
                        sx={{
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper'
                        }}
                      >
                        <CardActionArea onClick={() => setFrameworkId(fw.id)} sx={{ height: '100%' }}>
                          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {fw.name}
                              </Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                {fw.recommended && (
                                  <Chip size="small" color="success" variant="outlined" label="Popular" />
                                )}
                                {meta?.latestVersion && (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={`v${meta.latestVersion}`}
                                  />
                                )}
                              </Stack>
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              {fw.tagline}
                            </Typography>
                            {downloadsLabel && (
                              <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.5 }}>
                                {downloadsLabel} ({fw.registrySource.provider})
                              </Typography>
                            )}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    );
                  })}
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  4. BANCO DE DADOS, ORM, ESTILO, AUTH E VERSÃO
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                    gap: 1.5
                  }}
                >
                  <FormControl size="small" fullWidth>
                    <InputLabel>Banco de Dados</InputLabel>
                    <Select
                      label="Banco de Dados"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value as DatabaseOptionId)}
                    >
                      {availableDatabases.map((db) => (
                        <MenuItem key={db.id} value={db.id}>
                          {db.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth disabled={availableOrms.length <= 1 && availableOrms[0]?.id === 'none'}>
                    <InputLabel>ORM / Driver</InputLabel>
                    <Select
                      label="ORM / Driver"
                      value={orm}
                      onChange={(e) => setOrm(e.target.value as OrmOptionId)}
                    >
                      {availableOrms.map((o) => (
                        <MenuItem key={o.id} value={o.id}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth disabled={availableStyling.length <= 1}>
                    <InputLabel>Estilização / UI</InputLabel>
                    <Select
                      label="Estilização / UI"
                      value={styling}
                      onChange={(e) => setStyling(e.target.value as StylingOptionId)}
                    >
                      {availableStyling.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth disabled={availableAuth.length <= 1}>
                    <InputLabel>Autenticação</InputLabel>
                    <Select
                      label="Autenticação"
                      value={auth}
                      onChange={(e) => setAuth(e.target.value as AuthOptionId)}
                    >
                      {availableAuth.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl
                    size="small"
                    fullWidth
                    disabled={!selectedFramework || selectedFramework.supportedPackageManagers.length <= 1}
                  >
                    <InputLabel>Gerenciador</InputLabel>
                    <Select
                      label="Gerenciador"
                      value={packageManager}
                      onChange={(e) => setPackageManager(e.target.value as PackageManager)}
                    >
                      {(selectedFramework?.supportedPackageManagers ?? ['npm']).map((pm) => (
                        <MenuItem key={pm} value={pm}>
                          {pm}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel>Versão</InputLabel>
                    <Select
                      label="Versão"
                      value={versionMode}
                      onChange={(e) => setVersionMode(e.target.value as ProjectVersionMode)}
                    >
                      <MenuItem value="latest">Última versão (latest)</MenuItem>
                      <MenuItem value="pinned">Fixar versão específica</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {versionMode === 'pinned' && (
                  <TextField
                    size="small"
                    sx={{ mt: 1.5 }}
                    fullWidth
                    label="Versão fixada (opcional — padrão usa a versão mais recente consultada)"
                    placeholder={liveMeta[frameworkId]?.latestVersion ?? 'Ex: 15.1.0'}
                    value={pinnedVersion}
                    onChange={(e) => setPinnedVersion(e.target.value)}
                  />
                )}

                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={includeDocker}
                        onChange={(e) => setIncludeDocker(e.target.checked)}
                      />
                    }
                    label="Incluir Dockerfile / docker-compose"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={includeTests}
                        onChange={(e) => setIncludeTests(e.target.checked)}
                      />
                    }
                    label="Incluir setup de testes"
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<SearchIcon />}
                    onClick={handleSearchTemplatesForStack}
                  >
                    Buscar templates públicos desta stack
                  </Button>
                </Stack>
              </Box>
            </>
          )}

          {modeTab === 1 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                  size="small"
                  label="Usuário do GitHub"
                  value={userSearchName}
                  onChange={(e) => setUserSearchName(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
                <Button
                  variant="outlined"
                  startIcon={loadingUserTemplates ? <CircularProgress size={14} /> : <RefreshIcon />}
                  onClick={() => void loadUserTemplates(true)}
                  disabled={loadingUserTemplates}
                >
                  Buscar no GitHub
                </Button>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={includeAllRepos}
                      onChange={(e) => setIncludeAllRepos(e.target.checked)}
                    />
                  }
                  label="Mostrar todos os repositórios"
                />
              </Stack>

              {userTemplatesError && <Alert severity="error">{userTemplatesError}</Alert>}

              {!loadingUserTemplates && userTemplates.length === 0 && !userTemplatesError && (
                <Alert severity="info">
                  Nenhum repositório template detectado para <strong>{userSearchName}</strong>.
                  Ative &quot;Mostrar todos os repositórios&quot; ou marque um repositório como
                  Template no GitHub.
                </Alert>
              )}

              <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {userTemplates.map((repo) =>
                  renderTemplateCard(repo, selectedUserTemplate?.id === repo.id, () =>
                    setSelectedUserTemplate(repo)
                  )
                )}
              </Stack>
            </Stack>
          )}

          {modeTab === 2 && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  label="Buscar templates populares no GitHub (ex: nextjs prisma sqlite, fastapi, tauri)"
                  value={publicQuery}
                  onChange={(e) => setPublicQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runPublicSearch(publicQuery, true);
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={loadingPublicTemplates ? <CircularProgress size={14} /> : <SearchIcon />}
                  onClick={() => void runPublicSearch(publicQuery, true)}
                  disabled={loadingPublicTemplates}
                >
                  Buscar
                </Button>
              </Stack>

              {publicTemplatesError && <Alert severity="error">{publicTemplatesError}</Alert>}

              <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {publicTemplates.map((repo) =>
                  renderTemplateCard(repo, selectedPublicTemplate?.id === repo.id, () =>
                    setSelectedPublicTemplate(repo)
                  )
                )}
              </Stack>
            </Stack>
          )}

          <Divider />

          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              DESTINO E OPÇÕES DE CRIAÇÃO
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1.6fr' },
                gap: 1.5
              }}
            >
              <TextField
                size="small"
                label="Nome do projeto"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                helperText={`Pasta: ${sanitizedName}`}
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Pasta pai de destino"
                  placeholder="Ex: C:\Projetos\Pessoais"
                  value={parentDir}
                  onChange={(e) => setParentDir(e.target.value)}
                />
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => void handlePickParentDir()}
                  sx={{ whiteSpace: 'nowrap', height: 40 }}
                >
                  Escolher
                </Button>
              </Box>
            </Box>

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={installDeps}
                    onChange={(e) => setInstallDeps(e.target.checked)}
                  />
                }
                label="Instalar dependências automaticamente"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={initGit}
                    onChange={(e) => setInitGit(e.target.checked)}
                  />
                }
                label="Inicializar repositório Git"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={autoOpenInNexus}
                    onChange={(e) => setAutoOpenInNexus(e.target.checked)}
                  />
                }
                label="Abrir projeto no Nexus ao concluir"
              />
              <Box sx={{ flexGrow: 1 }} />
              <Button
                size="small"
                endIcon={previewOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setPreviewOpen((v) => !v)}
              >
                Pré-visualizar plano
              </Button>
            </Stack>

            <Collapse in={previewOpen}>
              {previewPlan && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem'
                  }}
                >
                  <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
                    Destino: {previewPlan.targetDir}
                  </Typography>
                  {previewPlan.commands.map((c, i) => (
                    <div key={`${c.label}-${i}`}>
                      [{i + 1}] {c.command}
                    </div>
                  ))}
                  {previewPlan.files.length > 0 && (
                    <Box sx={{ mt: 0.75 }}>
                      Arquivos gerados: {previewPlan.files.map((f) => f.relativePath).join(', ')}
                    </Box>
                  )}
                </Box>
              )}
            </Collapse>
          </Box>

          {(creating || progress || result) && (
            <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {progress?.message ?? (result?.ok ? 'Concluído' : 'Erro')}
                </Typography>
                {result?.ok && <CheckCircleIcon color="success" fontSize="small" />}
              </Box>
              {creating && <LinearProgress sx={{ mb: 1 }} />}
              {logs.length > 0 && (
                <Box
                  sx={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.default',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {logs.join('')}
                </Box>
              )}
              {result && !result.ok && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {result.error}
                </Alert>
              )}
              {result?.ok && (
                <Alert
                  severity="success"
                  sx={{ mt: 1 }}
                  action={
                    result.projectPath ? (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => {
                          void scanTarget(result.projectPath!).then(() => setOpen(false));
                        }}
                      >
                        Abrir no Nexus
                      </Button>
                    ) : undefined
                  }
                >
                  Projeto criado em <code>{result.projectPath}</code>
                </Alert>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => setOpen(false)} disabled={creating}>
          Fechar
        </Button>
        <Button
          variant="contained"
          startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
          disabled={!canCreate}
          onClick={() => void handleCreate()}
        >
          {creating ? 'Criando projeto...' : 'Criar Projeto'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
