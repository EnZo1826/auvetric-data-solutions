import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/crm/server/db";
import { verifyPassword } from "@/crm/server/password";
import { createSession, purgeExpired } from "@/crm/server/session";
import { assertSameOrigin, audit, clientMeta, handle, HttpError, json, readJson, withSessionCookie } from "@/crm/server/http";
import { DUMMY_HASH, ipBlocked, LOCK_MINUTES, MAX_ACCOUNT_FAILURES, nextStep, recordAttempt, stageAfterPassword } from "@/crm/server/signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().max(254).email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});
const BAD = "Email or password is incorrect.";

export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const meta = clientMeta(req);
  const { email, password } = await readJson(req, Body);

  if (await ipBlocked(meta.ip)) throw new HttpError(429, "Too many failed sign-ins from this network. Try again in 15 minutes.");

  const [u] = await db()`select id, password_hash, must_change_password, totp_enabled, disabled, locked_until
                           from users where lower(email) = lower(${email})`;
  if (!u || u.disabled) {
    await verifyPassword(password, DUMMY_HASH);
    await recordAttempt(email, meta.ip, false);
    throw new HttpError(401, BAD);
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    await recordAttempt(email, meta.ip, false);
    throw new HttpError(429, "Too many failed attempts. This account is locked for a few minutes.");
  }

  if (!(await verifyPassword(password, u.password_hash))) {
    const [r] = await db()`
      update users set failed_logins = failed_logins + 1,
             locked_until = case when failed_logins + 1 >= ${MAX_ACCOUNT_FAILURES} then now() + ${LOCK_MINUTES} * interval '1 minute' else locked_until end
       where id = ${u.id} returning failed_logins, locked_until`;
    if (r.failed_logins >= MAX_ACCOUNT_FAILURES) {
      await db()`update users set failed_logins = 0 where id = ${u.id}`;
      await audit(String(u.id), "auth.locked", meta);
    }
    await recordAttempt(email, meta.ip, false);
    throw new HttpError(401, BAD);
  }

  await db()`update users set failed_logins = 0, locked_until = null where id = ${u.id}`;
  await recordAttempt(email, meta.ip, true);
  await purgeExpired();
  const stage = stageAfterPassword(u as { must_change_password: boolean; totp_enabled: boolean });
  const { token, maxAge } = await createSession(String(u.id), stage, meta);
  await audit(String(u.id), "auth.password_ok", meta, { next: stage });
  return withSessionCookie(json({ next: nextStep[stage] }), token, maxAge);
});
