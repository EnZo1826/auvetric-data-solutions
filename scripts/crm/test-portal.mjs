// End-to-end Phase 5 tests: client portal sign-in links, access control, quote acceptance, payment notices.
//   CRM_TEST_URL=http://localhost:3100 npm run crm:test:portal
// Test data: users *@crm-test.invalid, clients "ZZ Test …", portal addresses *@portal-test.invalid; mail settings restored afterwards.
import assert from 'node:assert/strict';
import net from 'node:net';
import { PDFDocument } from 'pdf-lib';
import { hashPassword } from '../../src/crm/server/password.ts';
import { base32Decode, totp } from '../../src/crm/server/totp.ts';
import { connect, isHostedDb } from './env.mjs';

const BASE = (process.env.CRM_TEST_URL || 'http://localhost:3100').replace(/\/$/, '');
if (/auvetric\.com|netlify\.app/.test(BASE) || isHostedDb()) { console.error('Refusing to run against production.'); process.exit(2); }
const ORIGIN = new URL(BASE).origin;
const sql = connect();
const DOMAIN = 'crm-test.invalid', PDOM = 'portal-test.invalid';
const PW = 'Portal-Test-Pass-Phrase-2026';
let passed = 0;
const ok = (l) => { passed++; console.log(`  ✓ ${l}`); };
const expect = (r, status, label) => assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${String(r.text).slice(0, 300)}`);
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function smtpSink(creds) {
  const messages = [], sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock); sock.on('close', () => sockets.delete(sock)); sock.on('error', () => {});
    let buf = '', inData = false, data = '', authed = false, env = { rcpt: [] };
    const w = (s) => sock.write(s + '\r\n');
    w('220 sink ESMTP');
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; messages.push({ ...env, data }); env = { rcpt: [] }; data = ''; w('250 Ok'); } else data += (line.startsWith('..') ? line.slice(1) : line) + '\r\n'; continue; }
        const up = line.toUpperCase();
        if (up.startsWith('EHLO')) { w('250-sink'); w('250 AUTH PLAIN'); }
        else if (up.startsWith('AUTH PLAIN')) { const [, u, p] = Buffer.from(line.split(' ')[2] ?? '', 'base64').toString().split('\0'); authed = u === creds.user && p === creds.pass; w(authed ? '235 Ok' : '535 Bad'); }
        else if (up.startsWith('MAIL FROM')) w(authed ? '250 Ok' : '530 Auth');
        else if (up.startsWith('RCPT TO')) { env.rcpt.push(line.slice(8).trim().replace(/[<>]/g, '').toLowerCase()); w('250 Ok'); }
        else if (up === 'DATA') { inData = true; w('354 Go'); }
        else if (up === 'QUIT') { w('221 Bye'); sock.end(); }
        else w('250 Ok');
      }
    });
  });
  const stop = () => { for (const s of sockets) s.destroy(); server.close(); };
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res({ stop, port: server.address().port, messages })));
}
/** Text of a raw message: quoted-printable and base64 text parts decoded, enough to find links. */
function plain(raw) {
  let out = raw.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  for (const m of raw.matchAll(/Content-Transfer-Encoding: base64\r\n(?:[^\r\n]+\r\n)*\r\n([A-Za-z0-9+/=\r\n]+)/gi)) out += '\n' + Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  return out;
}
const linkIn = (raw) => plain(raw).match(/\/portal\/verify\?t=([\w-]+)/)?.[1];
async function waitMail(sink, to, n = 1) {
  for (let i = 0; i < 50; i++) { const m = sink.messages.filter((x) => x.rcpt.includes(to)); if (m.length >= n) return m[n - 1]; await sleep(100); }
  throw new Error(`no email to ${to}`);
}

function client(ip, cookieName) {
  let cookie = '';
  const req = async (p, { method = 'GET', body, form, raw, origin = true } = {}) => {
    const headers = { 'x-forwarded-for': ip };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET' && origin) headers.origin = ORIGIN;
    const res = await fetch(BASE + p, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); if (!cookieName || pair.includes(cookieName)) cookie = pair.split('=')[1] ? pair : ''; }
    if (raw) return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()), text: '' };
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  return { req, get: (p) => req(p), post: (p, b = {}) => req(p, { method: 'POST', body: b }), put: (p, b) => req(p, { method: 'PUT', body: b }),
    patch: (p, b) => req(p, { method: 'PATCH', body: b }), raw: (p) => req(p, { raw: true }), cookie: () => cookie };
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

let mailBackup, sink = null;
async function cleanup() {
  const users = (await sql`select id from users where email like ${'%@' + DOMAIN}`).map((u) => u.id);
  const cids = (await sql`select id from clients where name like 'ZZ Test %'`).map((c) => c.id);
  await sql`delete from portal_tokens where email like ${'%@' + PDOM}`;
  await sql`delete from portal_sessions where email like ${'%@' + PDOM}`;
  if (cids.length) {
    const docs = (await sql`select id from documents where client_id in ${sql(cids)}`).map((d) => d.id);
    if (docs.length) {
      await sql`delete from payment_notices where document_id in ${sql(docs)}`;
      await sql`delete from attachments where entity = 'document' and entity_id in ${sql(docs)}`;
      await sql`delete from payments where document_id in ${sql(docs)}`;
      await sql`delete from emails where document_id in ${sql(docs)}`;
      await sql`delete from activities where entity = 'document' and entity_id in ${sql(docs)}`;
    }
    await sql`delete from portal_events where client_id in ${sql(cids)}`;
    await sql`delete from documents where client_id in ${sql(cids)}`;
    await sql`delete from activities where entity = 'client' and entity_id in ${sql(cids)}`;
    await sql`delete from contacts where client_id in ${sql(cids)}`;
    await sql`delete from clients where id in ${sql(cids)}`;
  }
  await sql`delete from portal_events where email like ${'%@' + PDOM}`;
  if (users.length) { await sql`delete from audit_log where user_id in ${sql(users)}`; await sql`delete from activities where user_id in ${sql(users)}`; await sql`delete from emails where sent_by in ${sql(users)}`; }
  await sql`delete from audit_log where user_id is null and action like 'portal.%' and detail::text like ${'%' + PDOM + '%'}`;
  await sql`delete from users where email like ${'%@' + DOMAIN}`;
  await sql`delete from login_attempts where email like ${'%@' + DOMAIN}`;
}

try {
  await cleanup();
  mailBackup = (await sql`select value from settings where key = 'mail'`)[0]?.value ?? null;
  const hash = await hashPassword(PW);
  for (const [email, role] of [['padmin@' + DOMAIN, 'admin'], ['pmember@' + DOMAIN, 'member'], ['pread@' + DOMAIN, 'readonly']]) {
    await sql`insert into users (email, name, role, password_hash, must_change_password) values (${email}, ${'Test ' + role}, ${role}, ${hash}, false)`;
  }
  // Other (real) users in the local DB would also get partner notifications; keep them out of the assertions.
  const admin = await signedIn('padmin@' + DOMAIN, '10.99.0.1');
  const member = await signedIn('pmember@' + DOMAIN, '10.99.0.2');
  const reader = await signedIn('pread@' + DOMAIN, '10.99.0.3');
  console.log(`CRM Phase 5 (portal) tests against ${BASE}`);

  const creds = { user: 'sink@auvetric.test', pass: 'Sink-Pass-0123456789' };
  sink = await smtpSink(creds);
  expect(await admin.put('/api/crm/settings/mail', { host: '127.0.0.1', port: sink.port, security: 'none', user: creds.user, password: creds.pass, fromName: 'Auvetric', fromEmail: 'info@auvetric.test', replyTo: '', bccSender: true, templates: {} }), 200, 'mail settings');

  const ACC = `accounts@${PDOM}`, MARIA = `maria@${PDOM}`;
  const cl = (await member.post('/api/crm/clients', { name: 'ZZ Test Portal Client', email: ACC, currency: 'NAD' })).json;
  await member.post(`/api/crm/clients/${cl.id}/contacts`, { name: 'Maria Shikongo', role: 'Finance', email: MARIA.toUpperCase(), is_primary: true });
  const other = (await member.post('/api/crm/clients', { name: 'ZZ Test Other Client', email: `other@${PDOM}` })).json;
  const mk = async (c, type, extra = {}, status) => {
    const d = (await member.post('/api/crm/documents', { type, client_id: c.id, date: today, due_date: addDays(today, 14), data: { remarks: `${type} ${status ?? 'draft'}`, lines: [{ item: 'Work', qty: 1, rate: 1000 }], notes: 'INTERNAL-SECRET-NOTE' }, ...extra })).json;
    if (status) for (const s of status.split('>')) expect(await member.patch(`/api/crm/documents/${d.id}/status`, { status: s }), 200, `status ${s}`);
    return d;
  };
  const invSent = await mk(cl, 'invoice', {}, 'sent');
  const invDraft = await mk(cl, 'invoice');
  const invCancelled = await mk(cl, 'invoice', {}, 'sent>cancelled');
  const qSent = await mk(cl, 'quote', {}, 'sent');
  const qDecline = await mk(cl, 'quote', {}, 'sent');
  const qExpired = await mk(cl, 'quote', { date: addDays(today, -40), due_date: addDays(today, -10) }, 'sent');
  const qDraft = await mk(cl, 'quote');
  const otherInv = await mk(other, 'invoice', {}, 'sent');

  // ── access control on sign-in ──
  const pc = client('10.99.1.1', 'auv_portal');
  const portalCookie = () => pc.cookie();
  let r = await pc.post('/api/portal/login', { email: ACC });
  expect(r, 200, 'login while portal off'); await sleep(300);
  assert.equal(sink.messages.filter((m) => m.rcpt.includes(ACC)).length, 0, 'no link while the portal is off');
  r = await pc.post('/api/portal/login', { email: `nobody@${PDOM}` });
  expect(r, 200, 'unknown address gets the same answer');
  expect(await pc.req('/api/portal/login', { method: 'POST', body: { email: ACC }, origin: false }), 403, 'cross-site login');
  expect(await pc.post('/api/portal/login', { email: 'not-an-email' }), 400, 'bad email');
  ok('sign-in requests: same response for unknown/disabled addresses, no email sent, cross-site refused');

  expect(await reader.patch(`/api/crm/clients/${cl.id}/portal`, { enabled: true }), 403, 'read-only enables');
  expect(await member.post(`/api/crm/clients/${cl.id}/portal/invite`, { email: ACC }), 409, 'invite while off');
  expect(await member.patch(`/api/crm/clients/${cl.id}/portal`, { enabled: true }), 200, 'enable');
  r = await member.get(`/api/crm/clients/${cl.id}/portal`);
  assert.equal(r.json.enabled, true); assert.deepEqual(r.json.people.map((p) => p.email).sort(), [ACC, MARIA].sort(), 'client email + contact (lower-cased)');
  expect(await member.post(`/api/crm/clients/${cl.id}/portal/invite`, { email: `stranger@${PDOM}` }), 400, 'invite a stranger');
  expect(await member.post(`/api/crm/clients/${cl.id}/portal/invite`, { email: MARIA }), 200, 'invite');
  const inv = plain((await waitMail(sink, MARIA)).data);
  assert.match(inv, /\/portal\/login\?email=maria%40portal-test\.invalid/);
  ok('partners switch the portal on per client and invite the client email or a contact (members can, read-only cannot)');

  // ── sign-in link ──
  r = await pc.post('/api/portal/login', { email: MARIA.toUpperCase() });
  expect(r, 200, 'login');
  const loginMail = await waitMail(sink, MARIA, 2);
  const token = linkIn(loginMail.data);
  assert.ok(token, `link in the email:\n${loginMail.data.slice(0, 1500)}`); assert.ok(!sink.messages.at(-1).rcpt.includes('info@auvetric.test'), 'sign-in links are not BCC-copied');
  r = await pc.get(`/portal/verify?t=${token}`);
  expect(r, 200, 'verify page'); assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal((await sql`select used_at from portal_tokens where token_hash = encode(sha256(${token}::bytea), 'hex')`)[0].used_at, null, 'opening the page does not use the link');
  expect(await pc.req('/api/portal/verify', { method: 'POST', body: { token }, origin: false }), 403, 'cross-site verify');
  r = await pc.post('/api/portal/verify', { token });
  expect(r, 200, 'verify'); assert.ok(portalCookie().includes('auv_portal='), 'session cookie set');
  const pc2 = client('10.99.1.2', 'auv_portal');
  expect(await pc2.post('/api/portal/verify', { token }), 410, 'link reuse');
  await pc2.post('/api/portal/login', { email: ACC });
  const t2 = linkIn((await waitMail(sink, ACC)).data);
  assert.ok(t2, 'second link');
  await sql`update portal_tokens set expires_at = now() - interval '1 minute' where token_hash = encode(sha256(${t2}::bytea), 'hex')`;
  expect(await pc2.post('/api/portal/verify', { token: t2 }), 410, 'expired link');
  const before = sink.messages.length;
  for (let i = 0; i < 3; i++) expect(await pc2.post('/api/portal/login', { email: ACC }), 200, 'login burst'); // 2 requests already counted (one while off)
  await sleep(400);
  assert.equal(sink.messages.length - before, 1, 'at most 3 link requests per address per 15 minutes; the rest answer the same but send nothing');
  ok('one-time link: emailed (not BCC), page view does not consume it, single use, expires, cross-site refused, per-address limit');

  // ── what the client sees ──
  r = await pc.get('/portal');
  expect(r, 200, 'portal home');
  for (const d of [invSent, qSent, qDecline, qExpired]) assert.ok(r.text.includes(d.number), `${d.number} listed`);
  for (const d of [invDraft, invCancelled, qDraft, otherInv]) assert.ok(!r.text.includes(d.number), `${d.number} hidden`);
  assert.ok(!r.text.includes('INTERNAL-SECRET-NOTE'));
  for (const [d, st] of [[invDraft, 404], [invCancelled, 404], [qDraft, 404], [otherInv, 404], [invSent, 200]]) expect(await pc.get(`/portal/documents/${d.id}`), st, `doc ${d.number}`);
  r = await pc.get(`/portal/documents/${invSent.id}`);
  assert.ok(!r.text.includes('INTERNAL-SECRET-NOTE'), 'internal notes never shown'); assert.match(r.text, /Pay by EFT/);
  await pc.get(`/portal/documents/${invSent.id}`);
  assert.equal((await sql`select count(*)::int as n from portal_events where document_id = ${invSent.id} and kind = 'view'`)[0].n, 1, 'first view recorded once');
  assert.equal((await sql`select count(*)::int as n from activities where entity = 'document' and entity_id = ${invSent.id} and body like 'Viewed in the client portal%'`)[0].n, 1);
  r = await pc.raw(`/api/portal/documents/${invSent.id}/pdf`);
  expect(r, 200, 'pdf'); assert.equal((await PDFDocument.load(r.bytes)).getTitle(), `INVOICE ${invSent.number}`);
  expect(await pc.raw(`/api/portal/documents/${otherInv.id}/pdf`), 404, 'other client pdf');
  expect(await pc.raw(`/api/portal/documents/${invDraft.id}/pdf`), 404, 'draft pdf');
  r = await pc.raw(`/api/portal/statement/pdf?client_id=${cl.id}`);
  expect(r, 200, 'statement'); assert.match((await PDFDocument.load(r.bytes)).getTitle(), /^Statement ZZ Test Portal Client/);
  expect(await pc.raw(`/api/portal/statement/pdf?client_id=${other.id}`), 404, 'other statement');
  expect(await client('10.99.1.9').raw(`/api/portal/documents/${invSent.id}/pdf`), 401, 'no session');
  r = await client('10.99.1.9').get('/portal');
  assert.equal(r.status, 307); assert.match(r.headers.get('location'), /\/portal\/login$/);
  ok('portal shows only this client’s sent/issued documents (no drafts, cancelled or internal notes), PDFs and statement scoped, first view logged');

  // ── quotes ──
  const partnerMails = () => sink.messages.filter((m) => m.rcpt.includes('padmin@' + DOMAIN) && m.rcpt.includes('pmember@' + DOMAIN)).length;
  const pm0 = partnerMails();
  expect(await pc.post(`/api/portal/quotes/${qSent.id}/accept`, { name: 'M', accept: true }), 400, 'short name');
  expect(await pc.post(`/api/portal/quotes/${qSent.id}/accept`, { name: 'Maria Shikongo', accept: false }), 400, 'not ticked');
  expect(await pc.post(`/api/portal/quotes/${otherInv.id}/accept`, { name: 'Maria Shikongo', accept: true }), 404, 'other client');
  expect(await pc.post(`/api/portal/quotes/${invSent.id}/accept`, { name: 'Maria Shikongo', accept: true }), 404, 'invoice is not a quote');
  r = await pc.post(`/api/portal/quotes/${qSent.id}/accept`, { name: 'Maria Shikongo', accept: true });
  expect(r, 200, 'accept'); assert.equal(r.json.status, 'accepted');
  const [qa] = await sql`select status, data->'acceptance' as a from documents where id = ${qSent.id}`;
  assert.equal(qa.status, 'accepted'); assert.equal(qa.a.name, 'Maria Shikongo'); assert.equal(qa.a.email, MARIA); assert.equal(qa.a.ip, '10.99.1.1');
  expect(await pc.post(`/api/portal/quotes/${qSent.id}/accept`, { name: 'Maria Shikongo', accept: true }), 409, 'accept twice');
  r = await member.get(`/api/crm/documents/${qSent.id}`);
  expect(await member.put(`/api/crm/documents/${qSent.id}`, { client_id: cl.id, date: r.json.date, due_date: r.json.due_date, data: { ...r.json.data, lines: [{ item: 'Changed', qty: 1, rate: 1 }] } }), 409, 'edit an accepted quote');
  r = await member.raw(`/api/crm/documents/${qSent.id}/pdf`);
  expect(r, 200, 'accepted pdf');
  expect(await pc.post(`/api/portal/quotes/${qExpired.id}/accept`, { name: 'Maria Shikongo', accept: true }), 409, 'expired');
  r = await pc.post(`/api/portal/quotes/${qDecline.id}/decline`, { reason: 'Budget moved to next year' });
  expect(r, 200, 'decline');
  assert.equal((await sql`select status from documents where id = ${qDecline.id}`)[0].status, 'declined');
  await sleep(400);
  assert.equal(partnerMails() - pm0, 2, 'both partners emailed for accept and decline');
  const acts = (await sql`select body from activities where entity = 'client' and entity_id = ${cl.id} and (body like '%accepted in the client portal%' or body like '%declined in the client portal%')`).map((a) => a.body);
  assert.equal(acts.length, 2); assert.ok(acts.some((a) => a.includes('Budget moved to next year')));
  r = await admin.get(`/api/crm/audit?entity=document&entity_id=${qSent.id}`);
  assert.ok(r.json.rows.some((x) => x.action === 'quote.status' && x.detail.via === 'portal' && x.user_id === null));
  ok('quotes: acceptance needs a name and the tick, records name/email/time/IP, locks the quote, partners emailed, timeline + audit; expired refused; decline with reason');

  // ── payment notices ──
  const pm1 = partnerMails();
  const proof = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(500, 32)]);
  const fd = (o, file = true) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); if (file) f.set('file', new Blob([proof]), 'FNB receipt.pdf'); return f; };
  expect(await pc.req(`/api/portal/invoices/${invSent.id}/proof`, { method: 'POST', form: fd({ amount: '1000', date: addDays(today, 1) }) }), 400, 'future date');
  expect(await pc.req(`/api/portal/invoices/${invSent.id}/proof`, { method: 'POST', form: fd({ amount: '0', date: today }) }), 400, 'zero amount');
  expect(await pc.req(`/api/portal/invoices/${otherInv.id}/proof`, { method: 'POST', form: fd({ amount: '1000', date: today }) }), 404, 'other client invoice');
  r = await pc.req(`/api/portal/invoices/${invSent.id}/proof`, { method: 'POST', form: fd({ amount: '1000', date: today, reference: 'FNB 9981', note: 'Paid in full' }) });
  expect(r, 200, 'notice'); const nid = r.json.id;
  const [nrow] = await sql`select n.*, a.name as file_name, a.uploaded_by from payment_notices n left join attachments a on a.id = n.attachment_id where n.id = ${nid}`;
  assert.equal(Number(nrow.amount), 1000); assert.equal(nrow.file_name, 'Proof of payment - FNB receipt.pdf'); assert.equal(nrow.uploaded_by, null); assert.equal(nrow.status, 'new');
  await sleep(300);
  assert.equal(partnerMails() - pm1, 1, 'partners emailed');
  r = await member.get('/api/crm/payment-notices?status=new');
  assert.ok(r.json.some((n) => String(n.id) === String(nid) && n.number === invSent.number && n.file_name));
  r = await member.get(`/api/crm/documents/${invSent.id}/notices`);
  assert.equal(r.json.length, 1);
  expect(await reader.patch(`/api/crm/payment-notices/${nid}`, { status: 'recorded' }), 403, 'read-only handles notice');
  expect(await member.post('/api/crm/payments', { document_id: invSent.id, date: today, amount: 1000, method: 'eft', reference: 'FNB 9981' }), 200, 'record payment');
  r = await member.patch(`/api/crm/payment-notices/${nid}`, { status: 'recorded' });
  expect(r, 200, 'mark recorded');
  r = await pc.get(`/portal/documents/${invSent.id}`);
  assert.match(r.text, /Paid in full/); assert.doesNotMatch(r.text, /Pay by EFT/);
  expect(await pc.req(`/api/portal/invoices/${invSent.id}/proof`, { method: 'POST', form: fd({ amount: '5', date: today }) }), 409, 'notice on a paid invoice');
  ok('payment notices: validated, proof stored as a document file, partners emailed, listed for partners, recorded; paid invoices show as paid');

  // ── revocation and sign-out ──
  expect(await member.patch(`/api/crm/clients/${cl.id}/portal`, { enabled: false }), 200, 'disable');
  r = await pc.get('/portal');
  assert.equal(r.status, 307, 'switching the portal off ends access immediately');
  expect(await pc.raw(`/api/portal/statement/pdf?client_id=${cl.id}`), 401, 'API after disable');
  await member.patch(`/api/crm/clients/${cl.id}/portal`, { enabled: true });
  expect(await pc.get('/portal'), 200, 'back on');
  await sql`update contacts set email = '' where client_id = ${cl.id}`;
  expect(await pc.get('/portal'), 307, 'removing the address ends access');
  await sql`update contacts set email = ${MARIA} where client_id = ${cl.id}`;
  expect(await pc.get('/portal'), 200, 'address restored');
  r = await pc.post('/api/portal/logout', {});
  expect(r, 200, 'logout');
  assert.equal((await sql`select count(*)::int as n from portal_sessions where email = ${MARIA}`)[0].n, 0);
  expect(await pc.get('/portal'), 307, 'after logout');
  ok('access is re-checked on every request: switching the portal off or removing the address ends it; sign-out deletes the session');

  r = await admin.get('/api/crm/export');
  assert.ok(Array.isArray(r.json.payment_notices) && r.json.payment_notices.some((n) => String(n.id) === String(nid)) && Array.isArray(r.json.portal_events));
  assert.ok(!('portal_tokens' in r.json) && !('portal_sessions' in r.json), 'no tokens or sessions in backups');
  r = await member.get(`/api/crm/clients/${cl.id}/portal`);
  assert.ok(r.json.events.some((e) => e.kind === 'accept') && r.json.events.some((e) => e.kind === 'proof') && r.json.events.some((e) => e.kind === 'invite'));
  for (const p of [`/crm/clients/${cl.id}`, `/crm/invoices/${invSent.id}`, `/crm/quotes/${qSent.id}`, '/crm/payments']) expect(await member.req(p), 200, p);
  ok('backups include notices and portal activity (not tokens/sessions); client page shows portal activity; CRM pages render');

  console.log(`\nCRM Phase 5: ${passed} checks passed.`);
} catch (e) {
  console.error('\nFAILED:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  sink?.stop();
  if (mailBackup !== undefined) {
    if (mailBackup) await sql`update settings set value = ${sql.json(mailBackup)} where key = 'mail'`.catch(() => {});
    else await sql`delete from settings where key = 'mail'`.catch(() => {});
  }
  await cleanup().catch((e) => console.error('cleanup:', e.message));
  await sql.end({ timeout: 5 });
}
