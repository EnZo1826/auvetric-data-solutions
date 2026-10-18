/** Request helpers shared by CRM route handlers. */
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { db } from "./db";
import { COOKIE, cookieOptions, readSession, type Meta, type Session, type Stage } from "./session";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export function clientMeta(req: NextRequest): Meta {
  const ip =
    req.headers.get("x-nf-client-connection-ip") || // Netlify: set by the edge, not spoofable by the client
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return { ip: ip.slice(0, 64), userAgent: req.headers.get("user-agent") ?? "" };
}

/**
 * CSRF defence in depth (cookies are already SameSite=Strict): state-changing requests
 * must come from this origin.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Cross-site request refused.");
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { throw new HttpError(403, "Cross-site request refused."); }
  if (originHost !== host) throw new HttpError(403, "Cross-site request refused.");
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>, maxBytes = 16_384): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Request too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large.");
  let body: unknown;
  try { body = JSON.parse(text || "{}"); } catch { throw new HttpError(400, "Invalid JSON."); }
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Invalid request.");
  return r.data;
}

/** The session behind this request, if any, restricted to the allowed stages. */
export async function sessionFor(req: NextRequest, stages: Stage[] = ["full"]): Promise<Session> {
  const s = await readSession(req.cookies.get(COOKIE)?.value);
  if (!s || !stages.includes(s.stage)) throw new HttpError(401, "Not signed in.");
  return s;
}

export function withSessionCookie(res: NextResponse, token: string, maxAge: number) {
  res.cookies.set(COOKIE, token, cookieOptions(maxAge));
  return res;
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Wraps a handler: HttpError → JSON error; anything else → logged 500 without internals. */
export function handle(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) {
        const res = json({ error: e.message, ...e.extra }, e.status);
        return e.status === 401 && e.extra.clearCookie ? clearSessionCookie(res) : res;
      }
      console.error("[crm]", req.method, req.nextUrl.pathname, e);
      return json({ error: "Something went wrong on our side. Please try again." }, 500);
    }
  };
}

export async function audit(userId: string | null, action: string, meta: Meta | null, detail: Record<string, unknown> = {}, entity?: string, entityId?: string) {
  await db()`insert into audit_log (user_id, action, entity, entity_id, ip, detail)
    values (${userId}, ${action}, ${entity ?? null}, ${entityId ?? null}, ${meta?.ip ?? null}, ${db().json(detail as never)})`;
}
