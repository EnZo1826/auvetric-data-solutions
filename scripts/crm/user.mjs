// Partner account administration. Passwords are generated here and shown once; they are never passed on the command line.
//   npm run crm:user -- add <email> "<Full Name>" [--role admin|member|readonly]
//   npm run crm:user -- reset-password <email>   (new one-time password; must be changed at next sign-in; signs out everywhere)
//   npm run crm:user -- reset-mfa <email>        (re-enrol authenticator at next sign-in; signs out everywhere)
//   npm run crm:user -- unlock <email> | disable <email> | enable <email> | list
import { randomInt } from 'node:crypto';
import { hashPassword } from '../../src/crm/server/password.ts';
import { connect, describeDb } from './env.mjs';

const [cmd, email, ...rest] = process.argv.slice(2);
const roleIdx = rest.indexOf('--role');
const role = roleIdx >= 0 ? rest[roleIdx + 1] : 'admin';
const name = rest.filter((_, i) => i !== roleIdx && i !== roleIdx + 1).join(' ').trim();

// 4 groups of 5 from an unambiguous alphabet ≈ 100 bits.
function oneTimePassword() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => a[randomInt(a.length)]).join('')).join('-');
}
const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const usage = () => { console.error('Usage: add <email> "<Name>" [--role admin|member|readonly] | reset-password <email> | reset-mfa <email> | unlock|disable|enable <email> | list'); process.exit(2); };

const sql = connect();
const audit = (userId, action, detail = {}) =>
  sql`insert into audit_log (user_id, action, entity, entity_id, detail) values (null, ${action}, 'user', ${String(userId)}, ${sql.json({ ...detail, via: 'cli' })})`;

async function find(e) {
  const [u] = await sql`select id, email from users where lower(email) = lower(${e})`;
  if (!u) { console.error(`No user ${e}`); process.exit(1); }
  return u;
}

try {
  console.log(`CRM database ${describeDb()}`);
  if (cmd === 'list') {
    const rows = await sql`select id, email, name, role, totp_enabled, must_change_password, disabled, locked_until, last_login_at from users order by id`;
    console.table(rows.map((r) => ({ ...r, locked_until: r.locked_until?.toISOString() ?? '', last_login_at: r.last_login_at?.toISOString() ?? '' })));
  } else if (cmd === 'add') {
    if (!emailOk(email) || !name) usage();
    if (!['admin', 'member', 'readonly'].includes(role)) usage();
    const pw = oneTimePassword();
    const [u] = await sql`insert into users (email, name, role, password_hash) values (${email.trim()}, ${name}, ${role}, ${await hashPassword(pw)}) returning id`;
    await audit(u.id, 'user.create', { email, role });
    console.log(`Created ${email} (${role}). One-time password, shown once:\n\n    ${pw}\n\nSign in at /crm/login; you will be asked to set a new password and enrol an authenticator app.`);
  } else if (cmd === 'reset-password') {
    const u = await find(email); const pw = oneTimePassword();
    await sql`update users set password_hash = ${await hashPassword(pw)}, must_change_password = true, failed_logins = 0, locked_until = null, updated_at = now() where id = ${u.id}`;
    await sql`delete from sessions where user_id = ${u.id}`;
    await audit(u.id, 'user.password_reset');
    console.log(`New one-time password for ${u.email}, shown once:\n\n    ${pw}\n`);
  } else if (cmd === 'reset-mfa') {
    const u = await find(email);
    await sql`update users set totp_secret = null, totp_enabled = false, totp_last_step = null, updated_at = now() where id = ${u.id}`;
    await sql`delete from sessions where user_id = ${u.id}`;
    await audit(u.id, 'user.mfa_reset');
    console.log(`Two-factor reset for ${u.email}. They enrol a new authenticator at next sign-in.`);
  } else if (['unlock', 'disable', 'enable'].includes(cmd)) {
    const u = await find(email);
    if (cmd === 'unlock') await sql`update users set failed_logins = 0, locked_until = null, updated_at = now() where id = ${u.id}`;
    if (cmd === 'disable') { await sql`update users set disabled = true, updated_at = now() where id = ${u.id}`; await sql`delete from sessions where user_id = ${u.id}`; }
    if (cmd === 'enable') await sql`update users set disabled = false, updated_at = now() where id = ${u.id}`;
    await audit(u.id, `user.${cmd}`);
    console.log(`${cmd}: ${u.email} done.`);
  } else usage();
} catch (e) {
  console.error(e.code === '23505' ? `A user with that email already exists.` : e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
