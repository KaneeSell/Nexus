import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import type {
  ExportPipelineResult,
  PipelineDTO,
  PipelineExportFormat,
  PipelineExportOptions,
  PipelineExportStyle
} from '../../../shared/types';
import { useNexusStore } from '../store/useNexusStore';

interface ExportPipelineDialogProps {
  open: boolean;
  pipeline: PipelineDTO | null;
  onClose: () => void;
  onExported: (result: ExportPipelineResult, pipelineName: string) => void;
}

export function ExportPipelineDialog({
  open,
  pipeline,
  onClose,
  onExported
}: ExportPipelineDialogProps) {
  const appInfo = useNexusStore((s) => s.appInfo);
  const previewExportPipeline = useNexusStore((s) => s.previewExportPipeline);
  const exportPipeline = useNexusStore((s) => s.exportPipeline);

  const defaultFormat: PipelineExportFormat =
    (appInfo?.platform ?? 'win32') === 'win32' ? 'bat' : 'sh';

  const [format, setFormat] = useState<PipelineExportFormat>(defaultFormat);
  const [style, setStyle] = useState<PipelineExportStyle>('rich');
  const [confirmBeforeRun, setConfirmBeforeRun] = useState(true);
  const [pauseOnFinish, setPauseOnFinish] = useState(true);
  const [includeColors, setIncludeColors] = useState(true);
  const [useProjectDir, setUseProjectDir] = useState(true);
  const [saveLogFile, setSaveLogFile] = useState(false);
  const [envProfile, setEnvProfile] = useState('');
  const [customHeader, setCustomHeader] = useState('');

  const [previewCode, setPreviewCode] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormat((appInfo?.platform ?? 'win32') === 'win32' ? 'bat' : 'sh');
    setStyle('rich');
    setConfirmBeforeRun(true);
    setPauseOnFinish(true);
    setIncludeColors(true);
    setUseProjectDir(true);
    setSaveLogFile(false);
    setEnvProfile('');
    setCustomHeader('');
    setPreviewError(null);
    setCopied(false);
  }, [open, appInfo?.platform]);

  const handleStyleChange = (nextStyle: PipelineExportStyle): void => {
    setStyle(nextStyle);
    if (nextStyle === 'raw') {
      setConfirmBeforeRun(false);
      setPauseOnFinish(false);
      setIncludeColors(false);
    } else {
      setConfirmBeforeRun(true);
      setPauseOnFinish(true);
      setIncludeColors(true);
    }
  };

  const buildOptions = (): PipelineExportOptions => ({
    style,
    confirmBeforeRun,
    pauseOnFinish,
    includeColors,
    useProjectDir,
    saveLogFile,
    envProfile: envProfile.trim() || null,
    customHeader: customHeader.trim() || null
  });

  useEffect(() => {
    if (!open || !pipeline) return;
    let cancelled = false;
    const opts = {
      style,
      confirmBeforeRun,
      pauseOnFinish,
      includeColors,
      useProjectDir,
      saveLogFile,
      envProfile: envProfile.trim() || null,
      customHeader: customHeader.trim() || null
    };

    void previewExportPipeline(pipeline.id, format, opts)
      .then((code) => {
        if (!cancelled) {
          setPreviewCode(code);
          setPreviewError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    pipeline,
    format,
    style,
    confirmBeforeRun,
    pauseOnFinish,
    includeColors,
    useProjectDir,
    saveLogFile,
    envProfile,
    customHeader,
    previewExportPipeline
  ]);

  const handleCopy = async (): Promise<void> => {
    if (!previewCode) return;
    await navigator.clipboard.writeText(previewCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (): Promise<void> => {
    if (!pipeline) return;
    setExporting(true);
    setPreviewError(null);
    try {
      const result = await exportPipeline(pipeline.id, format, buildOptions());
      if (!result.canceled) {
        onExported(result, pipeline.name);
        onClose();
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Exportar Pipeline{pipeline ? `: ${pipeline.name}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Formato do arquivo
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={format}
                onChange={(_e, next: PipelineExportFormat | null) => next && setFormat(next)}
              >
                <ToggleButton value="bat">Windows (.bat)</ToggleButton>
                <ToggleButton value="ps1">PowerShell (.ps1)</ToggleButton>
                <ToggleButton value="sh">Linux / Bash (.sh)</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Estilo do script
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={style}
                onChange={(_e, next: PipelineExportStyle | null) => next && handleStyleChange(next)}
              >
                <ToggleButton value="rich">Personalizado (Nexus)</ToggleButton>
                <ToggleButton value="raw">Cru (só comandos)</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          <Divider />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 0.5
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={confirmBeforeRun}
                  onChange={(e) => setConfirmBeforeRun(e.target.checked)}
                />
              }
              label="Aguardar ENTER antes de executar"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={pauseOnFinish}
                  onChange={(e) => setPauseOnFinish(e.target.checked)}
                />
              }
              label="Pausar janela ao finalizar"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={useProjectDir}
                  onChange={(e) => setUseProjectDir(e.target.checked)}
                />
              }
              label="Fixar pasta do projeto (pushd / cd)"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={saveLogFile}
                  onChange={(e) => setSaveLogFile(e.target.checked)}
                />
              }
              label="Salvar saída em arquivo (.log)"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={includeColors}
                  disabled={style === 'raw'}
                  onChange={(e) => setIncludeColors(e.target.checked)}
                />
              }
              label="Cores ANSI no terminal"
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Perfil .env (opcional)"
              placeholder="Ex: staging, prod"
              value={envProfile}
              onChange={(e) => setEnvProfile(e.target.value)}
              sx={{ flex: 1, minWidth: 180 }}
            />
            <TextField
              size="small"
              label="Nota / cabeçalho personalizado (opcional)"
              placeholder="Ex: Rodar antes do deploy"
              value={customHeader}
              onChange={(e) => setCustomHeader(e.target.value)}
              sx={{ flex: 2, minWidth: 240 }}
            />
          </Box>

          {previewError && <Alert severity="error">{previewError}</Alert>}

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                Pré-visualização do script gerado
              </Typography>
              <Button
                size="small"
                startIcon={copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                onClick={() => void handleCopy()}
                disabled={!previewCode}
              >
                {copied ? 'Copiado!' : 'Copiar código'}
              </Button>
            </Box>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                bgcolor: '#090D14',
                color: '#E5E7EB',
                fontFamily: 'Consolas, "Courier New", monospace',
                fontSize: '0.75rem',
                lineHeight: 1.45,
                maxHeight: 240,
                overflow: 'auto',
                whiteSpace: 'pre'
              }}
            >
              {previewCode || 'Gerando pré-visualização...'}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={exporting || !pipeline || Boolean(previewError)}
          onClick={() => void handleExport()}
        >
          {exporting ? 'Exportando...' : `Exportar .${format}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
