
import { createTheme } from '@mui/material/styles';
export const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#2563eb' }, secondary: { main: '#0ea5e9' }, background: { default: '#f9fafb' } },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    h1: { fontSize: 24, fontWeight: 600 },
    h2: { fontSize: 18, fontWeight: 500 },
    body1: { fontSize: 16 },
    body2: { fontSize: 14 },
  },
});
