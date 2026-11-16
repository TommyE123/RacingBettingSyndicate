'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

type Severity = 'success' | 'info' | 'warning' | 'error';

interface Note {
  id: number;
  message: string;
  severity: Severity;
}

const NotifyContext = React.createContext<((message: string, severity?: Severity) => void) | undefined>(undefined);

export function NotifyProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [note, setNote] = React.useState<Note | null>(null);
  const notify = React.useCallback((message: string, severity: Severity = 'success') => {
    setNote({ id: Date.now(), message, severity });
  }, []);
  const close = (): void => {
    setNote(null);
  };

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
        autoHideDuration={note?.severity === 'error' ? 8000 : 4000}
        key={note?.id}
        onClose={close}
        open={note !== null}
      >
        <Alert onClose={close} severity={note?.severity ?? 'success'} sx={{ width: '100%' }} variant="filled">
          {note?.message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export function useNotify(): (message: string, severity?: Severity) => void {
  const context = React.useContext(NotifyContext);
  if (!context) {
    throw new Error('useNotify must be used within a NotifyProvider');
  }
  return context;
}
