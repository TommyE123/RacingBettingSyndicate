export interface NavItemConfig {
  key: string;
  title?: string;
  disabled?: boolean;
  external?: boolean;
  label?: string;
  icon?: string;
  href?: string;
  items?: NavItemConfig[];
  adminOnly?: boolean;
  // Matcher cannot be a function in order
  // to be able to use it on the server.
  matcher?: { type: 'startsWith' | 'equals'; href: string };
}
