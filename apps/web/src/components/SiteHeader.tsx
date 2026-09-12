import Link from "next/link";

/**
 * Sticky on every page: pinned to the top of the viewport as the page
 * scrolls, wordmark home link on the left, a single page action on the
 * right. No nav links — there are only three destinations in the product
 * and the pages themselves offer the onward step, so a nav bar would only
 * repeat what is already on screen.
 *
 * Themes through the shared tokens, so one component serves both the dark
 * journey and the paper report with no variant.
 */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar no-print">
      <div className="topbar-row">
        <Link href="/" className="wordmark">
          <span>
            <strong>GreenScreen</strong>
          </span>
        </Link>

        <div className="topbar-actions">{children}</div>
      </div>
    </header>
  );
}
