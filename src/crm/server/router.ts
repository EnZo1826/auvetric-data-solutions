/**
 * Minimal router for the CRM JSON API (one catch-all route handler under /api/crm).
 * Every route needs a full session; writes additionally need a same-origin request and a
 * non-read-only role; `admin: true` restricts to admins.
 */
import type { NextRequest } from "next/server";
import { assertSameOrigin, clientMeta, HttpError, sessionFor } from "./http";
import type { Meta, Session } from "./session";

export type Ctx = { req: NextRequest; params: Record<string, string>; session: Session; meta: Meta; query: URLSearchParams };
type Handler = (ctx: Ctx) => Promise<unknown>;
type Route = { method: string; re: RegExp; keys: string[]; handler: Handler; admin: boolean };

const routes: Route[] = [];

export function route(method: string, pattern: string, handler: Handler, opts: { admin?: boolean } = {}) {
  const keys: string[] = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  routes.push({ method, re, keys, handler, admin: !!opts.admin });
}

export async function dispatch(req: NextRequest, path: string): Promise<unknown> {
  const hits = routes.map((r) => ({ r, m: path.match(r.re) })).filter((x) => x.m);
  if (!hits.length) throw new HttpError(404, "Not found.");
  const hit = hits.find((x) => x.r.method === req.method);
  if (!hit) throw new HttpError(405, "Method not allowed.");

  const session = await sessionFor(req);
  const write = req.method !== "GET";
  if (write) {
    assertSameOrigin(req);
    if (session.user.role === "readonly") throw new HttpError(403, "Your account is read-only.");
  }
  if (hit.r.admin && session.user.role !== "admin") throw new HttpError(403, "Only admins can do that.");
  const params: Record<string, string> = {};
  hit.r.keys.forEach((k, i) => (params[k] = decodeURIComponent(hit.m![i + 1])));
  return hit.r.handler({ req, params, session, meta: clientMeta(req), query: req.nextUrl.searchParams });
}

/** Postgres bigint id from a URL segment or body field; anything else is a 404/400. */
export function id(v: unknown, what = "Record"): string {
  const s = String(v ?? "");
  if (!/^\d{1,18}$/.test(s)) throw new HttpError(404, `${what} not found.`);
  return s;
}
