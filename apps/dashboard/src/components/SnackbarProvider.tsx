import { Alert, Snackbar } from '@mui/material';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type SnackbarVariant = 'success' | 'error' | 'info' | 'warning';

type SnackbarOptions = {
  variant?: SnackbarVariant;
  autoHideDuration?: number;
};

type SnackbarContextValue = {
  enqueueSnackbar: (message: string, options?: SnackbarOptions) => void;
};

type SnackbarItem = {
  key: number;
  message: string;
  options: SnackbarOptions;
};

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar deve essere utilizzato all\'interno di SnackbarProvider');
  }
  return context;
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<SnackbarItem[]>([]);
  const [current, setCurrent] = useState<SnackbarItem | null>(null);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [queue, current]);

  const enqueueSnackbar = useCallback((message: string, options: SnackbarOptions = {}) => {
    setQueue((prev) => [...prev, { key: Date.now() + Math.random(), message, options }]);
  }, []);

  const handleClose = useCallback((_: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setCurrent(null);
  }, []);

  const contextValue = useMemo<SnackbarContextValue>(() => ({ enqueueSnackbar }), [enqueueSnackbar]);

  const autoHideDuration = current?.options.autoHideDuration ?? 4000;
  const severity = current?.options.variant ?? 'info';

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}
      <Snackbar
        key={current?.key}
        open={Boolean(current)}
        autoHideDuration={autoHideDuration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleClose} severity={severity as SnackbarVariant} variant="filled" sx={{ width: '100%' }}>
          {current?.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
