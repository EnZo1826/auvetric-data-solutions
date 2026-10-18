/** Sign-in state machine: password → (change password) → (enrol 2FA | verify 2FA) → full session. */
import { db } from "./db";
import type { Stage } from "./session";

export const MAX_ACCOUNT_FAILURES = 5; // consecutive wrong passwords before lockout
export const LOCK_MINUTES = 15;
export const MAX_IP_FAILURES = 20; // failed sign-ins per IP per 15 min
export const MAX_MFA_FAILURES = 5; // wrong codes per pending session

/** Well-formed scrypt hash that matches no password: unknown emails cost the same time as known ones. */
export const DUMMY_HASH =
  "scrypt$32768$8$1$3eTpoX0Pl3tQ1xM2bXb1Ow==$1n7m7l4G4HfE3Zz0P0YyqEJ7vqQm2F8c9hM1xk0b2dE=";

export function stageAfterPassword(u: { must_change_password: boolean; totp_enabled: boolean }): Stage {
  if (u.must_change_password) return "password_change";
  return u.totp_enabled ? "mfa" : "mfa_enroll";
}

export const nextStep: Record<Stage, "password" | "enroll" | "mfa" | "done"> = {
  password_change: "password",
  mfa_enroll: "enroll",
  mfa: "mfa",
  full: "done",
};

export async function ipBlocked(ip: string): Promise<boolean> {
  const [r] = await db()`select count(*)::int as n from login_attempts where ip = ${ip} and not ok and at > now() - interval '15 minutes'`;
  return r.n >= MAX_IP_FAILURES;
}

export async function recordAttempt(email: string | null, ip: string, ok: boolean) {
  await db()`insert into login_attempts (email, ip, ok) values (${email}, ${ip}, ${ok})`;
}
