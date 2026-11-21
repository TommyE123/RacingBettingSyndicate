import * as React from 'react';
import type { Metadata, Viewport } from 'next';

import '@/styles/global.css';

import { config } from '@/config';
import { UserProvider } from '@/contexts/user-context';
import { LocalizationProvider } from '@/components/core/localization-provider';
import { PwaProvider } from '@/components/core/pwa/pwa-provider';
import { ThemeProvider } from '@/components/core/theme-provider/theme-provider';

export const metadata = {
  title: config.site.name,
  description: config.site.description,
  applicationName: config.site.name,
  // The manifest itself comes from src/app/manifest.ts; Next.js adds its <link> automatically.
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // iOS ignores the manifest's display mode and name, so it needs these tags to open full screen.
  appleWebApp: { capable: true, title: config.site.shortName, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
} satisfies Metadata;

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the installed app use the whole screen; global.css pads the body by the safe-area insets.
  viewportFit: 'cover',
  themeColor: config.site.themeColor,
} satisfies Viewport;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <LocalizationProvider>
          <UserProvider>
            <ThemeProvider>
              <PwaProvider>{children}</PwaProvider>
            </ThemeProvider>
          </UserProvider>
        </LocalizationProvider>
      </body>
    </html>
  );
}
