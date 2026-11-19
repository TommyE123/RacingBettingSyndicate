'use client';

import * as React from 'react';

import { logger } from '@/lib/default-logger';

// Chromium-only event (Chrome, Edge, Samsung Internet); not in the TypeScript DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaContextValue {
  /** The browser offered an install prompt (Chrome, Edge) and the app isn't installed yet. */
  canInstall: boolean;
  /** Shows the browser's install dialog. */
  install: () => Promise<void>;
  /** iPhone or iPad, where installing is done by hand with Share, then "Add to Home Screen". */
  isIos: boolean;
  /** Running as the installed app rather than in a browser tab. */
  isStandalone: boolean;
}

const PwaContext = React.createContext<PwaContextValue | undefined>(undefined);

function detectIos(): boolean {
  const { userAgent, maxTouchPoints } = globalThis.navigator;
  // iPadOS reports itself as a Mac, so tell it apart by touch support.
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

function detectStandalone(): boolean {
  const iosStandalone = (globalThis.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || globalThis.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function PwaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);

  React.useEffect(() => {
    // Read after mount so the server render and the first client render match.
    setIsIos(detectIos());
    setIsStandalone(detectStandalone());

    const onBeforeInstallPrompt = (event: Event): void => {
      // Keep the event so the app shell can offer its own "Install app" button instead of the mini-infobar.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      setPromptEvent(null);
    };
    globalThis.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    globalThis.addEventListener('appinstalled', onInstalled);

    // Only production builds get a service worker: in development it would cache Next's unhashed dev chunks.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error: unknown) => {
        logger.error('Service worker registration failed', error);
      });
    }

    return () => {
      globalThis.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      globalThis.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = React.useCallback(async (): Promise<void> => {
    if (!promptEvent) {
      return;
    }
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    logger.debug(`[PwaProvider]: install prompt ${outcome}`);
    // A prompt event can only be used once.
    setPromptEvent(null);
  }, [promptEvent]);

  const value = React.useMemo<PwaContextValue>(
    () => ({ canInstall: promptEvent !== null && !isStandalone, install, isIos, isStandalone }),
    [promptEvent, install, isIos, isStandalone]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextValue {
  const context = React.useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}
