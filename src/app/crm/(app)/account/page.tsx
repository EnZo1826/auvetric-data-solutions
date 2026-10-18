import type { Metadata } from "next";
import { requireSession } from "@/crm/server/page-auth";
import { db } from "@/crm/server/db";
import { AccountForms } from "@/crm/ui/AccountForms";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(d);

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export default async function Account() {
  const s = await requireSession();
  const sessions = await db()`select id, ip, user_agent, created_at, last_seen_at from sessions
                               where user_id = ${s.user.id} and stage = 'full' and expires_at > now() order by last_seen_at desc`;
  return (
    <>
      <div className="page-head"><h1>My account</h1></div>
      <div className="grid2">
        <AccountForms email={s.user.email} />
        <section className="card flush">
          <div style={{ padding: "16px 16px 4px" }}><h2>Signed-in sessions</h2></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Device</th><th>IP</th><th>Last active</th></tr></thead>
              <tbody>
                {sessions.map((x) => (
                  <tr key={x.id}>
                    <td>{device(x.user_agent)} {x.id === s.id && <span className="badge info">this browser</span>}</td>
                    <td className="mono">{x.ip}</td>
                    <td>{fmt(x.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
