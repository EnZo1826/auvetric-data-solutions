// Proves the Supabase Data API (PostgREST) can't read or write any CRM table with the public key.
// Safe against production: it only attempts reads and an insert that must be refused.
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=<anon/publishable key> npm run crm:test:supabase
// The table list comes from the migrations folder, so new tables are covered automatically.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import './env.mjs';

const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!base || !key) { console.error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).'); process.exit(2); }

const dir = path.join(process.cwd(), 'src/crm/migrations');
const tables = new Set(['schema_migrations']);
for (const f of (await readdir(dir)).filter((x) => x.endsWith('.sql'))) {
  for (const m of (await readFile(path.join(dir, f), 'utf8')).matchAll(/create table (?:if not exists )?(\w+)/gi)) tables.add(m[1]);
}
const headers = { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };

let checked = 0;
const leaks = [];
for (const t of [...tables].sort()) {
  const r = await fetch(`${base}/rest/v1/${t}?select=*&limit=1`, { headers });
  const body = await r.text();
  // Refused (401/403/404) is the goal. A 200 with an empty array would still mean the table is exposed.
  if (r.ok) leaks.push(`${t}: readable (HTTP ${r.status}, ${body.slice(0, 60)})`);
  const w = await fetch(`${base}/rest/v1/${t}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', prefer: 'return=minimal' }, body: '{}' });
  if (w.ok) leaks.push(`${t}: writable (HTTP ${w.status})`);
  checked++;
}
assert.ok(checked >= 14, `expected the CRM tables, found ${checked}`);
if (leaks.length) { console.error(`Data API exposure:\n  ${leaks.join('\n  ')}`); process.exit(1); }
console.log(`Supabase Data API: ${checked} CRM tables refused for read and write with the public key.`);
