import { getSiteURL } from '@/lib/get-site-url';
import { LogLevel } from '@/lib/logger';

export interface Config {
  site: {
    name: string;
    shortName: string;
    description: string;
    themeColor: string;
    backgroundColor: string;
    url: string;
  };
  logLevel: keyof typeof LogLevel;
}

export const config: Config = {
  site: {
    name: 'Racing Betting Syndicate',
    shortName: 'Syndicate',
    description: 'Bets, budgets and bragging rights for the festival syndicate',
    themeColor: '#090a0b',
    // Splash screen behind the icon when the installed app starts; matches the light theme's page background.
    backgroundColor: '#ffffff',
    url: getSiteURL(),
  },
  logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as keyof typeof LogLevel) ?? LogLevel.ALL,
};
