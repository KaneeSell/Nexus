import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Stack,
  Typography
} from '@mui/material';
import { useNexusStore } from '../store/useNexusStore';

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return 'em andamento';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusColor(status: string): 'success' | 'error' | 'warning' | 'primary' {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'warning';
    default:
      return 'primary';
  }
}

export function HistoryTab() {
  const runHistory = useNexusStore((s) => s.runHistory);

  if (runHistory.length === 0) {
    return (
      <Alert severity="info">
        Nenhuma execução registrada no banco ainda para este projeto.
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      {runHistory.map((run) => (
        <Accordion key={run.id} variant="outlined" disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                pr: 1,
                gap: 1.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Chip size="small" color={statusColor(run.status)} label={run.status} />
                <Typography variant="body2" fontWeight={600}>
                  {run.title}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(run.startedAt).toLocaleString('pt-BR')} •{' '}
                {formatDuration(run.startedAt, run.finishedAt)}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.default',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                maxHeight: 280,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {run.logs || '(Sem logs gravados)'}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}
