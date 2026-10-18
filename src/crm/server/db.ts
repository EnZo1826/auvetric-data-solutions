/**
 * Postgres access for the CRM (Node runtime only).
 * Production: Supabase Postgres through its SESSION pooler (port 5432 on *.pooler.supabase.com).
 * Local/CI: plain Docker Postgres. The CRM uses Supabase purely as a database: no Data API, no supabase-js,
 * no Supabase Auth.
 *
 * Not the transaction pooler (6543): postgres.js pipelines queries on a connection, and through Supavisor's
 * transaction mode a mix of parameterless (simple protocol) and parameterised queries hangs indefinitely.
 * Reproduced against Supavisor 2.9.13 (Supabase CLI 2.121); the session pooler passes every CRM test.
 */
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __auvCrmSql?: Sql };

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** TLS for everything except a database on this machine (Docker dev / CI service container). */
export function sslFor(url: string): false | "require" {
  try {
    const { hostname, searchParams } = new URL(url);
    if (searchParams.get("sslmode") === "disable") return false;
    return ["localhost", "127.0.0.1", "::1"].includes(hostname) ? false : "require";
  } catch {
    return "require";
  }
}

/** Refuse the Supabase transaction pooler up front rather than hang under load (see header). */
export function assertSupportedUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "6543") {
      throw new Error("DATABASE_URL points at the Supabase transaction pooler (port 6543). Use the session pooler: same host, port 5432.");
    }
  } catch (e) {
    if (e instanceof TypeError) throw new Error("DATABASE_URL is not a valid URL.");
    throw e;
  }
}

export function db(): Sql {
  if (g.__auvCrmSql) return g.__auvCrmSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("CRM database is not configured (DATABASE_URL).");
  assertSupportedUrl(url);
  g.__auvCrmSql = postgres(url, {
    max: 3, // serverless: few connections per function instance (session pooler holds one server connection each)
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // no named prepared statements: safe behind any pooler
    ssl: sslFor(url),
    onnotice: () => {},
    types: {
      // NUMERIC → JS number (money is 2 dp, well inside double precision); DATE → plain YYYY-MM-DD
      numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
      date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
    },
    transform: { undefined: null },
  });
  return g.__auvCrmSql;
}
