import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeContextProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleTheme = (x, y) => {
    const isDark = mode === 'dark';
    const nextMode = isDark ? 'light' : 'dark';

    if (!document.startViewTransition) {
      setMode(nextMode);
      return;
    }

    const transition = document.startViewTransition(() => {
      setMode(nextMode);
    });

    transition.ready.then(() => {
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${radius}px at ${x}px ${y}px)`
      ];

      document.documentElement.animate(
        {
          clipPath: clipPath
        },
        {
          duration: 600,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    });
  };

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: '#1DB954',
        light: '#4ED17A',
        dark: '#149943',
        contrastText: '#ffffff',
      },
      secondary: {
        main: mode === 'dark' ? '#111827' : '#F3F4F6',
        light: mode === 'dark' ? '#374151' : '#FFFFFF',
        dark: mode === 'dark' ? '#0B1220' : '#D1D5DB',
        contrastText: mode === 'dark' ? '#ffffff' : '#111827',
      },
      background: {
        default: mode === 'dark' ? '#0B1220' : '#F9FAFB',
        paper: mode === 'dark' ? '#111827' : '#FFFFFF',
      },
      text: {
        primary: mode === 'dark' ? '#FFFFFF' : '#111827',
        secondary: mode === 'dark' ? '#E5E7EB' : '#4B5563',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: 600 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      h3: { fontSize: '1.75rem', fontWeight: 600 },
      h4: { fontSize: '1.5rem', fontWeight: 600 },
      h5: { fontSize: '1.25rem', fontWeight: 600 },
      h6: { fontSize: '1rem', fontWeight: 600 },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (themeParam) => ({
          body: {
            color: themeParam.palette.text.primary,
            backgroundColor: themeParam.palette.background.default,
            transition: 'background-color 0s', // Let view transition handle it
            '--glass-bg': mode === 'dark' ? 'rgba(17,24,39,0.45)' : 'rgba(255,255,255,0.65)',
            '--glass-bg-hover': mode === 'dark' ? 'rgba(17,24,39,0.55)' : 'rgba(255,255,255,0.95)',
            '--glass-border': mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            '--glass-border-hover': mode === 'dark' ? 'rgba(29,185,84,0.55)' : 'rgba(29,185,84,0.5)',
          },
        }),
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: mode === 'dark' 
              ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))'
              : 'none',
            boxShadow: mode === 'dark' 
              ? '0 10px 30px rgba(0,0,0,0.25)' 
              : '0 4px 12px rgba(0,0,0,0.05)',
            border: mode === 'dark' 
              ? '1px solid rgba(255,255,255,0.06)' 
              : '1px solid rgba(0,0,0,0.08)'
          },
        },
      },
    },
  }), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
