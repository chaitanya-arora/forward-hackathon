/**
 * A plain closing bar, not a second navigation. There are only three
 * destinations in the whole product and each page already offers the next
 * step, so the footer's job is just to say who this is and restate the one
 * fact that matters before a reader leaves the page.
 */
export function SiteFooter() {
  return (
    <footer className="footer no-print">
      <p className="footer-brand">GreenScreened · Climate disclosure readiness</p>
      <p className="footer-note note">
        Reports are retained by the backend. Keep the report link to return to this assessment.
      </p>
    </footer>
  );
}
