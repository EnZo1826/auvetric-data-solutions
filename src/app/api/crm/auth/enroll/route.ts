import type { NextRequest } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/crm/server/db";
import { seal, unseal } from "@/crm/server/crypto";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/crm/server/totp";
import { advanceSession, destroySession } from "@/crm/server/session";
import { assertSameOrigin, audit, clientMeta, clearSessionCookie, handle, HttpError, json, readJson, sessionFor, withSessionCookie } from "@/crm/server/http";
import { MAX_MFA_FAILURES } from "@/crm/server/signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the authenticator secret for this enrolment (created once per pending session). */
export const GET = handle(async (req: NextRequest) => {
  const s = await sessionFor(req, ["mfa_enroll"]);
  let secret: string;
  if (s.pendingTotpSecret) secret = unseal(s.pendingTotpSecret);
  else {
    secret = generateTotpSecret();
    await db()`update sessions set pending_totp_secret = ${seal(secret)} where id = ${s.id}`;
  }
  const uri = otpauthUri(secret, s.user.email);
  const qr = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#050b18", light: "#ffffff" } });
  return json({ secret: secret.replace(/(.{4})/g, "$1 ").trim(), uri, qr });
});

const Body = z.object({ code: z.string().trim().max(12) });

export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const meta = clientMeta(req);
  const s = await sessionFor(req, ["mfa_enroll"]);
  const { code } = await readJson(req, Body);
  if (!s.pendingTotpSecret) throw new HttpError(400, "Load the enrolment QR code first.");
  const secret = unseal(s.pendingTotpSecret);
  const r = verifyTotp(secret, code);
  if (!r.ok) {
    const [x] = await db()`update sessions set mfa_failures = mfa_failures + 1 where id = ${s.id} returning mfa_failures`;
    if (x.mfa_failures >= MAX_MFA_FAILURES) {
      await destroySession(s.id);
      await audit(s.user.id, "auth.mfa_enroll_aborted", meta);
      return clearSessionCookie(json({ error: "Too many wrong codes. Sign in again.", restart: true }, 401));
    }
    throw new HttpError(400, "That code didn't match. Check the time on your phone and try the newest code.");
  }
  await db()`update users set totp_secret = ${seal(secret)}, totp_enabled = true, totp_last_step = ${r.step!},
                              last_login_at = now(), updated_at = now() where id = ${s.user.id}`;
  await audit(s.user.id, "auth.mfa_enrolled", meta);
  await audit(s.user.id, "auth.signed_in", meta);
  const { token, maxAge } = await advanceSession(s, "full", meta);
  return withSessionCookie(json({ next: "done" }), token, maxAge);
});
