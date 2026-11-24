import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Alert, Box, LinearProgress, Paper, Typography } from '@mui/material';
import { useNexusStore } from '../store/useNexusStore';

export function ScanProgressBanner() {
  const isScanning = useNexusStore((s) => s.isScanning);
  const scanProgress = useNexusStore((s) => s.scanProgress);
  const scanError = useNexusStore((s) => s.scanError);

  if (scanError) {
    return (
      <Alert severity="error" sx={{ borderRadius: 0 }}>
        Falha ao ler workspace: {scanError}
      </Alert>
    );
  }

  if (!isScanning && !scanProgress) {
    return null;
  }

  if (!isScanning && scanProgress?.phase === 'done') {
    return (
      <Box
        sx={{
          px: 2,
          py: 0.6,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <CheckCircleOutlineIcon color="success" sx={{ fontSize: 16 }} />
        <Typography variant="caption" color="text.secondary">
          {scanProgress.message}
        </Typography>
      </Box>
    );
  }

  if (!isScanning && scanProgress?.phase === 'error') {
    return (
      <Box
        sx={{
          px: 2,
          py: 0.6,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <ErrorOutlineIcon color="error" sx={{ fontSize: 16 }} />
        <Typography variant="caption" color="error">
          {scanProgress.message}
        </Typography>
      </Box>
    );
  }

  const total = Math.max(scanProgress?.total ?? 1, 1);
  const current = Math.min(scanProgress?.current ?? 0, total);
  const percent = scanProgress?.phase === 'listing' ? undefined : Math.round((current / total) * 100);

  return (
    <Paper
      square
      elevation={0}
      sx={{
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" color="primary" fontWeight={600}>
          {scanProgress?.message ?? 'Escaneando projetos...'}
        </Typography>
        {percent !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {current}/{total} ({percent}%)
          </Typography>
        )}
      </Box>
      <LinearProgress
        variant={percent === undefined ? 'indeterminate' : 'determinate'}
        value={percent}
        sx={{ height: 5, borderRadius: 3 }}
      />
    </Paper>
  );
}
