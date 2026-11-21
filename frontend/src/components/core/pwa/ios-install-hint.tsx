'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { ExportIcon } from '@phosphor-icons/react/dist/ssr/Export';

import { usePwa } from './pwa-provider';

const STORAGE_KEY = 'rbs-ios-install-hint-dismissed';

function readDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeDismissed(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, 'true');
  } catch {
    // Storage can be unavailable (private mode); the hint then stays hidden for this visit only.
  }
}

// iOS has no install prompt, so explain the manual steps once, until the member dismisses it.
export function IosInstallHint(): React.JSX.Element | null {
  const { isIos, isStandalone } = usePwa();
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (!isIos || isStandalone || dismissed) {
    return null;
  }
  return (
    <Alert
      onClose={() => {
        storeDismissed();
        setDismissed(true);
      }}
      severity="info"
      sx={{ mb: 3 }}
    >
      <AlertTitle>Add the syndicate to your Home Screen</AlertTitle>
      Tap Share <ExportIcon aria-label="Share icon" style={{ verticalAlign: 'text-bottom' }} /> in the browser, then
      &ldquo;Add to Home Screen&rdquo;, to open it like an app.
    </Alert>
  );
}
