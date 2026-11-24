import { createTheme, type PaletteMode } from '@mui/material/styles';

export function createNexusTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#7C9CFF' : '#2F54EB'
      },
      secondary: {
        main: isDark ? '#38BDF8' : '#0284C7'
      },
      success: {
        main: isDark ? '#34D399' : '#059669'
      },
      error: {
        main: isDark ? '#F87171' : '#DC2626'
      },
      warning: {
        main: isDark ? '#FBBF24' : '#D97706'
      },
      background: {
        default: isDark ? '#0B0F17' : '#F4F6FA',
        paper: isDark ? '#121826' : '#FFFFFF'
      }
    },
    shape: {
      borderRadius: 10
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      h6: {
        fontWeight: 600
      }
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      }
    }
  });
}
