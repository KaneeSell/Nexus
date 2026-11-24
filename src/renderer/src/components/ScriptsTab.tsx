import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { ScannedProject } from '../../../shared/types';
import { useNexusStore } from '../store/useNexusStore';

interface ScriptsTabProps {
  project: ScannedProject;
  onCreatePipelineFromScripts: (scripts: string[]) => void;
}

export function ScriptsTab({ project, onCreatePipelineFromScripts }: ScriptsTabProps) {
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const activeRun = useNexusStore((s) => s.activeRun);
  const runSingleScript = useNexusStore((s) => s.runSingleScript);
  const runScriptsBatch = useNexusStore((s) => s.runScriptsBatch);

  useEffect(() => {
    setSelectedOrder([]);
  }, [project.id]);

  const isRunning = activeRun?.status === 'running';

  const toggleScript = (name: string): void => {
    setSelectedOrder((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  if (project.scripts.length === 0) {
    return (
      <Alert severity="info">
        Este projeto não possui scripts definidos no <code>package.json</code>. Você ainda pode criar
        pipelines na aba <strong>Pipelines</strong> usando comandos de terminal livres.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={600}>
            {selectedOrder.length === 0
              ? 'Selecione scripts na ordem desejada para executar em lote ou criar um pipeline:'
              : `Ordem selecionada (${selectedOrder.length}):`}
          </Typography>
          {selectedOrder.map((name, idx) => (
            <Chip
              key={name}
              size="small"
              color="primary"
              variant="outlined"
              label={`${idx + 1}. ${name}`}
              onDelete={() => toggleScript(name)}
            />
          ))}
        </Box>

        <Stack direction="row" spacing={1}>
          {selectedOrder.length > 0 && (
            <Button size="small" color="inherit" onClick={() => setSelectedOrder([])}>
              Limpar seleção
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlaylistAddIcon />}
            disabled={selectedOrder.length === 0}
            onClick={() => onCreatePipelineFromScripts(selectedOrder)}
          >
            Salvar como Pipeline
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<PlaylistPlayIcon />}
            disabled={selectedOrder.length === 0 || isRunning}
            onClick={() => void runScriptsBatch(project, selectedOrder)}
          >
            Executar Selecionados
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell sx={{ fontWeight: 700, width: 220 }}>Script</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Comando no package.json</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 130 }}>
                Ação
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {project.scripts.map((script) => {
              const orderIndex = selectedOrder.indexOf(script.name);
              const checked = orderIndex !== -1;
              return (
                <TableRow key={script.name} hover selected={checked}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked}
                      onChange={() => toggleScript(script.name)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {checked && (
                        <Chip
                          size="small"
                          color="primary"
                          label={orderIndex + 1}
                          sx={{ height: 20, minWidth: 24, fontSize: '0.7rem' }}
                        />
                      )}
                      <Typography variant="body2" fontWeight={600}>
                        {script.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={script.command}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          maxWidth: 520,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {script.command}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PlayArrowIcon />}
                      disabled={isRunning}
                      onClick={() => void runSingleScript(project, script.name)}
                    >
                      Rodar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
