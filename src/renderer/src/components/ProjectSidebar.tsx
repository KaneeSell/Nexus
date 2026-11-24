import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HistoryIcon from '@mui/icons-material/History';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNexusStore } from '../store/useNexusStore';

export function ProjectSidebar() {
  const [search, setSearch] = useState('');
  const projects = useNexusStore((s) => s.projects);
  const selectedProjectId = useNexusStore((s) => s.selectedProjectId);
  const workspaceHistory = useNexusStore((s) => s.workspaceHistory);
  const currentTarget = useNexusStore((s) => s.currentTarget);
  const selectProject = useNexusStore((s) => s.selectProject);
  const scanTarget = useNexusStore((s) => s.scanTarget);
  const pickAndScanFolder = useNexusStore((s) => s.pickAndScanFolder);
  const togglePinWorkspace = useNexusStore((s) => s.togglePinWorkspace);
  const removeWorkspaceHistory = useNexusStore((s) => s.removeWorkspaceHistory);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query) ||
        p.packageManager.toLowerCase().includes(query)
    );
  }, [projects, search]);

  return (
    <Box
      sx={{
        width: 310,
        minWidth: 270,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Filtrar projetos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              )
            }
          }}
        />
      </Box>

      <Box sx={{ px: 1.5, pb: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          Projetos ({filteredProjects.length})
        </Typography>
      </Box>

      <List dense sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {filteredProjects.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 2 }}>
            Nenhum projeto encontrado.
          </Typography>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            return (
              <ListItemButton
                key={project.id}
                selected={isSelected}
                onClick={() => void selectProject(project.id)}
                sx={{ borderRadius: 1.5, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TerminalIcon fontSize="small" color={isSelected ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                        {project.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={project.packageManager}
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    </Box>
                  }
                  secondary={`${project.scripts.length} script(s)`}
                />
              </ListItemButton>
            );
          })
        )}
      </List>

      <Divider />
      <Box sx={{ p: 1.25, maxHeight: 230, overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <HistoryIcon sx={{ fontSize: 15 }} color="action" />
            <Typography variant="overline" color="text.secondary" fontWeight={700}>
              Workspaces
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<FolderOpenIcon sx={{ fontSize: 14 }} />}
            onClick={() => void pickAndScanFolder()}
            sx={{ py: 0, px: 1, fontSize: '0.72rem' }}
          >
            Adicionar
          </Button>
        </Box>

        {workspaceHistory.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            Nenhuma pasta recente salva ainda.
          </Typography>
        ) : (
          <List dense disablePadding>
            {workspaceHistory.slice(0, 8).map((item) => (
              <ListItem
                key={item.id}
                disablePadding
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={item.isPinned ? 'Desafixar' : 'Fixar workspace'}>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => void togglePinWorkspace(item.id)}
                      >
                        {item.isPinned ? (
                          <PushPinIcon sx={{ fontSize: 14 }} color="primary" />
                        ) : (
                          <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover do histórico">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => void removeWorkspaceHistory(item.id)}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemButton
                  selected={currentTarget === item.path}
                  onClick={() => void scanTarget(item.path)}
                  sx={{ borderRadius: 1, py: 0.35, pr: 7 }}
                >
                  <ListItemIcon sx={{ minWidth: 26 }}>
                    <FolderIcon sx={{ fontSize: 15 }} color={item.isPinned ? 'primary' : 'action'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="caption" fontWeight={600} noWrap display="block">
                        {item.name}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                        sx={{ fontSize: '0.68rem' }}
                      >
                        {item.path}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
