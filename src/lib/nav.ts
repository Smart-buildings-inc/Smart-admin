// Single source of truth for primary navigation. Both the top NavBar (desktop)
// and the iOS-style BottomNav (mobile) read from here so the two never drift.

export type NavIcon = "console" | "fleet" | "download";

export type NavItem = {
  href: string;
  /** Full label used by the desktop bar. */
  label: string;
  /** Which glyph the mobile tab bar renders. */
  icon: NavIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Console", icon: "console" },
  { href: "/fleet", label: "Fleet", icon: "fleet" },
  { href: "/download", label: "Get App", icon: "download" },
];

/** Whether `href` is the active route for the given pathname. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
