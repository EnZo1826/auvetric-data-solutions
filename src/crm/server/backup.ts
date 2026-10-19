/**
 * Backups: the full JSON export (also used by Settings → Export), gzipped into Netlify Blobs nightly by the
 * daily job and on demand. Restore with `npm run crm:restore -- <file>` (scripts/crm/restore.mjs).
 * Not included: password hashes and 2FA secrets (users re-set them after a restore), sessions, sign-in
 * attempts, integration tokens (re-issue for n8n), the mail password, and the attachment files themselves.
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { db } from "./db";
import { fileStore } from "./files";

export const BACKUP_SCHEMA = "auvetric-crm/4";
/** Tables in the export, parents before children (restore order). */
export const BACKUP_TABLES = [
  "users", "companies", "settings", "clients", "contacts", "services", "enquiries", "opportunities", "projects", "retainers", "documents",
  "leads", "tasks", "activities", "payments", "time_entries", "expenses", "marketplace_earnings", "attachments", "payment_notices", "portal_events", "emails", "audit_log",
] as const;

export async function buildExport() {
  const s = db();
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), schema: BACKUP_SCHEMA };
  for (const t of BACKUP_TABLES) {
    out[t] = t === "users" ? await s`select id, email, name, role, totp_enabled, disabled, weekly_hours, created_at from users order by id`
      : t === "settings" ? await s`select * from settings where key <> 'mail' order by key`
      : await s`select * from ${s(t)} order by id`;
  }
  return out;
}

const counts = (e: Record<string, unknown>) => Object.fromEntries(BACKUP_TABLES.map((t) => [t, (e[t] as unknown[]).length]));

export async function runBackup(kind: "nightly" | "manual", userId: string | null) {
  const exp = await buildExport();
  const gz = gzipSync(Buffer.from(JSON.stringify(exp)), { level: 9 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "z").toLowerCase(); // 20261019t040000z
  const key = `backups/${stamp}-${kind}.json.gz`;
  await fileStore("crm-backups").put(key, new Uint8Array(gz), "application/gzip");
  const sha = createHash("sha256").update(gz).digest("hex");
  const [row] = await db()`insert into backups (kind, blob_key, size, sha256, counts, created_by)
    values (${kind}, ${key}, ${gz.byteLength}, ${sha}, ${db().json(counts(exp) as never)}, ${userId}) returning id, kind, blob_key, size, created_at, counts`;
  const pruned = await pruneBackups();
  return { id: String(row.id), kind: row.kind as string, size: Number(row.size), created_at: row.created_at as string, counts: row.counts as Record<string, number>, pruned };
}

/**
 * Retention: everything from the last 35 days, the first backup of each month for 13 months,
 * and the 10 newest manual ones. Everything else is deleted (blob first, then the row).
 */
export async function pruneBackups(now = new Date()) {
  const rows = await db()`select id, kind, blob_key, created_at from backups order by created_at desc`;
  const keep = new Set<string>();
  const cutoff = now.getTime() - 35 * 864e5;
  const monthFirst = new Map<string, string>();
  for (const r of [...rows].reverse()) {
    const m = new Date(r.created_at).toISOString().slice(0, 7);
    if (!monthFirst.has(m)) monthFirst.set(m, String(r.id));
  }
  const months = [...monthFirst.keys()].sort().reverse().slice(0, 13);
  for (const m of months) keep.add(monthFirst.get(m)!);
  for (const r of rows) if (new Date(r.created_at).getTime() >= cutoff) keep.add(String(r.id));
  rows.filter((r) => r.kind === "manual").slice(0, 10).forEach((r) => keep.add(String(r.id)));
  const store = fileStore("crm-backups");
  let n = 0;
  for (const r of rows) {
    if (keep.has(String(r.id))) continue;
    await store.del(r.blob_key);
    await db()`delete from backups where id = ${r.id}`;
    n++;
  }
  return n;
}
