/**
 * One list of destinations, so the header and footer can never drift apart.
 *
 * Primary is deliberately short: there is nowhere else to go. GreenScreen keeps
 * nothing, so there is no history, no saved reports and no account — a reader
 * either starts a report, looks at the example, or goes home.
 */
export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/report/preview", label: "Example report" },
  { href: "/upload", label: "Generate a report" },
];

/** Reference pages, reached from the footer rather than the header. */
export const SECONDARY_NAV: NavItem[] = [];

/** Marks the active nav item, treating nested routes as belonging to their parent. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
