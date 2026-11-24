import ClearAllIcon from '@mui/icons-material/ClearAll';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import StopIcon from '@mui/icons-material/Stop';
import TerminalIcon from '@mui/icons-material/Terminal';
import { Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import { useNexusStore } from '../store/useNexusStore';

export function RunnerConsole() {
  const activeRun = useNexusStore((s) => s.activeRun);
  const activeStepStatuses = useNexusStore((s) => s.activeStepStatuses);
  const logs = useNexusStore((s) => s.logs);
  const consoleExpanded = useNexusStore((s) => s.consoleExpanded);
  const setConsoleExpanded = useNexusStore((s) => s.setConsoleExpanded);
  const cancelActiveRun = useNexusStore((s) => s.cancelActiveRun);
  const clearLogs = useNexusStore((s) => s.clearLogs);

  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (consoleExpanded) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, consoleExpanded]);

  const isRunning = activeRun?.status === 'running';

  const handleCopy = async (): Promise<void> => {
    const text = logs.map((l) => l.chunk).join('');
    await navigator.clipboard.writeText(text);
  };

  return (
    <Paper
      square
      elevation={0}
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer'
        }}
        onClick={() => setConsoleExpanded(!consoleExpanded)}
      >
        <TerminalIcon fontSize="small" color={isRunning ? 'primary' : 'action'} />
        <Typography variant="subtitle2" fontWeight={700}>
          Console de Execução
        </Typography>

        {activeRun && (
          <Chip
            size="small"
            color={
              activeRun.status === 'running'
                ? 'primary'
                : activeRun.status === 'success'
                  ? 'success'
                  : activeRun.status === 'cancelled'
                    ? 'warning'
                    : 'error'
            }
            label={`${activeRun.title} — ${activeRun.status}`}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />

        {isRunning && (
          <Button
            size="small"
            color="error"
            variant="contained"
            startIcon={<StopIcon />}
            onClick={(e) => {
              e.stopPropagation();
              void cancelActiveRun();
            }}
          >
            Cancelar
          </Button>
        )}

        <Tooltip title="Copiar logs">
          <span>
            <IconButton
              size="small"
              disabled={logs.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                void handleCopy();
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Limpar logs">
          <span>
            <IconButton
              size="small"
              disabled={logs.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                clearLogs();
              }}
            >
              <ClearAllIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <IconButton size="small">
          {consoleExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
        </IconButton>
      </Box>

      {consoleExpanded && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          {activeStepStatuses.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {activeStepStatuses.map((step) => (
                <Chip
                  key={step.stepIndex}
                  size="small"
                  label={`${step.stepIndex + 1}. ${step.stepName}: ${step.status}`}
                  color={
                    step.status === 'success'
                      ? 'success'
                      : step.status === 'failed'
                        ? 'error'
                        : step.status === 'running'
                          ? 'primary'
                          : 'default'
                  }
                  variant={step.status === 'running' ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          )}

          <Box
            sx={{
              height: 220,
              overflowY: 'auto',
              p: 1.5,
              borderRadius: 1,
              bgcolor: '#090D14',
              color: '#E5E7EB',
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: '0.78rem',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {logs.length === 0 ? (
              <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                Aguardando execução de scripts ou pipelines...
              </Typography>
            ) : (
              logs.map((entry, idx) => (
                <Box
                  component="span"
                  key={idx}
                  sx={{
                    color:
                      entry.stream === 'stderr'
                        ? '#FCA5A5'
                        : entry.stream === 'system'
                          ? '#7DD3FC'
                          : '#E5E7EB'
                  }}
                >
                  {entry.chunk}
                </Box>
              ))
            )}
            <div ref={logEndRef} />
          </Box>
        </Box>
      )}
    </Paper>
  );
}
