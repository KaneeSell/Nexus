import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import type {
  OnErrorAction,
  PipelineDTO,
  ProjectScript,
  SavePipelineInput,
  SavePipelineStepInput,
  StepKind
} from '../../../shared/types';

interface EditableStep extends SavePipelineStepInput {
  localId: string;
}

interface SortableStepCardProps {
  step: EditableStep;
  index: number;
  scripts: ProjectScript[];
  onChange: (localId: string, patch: Partial<EditableStep>) => void;
  onRemove: (localId: string) => void;
}

function SortableStepCard({ step, index, scripts, onChange, onRemove }: SortableStepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.localId
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: step.enabled ? 'divider' : 'action.disabledBackground',
        bgcolor: 'background.default'
      }}
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            {...attributes}
            {...listeners}
            sx={{ cursor: 'grab' }}
            title="Arrastar para reordenar"
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>

          <Typography variant="caption" fontWeight={700} color="primary" sx={{ minWidth: 28 }}>
            #{index + 1}
          </Typography>

          <TextField
            size="small"
            label="Nome da etapa"
            value={step.name}
            onChange={(e) => onChange(step.localId, { name: e.target.value })}
            sx={{ flex: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Tipo</InputLabel>
            <Select
              label="Tipo"
              value={step.kind}
              onChange={(e) => {
                const nextKind = e.target.value as StepKind;
                const firstScript = scripts[0]?.name ?? '';
                onChange(step.localId, {
                  kind: nextKind,
                  command: nextKind === 'script' ? firstScript : '',
                  name: nextKind === 'script' && firstScript ? firstScript : step.name
                });
              }}
            >
              <MenuItem value="script" disabled={scripts.length === 0}>
                Script (package.json)
              </MenuItem>
              <MenuItem value="command">Comando Shell</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title={step.enabled ? 'Etapa ativa' : 'Etapa desabilitada'}>
            <Switch
              size="small"
              checked={step.enabled}
              onChange={(e) => onChange(step.localId, { enabled: e.target.checked })}
            />
          </Tooltip>

          <IconButton size="small" color="error" onClick={() => onRemove(step.localId)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {step.kind === 'script' ? (
            <FormControl size="small" sx={{ flex: 1, minWidth: 220 }}>
              <InputLabel>Script do package.json</InputLabel>
              <Select
                label="Script do package.json"
                value={step.command}
                onChange={(e) =>
                  onChange(step.localId, {
                    command: e.target.value,
                    name: step.name || e.target.value
                  })
                }
              >
                {scripts.map((s) => (
                  <MenuItem key={s.name} value={s.name}>
                    {s.name} — {s.command}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <TextField
              size="small"
              label="Comando no terminal"
              placeholder="Ex: npx prisma migrate deploy"
              value={step.command}
              onChange={(e) => onChange(step.localId, { command: e.target.value })}
              sx={{ flex: 1, minWidth: 220 }}
            />
          )}

          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>Se der erro</InputLabel>
            <Select
              label="Se der erro"
              value={step.onErrorAction}
              onChange={(e) =>
                onChange(step.localId, { onErrorAction: e.target.value as OnErrorAction })
              }
            >
              <MenuItem value="stop">Parar pipeline</MenuItem>
              <MenuItem value="continue">Continuar mesmo com erro</MenuItem>
              <MenuItem value="run_command">Executar comando e parar</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {step.onErrorAction === 'run_command' && (
          <TextField
            size="small"
            fullWidth
            label="Comando de fallback ao falhar"
            placeholder="Ex: echo Falha no passo && git checkout -- ."
            value={step.onErrorCommand ?? ''}
            onChange={(e) => onChange(step.localId, { onErrorCommand: e.target.value })}
          />
        )}

        <TextField
          size="small"
          fullWidth
          label="Comando extra se tiver sucesso (opcional)"
          placeholder="Ex: echo Etapa concluida com sucesso!"
          value={step.onSuccessCommand ?? ''}
          onChange={(e) => onChange(step.localId, { onSuccessCommand: e.target.value })}
        />
      </Stack>
    </Paper>
  );
}

interface PipelineEditorDialogProps {
  open: boolean;
  projectId: string;
  scripts: ProjectScript[];
  initialPipeline: PipelineDTO | null;
  prefillScripts?: string[];
  onClose: () => void;
  onSave: (input: SavePipelineInput) => Promise<void>;
}

function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PipelineEditorDialog({
  open,
  projectId,
  scripts,
  initialPipeline,
  prefillScripts,
  onClose,
  onSave
}: PipelineEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!open) return;

    if (initialPipeline) {
      setName(initialPipeline.name);
      setDescription(initialPipeline.description);
      setSteps(
        initialPipeline.steps.map((s) => ({
          localId: s.id || makeLocalId(),
          id: s.id,
          name: s.name,
          kind: s.kind,
          command: s.command,
          onErrorAction: s.onErrorAction,
          onErrorCommand: s.onErrorCommand ?? '',
          onSuccessCommand: s.onSuccessCommand ?? '',
          enabled: s.enabled
        }))
      );
      return;
    }

    if (prefillScripts && prefillScripts.length > 0) {
      setName('CI/CD');
      setDescription('');
      setSteps(
        prefillScripts.map((scriptName) => ({
          localId: makeLocalId(),
          name: scriptName,
          kind: 'script',
          command: scriptName,
          onErrorAction: 'stop',
          onErrorCommand: '',
          onSuccessCommand: '',
          enabled: true
        }))
      );
      return;
    }

    setName('CI/CD');
    setDescription('');
    const defaultScript = scripts[0]?.name ?? '';
    setSteps([
      {
        localId: makeLocalId(),
        name: defaultScript || 'Passo 1',
        kind: defaultScript ? 'script' : 'command',
        command: defaultScript,
        onErrorAction: 'stop',
        onErrorCommand: '',
        onSuccessCommand: '',
        enabled: true
      }
    ]);
  }, [open, initialPipeline, prefillScripts, scripts]);

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((i) => i.localId === active.id);
        const newIndex = items.findIndex((i) => i.localId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddStep = (kind: StepKind): void => {
    const defaultScript = scripts[0]?.name ?? '';
    setSteps((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        name: kind === 'script' && defaultScript ? defaultScript : `Etapa ${prev.length + 1}`,
        kind,
        command: kind === 'script' ? defaultScript : '',
        onErrorAction: 'stop',
        onErrorCommand: '',
        onSuccessCommand: '',
        enabled: true
      }
    ]);
  };

  const handleStepChange = (localId: string, patch: Partial<EditableStep>): void => {
    setSteps((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  };

  const handleRemoveStep = (localId: string): void => {
    setSteps((prev) => prev.filter((s) => s.localId !== localId));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    try {
      await onSave({
        id: initialPipeline?.id,
        projectId,
        name: name.trim(),
        description: description.trim(),
        steps: steps
          .filter((s) => s.command.trim().length > 0)
          .map(({ localId: _ignored, ...rest }) => rest)
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{initialPipeline ? 'Editar Pipeline' : 'Novo Pipeline'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label="Nome do Pipeline"
              placeholder="Ex: CI/CD, Deploy Staging, Lint + Test"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ flex: 1 }}
              required
            />
            <TextField
              size="small"
              label="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{ flex: 1.5 }}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Etapas (arraste pelo ícone à esquerda para reordenar)
            </Typography>
            <Stack direction="row" spacing={1}>
              {scripts.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddStep('script')}
                >
                  Adicionar Script
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleAddStep('command')}
              >
                Adicionar Comando
              </Button>
            </Stack>
          </Box>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={steps.map((s) => s.localId)}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={1.25}>
                {steps.map((step, index) => (
                  <SortableStepCard
                    key={step.localId}
                    step={step}
                    index={index}
                    scripts={scripts}
                    onChange={handleStepChange}
                    onRemove={handleRemoveStep}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={saving || !name.trim() || steps.every((s) => !s.command.trim())}
        >
          {saving ? 'Salvando...' : 'Salvar Pipeline'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
