/** Postgres access for the CRM (Node runtime only). Neon/Netlify DB in production, Docker Postgres locally. */
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __auvCrmSql?: Sql };

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);
}

export function db(): Sql {
  if (g.__auvCrmSql) return g.__auvCrmSql;
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error("CRM database is not configured (DATABASE_URL / NETLIFY_DATABASE_URL).");
  g.__auvCrmSql = postgres(url, {
    max: 3, // serverless: few connections per instance; Neon pooler fans out
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // safe behind PgBouncer transaction pooling
    onnotice: () => {},
    transform: { undefined: null },
  });
  return g.__auvCrmSql;
}
