// End-to-end Phase 4 tests: email (SMTP sink), PDFs, attachments, backups + restore, audit log, reports reconciliation.
//   CRM_TEST_URL=http://localhost:3100 npm run crm:test:insights
// Needs the server started with CRM_FILE_DIR (local file store) and the same CRM_CRON_SECRET as .env.local / CI.
// Test data: users *@crm-test.invalid, records "ZZ Test …"; mail settings and the company profile are restored afterwards.
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import postgres from 'postgres';
import { hashPassword } from '../../src/crm/server/password.ts';
import { base32Decode, totp } from '../../src/crm/server/totp.ts';
import { connect, databaseUrl, isHostedDb } from './env.mjs';

const BASE = (process.env.CRM_TEST_URL || 'http://localhost:3100').replace(/\/$/, '');
if (/auvetric\.com|netlify\.app/.test(BASE) || isHostedDb()) { console.error('Refusing to run against production.'); process.exit(2); }
const ORIGIN = new URL(BASE).origin;
const FILE_DIR = path.resolve(process.env.CRM_FILE_DIR || '.crm-files');
const sql = connect();
const DOMAIN = 'crm-test.invalid';
const PW = 'Insights-Test-Pass-Phrase-2026';
let passed = 0;
const ok = (l) => { passed++; console.log(`  ✓ ${l}`); };
const expect = (r, status, label) => assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${String(r.text).slice(0, 300)}`);
const close = (a, b, label, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} ≠ ${b}`);
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);

// ── minimal SMTP server: records messages, enforces AUTH ──
function smtpSink(creds) {
  const messages = [];
  const sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock); sock.on('close', () => sockets.delete(sock));
    let buf = '', inData = false, data = '', authed = false, login = null, env = { from: '', rcpt: [] };
    const w = (s) => sock.write(s + '\r\n');
    const check = (u, p) => { authed = u === creds.user && p === creds.pass; w(authed ? '235 2.7.0 Authentication successful' : '535 5.7.8 Authentication credentials invalid'); };
    w('220 sink.test ESMTP');
    sock.on('error', () => {});
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') { inData = false; messages.push({ ...env, data }); env = { from: '', rcpt: [] }; data = ''; w(`250 2.0.0 Ok: queued as SINK${messages.length}`); }
          else data += (line.startsWith('..') ? line.slice(1) : line) + '\r\n';
          continue;
        }
        if (login) {
          const v = Buffer.from(line, 'base64').toString();
          if (login.step === 'user') { login = { step: 'pass', user: v }; w('334 UGFzc3dvcmQ6'); } else { const u = login.user; login = null; check(u, v); }
          continue;
        }
        const up = line.toUpperCase();
        if (up.startsWith('EHLO')) { w('250-sink.test'); w('250-AUTH PLAIN LOGIN'); w('250-8BITMIME'); w('250 SIZE 52428800'); }
        else if (up.startsWith('HELO')) w('250 sink.test');
        else if (up.startsWith('AUTH PLAIN')) {
          const b64 = line.split(' ')[2];
          if (!b64) { login = { step: 'plain' }; w('334 '); continue; }
          const [, u, p] = Buffer.from(b64, 'base64').toString().split('\0'); check(u, p);
        }
        else if (up.startsWith('AUTH LOGIN')) { login = { step: 'user' }; w('334 VXNlcm5hbWU6'); }
        else if (up.startsWith('MAIL FROM')) { if (!authed) { w('530 5.7.0 Authentication required'); continue; } env.from = line.slice(10).trim(); w('250 2.1.0 Ok'); }
        else if (up.startsWith('RCPT TO')) { env.rcpt.push(line.slice(8).trim().replace(/[<>]/g, '')); w('250 2.1.5 Ok'); }
        else if (up === 'DATA') { inData = true; w('354 End data with <CR><LF>.<CR><LF>'); }
        else if (up === 'RSET') { env = { from: '', rcpt: [] }; w('250 Ok'); }
        else if (up === 'NOOP') w('250 Ok');
        else if (up === 'QUIT') { w('221 Bye'); sock.end(); }
        else w('502 5.5.2 Error: command not recognized');
      }
    });
  });
  const stop = () => { for (const s of sockets) s.destroy(); server.close(); };
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res({ server, stop, port: server.address().port, messages })));
}
/** Decoded attachment parts of a raw MIME message: [{ type, name, bytes }]. */
function parts(raw) {
  const out = [];
  for (const m of raw.matchAll(/Content-Type: ([\w./+-]+);?[^\r\n]*(?:\r\n[ \t][^\r\n]*)*\r\n((?:[\w-]+:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*\r\n)*)\r\n([A-Za-z0-9+/=\r\n]+?)\r\n(?=--|$)/g)) {
    const headers = m[0];
    if (!/Content-Transfer-Encoding: base64/i.test(headers)) continue;
    const segs = [...headers.matchAll(/filename(?:\*(\d+))?(\*)?=(?:"([^"]*)"|([^;\r\n]*))/gi)];
    const name = segs.map((s) => { let v = s[3] ?? s[4] ?? ''; if (s[2]) { v = v.replace(/^utf-8''/i, ''); try { v = decodeURIComponent(v); } catch { /* keep */ } } return v; }).join('');
    out.push({ type: m[1], name, bytes: Buffer.from(m[3].replace(/\r\n/g, ''), 'base64') });
  }
  return out;
}

function client(ip) {
  let cookie = '';
  const req = async (p, { method = 'GET', body, form, raw } = {}) => {
    const headers = { 'x-forwarded-for': ip };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET') headers.origin = ORIGIN;
    const res = await fetch(BASE + p, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); cookie = pair.split('=')[1] ? pair : ''; }
    if (raw) return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()), text: '' };
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  return {
    req, get: (p) => req(p), post: (p, b = {}) => req(p, { method: 'POST', body: b }), put: (p, b) => req(p, { method: 'PUT', body: b }),
    patch: (p, b) => req(p, { method: 'PATCH', body: b }), del: (p) => req(p, { method: 'DELETE' }), raw: (p) => req(p, { raw: true }),
    upload: (entity, entityId, name, bytes) => { const fd = new FormData(); fd.set('entity', entity); fd.set('entity_id', String(entityId)); fd.set('file', new Blob([bytes]), name); return req('/api/crm/attachments', { method: 'POST', form: fd }); },
  };
}
async function signedIn(email, ip) {
  const c = client(ip);
  let r = await c.post('/api/crm/auth/login', { email, password: PW });
  assert.equal(r.json?.next, 'enroll', JSON.stringify(r.json));
  const e = await c.get('/api/crm/auth/enroll');
  r = await c.post('/api/crm/auth/enroll', { code: totp(base32Decode(e.json.secret.replace(/\s/g, ''))) });
  assert.equal(r.json?.next, 'done');
  return c;
}

let companyBackup = null, mailBackup, sink = null, backupStart = 0;
const RESTORE_DB = 'auvetric_crm_restore_test';
const restoreUrl = () => { const u = new URL(databaseUrl()); u.pathname = '/' + RESTORE_DB; return u.toString(); };

async function cleanup() {
  const users = (await sql`select id from users where email like ${'%@' + DOMAIN}`).map((u) => u.id);
  const cids = (await sql`select id from clients where name like 'ZZ Test %'`).map((c) => c.id);
  const lids = (await sql`select id from leads where title like 'ZZ Test %'`).map((l) => l.id);
  const files = await sql`select id, entity, entity_id, blob_key from attachments where uploaded_by in ${sql(users.length ? users : [0])}`;
  for (const f of files) rmSync(path.join(FILE_DIR, 'crm-files', ...f.blob_key.split('/')), { force: true });
  if (files.length) await sql`delete from attachments where id in ${sql(files.map((f) => f.id))}`;
  if (lids.length) { await sql`delete from activities where entity = 'lead' and entity_id in ${sql(lids)}`; await sql`delete from leads where id in ${sql(lids)}`; }
  if (users.length) {
    await sql`delete from time_entries where user_id in ${sql(users)}`;
    await sql`delete from expenses where created_by in ${sql(users)}`;
    await sql`delete from marketplace_earnings where created_by in ${sql(users)}`;
    await sql`delete from emails where sent_by in ${sql(users)}`;
  }
  if (cids.length) {
    const docs = (await sql`select id from documents where client_id in ${sql(cids)}`).map((d) => d.id);
    if (docs.length) {
      await sql`delete from payments where document_id in ${sql(docs)}`;
      await sql`delete from emails where document_id in ${sql(docs)}`;
      await sql`delete from activities where entity = 'document' and entity_id in ${sql(docs)}`;
      await sql`update documents set source_id = null where source_id in ${sql(docs)}`;
    }
    await sql`delete from emails where client_id in ${sql(cids)}`;
    await sql`delete from time_entries where client_id in ${sql(cids)}`;
    await sql`delete from expenses where client_id in ${sql(cids)}`;
    await sql`delete from documents where client_id in ${sql(cids)}`;
    const projects = (await sql`select id from projects where client_id in ${sql(cids)}`).map((p) => p.id);
    if (projects.length) await sql`delete from activities where entity = 'project' and entity_id in ${sql(projects)}`;
    await sql`delete from projects where client_id in ${sql(cids)}`;
    await sql`delete from activities where entity = 'client' and entity_id in ${sql(cids)}`;
    await sql`delete from contacts where client_id in ${sql(cids)}`;
    await sql`delete from clients where id in ${sql(cids)}`;
  }
  await sql`delete from services where name like 'ZZ Test %'`;
  if (backupStart) {
    const bs = await sql`delete from backups where id > ${backupStart} returning blob_key`;
    for (const b of bs) rmSync(path.join(FILE_DIR, 'crm-backups', ...b.blob_key.split('/')), { force: true });
  }
  if (users.length) { await sql`delete from audit_log where user_id in ${sql(users)}`; await sql`delete from activities where user_id in ${sql(users)}`; }
  await sql`delete from users where email like ${'%@' + DOMAIN}`;
  await sql`delete from login_attempts where email like ${'%@' + DOMAIN}`;
}

try {
  await cleanup();
  [companyBackup] = await sql`select id, name, data from companies where is_default`;
  mailBackup = (await sql`select value from settings where key = 'mail'`)[0]?.value ?? null;
  backupStart = Number((await sql`select coalesce(max(id), 0) as m from backups`)[0].m);
  await sql`update companies set data = data || ${sql.json({ invoicePrefix: 'ZI-INV-', quotePrefix: 'ZI-QUO-', nextInvoice: 1, nextQuote: 1, usdToNad: 18, bankName: 'Bank Windhoek', bankAccount: '8000123456', bankAccountName: 'Auvetric Data Solutions' })} where id = ${companyBackup.id}`;
  const hash = await hashPassword(PW);
  for (const [email, role] of [['iadmin@' + DOMAIN, 'admin'], ['imember@' + DOMAIN, 'member'], ['iread@' + DOMAIN, 'readonly']]) {
    await sql`insert into users (email, name, role, password_hash, must_change_password) values (${email}, ${'Test ' + role}, ${role}, ${hash}, false)`;
  }
  const admin = await signedIn('iadmin@' + DOMAIN, '10.97.0.1');
  const member = await signedIn('imember@' + DOMAIN, '10.97.0.2');
  const reader = await signedIn('iread@' + DOMAIN, '10.97.0.3');
  const [adminRow] = await sql`select id from users where email = ${'iadmin@' + DOMAIN}`;
  const [memberRow] = await sql`select id from users where email = ${'imember@' + DOMAIN}`;
  console.log(`CRM Phase 4 tests against ${BASE}`);

  // ── email settings ──
  const creds = { user: 'sink-user@auvetric.test', pass: 'Sink-Pass-0123456789' };
  sink = await smtpSink(creds);
  const mailBody = (extra = {}) => ({ host: '127.0.0.1', port: sink.port, security: 'none', user: creds.user, password: creds.pass, fromName: 'Auvetric Test', fromEmail: 'info@auvetric.test', replyTo: '', bccSender: true, templates: {}, ...extra });
  expect(await member.get('/api/crm/settings/mail'), 403, 'member reads mail settings');
  expect(await admin.put('/api/crm/settings/mail', mailBody({ host: 'smtp.example.com' })), 400, 'plain SMTP to a remote host');
  expect(await admin.put('/api/crm/settings/mail', mailBody({ fromEmail: 'nope' })), 400, 'bad sender');
  let r = await admin.put('/api/crm/settings/mail', mailBody());
  expect(r, 200, 'save mail settings');
  assert.equal(r.json.hasPassword, true); assert.equal(r.json.password, undefined); assert.equal(r.json.passwordSealed, undefined);
  const [stored] = await sql`select value from settings where key = 'mail'`;
  assert.match(stored.value.passwordSealed, /^v1\./); assert.ok(!JSON.stringify(stored.value).includes(creds.pass), 'password sealed at rest');
  r = await admin.put('/api/crm/settings/mail', { ...mailBody(), password: '' });
  assert.equal(r.json.hasPassword, true, 'blank password keeps the saved one');
  r = await admin.post('/api/crm/settings/mail/test', {});
  expect(r, 200, 'test email');
  assert.equal(sink.messages.length, 1); assert.deepEqual(sink.messages[0].rcpt.sort(), ['iadmin@' + DOMAIN, 'info@auvetric.test'].sort(), 'to + BCC sender');
  ok('mail settings: admin only, plain SMTP refused off-box, password sealed and write-only, test email authenticates and BCCs the sender');

  await admin.put('/api/crm/settings/mail', { ...mailBody(), password: 'wrong-password-123' });
  r = await admin.post('/api/crm/settings/mail/test', {});
  expect(r, 502, 'wrong SMTP password'); assert.match(r.json.error, /rejected the login/);
  const [failed] = await sql`select status, error from emails where kind = 'test' order by id desc limit 1`;
  assert.equal(failed.status, 'failed');
  await admin.put('/api/crm/settings/mail', mailBody());
  ok('SMTP login failure explained to the user and logged as failed');

  // ── documents: PDF + email ──
  const cl = (await member.post('/api/crm/clients', { name: 'ZZ Test Ōshikoto Mining → Ltd ✓', currency: 'NAD', email: 'accounts@oshikoto.test', address: 'Plot 7\nTsumeb' })).json;
  await member.post(`/api/crm/clients/${cl.id}/contacts`, { name: 'Maria Nghipandulwa', role: 'Finance', email: 'maria@oshikoto.test', is_primary: true });
  const lines = Array.from({ length: 70 }, (_, i) => ({ item: `Work package ${i + 1}`, description: i % 3 ? '' : 'Telemetry, dashboards and “alarm” rules – phase 2 → 3', qty: 1, rate: 100 }));
  const inv = (await member.post('/api/crm/documents', { type: 'invoice', client_id: cl.id, date: today, due_date: today, data: { remarks: 'Long PDF test', lines } })).json;
  r = await member.raw(`/api/crm/documents/${inv.id}/pdf`);
  expect(r, 200, 'pdf'); assert.equal(r.headers.get('content-type'), 'application/pdf'); assert.match(r.headers.get('content-disposition'), /^attachment;/);
  let pdf = await PDFDocument.load(r.bytes);
  assert.ok(pdf.getPageCount() >= 2, `70 lines span pages (got ${pdf.getPageCount()})`);
  assert.equal(pdf.getTitle(), `INVOICE ${inv.number}`);
  ok(`invoice PDF: valid, ${pdf.getPageCount()} pages for 70 lines, non-Latin text handled, served as a download`);

  const attPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 32)]);
  r = await member.upload('document', inv.id, 'Signed PO.pdf', attPdf);
  expect(r, 200, 'upload to document');
  const poId = r.json.id;
  r = await member.get(`/api/crm/documents/${inv.id}/email`);
  expect(r, 200, 'email draft');
  assert.equal(r.json.configured, true); assert.equal(r.json.to.length, 1, 'one default recipient (the address on the document)');
  for (const e of ['accounts@oshikoto.test', 'maria@oshikoto.test']) assert.ok(r.json.options.some((o) => o.email === e), `${e} offered`);
  assert.match(r.json.subject, new RegExp(inv.number)); assert.match(r.json.body, /Maria Nghipandulwa/); assert.equal(r.json.warning, null);
  assert.equal(r.json.attachments.length, 1);
  expect(await reader.post(`/api/crm/documents/${inv.id}/email`, { to: ['x@y.test'], subject: 's', body: 'b' }), 403, 'read-only sends');
  expect(await member.post(`/api/crm/documents/${inv.id}/email`, { to: ['not-an-email'], subject: 's', body: 'b' }), 400, 'bad recipient');
  const before = sink.messages.length;
  r = await member.post(`/api/crm/documents/${inv.id}/email`, { to: ['accounts@oshikoto.test'], cc: ['maria@oshikoto.test'], subject: r.json.subject, body: r.json.body, attachment_ids: [poId], mark_sent: true });
  expect(r, 200, 'send invoice'); assert.equal(r.json.status, 'sent', 'draft marked sent');
  const msg = sink.messages[before];
  assert.ok(msg.rcpt.includes('accounts@oshikoto.test') && msg.rcpt.includes('maria@oshikoto.test'));
  const ps = parts(msg.data);
  const mailedPdf = ps.find((p) => p.type === 'application/pdf' && p.name.startsWith(inv.number));
  assert.ok(mailedPdf, 'invoice PDF attached'); assert.equal(mailedPdf.bytes.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await PDFDocument.load(mailedPdf.bytes)).getPageCount(), pdf.getPageCount());
  assert.ok(ps.some((p) => p.name === 'Signed PO.pdf' && p.bytes.equals(attPdf)), 'document attachment included byte-for-byte');
  const [sent] = await sql`select status, to_addrs, attachments, message_id from emails where document_id = ${inv.id} order by id desc limit 1`;
  assert.equal(sent.status, 'sent'); assert.equal(sent.attachments.length, 2); assert.ok(sent.message_id);
  const acts = await sql`select body from activities where entity = 'client' and entity_id = ${cl.id} and body like '%emailed%'`;
  assert.equal(acts.length, 1);
  ok('email invoice: recipients from client + contacts, template filled, PDF + chosen file attached, draft marked sent, logged and on the timeline');

  // statement
  r = await member.raw(`/api/crm/clients/${cl.id}/statement/pdf?from=${today.slice(0, 4)}-01-01&to=${today}`);
  expect(r, 200, 'statement pdf');
  pdf = await PDFDocument.load(r.bytes);
  assert.match(pdf.getTitle(), /^Statement ZZ Test/);
  r = await member.get(`/api/crm/clients/${cl.id}/statement/email`);
  assert.match(r.json.body, /N\$\s?7,000\.00/, 'balance in the message');
  r = await member.post(`/api/crm/clients/${cl.id}/statement/email`, { to: ['accounts@oshikoto.test'], subject: r.json.subject, body: r.json.body, from_date: r.json.from_date, to_date: r.json.to_date });
  expect(r, 200, 'send statement');
  assert.ok(parts(sink.messages.at(-1).data).some((p) => p.type === 'application/pdf' && p.name.startsWith('Statement ZZ Test')));
  expect(await member.post('/api/crm/payments', { document_id: inv.id, date: today, amount: 1000 }), 200, 'same-day payment');
  r = await member.get(`/api/crm/clients/${cl.id}/statement`);
  const sl = r.json.sections[0].lines.filter((l) => l.date === today);
  assert.deepEqual(sl.map((l) => l.kind), ['invoice', 'payment'], 'same day: invoice before its payment');
  assert.ok(r.json.sections[0].lines.every((l) => l.balance >= 0), 'running balance never dips below zero');
  ok('statement: PDF download and email with the PDF attached; same-day invoice listed before its payment');

  await sql`update companies set data = data || ${sql.json({ bankAccount: '[to be confirmed]' })} where id = ${companyBackup.id}`;
  r = await member.get(`/api/crm/documents/${inv.id}/email`);
  assert.match(r.json.warning, /to be confirmed/);
  await sql`update companies set data = data || ${sql.json({ bankAccount: '8000123456' })} where id = ${companyBackup.id}`;
  ok('placeholder banking details trigger a warning before sending an invoice');

  // ── attachments ──
  r = await member.upload('client', cl.id, 'evil.exe', Buffer.from('MZ'));
  expect(r, 415, 'exe');
  r = await member.upload('client', cl.id, 'fake.pdf', Buffer.from('hello'));
  expect(r, 415, 'pdf magic');
  r = await member.upload('client', cl.id, 'big.csv', Buffer.alloc(4 * 1024 * 1024 + 10, 65));
  expect(r, 413, 'too big');
  r = await reader.upload('client', cl.id, 'notes.txt', Buffer.from('hi'));
  expect(r, 403, 'read-only upload');
  r = await member.upload('client', '999999999', 'notes.txt', Buffer.from('hi'));
  expect(r, 404, 'missing record');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
  r = await member.upload('client', cl.id, 'site <photo>.png', png);
  expect(r, 200, 'png');
  const pngId = r.json.id; assert.equal(r.json.content_type, 'image/png');
  r = await member.raw(`/api/crm/attachments/${pngId}/download`);
  assert.ok(r.bytes.equals(png)); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('content-security-policy'), /sandbox/);
  r = await member.raw(`/api/crm/attachments/${pngId}/download?inline=1`);
  assert.match(r.headers.get('content-disposition'), /^inline;/);
  r = await member.get(`/api/crm/attachments?entity=client&id=${cl.id}`);
  assert.equal(r.json.length, 1);
  const tmp = (await member.post('/api/crm/clients', { name: 'ZZ Test Throwaway' })).json;
  r = await member.upload('client', tmp.id, 'nda.txt', Buffer.from('NDA'));
  const [tmpRow] = await sql`select blob_key from attachments where id = ${r.json.id}`;
  const tmpFile = path.join(FILE_DIR, 'crm-files', ...tmpRow.blob_key.split('/'));
  assert.ok(existsSync(tmpFile));
  expect(await member.del(`/api/crm/clients/${tmp.id}`), 200, 'delete client');
  assert.equal((await sql`select count(*)::int as n from attachments where entity = 'client' and entity_id = ${tmp.id}`)[0].n, 0);
  assert.ok(!existsSync(tmpFile), 'file removed with its client');
  expect(await member.del(`/api/crm/attachments/${pngId}`), 200, 'delete attachment');
  ok('attachments: type allow-list + content check, 4 MB cap, read-only refused, safe download headers, removed with their record');

  // ── reports reconciliation (fixture year 2019, measured as a delta) ──
  const Y = '2019';
  const rep = async (from, to) => (await member.get(`/api/crm/reports?from=${from}&to=${to}`)).json;
  const r0 = await rep(`${Y}-01-01`, `${Y}-12-31`);
  const svc = (await admin.post('/api/crm/services', { practice: 'data', name: 'ZZ Test BI dashboard', rate: 100 })).json;
  const proj = (await member.post('/api/crm/projects', { title: 'ZZ Test Telemetry', client_id: cl.id, practice: 'engineering', lead_user_id: String(adminRow.id), data: { description: '', checklist: [], milestones: [], tags: [] } })).json;
  const A = (await member.post('/api/crm/documents', { type: 'invoice', client_id: cl.id, project_id: proj.id, date: `${Y}-03-10`, due_date: `${Y}-04-10`,
    data: { lines: [{ item: 'BI', qty: 10, rate: 100, service_id: svc.id }, { item: 'Site work', qty: 2, rate: 250 }], discount: 150 } })).json;
  assert.equal(A.total, 1350);
  const usdCl = (await member.post('/api/crm/clients', { name: 'ZZ Test USD Client', currency: 'USD' })).json;
  const B = (await member.post('/api/crm/documents', { type: 'invoice', client_id: usdCl.id, currency: 'USD', fx_rate: 18, date: `${Y}-04-05`, due_date: `${Y}-05-05`, data: { lines: [{ item: 'Dev', qty: 1, rate: 100 }] } })).json;
  const C = (await member.post('/api/crm/documents', { type: 'invoice', client_id: cl.id, date: `${Y}-05-01`, due_date: `${Y}-05-30`, data: { lines: [{ item: 'Draft', qty: 1, rate: 999 }] } })).json;
  const D = (await member.post('/api/crm/documents', { type: 'invoice', client_id: cl.id, date: `${Y}-05-02`, due_date: `${Y}-05-30`, data: { lines: [{ item: 'Cancelled', qty: 1, rate: 777 }] } })).json;
  for (const d of [A, B, D]) await member.patch(`/api/crm/documents/${d.id}/status`, { status: 'sent' });
  await member.patch(`/api/crm/documents/${D.id}/status`, { status: 'cancelled' });
  void C;
  expect(await member.post('/api/crm/payments', { document_id: A.id, date: `${Y}-03-20`, amount: 1000 }), 200, 'payment A');
  expect(await member.post('/api/crm/payments', { document_id: B.id, date: `${Y}-05-01`, amount: 50 }), 200, 'payment B');
  expect(await member.post('/api/crm/marketplace', { platform: 'upwork', date: `${Y}-06-01`, client_name: 'Acme', gross: 200, fee: 20, currency: 'USD', fx_rate: 18 }), 200, 'earning');
  expect(await member.post('/api/crm/expenses', { date: `${Y}-06-15`, supplier: 'Host', category: 'hosting', amount: 230, vat_amount: 30, currency: 'NAD' }), 200, 'expense 1');
  expect(await member.post('/api/crm/expenses', { date: `${Y}-06-20`, supplier: 'SaaS', category: 'software', amount: 10, currency: 'USD', fx_rate: 18 }), 200, 'expense 2');
  expect(await member.post('/api/crm/time', { date: `${Y}-03-11`, project_id: proj.id, minutes: 120, billable: true, rate: 500 }), 200, 'time 1');
  expect(await member.post('/api/crm/time', { date: `${Y}-03-12`, project_id: proj.id, minutes: 60, billable: false }), 200, 'time 2');
  for (const [title, stage, value] of [['ZZ Test Won', 'won', 5000], ['ZZ Test Lost', 'lost', 3000]]) {
    const l = (await member.post('/api/crm/leads', { title, stage, value, currency: 'NAD', source: 'referral' })).json;
    await sql`update leads set closed_at = ${`${Y}-07-01T10:00:00Z`} where id = ${l.id}`;
  }
  const r1 = await rep(`${Y}-01-01`, `${Y}-12-31`);
  const dv = (f) => f(r1) - f(r0);
  close(dv((x) => x.revenue.invoiced_nad), 1350 + 1800, 'invoiced excl. drafts/cancelled, USD at its own rate');
  close(dv((x) => x.revenue.received_nad), 1000 + 900, 'received');
  close(dv((x) => x.revenue.marketplace_nad), 180 * 18, 'platform net');
  close(dv((x) => x.revenue.expenses_nad), 230 + 180, 'expenses');
  const pr = (x, k) => x.revenue.by_practice.find((p) => p.practice === k)?.nad ?? 0;
  close(pr(r1, 'data') - pr(r0, 'data'), 900, 'service practice share (1000/1500 of 1350)');
  close(pr(r1, 'engineering') - pr(r0, 'engineering'), 450, 'project practice for lines without a service');
  close(pr(r1, 'unassigned') - pr(r0, 'unassigned'), 1800, 'no service, no project');
  const pa = (x, id) => x.revenue.by_partner.find((p) => p.user_id === String(id))?.nad ?? 0;
  close(pa(r1, adminRow.id), 1350, 'project lead gets the project invoice'); close(pa(r1, memberRow.id), 1800, 'creator gets the rest');
  const mo = (x, m, k) => x.revenue.monthly.find((v) => v.month === `${Y}-${m}`)[k];
  close(mo(r1, '03', 'invoiced') - mo(r0, '03', 'invoiced'), 1350, 'March'); close(mo(r1, '04', 'invoiced') - mo(r0, '04', 'invoiced'), 1800, 'April');
  close(mo(r1, '05', 'received') - mo(r0, '05', 'received'), 900, 'May received'); close(mo(r1, '06', 'net_cash') - mo(r0, '06', 'net_cash'), 3240 - 410, 'June net cash');
  const vin = (x) => x.vat.monthly.find((v) => v.month === `${Y}-06`).input;
  close(vin(r1) - vin(r0), 30, 'input VAT');
  const hu = r1.hours.by_user.find((u) => u.user_id === String(memberRow.id));
  assert.deepEqual([hu.total_min, hu.billable_min, hu.unbilled_min, hu.capacity_min], [180, 120, 120, 261 * 8 * 60]);
  assert.equal(r1.hours.weekdays, 261);
  const wr = (x) => x.sales.win_rate.find((w) => w.source === 'referral') ?? { won: 0, lost: 0, won_value_nad: 0 };
  assert.equal(wr(r1).won - wr(r0).won, 1); assert.equal(wr(r1).lost - wr(r0).lost, 1); close(wr(r1).won_value_nad - wr(r0).won_value_nad, 5000, 'won value');
  ok('reports fixture: revenue excl. drafts/cancelled, USD conversion, practice/partner allocation, months, cash, VAT, hours/capacity, win rate');

  // invariants + independent SQL on the current year (whatever data exists)
  const rc = await rep(`${today.slice(0, 4)}-01-01`, today);
  for (const x of [r1, rc]) {
    const inv = x.revenue.invoiced_nad, tol = 0.01 * (x.revenue.invoice_count + 2);
    close(x.revenue.by_practice.reduce((a, p) => a + p.nad, 0), inv, 'practice sums to invoiced', tol);
    close(x.revenue.by_partner.reduce((a, p) => a + p.nad, 0), inv, 'partners sum to invoiced', tol);
    close(x.revenue.by_client.reduce((a, p) => a + p.invoiced, 0), inv, 'clients sum to invoiced', tol);
    close(x.revenue.monthly.reduce((a, p) => a + p.invoiced, 0), inv, 'months sum to invoiced', tol);
    close(x.revenue.monthly.reduce((a, p) => a + p.received, 0), x.revenue.received_nad, 'months sum to received', tol);
    close(x.sales.pipeline.reduce((a, p) => a + p.value_nad, 0), x.sales.open_value_nad, 'pipeline stages sum', tol);
  }
  const [raw] = await sql`select
      coalesce(sum((total - vat) * case when currency = 'NAD' then 1 else fx_rate end), 0) as inv
      from documents where type = 'invoice' and status in ('sent','paid','overdue') and date between ${today.slice(0, 4) + '-01-01'} and ${today}`;
  const [rawPay] = await sql`select coalesce(sum(p.amount * case when d.currency = 'NAD' then 1 else d.fx_rate end), 0) as rec
      from payments p join documents d on d.id = p.document_id where d.status <> 'cancelled' and p.date between ${today.slice(0, 4) + '-01-01'} and ${today}`;
  close(rc.revenue.invoiced_nad, Number(raw.inv), 'invoiced = raw SQL', 0.05); close(rc.revenue.received_nad, Number(rawPay.rec), 'received = raw SQL', 0.05);
  const [rawDebt] = await sql`select coalesce(sum((total - amount_paid) * case when currency = 'NAD' then 1 else fx_rate end), 0) as d from documents where type = 'invoice' and status in ('sent','overdue')`;
  close(rc.debtors.total_nad, Number(rawDebt.d), 'debtors = raw SQL', 0.05);
  expect(await member.get('/api/crm/reports?from=2026-05-01&to=2026-01-01'), 400, 'inverted period');
  expect(await member.patch(`/api/crm/users/${memberRow.id}/capacity`, { weekly_hours: 30 }), 403, 'member sets capacity');
  expect(await admin.patch(`/api/crm/users/${memberRow.id}/capacity`, { weekly_hours: 30 }), 200, 'admin sets capacity');
  assert.equal((await rep(`${Y}-01-01`, `${Y}-12-31`)).hours.by_user.find((u) => u.user_id === String(memberRow.id)).capacity_min, 261 * 6 * 60);
  ok('report breakdowns each sum to their headline; invoiced, received and debtors reconcile with raw SQL; capacity editable by admins');

  // ── audit log ──
  expect(await member.get('/api/crm/audit'), 403, 'member audit');
  r = await admin.get(`/api/crm/audit?action=email.&user=${memberRow.id}`);
  assert.ok(r.json.rows.length >= 2 && r.json.rows.every((x) => x.action.startsWith('email.')), 'filter by area and user');
  r = await admin.get('/api/crm/audit?limit=2');
  assert.equal(r.json.rows.length, 2); assert.equal(r.json.more, true);
  const r2 = await admin.get(`/api/crm/audit?limit=2&before=${r.json.rows[1].id}`);
  assert.ok(Number(r2.json.rows[0].id) < Number(r.json.rows[1].id), 'pages backwards');
  r = await admin.get(`/api/crm/audit?entity=document&entity_id=${A.id}`);
  assert.ok(r.json.rows.some((x) => x.action === 'payment.create' || x.action.startsWith('invoice.')), JSON.stringify(r.json.rows.map((x) => x.action)));
  r = await admin.get('/api/crm/audit/facets');
  assert.ok(r.json.actions.some((a) => a.prefix === 'auth'));
  for (const p of ['/crm/reports', '/crm/audit', '/crm/settings']) expect(await admin.req(p), 200, p);
  r = await member.req('/crm/audit');
  assert.match(r.text, /Only admins can view the audit log/);
  ok('audit log: admins only, filters (area, user, record), keyset paging, pages render');

  // ── backups + restore ──
  expect(await member.post('/api/crm/backups', {}), 403, 'member backup');
  r = await admin.post('/api/crm/backups', {});
  expect(r, 200, 'manual backup');
  const manual = r.json;
  assert.ok(manual.size > 0 && manual.counts.clients >= 2);
  const secret = process.env.CRM_CRON_SECRET;
  assert.ok(secret, 'CRM_CRON_SECRET must be set for the test (same value as the server)');
  let cr = await fetch(`${BASE}/api/crm/cron`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
  const cron = await cr.json();
  assert.equal(cr.status, 200, JSON.stringify(cron)); assert.ok(cron.backup?.id, `nightly backup: ${JSON.stringify(cron.backup)}`);
  r = await admin.get('/api/crm/backups');
  assert.equal(r.json.storage, 'folder'); assert.ok(r.json.backups.some((b) => b.kind === 'nightly' && String(b.id) === cron.backup.id));
  r = await admin.raw(`/api/crm/backups/${manual.id}/download`);
  expect(r, 200, 'download backup'); assert.equal(r.headers.get('content-type'), 'application/gzip');
  const exp = JSON.parse(gunzipSync(r.bytes).toString());
  assert.equal(exp.schema, 'auvetric-crm/4');
  assert.ok(!JSON.stringify(exp.users).includes('password_hash') && !JSON.stringify(exp.settings).includes('passwordSealed'), 'no secrets in backups');
  assert.ok(exp.clients.some((c) => c.id === cl.id) && exp.attachments.some((a) => a.id === poId) && exp.emails.length > 0);
  ok('backups: admin-only manual backup, nightly backup from the daily job, gzip download without secrets');

  mkdirSync(FILE_DIR, { recursive: true });
  const file = path.join(FILE_DIR, 'restore-test.json.gz');
  writeFileSync(file, r.bytes);
  await sql.unsafe(`drop database if exists ${RESTORE_DB} with (force)`);
  await sql.unsafe(`create database ${RESTORE_DB}`);
  const env = { ...process.env, MIGRATE_DATABASE_URL: restoreUrl() };
  const node = (script, args = []) => spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args], { env, encoding: 'utf8' });
  let p = node('scripts/crm/migrate.mjs');
  assert.equal(p.status, 0, p.stderr + p.stdout);
  p = node('scripts/crm/restore.mjs', [file]);
  assert.equal(p.status, 0, `restore: ${p.stderr}\n${p.stdout}`);
  const rdb = postgres(restoreUrl(), { max: 1, onnotice: () => {}, prepare: false, ssl: false });
  try {
    for (const t of Object.keys(exp).filter((k) => Array.isArray(exp[k]))) {
      const [{ n }] = await rdb`select count(*)::int as n from ${rdb(t)}`;
      assert.equal(n, exp[t].length + (t === 'audit_log' ? 1 : 0), `${t} row count`);
    }
    const [{ s }] = await rdb`select coalesce(sum(total), 0)::numeric as s from documents`;
    close(Number(s), exp.documents.reduce((a, d) => a + Number(d.total), 0), 'document totals');
    const [{ s: pays }] = await rdb`select coalesce(sum(amount), 0)::numeric as s from payments`;
    close(Number(pays), exp.payments.reduce((a, d) => a + Number(d.amount), 0), 'payment totals');
    const [proj2] = await rdb`select quote_id, lead_user_id from projects where id = ${proj.id}`;
    assert.equal(String(proj2.lead_user_id), String(adminRow.id), 'deferred FK restored');
    const [u] = await rdb`select must_change_password, totp_enabled, password_hash from users where id = ${adminRow.id}`;
    assert.equal(u.must_change_password, true); assert.equal(u.totp_enabled, false); assert.match(u.password_hash, /^!restored/);
    const [nextId] = await rdb`insert into clients (name) values ('ZZ Test after restore') returning id`;
    assert.ok(Number(nextId.id) > Math.max(...exp.clients.map((c) => Number(c.id))), 'sequences moved past restored ids');
  } finally { await rdb.end({ timeout: 5 }); }
  p = node('scripts/crm/restore.mjs', [file]);
  assert.equal(p.status, 2, 'refuses a non-empty target without --wipe'); assert.match(p.stderr, /--wipe --yes/);
  p = node('scripts/crm/restore.mjs', [file, '--wipe', '--yes']);
  assert.equal(p.status, 0, p.stderr);
  await sql.unsafe(`drop database if exists ${RESTORE_DB} with (force)`);
  rmSync(file, { force: true });
  ok('restore: into a freshly migrated database, every table and money total matches, circular links and sequences fixed, users must reset, refuses to overwrite without --wipe --yes');

  console.log(`\nCRM Phase 4: ${passed} checks passed.`);
} catch (e) {
  console.error('\nFAILED:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  sink?.stop();
  if (companyBackup) await sql`update companies set data = ${sql.json(companyBackup.data)} where id = ${companyBackup.id}`.catch(() => {});
  if (mailBackup !== undefined) {
    if (mailBackup) await sql`update settings set value = ${sql.json(mailBackup)} where key = 'mail'`.catch(() => {});
    else await sql`delete from settings where key = 'mail'`.catch(() => {});
  }
  await sql.unsafe(`drop database if exists ${RESTORE_DB} with (force)`).catch(() => {});
  await cleanup().catch((e) => console.error('cleanup:', e.message));
  await sql.end({ timeout: 5 });
}
