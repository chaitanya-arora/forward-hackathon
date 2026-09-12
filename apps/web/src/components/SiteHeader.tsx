"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, PRIMARY_NAV } from "@/lib/nav";

/**
 * The same header on every page, on both surfaces — it themes through the
 * shared tokens, so it needs no dark/paper variant. `children` is the slot for
 * a page's own action, such as Download PDF on the report.
 */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="topbar no-print">
      <div className="topbar-left">
        <Link href="/" className="wordmark">
          <span>
            <strong>GreenScreen</strong>
          </span>
        </Link>

        <nav className="nav" aria-label="Primary">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="topbar-actions">{children}</div>
    </header>
  );
}
