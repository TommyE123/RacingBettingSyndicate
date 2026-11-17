export const paths = {
  home: '/',
  auth: { signIn: '/auth/sign-in', resetPassword: '/auth/reset-password' },
  dashboard: {
    overview: '/dashboard',
    newBet: '/dashboard/bets/new',
    bets: '/dashboard/bets',
    bet: (id: number) => `/dashboard/bets/${id}`,
    returns: '/dashboard/returns',
    leaderboard: '/dashboard/leaderboard',
    stats: '/dashboard/stats',
    sheets: '/dashboard/sheets',
    sheet: (id: number) => `/dashboard/sheets/${id}`,
    rules: '/dashboard/rules',
    account: '/dashboard/account',
    admin: {
      users: '/dashboard/admin/users',
      competitions: '/dashboard/admin/competitions',
      competition: (id: number) => `/dashboard/admin/competitions/${id}`,
      audit: '/dashboard/admin/audit',
    },
  },
  errors: { notFound: '/errors/not-found' },
} as const;
