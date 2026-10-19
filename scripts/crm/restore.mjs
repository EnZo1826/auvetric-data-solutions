// Restore a CRM backup (Settings → Backups download, or the JSON export) into a migrated database.
//
//   npm run crm:migrate                                   # target schema first
//   npm run crm:restore -- <backup.json.gz|backup.json>   # empty target
//   npm run crm:restore -- <file> --wipe --yes            # replace a target that already has data
//
// Target = DATABASE_URL (or MIGRATE_DATABASE_URL). Hosted databases always need --yes.
// After a restore every user must get a new one-time password (backups carry no password hashes or 2FA secrets):
//   npm run crm:user -- reset-password <email>
// Re-issue the n8n integration token under Integrations, and re-enter the mail password under Settings → Email.
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { connect, describeDb, isHostedDb } from './env.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (f) => args.includes(f);
if (!file) { console.error('Usage: npm run crm:restore -- <backup.json.gz|backup.json> [--wipe] [--yes]'); process.exit(2); }

let raw = readFileSync(file);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = gunzipSync(raw);
const backup = JSON.parse(raw.toString('utf8'));
if (!/^auvetric-crm\/\d+$/.test(backup.schema ?? '')) { console.error('This is not an Auvetric CRM backup (missing schema marker).'); process.exit(2); }

const sql = connect();
const fail = async (msg, code = 1) => { console.error(msg); await sql.end({ timeout: 5 }); process.exit(code); };
console.log(`Restoring ${file} (${backup.schema}, exported ${backup.exported_at}) into ${describeDb()}`);
if (isHostedDb() && !flag('--yes')) await fail('Hosted database: add --yes to confirm the target.', 2);

// Target must be fully migrated.
const files = readdirSync('src/crm/migrations').filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f));
const applied = new Set((await sql`select name from schema_migrations`.catch(() => [])).map((r) => r.name));
const missing = files.filter((f) => !applied.has(f));
if (missing.length) await fail(`The target database is missing migrations (${missing.join(', ')}). Run npm run crm:migrate first.`, 2);

const tables = Object.keys(backup).filter((k) => Array.isArray(backup[k]));
const known = new Set((await sql`select tablename from pg_tables where schemaname = 'public'`).map((r) => r.tablename));
const unknown = tables.filter((t) => !known.has(t));
if (unknown.length) await fail(`The backup has tables this database doesn't: ${unknown.join(', ')}. Update the code and migrate first.`, 2);

const [{ n }] = await sql`select (select count(*) from clients) + (select count(*) from documents) + (select count(*) from leads) + (select count(*) from enquiries) as n`;
if (Number(n) > 0 && !(flag('--wipe') && flag('--yes'))) await fail(`The target already has ${n} clients/documents/leads/enquiries. Use --wipe --yes to replace everything.`, 2);

const cols = new Map();
for (const r of await sql`select table_name, column_name, is_identity from information_schema.columns where table_schema = 'public'`) {
  if (!cols.has(r.table_name)) cols.set(r.table_name, new Map());
  cols.get(r.table_name).set(r.column_name, r.is_identity === 'YES');
}
const fks = await sql`select tc.table_name, kcu.column_name, ccu.table_name as ref
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`;

const ROW_BATCH = 500;
const counts = {};
try {
  await sql.begin(async (tx) => {
    // Everything restorable, plus the per-session tables that would point at the old users.
    const wipe = [...new Set([...tables, 'sessions', 'login_attempts', 'integration_tokens'])].filter((t) => known.has(t));
    await tx.unsafe(`truncate table ${wipe.map((t) => `"${t}"`).join(', ')} restart identity cascade`);

    const done = new Set();
    const deferred = []; // [table, column, rows]
    for (const t of tables) {
      const tcols = cols.get(t);
      let rows = backup[t];
      if (t === 'users') rows = rows.map((u) => ({ ...u, password_hash: '!restored-reset-required', must_change_password: true, totp_enabled: false, totp_secret: null, totp_last_step: null }));
      // FK columns pointing at tables not restored yet (or at itself) are inserted as null and filled in afterwards.
      const later = fks.filter((f) => f.table_name === t && (f.ref === t || (!done.has(f.ref) && tables.includes(f.ref)))).map((f) => f.column_name);
      if (later.length) {
        deferred.push([t, later, rows.filter((r) => later.some((c) => r[c] != null)).map((r) => Object.fromEntries([['id', r.id], ...later.map((c) => [c, r[c]])]))]);
        rows = rows.map((r) => { const o = { ...r }; for (const c of later) o[c] = null; return o; });
      }
      const use = rows.length ? Object.keys(rows[0]).filter((c) => tcols.has(c)) : [];
      const list = use.map((c) => `"${c}"`).join(', ');
      const identity = use.some((c) => tcols.get(c));
      for (let i = 0; i < rows.length; i += ROW_BATCH) {
        const chunk = JSON.stringify(rows.slice(i, i + ROW_BATCH).map((r) => Object.fromEntries(use.map((c) => [c, r[c] ?? null]))));
        await tx.unsafe(`insert into "${t}" (${list}) ${identity ? 'overriding system value' : ''} select ${list} from json_populate_recordset(null::"${t}", $1::text::json)`, [chunk]);
      }
      counts[t] = rows.length;
      done.add(t);
    }
    for (const [t, later, rows] of deferred) {
      for (let i = 0; i < rows.length; i += ROW_BATCH) {
        const chunk = JSON.stringify(rows.slice(i, i + ROW_BATCH));
        await tx.unsafe(`update "${t}" t set ${later.map((c) => `"${c}" = coalesce(x."${c}", t."${c}")`).join(', ')}
          from json_populate_recordset(null::"${t}", $1::text::json) x where t.id = x.id`, [chunk]);
      }
    }
    for (const t of tables) {
      if (cols.get(t)?.get('id')) await tx.unsafe(`select setval(pg_get_serial_sequence('"${t}"', 'id'), greatest((select coalesce(max(id), 0) from "${t}"), 1), (select count(*) > 0 from "${t}"))`);
    }
    await tx`insert into audit_log (action, detail) values ('backup.restored', ${tx.json({ schema: backup.schema, exported_at: backup.exported_at, counts })})`;
  });
} catch (e) {
  await fail(`Restore failed and was rolled back: ${e.message}`);
}
console.log('Restored:', Object.entries(counts).map(([t, c]) => `${t} ${c}`).join(', '));
console.log('\nNext: give every user a new one-time password (npm run crm:user -- reset-password <email>), re-issue the n8n token under Integrations, and re-enter the mail password under Settings → Email.');
await sql.end({ timeout: 5 });
