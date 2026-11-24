import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import TerminalIcon from '@mui/icons-material/Terminal';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { StartupMode } from '../../../shared/types';
import { useNexusStore } from '../store/useNexusStore';

export function SettingsDialog() {
  const open = useNexusStore((s) => s.settingsOpen);
  const setSettingsOpen = useNexusStore((s) => s.setSettingsOpen);
  const themeMode = useNexusStore((s) => s.themeMode);
  const setThemeMode = useNexusStore((s) => s.setThemeMode);
  const startupMode = useNexusStore((s) => s.startupMode);
  const defaultWorkspacePath = useNexusStore((s) => s.defaultWorkspacePath);
  const cliStatus = useNexusStore((s) => s.cliStatus);
  const appInfo = useNexusStore((s) => s.appInfo);
  const updateInfo = useNexusStore((s) => s.updateInfo);
  const checkingUpdates = useNexusStore((s) => s.checkingUpdates);
  const installingUpdate = useNexusStore((s) => s.installingUpdate);
  const updateError = useNexusStore((s) => s.updateError);
  const loadSettings = useNexusStore((s) => s.loadSettings);
  const saveStartupConfig = useNexusStore((s) => s.saveStartupConfig);
  const installCli = useNexusStore((s) => s.installCli);
  const uninstallCli = useNexusStore((s) => s.uninstallCli);
  const checkForUpdates = useNexusStore((s) => s.checkForUpdates);
  const installUpdate = useNexusStore((s) => s.installUpdate);

  const [draftMode, setDraftMode] = useState<StartupMode>(startupMode);
  const [draftPath, setDraftPath] = useState(defaultWorkspacePath);
  const [busyCli, setBusyCli] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cliFeedback, setCliFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCliFeedback(null);
      void loadSettings();
    }
  }, [open, loadSettings]);

  useEffect(() => {
    setDraftMode(startupMode);
    setDraftPath(defaultWorkspacePath);
  }, [startupMode, defaultWorkspacePath, open]);

  const handlePickDefaultFolder = async (): Promise<void> => {
    const picked = await window.nexus.pickFolder();
    if (picked) {
      setDraftPath(picked);
      setDraftMode('fixed');
    }
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await saveStartupConfig(draftMode, draftPath);
      setSettingsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleInstallCli = async (): Promise<void> => {
    setBusyCli(true);
    setCliFeedback(null);
    try {
      await installCli();
      setCliFeedback('Comando "nexus ." registrado no PATH do usuário. Abra um novo Explorer/Terminal para usar.');
    } catch (err) {
      setCliFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyCli(false);
    }
  };

  const handleUninstallCli = async (): Promise<void> => {
    setBusyCli(true);
    setCliFeedback(null);
    try {
      await uninstallCli();
      setCliFeedback('Comando "nexus" removido do PATH do usuário.');
    } catch (err) {
      setCliFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyCli(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Configurações do Nexus</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ fontWeight: 700, mb: 1 }}>
                Ao abrir o aplicativo normalmente
              </FormLabel>
              <RadioGroup
                value={draftMode}
                onChange={(e) => setDraftMode(e.target.value as StartupMode)}
              >
                <FormControlLabel
                  value="last"
                  control={<Radio size="small" />}
                  label="Reabrir a última pasta acessada"
                />
                <FormControlLabel
                  value="fixed"
                  control={<Radio size="small" />}
                  label="Sempre abrir uma pasta padrão fixa"
                />
                <FormControlLabel
                  value="empty"
                  control={<Radio size="small" />}
                  label="Abrir tela inicial vazia para escolher manualmente"
                />
              </RadioGroup>
            </FormControl>

            {draftMode === 'fixed' && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Pasta padrão ao iniciar"
                  placeholder="Ex: C:\Projetos\Pessoais"
                  value={draftPath}
                  onChange={(e) => setDraftPath(e.target.value)}
                />
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => void handlePickDefaultFolder()}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Escolher
                </Button>
              </Box>
            )}
          </Box>

          <Divider />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TerminalIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Comando CLI (nexus .)
                </Typography>
              </Box>
              {cliStatus && (
                <Chip
                  size="small"
                  icon={cliStatus.installed ? <CheckCircleIcon /> : <WarningAmberIcon />}
                  color={cliStatus.installed ? 'success' : 'warning'}
                  label={cliStatus.installed ? 'Registrado no PATH' : 'Não registrado'}
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Permite digitar <code>nexus .</code> na barra de endereço do Windows Explorer ou no
              terminal para abrir o Nexus direto na pasta atual.
            </Typography>

            {cliStatus && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ fontFamily: 'monospace', mb: 1.5, wordBreak: 'break-all' }}
              >
                Pasta do comando: {cliStatus.binDir}
              </Typography>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                disabled={busyCli}
                onClick={() => void handleInstallCli()}
              >
                {cliStatus?.installed ? 'Atualizar PATH' : 'Registrar nexus no PATH'}
              </Button>
              {cliStatus?.installed && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  disabled={busyCli}
                  onClick={() => void handleUninstallCli()}
                >
                  Remover do PATH
                </Button>
              )}
            </Stack>

            {cliFeedback && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {cliFeedback}
              </Alert>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Aparência e Dados Locais
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={themeMode === 'dark'}
                  onChange={(e) => void setThemeMode(e.target.checked ? 'dark' : 'light')}
                />
              }
              label="Modo escuro"
            />

            {appInfo && (
              <Box sx={{ mt: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                >
                  Versão: {appInfo.version} ({appInfo.isPackaged ? 'Instalado' : 'Desenvolvimento'})
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mb: 1 }}
                >
                  Banco SQLite: {appInfo.dbPath}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => void window.nexus.openInExplorer(appInfo.userDataPath)}
                >
                  Abrir pasta de dados
                </Button>
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={checkingUpdates}
                  onClick={() => void checkForUpdates(true)}
                >
                  {checkingUpdates ? 'Verificando...' : 'Verificar atualizações'}
                </Button>
                {updateInfo?.hasUpdate && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={installingUpdate}
                    onClick={() => void installUpdate()}
                  >
                    {installingUpdate
                      ? 'Baixando...'
                      : `Atualizar para v${updateInfo.latestVersion}`}
                  </Button>
                )}
              </Stack>

              {updateInfo && !updateInfo.hasUpdate && (
                <Typography variant="caption" color="success.main" display="block" sx={{ mt: 0.75 }}>
                  Você já está na versão mais recente (v{updateInfo.currentVersion}).
                </Typography>
              )}
              {updateInfo?.hasUpdate && (
                <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.75 }}>
                  Nova versão v{updateInfo.latestVersion} disponível no GitHub Releases.
                </Typography>
              )}
              {updateError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.75 }}>
                  {updateError}
                </Typography>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSettingsOpen(false)}>Fechar</Button>
        <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
