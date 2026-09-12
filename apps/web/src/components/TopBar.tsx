import Link from "next/link";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="topbar no-print">
      <Link href="/" className="wordmark">
        <span>
          <strong>GreenScreen</strong> · AASB S2 / TCFD
        </span>
      </Link>
      <div style={{ display: "flex", gap: 10 }}>{children}</div>
    </div>
  );
}
