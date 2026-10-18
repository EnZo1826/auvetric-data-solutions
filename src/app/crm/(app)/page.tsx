import type { Metadata } from "next";
import { requireSession } from "@/crm/server/page-auth";
import { db } from "@/crm/server/db";
import { NAV } from "@/crm/nav";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(d) : "—";

export default async function Dashboard() {
  const { user } = await requireSession();
  const sql = db();
  const [[stats], [mig], [prev]] = await Promise.all([
    sql`select (select count(*)::int from users where not disabled) as users,
               (select count(*)::int from users where not disabled and totp_enabled) as mfa,
               (select count(*)::int from sessions where stage = 'full' and expires_at > now()) as sessions,
               (select count(*)::int from login_attempts where not ok and at > now() - interval '24 hours') as failed24`,
    sql`select name, applied_at from schema_migrations order by name desc limit 1`,
    sql`select at, ip from audit_log where user_id = ${user.id} and action = 'auth.signed_in' order by at desc offset 1 limit 1`,
  ]);
  const phases = [0, 1, 2, 3, 4].map((p) => ({ p, items: NAV.flatMap((g) => g.items).filter((i) => i.phase === p && i.slug !== "" && i.slug !== "account") }));
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <div className="page-head">
        <h1>Good to see you, {firstName}</h1>
        <span className="badge info">Phase 0 · Foundations</span>
      </div>

      <div className="grid4" style={{ marginBottom: 12 }}>
        <div className="card kpi"><span className="l">Partners</span><span className="v">{stats.users}</span><span className="s">{stats.mfa} with two-factor</span></div>
        <div className="card kpi"><span className="l">Active sessions</span><span className="v">{stats.sessions}</span><span className="s">across all partners</span></div>
        <div className="card kpi"><span className="l">Failed sign-ins · 24 h</span><span className="v">{stats.failed24}</span><span className="s">{stats.failed24 ? "check the audit trail" : "none"}</span></div>
        <div className="card kpi"><span className="l">Database schema</span><span className="v mono" style={{ fontSize: 15 }}>{mig?.name?.replace(".sql", "") ?? "—"}</span><span className="s"><span className="dot" /> connected</span></div>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Your account</h2>
          <table className="tbl">
            <tbody>
              <tr><td className="muted">Signed in as</td><td>{user.name} · {user.email}</td></tr>
              <tr><td className="muted">Role</td><td style={{ textTransform: "capitalize" }}>{user.role}</td></tr>
              <tr><td className="muted">Two-factor</td><td>{user.totpEnabled ? <span className="badge ok">enabled</span> : <span className="badge err">not set</span>}</td></tr>
              <tr><td className="muted">Previous sign-in</td><td>{prev ? `${fmt(prev.at)} · ${prev.ip ?? ""}` : "This is your first sign-in."}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Build roadmap</h2>
          <ul className="roadmap" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li><span className="ph">P0</span><span><b>Foundations</b> <span className="badge ok">live</span><br /><span className="muted">Secure partner sign-in with two-factor, CRM shell, database migrations.</span></span></li>
            {phases.filter((x) => x.p > 0).map(({ p, items }) => (
              <li key={p}><span className="ph">P{p}</span><span className="muted">{items.map((i) => i.label).join(" · ")}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
