/**
 * Server-side sessions. The browser holds a random token in an HTTP-only cookie;
 * the database stores only its SHA-256, so a database leak doesn't hand out live sessions.
 * Each sign-in step (password → change password → enrol/verify 2FA → full) rotates the token.
 */
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";

export type Stage = "password_change" | "mfa_enroll" | "mfa" | "full";
export const COOKIE = process.env.NODE_ENV === "production" ? "__Host-auv_crm" : "auv_crm";

const PENDING_TTL_MS = 10 * 60 * 1000; // half-finished sign-ins
const IDLE_MS = 12 * 60 * 60 * 1000; // full session: sign out after 12 h idle
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // …and after 7 days regardless
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member" | "readonly";
  totpEnabled: boolean;
  mustChangePassword: boolean;
};
export type Session = {
  id: string;
  stage: Stage;
  createdAt: Date;
  pendingTotpSecret: string | null;
  mfaFailures: number;
  user: SessionUser;
};

export type Meta = { ip: string; userAgent: string };

export async function createSession(userId: string, stage: Stage, meta: Meta, extra: { pendingTotpSecret?: string | null } = {}) {
  const token = randomToken();
  const ttl = stage === "full" ? IDLE_MS : PENDING_TTL_MS;
  await db()`insert into sessions (id, user_id, stage, pending_totp_secret, ip, user_agent, expires_at)
    values (${sha256(token)}, ${userId}, ${stage}, ${extra.pendingTotpSecret ?? null}, ${meta.ip}, ${meta.userAgent.slice(0, 300)},
            now() + ${ttl / 1000} * interval '1 second')`;
  return { token, maxAge: Math.floor((stage === "full" ? ABSOLUTE_MS : PENDING_TTL_MS) / 1000) };
}

/** Replace a session with a fresh token at a new stage (prevents session fixation between steps). */
export async function advanceSession(session: Session, stage: Stage, meta: Meta) {
  await destroySession(session.id);
  return createSession(session.user.id, stage, meta);
}

export async function readSession(token: string | undefined | null): Promise<Session | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = sha256(token);
  const [r] = await db()`
    select s.id, s.stage, s.created_at, s.last_seen_at, s.pending_totp_secret, s.mfa_failures,
           u.id as uid, u.email, u.name, u.role, u.totp_enabled, u.must_change_password
      from sessions s join users u on u.id = s.user_id
     where s.id = ${id} and s.expires_at > now() and not u.disabled
       and (s.stage <> 'full' or s.created_at > now() - ${ABSOLUTE_MS / 1000} * interval '1 second')`;
  if (!r) return null;
  if (r.stage === "full" && Date.now() - new Date(r.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await db()`update sessions set last_seen_at = now(), expires_at = now() + ${IDLE_MS / 1000} * interval '1 second' where id = ${id}`;
  }
  return {
    id: r.id,
    stage: r.stage,
    createdAt: r.created_at,
    pendingTotpSecret: r.pending_totp_secret,
    mfaFailures: r.mfa_failures,
    user: { id: String(r.uid), email: r.email, name: r.name, role: r.role, totpEnabled: r.totp_enabled, mustChangePassword: r.must_change_password },
  };
}

export async function destroySession(id: string) {
  await db()`delete from sessions where id = ${id}`;
}

export async function destroyOtherSessions(userId: string, keepId: string | null) {
  await db()`delete from sessions where user_id = ${userId} and (${keepId}::text is null or id <> ${keepId})`;
}

/** Opportunistic cleanup; called on sign-in so no scheduler is needed. */
export async function purgeExpired() {
  await db()`delete from sessions where expires_at < now() - interval '1 day'`;
  await db()`delete from login_attempts where at < now() - interval '30 days'`;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
