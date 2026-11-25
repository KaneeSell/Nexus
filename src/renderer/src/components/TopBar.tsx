import AddIcon from '@mui/icons-material/Add';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HubIcon from '@mui/icons-material/Hub';
import LightModeIcon from '@mui/icons-material/LightMode';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  AppBar,
  Box,
  Button,
  Chip,
  IconButton,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import { useNexusStore } from '../store/useNexusStore';

export function TopBar() {
  const currentTarget = useNexusStore((s) => s.currentTarget);
  const isScanning = useNexusStore((s) => s.isScanning);
  const themeMode = useNexusStore((s) => s.themeMode);
  const activeRun = useNexusStore((s) => s.activeRun);
  const pickAndScanFolder = useNexusStore((s) => s.pickAndScanFolder);
  const scanTarget = useNexusStore((s) => s.scanTarget);
  const toggleTheme = useNexusStore((s) => s.toggleTheme);
  const setConsoleExpanded = useNexusStore((s) => s.setConsoleExpanded);
  const setSettingsOpen = useNexusStore((s) => s.setSettingsOpen);
  const setNewProjectOpen = useNexusStore((s) => s.setNewProjectOpen);

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 54 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HubIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700} letterSpacing={0.3}>
            NEXUS
          </Typography>
        </Box>

        {currentTarget ? (
          <Tooltip title={currentTarget}>
            <Chip
              size="small"
              variant="outlined"
              label={currentTarget}
              sx={{
                maxWidth: 420,
                fontFamily: 'monospace',
                fontSize: '0.75rem'
              }}
            />
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nenhuma pasta aberta
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {activeRun && (
          <Chip
            size="small"
            icon={<PlayCircleIcon />}
            color={
              activeRun.status === 'running'
                ? 'primary'
                : activeRun.status === 'success'
                  ? 'success'
                  : activeRun.status === 'cancelled'
                    ? 'warning'
                    : 'error'
            }
            label={
              activeRun.status === 'running'
                ? `Executando: ${activeRun.title}`
                : `${activeRun.title} (${activeRun.status})`
            }
            onClick={() => setConsoleExpanded(true)}
            sx={{ cursor: 'pointer' }}
          />
        )}

        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setNewProjectOpen(true)}
        >
          Novo Projeto
        </Button>

        <Button
          size="small"
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => void pickAndScanFolder()}
          disabled={isScanning}
        >
          Abrir Pasta
        </Button>

        {currentTarget && (
          <Tooltip title="Reescanear pasta atual">
            <span>
              <IconButton
                size="small"
                onClick={() => void scanTarget(currentTarget)}
                disabled={isScanning}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        <Tooltip title={themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          <IconButton size="small" onClick={() => void toggleTheme()}>
            {themeMode === 'dark' ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="Configurações (Inicialização e CLI nexus .)">
          <IconButton size="small" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
