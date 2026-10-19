// End-to-end sign-in tests against a running server (next start / next dev) and its database.
//   CRM_TEST_URL=http://localhost:3100 npm run crm:test:auth
// Creates and deletes its own throwaway users (*@crm-test.invalid). Never point this at production.
import assert from 'node:assert/strict';
import { hashPassword } from '../../src/crm/server/password.ts';
import { base32Decode, totp } from '../../src/crm/server/totp.ts';
import { connect, isHostedDb } from './env.mjs';

const BASE = (process.env.CRM_TEST_URL || 'http://localhost:3100').replace(/\/$/, '');
if (/auvetric\.com|netlify\.app/.test(BASE) || isHostedDb()) {
  console.error('Refusing to run auth tests against production.');
  process.exit(2);
}
const ORIGIN = new URL(BASE).origin;
const sql = connect();
const DOMAIN = 'crm-test.invalid';
const PW1 = 'One-Time-Pass-Word-1';
const PW2 = 'Namib-Dune-Pump-Fresh-2026';
let passed = 0;
const ok = (label) => { passed++; console.log(`  ✓ ${label}`); };

/** Minimal cookie-jar client. */
function client(ip) {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; },
    async req(path, { method = 'GET', body, origin = ORIGIN, redirect = 'manual' } = {}) {
      const headers = { 'x-forwarded-for': ip, 'user-agent': 'crm-auth-test' };
      if (cookie) headers.cookie = cookie;
      if (body !== undefined) headers['content-type'] = 'application/json';
      if (origin && method !== 'GET') headers.origin = origin;
      const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect });
      const set = res.headers.getSetCookie();
      for (const c of set) {
        const [pair] = c.split(';');
        const [, val] = pair.split('=');
        cookie = val ? pair : '';
      }
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* html */ }
      return { status: res.status, headers: res.headers, setCookie: set, json, text };
    },
  };
}
const post = (c, path, body, extra) => c.req(path, { method: 'POST', body, ...extra });

async function cleanup() {
  await sql`delete from audit_log where user_id in (select id from users where email like ${'%@' + DOMAIN})`;
  await sql`delete from login_attempts where email like ${'%@' + DOMAIN} or ip like '10.99.%'`;
  await sql`delete from users where email like ${'%@' + DOMAIN}`;
}

try {
  await cleanup();
  const [u] = await sql`insert into users (email, name, password_hash) values (${'partner@' + DOMAIN}, 'Test Partner', ${await hashPassword(PW1)}) returning id`;
  const email = 'partner@' + DOMAIN;
  console.log(`CRM auth tests against ${BASE}`);

  // ── Gatekeeping ──
  const anon = client('10.99.0.1');
  let r = await anon.req('/crm');
  assert.equal(r.status, 307); assert.match(r.headers.get('location'), /\/crm\/login$/);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  ok('anonymous /crm redirects to /crm/login, noindex header');
  r = await anon.req('/crm/invoices');
  assert.equal(r.status, 307);
  ok('anonymous deep link redirects');
  r = await anon.req('/api/crm/auth/me');
  assert.equal(r.status, 401);
  ok('anonymous API → 401');
  r = await anon.req('/crm/login');
  assert.equal(r.status, 200); assert.match(r.text, /Partner sign-in/); assert.match(r.text, /noindex/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  ok('login page renders, meta noindex, frame-deny');
  anon.cookie = 'auv_crm=forged-token-forged-token-forged; __Host-auv_crm=forged-token-forged-token-forged';
  r = await anon.req('/crm');
  assert.ok([307, 308].includes(r.status) && /\/crm\/login/.test(r.headers.get('location') ?? ''), `forged cookie → login (got ${r.status})`);
  r = await anon.req('/api/crm/auth/me');
  assert.equal(r.status, 401);
  anon.cookie = '';
  ok('forged cookie rejected by pages and API');

  // ── CSRF / input validation ──
  r = await post(anon, '/api/crm/auth/login', { email, password: PW1 }, { origin: null });
  assert.equal(r.status, 403);
  r = await post(anon, '/api/crm/auth/login', { email, password: PW1 }, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  ok('missing or foreign Origin → 403');
  r = await post(anon, '/api/crm/auth/login', { email: 'not-an-email', password: 'x' });
  assert.equal(r.status, 400);
  ok('invalid email → 400');

  // ── Wrong credentials: identical response for unknown and known users ──
  const wrong = await post(anon, '/api/crm/auth/login', { email, password: 'wrong-password-here' });
  const unknown = await post(anon, '/api/crm/auth/login', { email: 'nobody@' + DOMAIN, password: 'wrong-password-here' });
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.json, unknown.json);
  assert.equal(wrong.setCookie.length, 0);
  ok('wrong password and unknown email give the same 401, no cookie');

  // ── First sign-in: one-time password → forced change → enrol 2FA ──
  const a = client('10.99.0.2');
  r = await post(a, '/api/crm/auth/login', { email: email.toUpperCase(), password: PW1 });
  assert.equal(r.status, 200); assert.equal(r.json.next, 'password');
  const sc = r.setCookie[0];
  assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=Strict/i); assert.match(sc, /Path=\//);
  ok('one-time password accepted (email case-insensitive) → next: password; cookie HttpOnly, SameSite=Strict');
  r = await a.req('/api/crm/auth/me');
  assert.equal(r.status, 401);
  r = await a.req('/crm');
  assert.equal(r.status, 307);
  ok('half-signed-in session cannot reach CRM pages or API');
  r = await a.req('/crm/login');
  assert.match(r.text, /Choose your password/);
  ok('refreshing the login page resumes at the password step');
  r = await post(a, '/api/crm/auth/enroll', { code: '123456' });
  assert.equal(r.status, 401);
  ok('cannot skip ahead to 2FA enrolment');
  r = await post(a, '/api/crm/auth/password', { newPassword: 'short' });
  assert.equal(r.status, 400);
  r = await post(a, '/api/crm/auth/password', { newPassword: 'partner-is-in-here-123' });
  assert.equal(r.status, 400, 'password containing email local-part rejected');
  r = await post(a, '/api/crm/auth/password', { newPassword: PW1 });
  assert.equal(r.status, 400, 'same password rejected');
  ok('weak / email-containing / unchanged passwords rejected');
  const preChange = a.cookie;
  r = await post(a, '/api/crm/auth/password', { newPassword: PW2 });
  assert.equal(r.status, 200); assert.equal(r.json.next, 'enroll');
  assert.notEqual(a.cookie, preChange);
  ok('password changed → next: enroll; session token rotated');
  const stale = client('10.99.0.2'); stale.cookie = preChange;
  r = await stale.req('/api/crm/auth/enroll');
  assert.equal(r.status, 401);
  ok('previous-step token is dead');

  r = await a.req('/api/crm/auth/enroll');
  assert.equal(r.status, 200); assert.match(r.json.qr, /^data:image\/png;base64,/); assert.match(r.json.uri, /^otpauth:\/\/totp\//);
  const secret = r.json.secret.replace(/\s/g, '');
  const again = await a.req('/api/crm/auth/enroll');
  assert.equal(again.json.secret.replace(/\s/g, ''), secret);
  ok('enrolment returns QR + otpauth URI; secret stable across reloads');
  const [raw] = await sql`select pending_totp_secret from sessions where user_id = ${u.id}`;
  assert.ok(raw.pending_totp_secret.startsWith('v1.') && !raw.pending_totp_secret.includes(secret));
  ok('pending secret is sealed at rest');
  r = await post(a, '/api/crm/auth/enroll', { code: '000000' });
  assert.equal(r.status, 400);
  r = await post(a, '/api/crm/auth/enroll', { code: totp(base32Decode(secret)) });
  assert.equal(r.status, 200); assert.equal(r.json.next, 'done');
  ok('wrong code rejected; correct code completes enrolment');

  r = await a.req('/api/crm/auth/me');
  assert.equal(r.status, 200); assert.equal(r.json.user.email, email); assert.equal(r.json.user.totpEnabled, true);
  assert.equal(r.json.user.password_hash, undefined);
  ok('full session: /me returns the user, no secrets');
  r = await a.req('/crm');
  assert.equal(r.status, 200); assert.match(r.text, /Good to see you/); assert.match(r.text, /Test Partner/);
  ok('dashboard renders for the signed-in partner');
  r = await a.req('/crm/reports');
  assert.equal(r.status, 200); assert.match(r.text, /Scheduled · Phase/);
  r = await a.req('/crm/account');
  assert.equal(r.status, 200); assert.match(r.text, /this browser/);
  r = await a.req('/crm/does-not-exist');
  assert.equal(r.status, 404);
  ok('scheduled module, account page and 404 behave');
  const [stored] = await sql`select totp_secret, must_change_password from users where id = ${u.id}`;
  assert.ok(stored.totp_secret.startsWith('v1.')); assert.equal(stored.must_change_password, false);
  ok('TOTP secret sealed in users table');

  r = await post(a, '/api/crm/auth/logout', {});
  assert.equal(r.status, 200);
  r = await a.req('/api/crm/auth/me');
  assert.equal(r.status, 401);
  ok('sign-out ends the session');

  // ── Returning sign-in with 2FA and replay protection ──
  const b = client('10.99.0.3');
  r = await post(b, '/api/crm/auth/login', { email, password: PW1 });
  assert.equal(r.status, 401, 'old one-time password no longer works');
  r = await post(b, '/api/crm/auth/login', { email, password: PW2 });
  assert.equal(r.json.next, 'mfa');
  const key = base32Decode(secret);
  const codeAt = (step) => totp(key, step * 30_000);
  const lastStep = async () => Number((await sql`select totp_last_step from users where id = ${u.id}`)[0].totp_last_step);
  const nowStep = () => Math.floor(Date.now() / 30_000);
  r = await post(b, '/api/crm/auth/verify', { code: codeAt(await lastStep()) });
  assert.equal(r.status, 400, 'code already used at enrolment is refused');
  r = await post(b, '/api/crm/auth/verify', { code: codeAt((await lastStep()) + 1) });
  assert.equal(r.status, 200); assert.equal(r.json.next, 'done');
  ok('returning sign-in: password → 2FA; reused code refused, next code accepted');

  // second browser, then "sign out everywhere"
  const c2 = client('10.99.0.4');
  await post(c2, '/api/crm/auth/login', { email, password: PW2 });
  r = await post(c2, '/api/crm/auth/verify', { code: codeAt(await lastStep()) });
  assert.equal(r.status, 400, 'same code cannot be used twice, even on another device');
  await sql`update users set totp_last_step = ${nowStep() - 2} where id = ${u.id}`; // simulate time passing
  r = await post(c2, '/api/crm/auth/verify', { code: codeAt(nowStep()) });
  assert.equal(r.status, 200);
  r = await b.req('/api/crm/auth/me'); assert.equal(r.status, 200);
  r = await post(b, '/api/crm/auth/logout', { everywhere: true });
  r = await c2.req('/api/crm/auth/me'); assert.equal(r.status, 401);
  ok('cross-device code replay refused; sign out everywhere ends all sessions');

  // voluntary password change requires the current password and signs out other devices
  const d = client('10.99.0.5');
  await post(d, '/api/crm/auth/login', { email, password: PW2 });
  await sql`update users set totp_last_step = ${nowStep() - 2} where id = ${u.id}`;
  r = await post(d, '/api/crm/auth/verify', { code: codeAt(nowStep()) });
  assert.equal(r.status, 200);
  r = await post(d, '/api/crm/auth/password', { currentPassword: 'wrong-current-pass', newPassword: 'Another-Strong-Phrase-77' });
  assert.equal(r.status, 400);
  r = await post(d, '/api/crm/auth/password', { currentPassword: PW2, newPassword: 'Another-Strong-Phrase-77' });
  assert.equal(r.status, 200);
  r = await d.req('/api/crm/auth/me'); assert.equal(r.status, 200);
  ok('account password change needs the current password; this session survives');

  // ── 2FA brute force: 5 wrong codes kill the pending session ──
  const e = client('10.99.0.6');
  await post(e, '/api/crm/auth/login', { email, password: 'Another-Strong-Phrase-77' });
  for (let i = 0; i < 4; i++) assert.equal((await post(e, '/api/crm/auth/verify', { code: '111111' })).status, 400);
  r = await post(e, '/api/crm/auth/verify', { code: '111111' });
  assert.equal(r.status, 401); assert.equal(r.json.restart, true);
  r = await post(e, '/api/crm/auth/verify', { code: codeAt(nowStep() + 1) });
  assert.equal(r.status, 401);
  ok('5 wrong 2FA codes end the pending sign-in');

  // ── Account lockout after 5 wrong passwords ──
  const f = client('10.99.0.7');
  for (let i = 0; i < 5; i++) assert.equal((await post(f, '/api/crm/auth/login', { email, password: 'bad-guess-' + i })).status, 401);
  r = await post(f, '/api/crm/auth/login', { email, password: 'Another-Strong-Phrase-77' });
  assert.equal(r.status, 429);
  ok('5 wrong passwords lock the account (correct password refused while locked)');
  await sql`update users set locked_until = null where id = ${u.id}`;

  // ── Per-IP throttle ──
  const g = client('10.99.0.8');
  for (let i = 0; i < 20; i++) await post(g, '/api/crm/auth/login', { email: `x${i}@${DOMAIN}`, password: 'nope-nope-nope' });
  r = await post(g, '/api/crm/auth/login', { email, password: 'Another-Strong-Phrase-77' });
  assert.equal(r.status, 429);
  ok('20 failures from one IP throttle that IP');

  // ── Disabled user's sessions stop working immediately ──
  r = await d.req('/api/crm/auth/me'); assert.equal(r.status, 200);
  await sql`update users set disabled = true where id = ${u.id}`;
  r = await d.req('/api/crm/auth/me'); assert.equal(r.status, 401);
  ok('disabling a user cuts off live sessions');

  // ── Audit trail and public site ──
  const actions = (await sql`select distinct action from audit_log where user_id = ${u.id}`).map((x) => x.action);
  for (const want of ['auth.password_ok', 'auth.password_changed', 'auth.mfa_enrolled', 'auth.signed_in', 'auth.signed_out', 'auth.mfa_failed', 'auth.locked']) assert.ok(actions.includes(want), `audit has ${want}`);
  ok('audit log records the sign-in lifecycle');
  r = await anon.req('/');
  assert.equal(r.status, 200); assert.equal(r.headers.get('x-robots-tag'), null); assert.match(r.text, /Partner login/);
  r = await anon.req('/robots.txt');
  assert.equal(r.status, 200);
  ok('public site unaffected; footer shows Partner login');

  console.log(`\nCRM auth: ${passed} checks passed.`);
} catch (e) {
  console.error('\nFAILED:', e.message);
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await sql.end({ timeout: 5 });
}
