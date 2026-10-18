import Link from "next/link";

export default function CrmNotFound() {
  return (
    <div className="auth">
      <div className="auth-card card stack">
        <div className="step" style={{ font: "500 11px/1 var(--font-mono)", color: "var(--data)", letterSpacing: "0.14em" }}>404</div>
        <h1>Not found</h1>
        <p className="muted" style={{ margin: 0 }}>That CRM page doesn&apos;t exist.</p>
        <Link href="/crm" className="btn primary">Back to the dashboard</Link>
      </div>
    </div>
  );
}
