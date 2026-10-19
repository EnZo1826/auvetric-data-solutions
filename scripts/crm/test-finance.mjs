// End-to-end Phase 3 tests (payments, ageing, statements, time → invoice, expenses re-billing, marketplace).
//   CRM_TEST_URL=http://localhost:3100 npm run crm:test:finance
// Test data: users *@crm-test.invalid, clients "ZZ Test …"; the company profile is restored afterwards.
import assert from 'node:assert/strict';
import { hashPassword } from '../../src/crm/server/password.ts';
import { base32Decode, totp } from '../../src/crm/server/totp.ts';
import { connect, isHostedDb } from './env.mjs';

const BASE = (process.env.CRM_TEST_URL || 'http://localhost:3100').replace(/\/$/, '');
if (/auvetric\.com|netlify\.app/.test(BASE) || isHostedDb()) { console.error('Refusing to run against production.'); process.exit(2); }
const ORIGIN = new URL(BASE).origin;
const sql = connect();
const DOMAIN = 'crm-test.invalid';
const PW = 'Finance-Test-Pass-Phrase-2026';
let passed = 0;
const ok = (l) => { passed++; console.log(`  ✓ ${l}`); };
const expect = (r, status, label) => assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${r.text.slice(0, 300)}`);
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function client(ip) {
  let cookie = '';
  const req = async (path, { method = 'GET', body } = {}) => {
    const headers = { 'x-forwarded-for': ip };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET') headers.origin = ORIGIN;
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); cookie = pair.split('=')[1] ? pair : ''; }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text };
  };
  return { req, get: (p) => req(p), post: (p, b = {}) => req(p, { method: 'POST', body: b }), put: (p, b) => req(p, { method: 'PUT', body: b }), patch: (p, b) => req(p, { method: 'PATCH', body: b }), del: (p) => req(p, { method: 'DELETE' }) };
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

let companyBackup = null;
async function cleanup() {
  const users = (await sql`select id from users where email like ${'%@' + DOMAIN}`).map((u) => u.id);
  const cids = (await sql`select id from clients where name like 'ZZ Test %'`).map((c) => c.id);
  if (users.length) {
    await sql`delete from time_entries where user_id in ${sql(users)}`;
    await sql`delete from expenses where created_by in ${sql(users)}`;
    await sql`delete from marketplace_earnings where created_by in ${sql(users)}`;
  }
  if (cids.length) {
    const docs = (await sql`select id from documents where client_id in ${sql(cids)}`).map((d) => d.id);
    if (docs.length) { await sql`delete from payments where document_id in ${sql(docs)}`; await sql`update documents set source_id = null where source_id in ${sql(docs)}`; }
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
  if (users.length) { await sql`delete from audit_log where user_id in ${sql(users)}`; await sql`delete from activities where user_id in ${sql(users)}`; }
  await sql`delete from users where email like ${'%@' + DOMAIN}`;
  await sql`delete from login_attempts where email like ${'%@' + DOMAIN}`;
}

try {
  await cleanup();
  [companyBackup] = await sql`select id, name, data from companies where is_default`;
  await sql`update companies set data = data || ${sql.json({ invoicePrefix: 'ZF-INV-', nextInvoice: 1, usdToNad: 18 })} where id = ${companyBackup.id}`;
  const hash = await hashPassword(PW);
  for (const [email, role] of [['fadmin@' + DOMAIN, 'admin'], ['fmember@' + DOMAIN, 'member']]) {
    await sql`insert into users (email, name, role, password_hash, must_change_password) values (${email}, ${'Test ' + role}, ${role}, ${hash}, false)`;
  }
  const admin = await signedIn('fadmin@' + DOMAIN, '10.96.0.1');
  const member = await signedIn('fmember@' + DOMAIN, '10.96.0.2');
  console.log(`CRM Phase 3 tests against ${BASE}`);

  const nadClient = (await member.post('/api/crm/clients', { name: 'ZZ Test Fin NAD', currency: 'NAD', payment_terms_days: 30 })).json;
  const usdClient = (await member.post('/api/crm/clients', { name: 'ZZ Test Fin USD', currency: 'USD' })).json;
  const mkInv = async (lines, extra = {}) => (await member.post('/api/crm/documents', { type: 'invoice', client_id: nadClient.id, date: addDays(today, -40), due_date: addDays(today, -10), data: { lines }, ...extra })).json;

  // ── payments ──
  const inv = await mkInv([{ item: 'Work', qty: 10, rate: 100 }]);
  assert.equal(inv.total, 1000);
  expect(await member.post('/api/crm/payments', { document_id: inv.id, date: today, amount: 100 }), 409, 'payment on a draft');
  await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'sent' });
  let r = await member.post('/api/crm/payments', { document_id: inv.id, date: addDays(today, -5), amount: 400, method: 'eft', reference: 'FNB 123' });
  expect(r, 200, 'part payment');
  assert.equal(r.json.invoice.status, 'sent'); assert.equal(Number(r.json.invoice.amount_paid), 400);
  expect(await member.post('/api/crm/payments', { document_id: inv.id, date: today, amount: 600.01 }), 400, 'overpayment');
  expect(await member.post('/api/crm/payments', { document_id: inv.id, date: addDays(today, 2), amount: 10 }), 400, 'future date');
  expect(await member.put(`/api/crm/documents/${inv.id}`, { client_id: nadClient.id, date: inv.date, due_date: inv.due_date, data: { lines: [{ item: 'Work', qty: 3, rate: 100 }] } }), 409, 'total below paid');
  r = await member.post('/api/crm/payments', { document_id: inv.id, date: addDays(today, -1), amount: 600 });
  assert.equal(r.json.invoice.status, 'paid'); assert.ok(r.json.invoice.paid_at);
  const payments = (await member.get(`/api/crm/documents/${inv.id}/payments`)).json;
  assert.equal(payments.length, 2);
  r = await member.del(`/api/crm/payments/${payments[1].id}`);
  assert.equal(r.json.invoice.status, 'overdue', 'removing a payment reopens it; past due → overdue'); assert.equal(r.json.invoice.paid_at, null);
  expect(await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'cancelled' }), 409, 'cancel with payments');
  ok('payments: not on drafts; part, over, future and edit-below-paid rules; full payment marks paid; removing reopens as overdue; no cancel with payments');

  r = await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'paid' });
  assert.equal(r.json.status, 'paid'); assert.equal(Number(r.json.amount_paid), 1000);
  let ps = (await member.get(`/api/crm/documents/${inv.id}/payments`)).json;
  assert.equal(ps.filter((p) => p.auto).length, 1); assert.equal(Number(ps.find((p) => p.auto).amount), 600, 'Mark paid records the remaining balance');
  r = await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'sent' });
  assert.equal(r.json.status, 'sent'); assert.equal(Number(r.json.amount_paid), 400, 'undo removes only the automatic payment');
  r = await member.post('/api/crm/payments', { document_id: inv.id, date: today, amount: 600, method: 'cash' });
  assert.equal(r.json.invoice.status, 'paid');
  expect(await member.patch(`/api/crm/documents/${inv.id}/status`, { status: 'sent' }), 409, 'undo paid when real payments cover it');
  ok('Mark paid records the balance as an automatic payment; undo removes only that; real payments can’t be undone by status');

  // ── ageing & statement ──
  const i2 = await mkInv([{ item: 'Support', qty: 1, rate: 500 }], { date: addDays(today, -100), due_date: addDays(today, -70) });
  await member.patch(`/api/crm/documents/${i2.id}/status`, { status: 'sent' });
  const i3 = await mkInv([{ item: 'Hosting', qty: 1, rate: 250 }], { date: addDays(today, -5), due_date: addDays(today, 25) });
  await member.patch(`/api/crm/documents/${i3.id}/status`, { status: 'sent' });
  await member.post('/api/crm/payments', { document_id: i3.id, date: today, amount: 50 });
  const usdInv = (await member.post('/api/crm/documents', { type: 'invoice', client_id: usdClient.id, currency: 'USD', fx_rate: 18, date: addDays(today, -40), due_date: addDays(today, -35), data: { lines: [{ item: 'Dev', qty: 1, rate: 100 }] } })).json;
  await member.patch(`/api/crm/documents/${usdInv.id}/status`, { status: 'sent' });
  r = await member.get('/api/crm/debtors');
  const nadRow = r.json.clients.find((c) => c.client_id === nadClient.id);
  assert.equal(nadRow.d90, 500, '61–90 bucket'); assert.equal(nadRow.current, 200, 'current bucket after part payment'); assert.equal(nadRow.total, 700);
  const usdRow = r.json.clients.find((c) => c.client_id === usdClient.id);
  assert.equal(usdRow.d60, 100); assert.equal(usdRow.total_nad, 1800);
  ok('debtors ageing: balances net of payments, correct buckets, USD converted for the total');

  r = await member.get(`/api/crm/clients/${nadClient.id}/statement?from=${addDays(today, -60)}&to=${today}`);
  const sec = r.json.sections[0];
  assert.equal(sec.opening, 500, 'invoice before the period is the opening balance');
  assert.equal(sec.closing, 700); assert.equal(sec.lines.at(-1).balance, 700);
  assert.equal(sec.lines.filter((l) => l.kind === 'invoice').length, 2);
  assert.equal(sec.lines.filter((l) => l.kind === 'payment').reduce((s, l) => s + l.credit, 0), 1050);
  r = await member.req(`/crm/print/statement?client_id=${nadClient.id}&from=${addDays(today, -60)}&to=${today}`);
  expect(r, 200, 'statement page'); assert.match(r.text, /STATEMENT/); assert.match(r.text, /Opening balance/);
  ok('statement: opening balance, running balance, closing = ageing total; A4 page renders');

  r = await member.req(`/crm/print?ids=${i3.id}`);
  assert.match(r.text, /Balance due/, 'printed invoice shows the balance after part payment');
  ok('printed invoice shows paid and balance due');

  // ── time → invoice ──
  const proj = (await member.post('/api/crm/projects', { title: 'ZZ Test Fin Project', client_id: nadClient.id, data: { description: '', checklist: [], milestones: [], tags: [] } })).json;
  expect(await member.post('/api/crm/time', { date: today, project_id: proj.id, minutes: 60, billable: true }), 400, 'billable without rate');
  expect(await member.post('/api/crm/time', { date: today, minutes: 60, billable: true, rate: 500 }), 400, 'billable without client');
  const t1 = (await member.post('/api/crm/time', { date: addDays(today, -2), project_id: proj.id, minutes: 90, description: 'API design', billable: true, rate: 800, currency: 'NAD' })).json;
  const t2 = (await member.post('/api/crm/time', { date: addDays(today, -1), project_id: proj.id, minutes: 45, description: 'Dashboard', billable: true, rate: 800, currency: 'NAD' })).json;
  const t3 = (await member.post('/api/crm/time', { date: today, project_id: proj.id, minutes: 30, description: 'Internal sync', billable: false })).json;
  assert.equal(t1.client_id, nadClient.id, 'client taken from the project');
  const tAdmin = (await admin.post('/api/crm/time', { date: today, project_id: proj.id, minutes: 15, billable: true, rate: 800 })).json;
  expect(await member.put(`/api/crm/time/${tAdmin.id}`, { date: today, project_id: proj.id, minutes: 20, billable: true, rate: 800 }), 403, "edit someone else's time");
  expect(await member.post('/api/crm/time/invoice', { ids: [t1.id, t3.id] }), 400, 'non-billable');
  r = await member.post('/api/crm/time/invoice', { ids: [t1.id, t2.id] });
  expect(r, 200, 'invoice time');
  const tInv = r.json;
  assert.equal(tInv.status, 'draft'); assert.equal(tInv.data.lines.length, 1); assert.equal(tInv.data.lines[0].qty, 2.25); assert.equal(tInv.total, 1800);
  assert.match(tInv.data.lines[0].description, /API design/);
  expect(await member.post('/api/crm/time/invoice', { ids: [t1.id] }), 409, 'already invoiced');
  expect(await member.del(`/api/crm/time/${t1.id}`), 409, 'delete invoiced time');
  r = await admin.post('/api/crm/time/invoice', { ids: [tAdmin.id], invoice_id: tInv.id, group: 'entry' });
  assert.equal(r.json.id, tInv.id); assert.equal(r.json.data.lines.length, 2, 'appended to the existing draft');
  const kept = r.json.data.lines.filter((l) => l.qty === 2.25);
  r = await member.put(`/api/crm/documents/${tInv.id}`, { client_id: nadClient.id, date: tInv.date, due_date: tInv.due_date, data: { lines: kept } });
  expect(r, 200, 'remove a line');
  const [freed] = await sql`select invoice_id from time_entries where id = ${tAdmin.id}`;
  assert.equal(freed.invoice_id, null, 'removing the line releases its time');
  await member.patch(`/api/crm/documents/${tInv.id}/status`, { status: 'sent' });
  expect(await admin.post('/api/crm/time/invoice', { ids: [tAdmin.id], invoice_id: tInv.id }), 409, 'append to a sent invoice');
  r = await member.get('/api/crm/projects');
  assert.equal(r.json.find((p) => p.id === proj.id).minutes_logged, 180);
  ok('time: rate/client rules, own entries only, grouped invoice line (2.25 h × 800), locked once invoiced, append to draft, removing a line frees time, logged hours on projects');

  // ── expenses ──
  expect(await member.post('/api/crm/expenses', { date: today, amount: 10, billable: true }), 400, 'billable without client');
  expect(await member.post('/api/crm/expenses', { date: today, amount: 10, currency: 'USD' }), 400, 'USD without rate');
  const e1 = (await member.post('/api/crm/expenses', { date: today, supplier: 'AWS', category: 'hosting', description: 'EC2 Oct', amount: 50, currency: 'USD', fx_rate: 18, client_id: nadClient.id, billable: true, markup_pct: 10 })).json;
  const e2 = (await member.post('/api/crm/expenses', { date: today, supplier: 'Netlify', category: 'hosting', amount: 100, currency: 'NAD' })).json;
  expect(await member.post('/api/crm/expenses/rebill', { ids: [e2.id] }), 400, 'non-billable rebill');
  r = await member.post('/api/crm/expenses/rebill', { ids: [e1.id] });
  expect(r, 200, 'rebill');
  assert.equal(r.json.currency, 'NAD'); assert.equal(r.json.data.lines[0].rate, 990, '50 USD × 18 + 10%'); assert.match(r.json.data.lines[0].description, /Original USD 50.00/);
  expect(await member.put(`/api/crm/expenses/${e1.id}`, { date: today, amount: 60 }), 409, 'edit re-billed expense');
  expect(await member.del(`/api/crm/expenses/${e1.id}`), 409, 'delete re-billed expense');
  expect(await member.del(`/api/crm/documents/${r.json.id}`), 200, 'delete the draft');
  const [e1b] = await sql`select invoice_id from expenses where id = ${e1.id}`;
  assert.equal(e1b.invoice_id, null, 'deleting the draft frees the expense');
  ok('expenses: client and FX rules, re-bill converts USD→NAD with markup, locked while invoiced, freed when the draft is deleted');

  // ── marketplace ──
  expect(await member.post('/api/crm/marketplace', { date: today, gross: 100, fee: 120 }), 400, 'fee above gross');
  r = await member.post('/api/crm/marketplace', { platform: 'upwork', date: today, client_name: 'Acme', gross: 500, fee: 50, currency: 'USD', fx_rate: 18 });
  expect(r, 200, 'earning');
  const mid = r.json.id;
  r = await member.get(`/api/crm/marketplace?from=${today.slice(0, 4)}-01-01`);
  assert.equal(Number(r.json.find((m) => m.id === mid).net), 450);
  expect(await member.del(`/api/crm/marketplace/${mid}`), 200, 'delete earning');
  ok('marketplace: fee rule, net = gross − fee');

  r = await admin.get('/api/crm/export');
  assert.equal(r.json.schema, 'auvetric-crm/3'); assert.ok(Array.isArray(r.json.payments) && Array.isArray(r.json.time_entries));
  for (const p of ['/crm/time', '/crm/payments', '/crm/expenses', '/crm/marketplace', `/crm/invoices/${inv.id}`, `/crm/clients/${nadClient.id}`, '/crm']) expect(await member.req(p), 200, p);
  r = await member.req('/crm');
  assert.match(r.text, /Unbilled time/);
  ok('export includes finance tables; all Phase 3 pages render; dashboard shows unbilled time');

  console.log(`\nCRM Phase 3: ${passed} checks passed.`);
} catch (e) {
  console.error('\nFAILED:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  if (companyBackup) await sql`update companies set data = ${sql.json(companyBackup.data)} where id = ${companyBackup.id}`.catch(() => {});
  await cleanup().catch((e) => console.error('cleanup:', e.message));
  await sql.end({ timeout: 5 });
}
