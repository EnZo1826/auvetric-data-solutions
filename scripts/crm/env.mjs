// Shared env loader for CRM scripts: .env.local then .env (first wins), never overriding real env vars.
import { existsSync } from 'node:fs';
import postgres from 'postgres';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);

/**
 * Scripts (migrations, user admin) normally use DATABASE_URL. MIGRATE_DATABASE_URL overrides it for scripts only,
 * e.g. to run migrations from the PC against production without changing .env.local.
 */
export function databaseUrl() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. See .env.example.');
    process.exit(2);
  }
  return url;
}

export function sslFor(url) {
  try {
    const { hostname, searchParams } = new URL(url);
    if (searchParams.get('sslmode') === 'disable') return false;
    return ['localhost', '127.0.0.1', '::1'].includes(hostname) ? false : 'require';
  } catch { return 'require'; }
}

export function connect() {
  const url = databaseUrl();
  return postgres(url, { max: 1, onnotice: () => {}, prepare: false, ssl: sslFor(url) });
}

/** True for hosted databases (Supabase/Neon); test suites refuse to run against them. */
export function isHostedDb(url = databaseUrl()) {
  try { return !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname); } catch { return true; }
}

/** Host part of the URL only, for log lines (never print credentials). */
export function describeDb() {
  try { const u = new URL(databaseUrl()); return `${u.hostname}:${u.port || 5432}${u.pathname}`; } catch { return '(unparseable url)'; }
}
