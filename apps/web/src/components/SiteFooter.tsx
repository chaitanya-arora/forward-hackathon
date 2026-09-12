import Link from "next/link";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="footer no-print">
      <div className="footer-inner">
        <div className="footer-brand">
          <strong>GreenScreen</strong>
          <span className="note">Climate disclosure readiness · AASB S2 / TCFD</span>
        </div>

        <nav className="footer-nav" aria-label="Footer">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="footer-link">
              {item.label}
            </Link>
          ))}
          {SECONDARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="footer-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="footer-note note">
        Reports are not saved. A report exists only in the browser tab that generated it.
      </p>
    </footer>
  );
}
