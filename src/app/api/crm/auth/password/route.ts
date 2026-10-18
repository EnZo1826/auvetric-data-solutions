import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/crm/server/db";
import { hashPassword, passwordProblems, verifyPassword } from "@/crm/server/password";
import { advanceSession, destroyOtherSessions } from "@/crm/server/session";
import { assertSameOrigin, audit, clientMeta, handle, HttpError, json, readJson, sessionFor, withSessionCookie } from "@/crm/server/http";
import { nextStep } from "@/crm/server/signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().max(200),
});

/**
 * Two uses: the forced change after a one-time password (stage password_change, no current
 * password needed, the password step just proved it), and a voluntary change from Account
 * (full session, current password required).
 */
export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const meta = clientMeta(req);
  const s = await sessionFor(req, ["password_change", "full"]);
  const { currentPassword, newPassword } = await readJson(req, Body);

  const [u] = await db()`select password_hash, totp_enabled from users where id = ${s.user.id}`;
  if (s.stage === "full" && !(await verifyPassword(currentPassword ?? "", u.password_hash))) {
    throw new HttpError(400, "Current password is incorrect.");
  }
  const problems = passwordProblems(newPassword, s.user.email);
  if (problems.length) throw new HttpError(400, problems[0], { problems });
  if (await verifyPassword(newPassword, u.password_hash)) throw new HttpError(400, "Choose a password different from the current one.");

  await db()`update users set password_hash = ${await hashPassword(newPassword)}, must_change_password = false, updated_at = now() where id = ${s.user.id}`;
  await audit(s.user.id, "auth.password_changed", meta);

  if (s.stage === "full") {
    await destroyOtherSessions(s.user.id, s.id); // other devices must sign in again
    return json({ ok: true, next: "done" });
  }
  const stage = u.totp_enabled ? "mfa" : "mfa_enroll";
  const { token, maxAge } = await advanceSession(s, stage, meta);
  return withSessionCookie(json({ next: nextStep[stage] }), token, maxAge);
});
