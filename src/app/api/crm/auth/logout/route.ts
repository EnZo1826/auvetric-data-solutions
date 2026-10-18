import type { NextRequest } from "next/server";
import { z } from "zod";
import { readSession, COOKIE, destroySession, destroyOtherSessions } from "@/crm/server/session";
import { assertSameOrigin, audit, clientMeta, clearSessionCookie, handle, json, readJson } from "@/crm/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ everywhere: z.boolean().optional() });

/** Sign out this browser, or every session for this user (`{ "everywhere": true }`). Always succeeds. */
export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { everywhere } = await readJson(req, Body);
  const s = await readSession(req.cookies.get(COOKIE)?.value);
  if (s) {
    if (everywhere) await destroyOtherSessions(s.user.id, null);
    else await destroySession(s.id);
    await audit(s.user.id, everywhere ? "auth.signed_out_everywhere" : "auth.signed_out", clientMeta(req));
  }
  return clearSessionCookie(json({ ok: true }));
});
