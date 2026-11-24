import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useNexusStore } from '../store/useNexusStore';

export function UpdateBanner() {
  const updateInfo = useNexusStore((s) => s.updateInfo);
  const installingUpdate = useNexusStore((s) => s.installingUpdate);
  const updateError = useNexusStore((s) => s.updateError);
  const installUpdate = useNexusStore((s) => s.installUpdate);
  const dismissUpdate = useNexusStore((s) => s.dismissUpdate);

  if (!updateInfo?.hasUpdate || !updateInfo.shouldNotify) {
    return null;
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Alert
        severity="info"
        icon={<SystemUpdateAltIcon fontSize="small" />}
        sx={{
          borderRadius: 0,
          py: 0.5,
          alignItems: 'center',
          '& .MuiAlert-message': { flex: 1 }
        }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              size="small"
              variant="contained"
              disabled={installingUpdate}
              onClick={() => void installUpdate()}
            >
              {installingUpdate ? 'Baixando...' : 'Atualizar agora'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewIcon fontSize="small" />}
              onClick={() => void window.nexus.openExternalUrl(updateInfo.releaseUrl)}
            >
              Ver release
            </Button>
            <Button size="small" color="inherit" onClick={() => void dismissUpdate(24)}>
              Lembrar em 24h
            </Button>
            <Button size="small" color="inherit" onClick={() => void dismissUpdate(24 * 7)}>
              Ignorar 7 dias
            </Button>
          </Stack>
        }
      >
        <Typography variant="body2" fontWeight={600}>
          Nova versão disponível: v{updateInfo.latestVersion}{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            (atual: v{updateInfo.currentVersion})
          </Typography>
        </Typography>
        {updateError && (
          <Typography variant="caption" color="error" display="block">
            {updateError}
          </Typography>
        )}
      </Alert>
    </Box>
  );
}
