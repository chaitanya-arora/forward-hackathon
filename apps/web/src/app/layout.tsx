import type { Metadata } from "next";
import "./globals.css";
import "./journey.css";
import "./report.css";

export const metadata: Metadata = {
  title: "Climate Readiness Report",
  description: "Turn company climate documentation into a cited AASB S2 / TCFD readiness report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
