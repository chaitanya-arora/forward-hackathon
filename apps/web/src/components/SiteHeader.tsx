import Link from "next/link";

/**
 * Wordmark home link on the left, a single page action on the right.
 *
 * No nav links: there are only three places to go and the pages themselves
 * offer the onward step, so a nav bar would only repeat what is already on
 * screen. Themes through the shared tokens, so one component serves both the
 * dark journey and the paper report.
 */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar no-print">
      <Link href="/" className="wordmark">
        <span>
          <strong>GreenScreen</strong>
        </span>
      </Link>

      <div className="topbar-actions">{children}</div>
    </header>
  );
}
