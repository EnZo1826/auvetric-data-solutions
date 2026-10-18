import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/crm/server/db";
import { unseal } from "@/crm/server/crypto";
import { verifyTotp } from "@/crm/server/totp";
import { advanceSession, destroySession } from "@/crm/server/session";
import { assertSameOrigin, audit, clientMeta, clearSessionCookie, handle, HttpError, json, readJson, sessionFor, withSessionCookie } from "@/crm/server/http";
import { MAX_MFA_FAILURES } from "@/crm/server/signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().trim().max(12) });

/** Second factor for enrolled users. */
export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const meta = clientMeta(req);
  const s = await sessionFor(req, ["mfa"]);
  const { code } = await readJson(req, Body);
  const [u] = await db()`select totp_secret, totp_last_step from users where id = ${s.user.id}`;
  if (!u?.totp_secret) throw new HttpError(401, "Two-factor is not set up for this account. Sign in again.", { clearCookie: true });

  const r = verifyTotp(unseal(u.totp_secret), code, { lastUsedStep: u.totp_last_step == null ? null : Number(u.totp_last_step) });
  if (!r.ok) {
    const [x] = await db()`update sessions set mfa_failures = mfa_failures + 1 where id = ${s.id} returning mfa_failures`;
    await audit(s.user.id, "auth.mfa_failed", meta);
    if (x.mfa_failures >= MAX_MFA_FAILURES) {
      await destroySession(s.id);
      return clearSessionCookie(json({ error: "Too many wrong codes. Sign in again.", restart: true }, 401));
    }
    throw new HttpError(400, "That code is incorrect or already used. Wait for the next code and try again.");
  }
  // Conditional update closes the race where two requests submit the same code at once.
  const won = await db()`update users set totp_last_step = ${r.step!}, last_login_at = now()
                          where id = ${s.user.id} and (totp_last_step is null or totp_last_step < ${r.step!}) returning id`;
  if (!won.length) throw new HttpError(400, "That code is incorrect or already used. Wait for the next code and try again.");
  await audit(s.user.id, "auth.signed_in", meta);
  const { token, maxAge } = await advanceSession(s, "full", meta);
  return withSessionCookie(json({ next: "done" }), token, maxAge);
});
