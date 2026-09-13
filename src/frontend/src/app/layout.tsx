import type { Metadata } from "next";
import "./globals.css";
import "./journey.css";
import "./report.css";

export const metadata: Metadata = {
  title: "GreenScreened",
  description:
    "GreenScreened turns a company's scattered climate documentation into a cited AASB S2 readiness report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Grammarly (and similar extensions) inject data-gr-* attributes into
          <body> before React hydrates, which React then reports as a
          hydration mismatch — it isn't one; nothing here is actually wrong,
          the DOM was edited by something outside React's control. This is
          the documented fix, not a workaround for a real bug. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
