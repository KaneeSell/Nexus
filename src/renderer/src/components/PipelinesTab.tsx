import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import type { PipelineDTO } from '../../../shared/types';
import { useNexusStore } from '../store/useNexusStore';

interface PipelinesTabProps {
  projectId: string;
  onCreateNew: () => void;
  onEdit: (pipeline: PipelineDTO) => void;
}

function errorLabel(action: string): string {
  switch (action) {
    case 'continue':
      return 'Se erro: continuar';
    case 'run_command':
      return 'Se erro: comando fallback';
    default:
      return 'Se erro: parar';
  }
}

export function PipelinesTab({ projectId, onCreateNew, onEdit }: PipelinesTabProps) {
  const pipelines = useNexusStore((s) => s.pipelines);
  const activeRun = useNexusStore((s) => s.activeRun);
  const runPipeline = useNexusStore((s) => s.runPipeline);
  const deletePipeline = useNexusStore((s) => s.deletePipeline);

  const isRunning = activeRun?.status === 'running';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Pipelines configurados ({pipelines.length})
        </Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onCreateNew}>
          Novo Pipeline
        </Button>
      </Box>

      {pipelines.length === 0 ? (
        <Alert severity="info">
          Nenhum pipeline criado ainda para este projeto. Crie um conjunto de comandos (ex:{' '}
          <strong>CI/CD</strong>) clicando em <strong>Novo Pipeline</strong> ou selecionando
          scripts na aba anterior.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {pipeline.name}
                    </Typography>
                    {pipeline.description && (
                      <Typography variant="body2" color="text.secondary">
                        {pipeline.description}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    size="small"
                    label={`${pipeline.steps.filter((s) => s.enabled).length} etapa(s) ativa(s)`}
                    variant="outlined"
                  />
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {pipeline.steps.map((step, index) => (
                    <Chip
                      key={step.id}
                      size="small"
                      variant={step.enabled ? 'filled' : 'outlined'}
                      color={step.enabled ? 'default' : 'warning'}
                      label={`${index + 1}. ${step.name} (${errorLabel(step.onErrorAction)})`}
                      sx={{ opacity: step.enabled ? 1 : 0.6 }}
                    />
                  ))}
                </Stack>
              </CardContent>

              <CardActions sx={{ px: 2, pb: 1.5, justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    disabled={isRunning}
                    onClick={() => void runPipeline(pipeline.id)}
                  >
                    Executar
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => onEdit(pipeline)}
                  >
                    Editar / Reordenar
                  </Button>
                </Stack>

                <IconButton
                  size="small"
                  color="error"
                  title="Excluir pipeline"
                  onClick={() => void deletePipeline(pipeline.id, projectId)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
