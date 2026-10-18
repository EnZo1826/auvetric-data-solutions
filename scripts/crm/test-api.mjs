// End-to-end Phase 1 API tests against a running server and its database.
//   CRM_TEST_URL=http://localhost:3100 CRM_CRON_SECRET=… npm run crm:test:api
// Creates throwaway users/clients (*@crm-test.invalid / "ZZ Test …"), restores the company profile afterwards.
import assert from 'node:assert/strict';
import { hashPassword } from '../../src/crm/server/password.ts';
import { base32Decode, totp } from '../../src/crm/server/totp.ts';
import { connect, isHostedDb } from './env.mjs';

const BASE = (process.env.CRM_TEST_URL || 'http://localhost:3100').replace(/\/$/, '');
if (/auvetric\.com|netlify\.app/.test(BASE) || isHostedDb()) { console.error('Refusing to run against production.'); process.exit(2); }
const ORIGIN = new URL(BASE).origin;
const sql = connect();
const DOMAIN = 'crm-test.invalid';
const PW = 'Api-Test-Pass-Phrase-2026';
let passed = 0;
const ok = (l) => { passed++; console.log(`  ✓ ${l}`); };

function client(ip) {
  let cookie = '';
  const req = async (path, { method = 'GET', body, origin = ORIGIN } = {}) => {
    const headers = { 'x-forwarded-for': ip };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (origin && method !== 'GET') headers.origin = origin;
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); cookie = pair.split('=')[1] ? pair : ''; }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  return {
    req,
    get: (p) => req(p),
    post: (p, b = {}, o) => req(p, { method: 'POST', body: b, ...o }),
    put: (p, b) => req(p, { method: 'PUT', body: b }),
    patch: (p, b) => req(p, { method: 'PATCH', body: b }),
    del: (p) => req(p, { method: 'DELETE' }),
  };
}

async function signedIn(email, ip) {
  const c = client(ip);
  let r = await c.post('/api/crm/auth/login', { email, password: PW });
  assert.equal(r.json?.next, 'enroll', `login ${email}: ${JSON.stringify(r.json)}`);
  const e = await c.get('/api/crm/auth/enroll');
  r = await c.post('/api/crm/auth/enroll', { code: totp(base32Decode(e.json.secret.replace(/\s/g, ''))) });
  assert.equal(r.json?.next, 'done');
  return c;
}
const expect = (r, status, label) => assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${r.text.slice(0, 200)}`);

let companyBackup = null;
async function cleanup() {
  const users = await sql`select id from users where email like ${'%@' + DOMAIN}`;
  const uids = users.map((u) => u.id);
  const clients = await sql`select id from clients where name like 'ZZ Test %'`;
  const cids = clients.map((c) => c.id);
  if (cids.length) {
    const docs = await sql`select id from documents where client_id in ${sql(cids)}`;
    const projects = await sql`select id from projects where client_id in ${sql(cids)} or title like 'ZZ Test %'`;
    if (docs.length) await sql`update documents set source_id = null where source_id in ${sql(docs.map((d) => d.id))}`;
    await sql`update projects set quote_id = null where client_id in ${sql(cids)}`;
    await sql`delete from documents where client_id in ${sql(cids)}`;
    await sql`delete from retainers where client_id in ${sql(cids)}`;
    if (projects.length) await sql`delete from activities where entity = 'project' and entity_id in ${sql(projects.map((p) => p.id))}`;
    await sql`delete from projects where client_id in ${sql(cids)}`;
    await sql`delete from activities where entity = 'client' and entity_id in ${sql(cids)}`;
    await sql`delete from clients where id in ${sql(cids)}`;
  }
  await sql`delete from projects where title like 'ZZ Test %'`;
  await sql`delete from services where name like 'ZZ Test %'`;
  if (uids.length) {
    await sql`delete from audit_log where user_id in ${sql(uids)}`;
    await sql`delete from activities where user_id in ${sql(uids)}`;
  }
  await sql`delete from users where email like ${'%@' + DOMAIN}`;
  await sql`delete from login_attempts where email like ${'%@' + DOMAIN}`;
}

try {
  await cleanup();
  [companyBackup] = await sql`select id, name, data from companies where is_default`;
  const hash = await hashPassword(PW);
  for (const [email, role] of [['admin@' + DOMAIN, 'admin'], ['member@' + DOMAIN, 'member'], ['viewer@' + DOMAIN, 'readonly']]) {
    await sql`insert into users (email, name, role, password_hash, must_change_password) values (${email}, ${'Test ' + role}, ${role}, ${hash}, false)`;
  }
  const admin = await signedIn('admin@' + DOMAIN, '10.97.0.1');
  const member = await signedIn('member@' + DOMAIN, '10.97.0.2');
  const viewer = await signedIn('viewer@' + DOMAIN, '10.97.0.3');
  console.log(`CRM API tests against ${BASE}`);

  // ── auth & roles on the API ──
  expect(await client('10.97.0.9').get('/api/crm/clients'), 401, 'anonymous');
  expect(await member.post('/api/crm/clients', { name: 'ZZ Test X' }, { origin: 'https://evil.example' }), 403, 'cross-origin write');
  expect(await viewer.post('/api/crm/clients', { name: 'ZZ Test Viewer' }), 403, 'read-only write');
  expect(await viewer.get('/api/crm/clients'), 200, 'read-only read');
  expect(await member.put('/api/crm/company', { name: 'x', data: {} }), 403, 'member edits company');
  expect(await member.get('/api/crm/export'), 403, 'member export');
  expect(await member.get('/api/crm/nope'), 404, 'unknown route');
  expect(await member.get('/api/crm/clients/abc'), 404, 'bad id');
  ok('API: anonymous 401, cross-origin 403, read-only and admin-only enforced, unknown routes 404');

  // ── company profile (placeholders, VAT off) ──
  let r = await admin.get('/api/crm/company');
  expect(r, 200, 'company');
  assert.equal(r.json.data.vatRegistered, false);
  const co = r.json;
  r = await admin.put('/api/crm/company', { name: co.name, data: { ...co.data, vatRegistered: true, vatNo: '' } });
  expect(r, 400, 'VAT on without number');
  r = await admin.put('/api/crm/company', { name: co.name, data: { ...co.data, invoicePrefix: 'ZT-INV-{YYYY}-', quotePrefix: 'ZT-QUO-{YYYY}-', nextInvoice: 1, nextQuote: 1, numberPad: 4 } });
  expect(r, 200, 'company update');
  ok('company profile: VAT needs a number; admin can update numbering');

  // ── clients & contacts ──
  expect(await member.post('/api/crm/clients', { name: '' }), 400, 'client without name');
  expect(await member.post('/api/crm/clients', { name: 'ZZ Test Bad', email: 'not-mail' }), 400, 'bad email');
  r = await member.post('/api/crm/clients', { name: 'ZZ Test Mining Ltd', address: 'Plot 1\nWalvis Bay', email: 'ap@zz.test', vat_no: '1234567', currency: 'NAD', payment_terms_days: 30, tags: ['priority'] });
  expect(r, 200, 'create client');
  const cl = r.json;
  r = await member.post(`/api/crm/clients/${cl.id}/contacts`, { name: 'Pat Primary', role: 'Ops', email: 'pat@zz.test' });
  assert.equal(r.json.is_primary, true, 'first contact becomes primary');
  const pat = r.json;
  r = await member.post(`/api/crm/clients/${cl.id}/contacts`, { name: 'Sam Second', email: 'sam@zz.test', is_primary: true });
  const sam = r.json;
  r = await member.get(`/api/crm/clients/${cl.id}`);
  assert.equal(r.json.contacts.filter((k) => k.is_primary).length, 1, 'exactly one primary');
  assert.equal(r.json.contacts.find((k) => k.is_primary).id, sam.id);
  ok('clients: validation, create, contacts with a single primary');
  r = await member.post('/api/crm/clients', { name: 'ZZ Test Global Inc', currency: 'USD' });
  const usdClient = r.json;

  // ── services ──
  r = await member.post('/api/crm/services', { practice: 'engineering', name: 'ZZ Test Development', unit: 'Hour', rate: 850, currency: 'NAD' });
  expect(r, 200, 'service');
  const svc = r.json;
  expect(await member.post('/api/crm/services', { practice: 'magic', name: 'ZZ Test Bad' }), 400, 'bad practice');
  ok('services catalogue: create and validate practice');

  // ── quotes: numbering, server-side totals, VAT off, snapshot ──
  const lines = [{ item: 'Development', description: 'Phase 1', unit: 'Hour', qty: 10, rate: 850, service_id: svc.id }, { item: 'Hosting set-up', unit: 'Fixed', qty: 1, rate: 1250.5 }];
  r = await member.post('/api/crm/documents', { type: 'quote', client_id: cl.id, contact_id: pat.id, date: '2026-10-01', data: { remarks: 'Telemetry dashboard', lines, discount: 100, vatRate: 15, total: 1, proposal: { scope: 'Build it' } }, subtotal: 5, total: 5 });
  expect(r, 200, 'create quote');
  const q1 = r.json;
  assert.equal(q1.number, 'ZT-QUO-2026-0001');
  assert.deepEqual([q1.subtotal, q1.vat, q1.discount, q1.total], [9750.5, 0, 100, 9650.5], 'server totals; VAT 0 while unregistered; client totals ignored');
  assert.equal(q1.due_date, '2026-10-31', 'valid for company default 30 days');
  assert.equal(q1.data.client.name, 'ZZ Test Mining Ltd'); assert.equal(q1.data.client.contact, 'Pat Primary'); assert.equal(q1.data.client.email, 'pat@zz.test');
  assert.equal(q1.data.proposal.scope, 'Build it');
  ok(`quote ${q1.number}: numbering, server-computed totals, VAT off, client snapshot with contact, proposal sections`);
  r = await member.post('/api/crm/documents', { type: 'quote', client_id: cl.id, contact_id: pat.id, data: { lines: [], discount: 5 } });
  expect(r, 400, 'discount above total');
  r = await member.post('/api/crm/documents', { type: 'quote', client_id: usdClient.id, contact_id: pat.id, data: { lines } });
  expect(r, 400, 'contact from another client');
  r = await member.post('/api/crm/documents', { type: 'quote', client_id: cl.id, date: '2026-10-10', due_date: '2026-10-01', data: { lines } });
  expect(r, 400, 'due before date');
  ok('document validation: negative total, foreign contact, due before date refused');

  // concurrency: numbers stay unique and gapless
  const many = await Promise.all(Array.from({ length: 8 }, () => member.post('/api/crm/documents', { type: 'quote', client_id: cl.id, date: '2026-10-02', data: { lines: [{ item: 'x', qty: 1, rate: 1 }] } })));
  const nums = many.map((x) => x.json.number).sort();
  assert.equal(new Set(nums).size, 8);
  assert.deepEqual(nums, Array.from({ length: 8 }, (_, i) => `ZT-QUO-2026-${String(i + 2).padStart(4, '0')}`));
  ok('8 parallel quotes get unique, consecutive numbers');

  // USD needs a rate; client currency default + terms
  r = await member.post('/api/crm/documents', { type: 'invoice', client_id: usdClient.id, currency: 'USD', fx_rate: 0, data: { lines } });
  expect(r, 400, 'USD without rate');
  r = await member.post('/api/crm/documents', { type: 'invoice', client_id: usdClient.id, currency: 'USD', fx_rate: 18.25, date: '2026-10-05', data: { lines } });
  expect(r, 200, 'USD invoice');
  assert.equal(r.json.currency, 'USD'); assert.equal(Number(r.json.fx_rate), 18.25);
  const usdInv = r.json;
  ok('USD invoice requires and stores an exchange rate');

  // ── convert quote → invoice, lock rules ──
  r = await member.patch(`/api/crm/documents/${q1.id}/status`, { status: 'invoiced' });
  expect(r, 400, 'manual invoiced');
  r = await member.patch(`/api/crm/documents/${q1.id}/status`, { status: 'accepted' });
  assert.equal(r.json.status, 'accepted'); assert.ok(r.json.sent_at);
  r = await member.post(`/api/crm/documents/${q1.id}/convert`);
  expect(r, 200, 'convert');
  const inv = r.json;
  assert.equal(inv.type, 'invoice'); assert.equal(inv.number, 'ZT-INV-2026-0002'); assert.equal(inv.source_id, q1.id);
  assert.equal(inv.total, 9650.5); assert.equal(inv.data.proposal, undefined, 'invoices carry no proposal');
  r = await member.get(`/api/crm/documents/${q1.id}`);
  assert.equal(r.json.status, 'invoiced'); assert.equal(r.json.derived[0].number, inv.number);
  expect(await member.post(`/api/crm/documents/${q1.id}/convert`), 409, 'convert twice');
  expect(await member.put(`/api/crm/documents/${q1.id}`, { data: { lines } }), 409, 'edit invoiced quote');
  ok(`quote converted to ${inv.number} (payment terms of client: due ${inv.due_date}); invoiced quote locked; no double conversion`);
  assert.equal(inv.due_date, (() => { const d = new Date(inv.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 30); return d.toISOString().slice(0, 10); })(), 'client 30-day terms');

  expect(await member.del(`/api/crm/documents/${usdInv.id}`), 200, 'delete draft');
  r = await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'sent' });
  expect(await member.del(`/api/crm/documents/${inv.id}`), 409, 'delete sent invoice');
  r = await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'paid' });
  assert.ok(r.json.paid_at);
  expect(await member.put(`/api/crm/documents/${inv.id}`, { data: { lines } }), 409, 'edit paid invoice');
  r = await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'sent' });
  assert.equal(r.json.paid_at, null, 'undo paid clears paid_at');
  r = await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'cancelled' });
  expect(await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'sent' }), 409, 'reopen cancelled');
  ok('drafts deletable; sent invoices not; paid and cancelled invoices locked; cancelled never reopens');

  r = await member.post(`/api/crm/documents/${inv.id}/duplicate`, { type: 'quote' });
  expect(r, 200, 'duplicate as quote');
  assert.equal(r.json.type, 'quote'); assert.equal(r.json.status, 'draft'); assert.equal(r.json.source_id, inv.id);
  ok('duplicate a cancelled invoice as a new draft quote');

  r = await member.get(`/api/crm/documents?type=quote&client_id=${cl.id}&q=Telemetry`);
  assert.ok(r.json.length >= 1 && r.json.every((x) => x.type === 'quote'));
  r = await member.get(`/api/crm/documents?q=${encodeURIComponent("%' or 1=1 --")}`);
  expect(r, 200, 'hostile search'); assert.equal(r.json.length, 0);
  ok('document list filters and hostile search text');

  // ── projects ──
  r = await member.post(`/api/crm/documents/${many[0].json.id}/project`);
  expect(r, 200, 'project from quote');
  const proj = r.json;
  assert.equal(proj.quote_id, many[0].json.id); assert.equal(proj.client_id, cl.id); assert.equal(proj.data.checklist.length, 1);
  r = await member.post(`/api/crm/documents/${many[0].json.id}/project`);
  assert.equal(r.json.id, proj.id, 'idempotent');
  r = await member.post('/api/crm/projects', { title: 'ZZ Test Board item', client_id: cl.id, priority: 'high', practice: 'data', data: { description: '', checklist: [{ text: 'a' }], milestones: [{ title: 'M1', due: '2026-11-01' }], tags: [] } });
  expect(r, 200, 'create project');
  const p2 = r.json;
  expect(await member.post('/api/crm/projects/move', { id: p2.id, status: 'nope', ids: [p2.id] }), 400, 'unknown column');
  expect(await member.post('/api/crm/projects/move', { id: p2.id, status: 'in_progress', ids: [p2.id, proj.id] }), 200, 'move');
  r = await member.get(`/api/crm/projects/${p2.id}`);
  assert.equal(r.json.project.status, 'in_progress');
  assert.ok(r.json.activities.some((a) => a.body === 'Moved to In progress'));
  r = await member.get(`/api/crm/projects/${proj.id}`);
  assert.equal(r.json.project.status, 'planned', 'other column untouched by reorder ids');
  expect(await admin.put('/api/crm/settings/project_columns', [{ key: 'planned', label: 'Planned', color: '#123456' }]), 409, 'remove used column');
  ok('projects: from quote (idempotent), create, move with activity log; columns in use protected');

  // ── retainers ──
  r = await member.post('/api/crm/retainers', { client_id: cl.id, kind: 'support', currency: 'NAD', day_of_month: 5, auto: true, data: { lines: [{ item: 'Support', qty: 1, rate: 4500 }], remarks: 'Monthly support', discount: 0 } });
  expect(r, 200, 'retainer');
  const ret = r.json;
  r = await member.post('/api/crm/retainers/generate', { period: '2026-09', ids: [ret.id] });
  assert.equal(r.json.created.length, 1);
  const rInv = r.json.created[0];
  r = await member.post('/api/crm/retainers/generate', { period: '2026-09', ids: [ret.id] });
  assert.equal(r.json.created.length, 0); assert.match(r.json.skipped[0].reason, /Already invoiced/);
  const both = await Promise.all([member.post('/api/crm/retainers/generate', { period: '2026-08', ids: [ret.id] }), member.post('/api/crm/retainers/generate', { period: '2026-08', ids: [ret.id] })]);
  assert.equal(both.reduce((s, x) => s + x.json.created.length, 0), 1, 'concurrent generation still bills once');
  r = await member.get(`/api/crm/documents/${rInv.id}`);
  assert.equal(r.json.date, '2026-09-05'); assert.equal(r.json.period, '2026-09'); assert.equal(r.json.total, 4500);
  expect(await member.post('/api/crm/retainers/generate', { period: '2026-13' }), 400, 'bad period');
  r = await member.del(`/api/crm/retainers/${ret.id}`);
  assert.equal(r.json.deactivated, true, 'retainer with invoices is paused, not deleted');
  ok('retainers: generate once per month (also under concurrency), dated on billing day, paused not deleted');

  // ── daily job (cron) ──
  await sql`update retainers set active = true, auto = true, last_period = null where id = ${ret.id}`;
  const cronSecret = process.env.CRM_CRON_SECRET;
  expect(await client('10.97.0.8').req('/api/crm/cron', { method: 'POST' }), 401, 'cron without secret');
  expect(await client('10.97.0.8').req('/api/crm/cron', { method: 'POST', origin: null }), 401, 'cron anonymous');
  if (cronSecret) {
    await sql`update documents set status = 'sent', due_date = '2026-01-31', date = '2026-01-01' where id = ${rInv.id}`;
    const res = await fetch(BASE + '/api/crm/cron', { method: 'POST', headers: { authorization: 'Bearer ' + cronSecret } });
    const j = await res.json();
    assert.equal(res.status, 200);
    assert.ok(j.overdue >= 1);
    r = await member.get(`/api/crm/documents/${rInv.id}`);
    assert.equal(r.json.status, 'overdue');
    ok(`daily job with bearer secret: ${j.retainers.created.length} retainer invoice(s), ${j.overdue} flagged overdue`);
  } else console.log('  - daily job bearer test skipped (CRM_CRON_SECRET not set for the test)');

  // ── client delete archives when history exists; activity notes ──
  r = await member.post('/api/crm/activities', { entity: 'client', entity_id: cl.id, kind: 'call', body: 'Discussed phase 2' });
  expect(r, 200, 'log call');
  const note = r.json;
  expect(await admin.del(`/api/crm/activities/${note.id}`), 200, 'admin deletes note');
  r = await member.get(`/api/crm/clients/${cl.id}`);
  assert.ok(r.json.activities.some((a) => a.kind === 'system' && /converted to invoice/.test(a.body)), 'system timeline entries');
  r = await member.del(`/api/crm/clients/${cl.id}`);
  assert.equal(r.json.archived, true);
  r = await member.post('/api/crm/clients', { name: 'ZZ Test Empty' });
  r = await member.del(`/api/crm/clients/${r.json.id}`);
  assert.equal(r.json.archived, false);
  ok('timeline notes and system events; clients with history archive, empty clients delete');

  // ── users (admin) ──
  r = await admin.post('/api/crm/users', { email: 'new@' + DOMAIN, name: 'New Person', role: 'member' });
  expect(r, 200, 'add user');
  assert.match(r.json.oneTimePassword, /^[\w]{5}(-[\w]{5}){3}$/);
  expect(await admin.post('/api/crm/users', { email: 'new@' + DOMAIN, name: 'Dup' }), 409, 'duplicate user');
  const me = (await admin.get('/api/crm/auth/me')).json.user;
  expect(await admin.patch(`/api/crm/users/${me.id}`, { disabled: true }), 400, 'disable self');
  const mem = (await admin.get('/api/crm/users')).json.find((u) => u.email === 'member@' + DOMAIN);
  expect(await admin.patch(`/api/crm/users/${mem.id}`, { role: 'readonly' }), 200, 'demote member');
  expect(await member.post('/api/crm/clients', { name: 'ZZ Test After demote' }), 403, 'demoted member blocked at once');
  expect(await admin.post(`/api/crm/users/${mem.id}/reset`, { what: 'mfa' }), 200, 'reset mfa');
  expect(await member.get('/api/crm/clients'), 401, 'reset signs the user out');
  ok('users: add with one-time password, no duplicates, no self-disable, role change applies at once, 2FA reset signs out');

  // ── export, print, pages ──
  r = await admin.get('/api/crm/export');
  expect(r, 200, 'export');
  assert.equal(r.json.schema, 'auvetric-crm/1'); assert.ok(r.json.documents.length > 0);
  assert.ok(r.json.users.every((u) => !('password_hash' in u) && !('totp_secret' in u)), 'no secrets in backup');
  r = await admin.req(`/crm/print?ids=${q1.id},${inv.id}`);
  expect(r, 200, 'print page');
  assert.match(r.text, /QUOTATION/); assert.match(r.text, />INVOICE</); assert.doesNotMatch(r.text, /TAX INVOICE/);
  assert.match(r.text, /ZT-QUO-2026-0001/); assert.match(r.text, /Build it/);
  for (const p of ['/crm', '/crm/invoices', '/crm/quotes', `/crm/quotes/${q1.id}`, '/crm/invoices/new', '/crm/clients', `/crm/clients/${cl.id}`, '/crm/projects', '/crm/retainers', '/crm/services', '/crm/company', '/crm/users', '/crm/settings']) {
    expect(await admin.req(p), 200, p);
  }
  expect(await admin.req('/crm/quotes/abc'), 404, 'bad doc id page');
  ok('backup export (no secrets); A4 print shows QUOTATION / INVOICE (no TAX INVOICE while unregistered); all Phase 1 pages render');

  console.log(`\nCRM API: ${passed} checks passed.`);
} catch (e) {
  console.error('\nFAILED:', e.message);
  process.exitCode = 1;
} finally {
  if (companyBackup) await sql`update companies set name = ${companyBackup.name}, data = ${sql.json(companyBackup.data)} where id = ${companyBackup.id}`.catch(() => {});
  await cleanup().catch((e) => console.error('cleanup:', e.message));
  await sql.end({ timeout: 5 });
}
