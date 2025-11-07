import { alpha, createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    layout: {
      pagePadding: string;
      sectionGap: string;
      cardPadding: string;
      toolbarHeight: string;
    };
    gradients: {
      primary: string;
      accent: string;
    };
    customShadows: {
      card: string;
      dialog: string;
      focusRing: string;
    };
  }

  interface ThemeOptions {
    layout?: {
      pagePadding?: string;
      sectionGap?: string;
      cardPadding?: string;
      toolbarHeight?: string;
    };
    gradients?: {
      primary?: string;
      accent?: string;
    };
    customShadows?: {
      card?: string;
      dialog?: string;
      focusRing?: string;
    };
  }
}

const primaryMain = '#2563eb';
const secondaryMain = '#10b981';
const slate900 = '#0f172a';

export const theme = createTheme({
  spacing: 8,
  shape: { borderRadius: 12 },
  palette: {
    mode: 'light',
    primary: { light: '#60a5fa', main: primaryMain, dark: '#1d4ed8', contrastText: '#f8fafc' },
    secondary: { light: '#34d399', main: secondaryMain, dark: '#047857', contrastText: '#022c22' },
    info: { light: '#38bdf8', main: '#0ea5e9', dark: '#0369a1', contrastText: '#f8fafc' },
    success: { light: '#4ade80', main: '#16a34a', dark: '#166534', contrastText: '#f8fafc' },
    warning: { light: '#fbbf24', main: '#f59e0b', dark: '#b45309', contrastText: slate900 },
    error: { light: '#f87171', main: '#ef4444', dark: '#b91c1c', contrastText: '#fef2f2' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    divider: alpha(slate900, 0.08),
    text: { primary: slate900, secondary: '#475569', disabled: alpha(slate900, 0.4) },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5f5',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: slate900,
      A100: '#cbd5f5',
      A200: '#94a3b8',
      A400: '#475569',
      A700: '#1e293b',
    },
  },
  typography: {
    fontFamily:
      'Inter, "InterVariable", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    h1: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
    subtitle1: { fontSize: '1.125rem', fontWeight: 500 },
    body1: { fontSize: '1rem', lineHeight: 1.7 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
    caption: { fontSize: '0.75rem', color: '#64748b' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
          color: slate900,
          fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 999,
          fontWeight: 600,
          paddingInline: theme.spacing(2.5),
          paddingBlock: theme.spacing(1.25),
        }),
        containedPrimary: ({ theme }) => ({
          boxShadow: `0 14px 24px -12px ${alpha(theme.palette.primary.main, 0.55)}`,
        }),
        outlined: ({ theme }) => ({
          borderColor: alpha(theme.palette.primary.main, 0.4),
          '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          borderRadius: theme.shape.borderRadius * 1.25,
        }),
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          boxShadow: `0 30px 60px -40px ${alpha(slate900, 0.55)}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)}, ${theme.palette.background.paper})`,
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontWeight: 600,
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          boxShadow: `0 36px 80px -40px ${alpha(slate900, 0.7)}`,
          borderRadius: theme.shape.borderRadius * 1.2,
          padding: theme.spacing(0.5),
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          fontWeight: 600,
          color: theme.palette.text.secondary,
        }),
      },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: {
        root: ({ theme }) => ({
          fontWeight: 500,
          color: theme.palette.primary.main,
          '&:hover': { color: theme.palette.primary.dark },
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: ({ theme }) => ({
          height: 3,
          borderRadius: 999,
          backgroundColor: theme.palette.primary.main,
        }),
      },
    },
  },
});

theme.layout = {
  pagePadding: theme.spacing(4),
  sectionGap: theme.spacing(3),
  cardPadding: theme.spacing(3),
  toolbarHeight: '3.5rem',
};

theme.gradients = {
  primary: `linear-gradient(135deg, ${alpha(primaryMain, 0.95)}, ${alpha('#4338ca', 0.95)})`,
  accent: `linear-gradient(120deg, ${alpha(secondaryMain, 0.95)}, ${alpha('#0ea5e9', 0.9)})`,
};

theme.customShadows = {
  card: `0 25px 60px -40px ${alpha(slate900, 0.5)}`,
  dialog: `0 40px 90px -50px ${alpha(slate900, 0.65)}`,
  focusRing: `0 0 0 3px ${alpha(primaryMain, 0.3)}`,
};

export type AppTheme = typeof theme;
