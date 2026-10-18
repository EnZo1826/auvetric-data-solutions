// Shared env loader for CRM scripts: .env.local then .env (first wins), never overriding real env vars.
import { existsSync } from 'node:fs';
import postgres from 'postgres';

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f);

export function databaseUrl() {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL (or NETLIFY_DATABASE_URL) is not set. See .env.example.');
    process.exit(2);
  }
  return url;
}

export function connect() {
  return postgres(databaseUrl(), { max: 1, onnotice: () => {}, prepare: false });
}

/** Host part of the URL only, for log lines (never print credentials). */
export function describeDb() {
  try { const u = new URL(databaseUrl()); return `${u.hostname}:${u.port || 5432}${u.pathname}`; } catch { return '(unparseable url)'; }
}
