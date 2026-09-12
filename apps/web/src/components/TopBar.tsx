import Link from "next/link";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="topbar no-print">
      <Link href="/" className="wordmark">
        <strong>Readiness</strong> · AASB S2 / TCFD
      </Link>
      <div style={{ display: "flex", gap: 10 }}>{children}</div>
    </div>
  );
}
