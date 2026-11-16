import type { NavItemConfig } from '@/types/nav';
import { paths } from '@/paths';

export const navItems = [
  { key: 'overview', title: 'Home', href: paths.dashboard.overview, icon: 'house' },
  { key: 'new-bet', title: 'Add a bet', href: paths.dashboard.newBet, icon: 'plus-circle' },
  {
    key: 'bets',
    title: 'All bets',
    href: paths.dashboard.bets,
    icon: 'list-checks',
    matcher: { type: 'startsWith', href: paths.dashboard.bets },
  },
  { key: 'returns', title: 'Enter returns', href: paths.dashboard.returns, icon: 'coins' },
  { key: 'leaderboard', title: 'Leaderboard', href: paths.dashboard.leaderboard, icon: 'trophy' },
  { key: 'stats', title: 'Stats', href: paths.dashboard.stats, icon: 'chart-bar' },
  {
    key: 'sheets',
    title: 'Bet sheets',
    href: paths.dashboard.sheets,
    icon: 'image',
    matcher: { type: 'startsWith', href: paths.dashboard.sheets },
  },
  { key: 'rules', title: 'Rules', href: paths.dashboard.rules, icon: 'book-open' },
  { key: 'account', title: 'My account', href: paths.dashboard.account, icon: 'user' },
  { key: 'admin-users', title: 'Users', href: paths.dashboard.admin.users, icon: 'users', adminOnly: true },
  {
    key: 'admin-competitions',
    title: 'Competitions',
    href: paths.dashboard.admin.competitions,
    icon: 'flag',
    adminOnly: true,
    matcher: { type: 'startsWith', href: paths.dashboard.admin.competitions },
  },
  { key: 'admin-audit', title: 'Audit log', href: paths.dashboard.admin.audit, icon: 'clipboard', adminOnly: true },
] satisfies NavItemConfig[];
