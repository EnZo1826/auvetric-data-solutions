// Applies src/crm/migrations/*.sql in name order, each once, each in its own transaction.
// Usage: npm run crm:migrate            (apply pending)
//        npm run crm:migrate -- --status (list only, change nothing)
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { connect, describeDb } from './env.mjs';

const dir = path.join(process.cwd(), 'src/crm/migrations');
const statusOnly = process.argv.includes('--status');
const sql = connect();

try {
  await sql`create table if not exists schema_migrations (
    name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
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
} catch (e) {
  console.error(`Migration failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
