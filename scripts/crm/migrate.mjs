// Applies src/crm/migrations/*.sql in name order, each once, each in its own transaction,
// then checks that the Supabase Data API can't reach any CRM table.
// Usage: npm run crm:migrate            (apply pending + lockdown check)
//        npm run crm:migrate -- --status (list and check only, change nothing)
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { connect, describeDb } from './env.mjs';

const dir = path.join(process.cwd(), 'src/crm/migrations');
const statusOnly = process.argv.includes('--status');
const sql = connect();

/**
 * Every table in `public` must have row-level security on, and (on Supabase) the Data API roles
 * `anon` / `authenticated` must hold no privileges on any of them. Fails the run otherwise.
 */
async function assertLockdown() {
  const noRls = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity order by 1`;
  const [{ supabase }] = await sql`select exists (select 1 from pg_roles where rolname = 'anon') as supabase`;
  const grants = supabase ? await sql`
    select table_name, grantee, string_agg(privilege_type, ',') as privs from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1, 2 order by 1` : [];
  const problems = [
    ...noRls.map((r) => `${r.relname}: row-level security is off`),
    ...grants.map((g) => `${g.table_name}: ${g.grantee} has ${g.privs}`),
  ];
  if (problems.length) {
    throw new Error(`Data API lockdown check failed:\n    ${problems.join('\n    ')}\n  Enable RLS and revoke anon/authenticated grants in a new migration (see 0003_supabase_lockdown.sql).`);
  }
  console.log(`Lockdown check: all public tables have RLS${supabase ? '; anon/authenticated hold no table privileges (Supabase)' : ''}.`);
}

try {
  await sql`create table if not exists schema_migrations (
    name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
  await sql`alter table schema_migrations enable row level security`;
  const applied = new Map((await sql`select name, checksum from schema_migrations`).map((r) => [r.name, r.checksum]));
  const files = (await readdir(dir)).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  console.log(`CRM database ${describeDb()} · ${files.length} migration file(s), ${applied.size} applied`);

  let pending = 0;
  for (const f of files) {
    const body = await readFile(path.join(dir, f), 'utf8');
    const sum = createHash('sha256').update(body).digest('hex');
    if (applied.has(f)) {
      if (applied.get(f) !== sum) throw new Error(`${f} was edited after it was applied. Add a new migration instead.`);
      continue;
    }
    pending++;
    if (statusOnly) { console.log(`  pending  ${f}`); continue; }
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name, checksum) values (${f}, ${sum})`;
    });
    console.log(`  applied  ${f}`);
  }
  console.log(pending ? (statusOnly ? `${pending} pending.` : `Done: ${pending} applied.`) : 'Up to date.');
  if (!statusOnly || !pending) await assertLockdown();
} catch (e) {
  console.error(`Migration failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
