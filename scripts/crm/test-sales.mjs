// End-to-end Phase 2 tests (sales, tasks, n8n ingest, public enquiry form) against a running server.
//   Server must run with CONTACT_PROVIDER=crm.   CRM_TEST_URL=http://localhost:3100 npm run crm:test:sales
// Test data: users *@crm-test.invalid, organisations/titles "ZZ Test …", job keys "zz-test-…".
import assert from 'node:assert/strict';
import { hashPassword } from '../../src/crm/server/password.ts';
import { base32Decode, totp } from '../../src/crm/server/totp.ts';
import { connect, isHostedDb } from './env.mjs';

const BASE = (process.env.CRM_TEST_URL || 'http://localhost:3100').replace(/\/$/, '');
if (/auvetric\.com|netlify\.app/.test(BASE) || isHostedDb()) { console.error('Refusing to run against production.'); process.exit(2); }
const ORIGIN = new URL(BASE).origin;
const sql = connect();
const DOMAIN = 'crm-test.invalid';
const PW = 'Sales-Test-Pass-Phrase-2026';
const RUN = Date.now().toString(36);
let passed = 0;
const ok = (l) => { passed++; console.log(`  ✓ ${l}`); };
const expect = (r, status, label) => assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${r.text.slice(0, 300)}`);

function client(ip) {
  let cookie = '';
  const req = async (path, { method = 'GET', body, origin = ORIGIN, headers: extra = {}, raw } = {}) => {
    const headers = { 'x-forwarded-for': ip, ...extra };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined && !raw) headers['content-type'] = 'application/json';
    if (origin && method !== 'GET') headers.origin = origin;
    const res = await fetch(BASE + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); cookie = pair.split('=')[1] ? pair : ''; }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text };
  };
  return {
    req, get: (p) => req(p), post: (p, b = {}, o) => req(p, { method: 'POST', body: b, ...o }),
    put: (p, b) => req(p, { method: 'PUT', body: b }), patch: (p, b) => req(p, { method: 'PATCH', body: b }), del: (p) => req(p, { method: 'DELETE' }),
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
function n8n(token, ip = '10.98.0.50') {
  const call = async (method, path, body) => {
    const res = await fetch(BASE + '/api/ingest' + path, { method, headers: { 'x-forwarded-for': ip, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), patch: (p, b) => call('PATCH', p, b) };
}
async function submitForm(ip, fields = {}) {
  const fd = new FormData();
  const f = { intent: 'project', name: 'Zed Tester', organisation: `ZZ Test Org ${RUN}`, email: `zed+${RUN}@${DOMAIN}`, phone: '+264 81 000 0000',
    interest: 'Engineering & Development', description: 'We need a telemetry dashboard for 40 pumps with MQTT and alarms.', budget: 'Not specified',
    timeline: 'Within 3 months', consent: 'on', website: '', started: String(Date.now() - 10_000), ...fields };
  for (const [k, v] of Object.entries(f)) fd.set(k, v);
  const res = await fetch(BASE + '/api/contact', { method: 'POST', headers: { 'x-forwarded-for': ip, origin: ORIGIN }, body: fd });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}

async function cleanup() {
  const users = (await sql`select id from users where email like ${'%@' + DOMAIN}`).map((u) => u.id);
  const leads = (await sql`select id from leads where title like 'ZZ Test%' or organisation like 'ZZ Test%' or ${users.length ? sql`created_by in ${sql(users)}` : sql`false`}`).map((l) => l.id);
  const enq = (await sql`select id from enquiries where email like ${'%@' + DOMAIN} or organisation like 'ZZ Test%'`).map((e) => e.id);
  const opp = (await sql`select id from opportunities where job_key like 'zz-test-%'`).map((o) => o.id);
  const clients = (await sql`select id from clients where name like 'ZZ Test%'`).map((c) => c.id);
  const projects = (await sql`select id from projects where title like 'ZZ Test%' or ${clients.length ? sql`client_id in ${sql(clients)}` : sql`false`}`).map((p) => p.id);
  for (const [entity, ids] of [['lead', leads], ['enquiry', enq], ['opportunity', opp], ['client', clients], ['project', projects]]) {
    if (ids.length) { await sql`delete from activities where entity = ${entity} and entity_id in ${sql(ids)}`; await sql`delete from tasks where entity = ${entity} and entity_id in ${sql(ids)}`; }
  }
  if (users.length) await sql`delete from tasks where created_by in ${sql(users)} or assignee_user_id in ${sql(users)}`;
  if (leads.length) await sql`delete from leads where id in ${sql(leads)}`;
  if (enq.length) await sql`delete from enquiries where id in ${sql(enq)}`;
  if (opp.length) await sql`delete from opportunities where id in ${sql(opp)}`;
  if (projects.length) await sql`delete from projects where id in ${sql(projects)}`;
  if (clients.length) await sql`delete from clients where id in ${sql(clients)}`;
  await sql`delete from integration_tokens where name like 'ZZ Test%'`;
  if (users.length) { await sql`delete from audit_log where user_id in ${sql(users)}`; await sql`delete from activities where user_id in ${sql(users)}`; }
  await sql`delete from users where email like ${'%@' + DOMAIN}`;
  await sql`delete from login_attempts where email like ${'%@' + DOMAIN}`;
}

try {
  await cleanup();
  const hash = await hashPassword(PW);
  for (const [email, role] of [['admin@' + DOMAIN, 'admin'], ['member@' + DOMAIN, 'member'], ['viewer@' + DOMAIN, 'readonly']]) {
    await sql`insert into users (email, name, role, password_hash, must_change_password) values (${email}, ${'Test ' + role}, ${role}, ${hash}, false)`;
  }
  const admin = await signedIn('admin@' + DOMAIN, '10.98.0.1');
  const member = await signedIn('member@' + DOMAIN, '10.98.0.2');
  const viewer = await signedIn('viewer@' + DOMAIN, '10.98.0.3');
  console.log(`CRM Phase 2 tests against ${BASE}`);

  // ── integration tokens ──
  expect(await member.get('/api/crm/integrations'), 403, 'member reads integrations');
  expect(await member.post('/api/crm/integrations/tokens', { name: 'ZZ Test x' }), 403, 'member creates token');
  let r = await admin.post('/api/crm/integrations/tokens', { name: 'ZZ Test n8n' });
  expect(r, 200, 'create token');
  const token = r.json.token;
  assert.match(token, /^auvi_[A-Za-z0-9_-]{40,}$/);
  const [stored] = await sql`select token_hash, prefix from integration_tokens where id = ${r.json.id}`;
  assert.notEqual(stored.token_hash, token); assert.equal(stored.prefix, token.slice(0, 10));
  r = await admin.get('/api/crm/integrations');
  assert.ok(r.json.tokens.every((t) => !('token_hash' in t) && !('token' in t)), 'token never listed');
  expect(await n8n(null).get('/ping'), 401, 'ingest without token');
  expect(await n8n('auvi_' + 'x'.repeat(43)).get('/ping'), 401, 'ingest with wrong token');
  expect(await member.get('/api/ingest/ping'), 401, 'session cookie is not an ingest credential');
  const bot = n8n(token);
  r = await bot.get('/ping');
  expect(r, 200, 'ping'); assert.equal(r.json.token, 'ZZ Test n8n');
  ok('integration tokens: admin-only, shown once, stored hashed; ingest rejects missing/wrong tokens and session cookies');

  // ── opportunities ingest (upsert by job_key) ──
  const jobs = [
    { job_key: `zz-test-${RUN}-1`, source: 'upwork', url: 'https://www.upwork.com/jobs/~01abc', title: 'Node-RED MQTT dashboard', company: 'Acme', budget: '$1,500 fixed', skills: 'Node-RED, MQTT', summary: 'Pump telemetry', fit_score: 88, practice: 'engineering', action: 'apply_now', received_at: new Date().toISOString() },
    { job_key: `zz-test-${RUN}-2`, source: 'linkedin', url: 'https://www.linkedin.com/jobs/view/123', title: 'Power BI analyst', fit_score: 64, practice: 'data_bi', skills: ['Power BI', 'DAX'] },
    { job_key: `zz-test-${RUN}-3`, url: 'javascript:alert(1)', title: 'Bad' },
  ];
  r = await bot.post('/opportunities', { items: jobs });
  expect(r, 200, 'ingest opportunities');
  assert.equal(r.json.created, 2); assert.equal(r.json.errors.length, 1); assert.equal(r.json.errors[0].index, 2);
  const [o1] = await sql`select * from opportunities where job_key = ${jobs[0].job_key}`;
  const [o2] = await sql`select * from opportunities where job_key = ${jobs[1].job_key}`;
  assert.equal(o2.practice, 'data'); assert.equal(o2.skills, 'Power BI, DAX');
  expect(await member.patch(`/api/crm/opportunities/${o1.id}`, { status: 'applied', notes: 'Sent proposal at $45/h' }), 200, 'set status');
  r = await bot.post('/opportunities', { items: [{ ...jobs[0], fit_score: 91, summary: 'Updated summary' }] });
  assert.equal(r.json.created, 0); assert.equal(r.json.updated, 1);
  const [o1b] = await sql`select * from opportunities where id = ${o1.id}`;
  assert.equal(o1b.fit_score, 91); assert.equal(o1b.status, 'applied', 'CRM status survives re-ingest'); assert.equal(o1b.notes, 'Sent proposal at $45/h');
  r = await bot.post('/opportunities', { items: Array.from({ length: 201 }, (_, i) => ({ job_key: `zz-test-x-${i}`, title: 'x' })) });
  expect(r, 400, 'batch too large');
  ok('opportunities: upsert by job_key, practice normalised, unsafe URL rejected per item, CRM status/notes survive re-ingest, batch cap');

  r = await member.get('/api/crm/opportunities?status=&min_fit=80&days=7');
  assert.ok(r.json.some((x) => x.id === o1.id) && !r.json.some((x) => x.id === o2.id), 'fit filter');
  r = await member.post('/api/crm/opportunities/bulk-status', { ids: [o2.id], status: 'skipped' });
  assert.equal(r.json.updated, 1);
  ok('opportunity list filters and bulk status');

  // ── public enquiry form → CRM ──
  r = await submitForm('10.98.1.1');
  expect(r, 200, 'contact form'); assert.match(r.json.ref, /^AUV-\d{5}$/);
  const [e1] = await sql`select * from enquiries where organisation = ${`ZZ Test Org ${RUN}`} order by id desc limit 1`;
  assert.equal(e1.source, 'website'); assert.equal(e1.triage_status, 'pending'); assert.equal(e1.status, 'new'); assert.equal(e1.ip, '10.98.1.1');
  assert.equal(e1.intent, 'Discuss a Project');
  expect(await submitForm('10.98.1.2', { website: 'http://spam' }), 400, 'honeypot');
  expect(await submitForm('10.98.1.2', { started: String(Date.now()) }), 400, 'too fast');
  expect(await submitForm('10.98.1.2', { consent: '' }), 422, 'no consent');
  const burst = [];
  for (let i = 0; i < 6; i++) burst.push((await submitForm('10.98.1.9', { email: `burst${i}+${RUN}@${DOMAIN}` })).status);
  assert.deepEqual(burst.slice(0, 5), [200, 200, 200, 200, 200]); assert.equal(burst[5], 429, 'sixth submission from one IP in 10 minutes');
  ok(`website form stores the enquiry in the CRM (ref ${r.json.ref}); honeypot, timing, consent and per-IP limit enforced`);

  // ── relay / backfill ingest ──
  const relay = { submission_id: `zz-test-relay-${RUN}`, name: 'Relay Person', organisation: `ZZ Test Relay ${RUN}`, email: `relay+${RUN}@${DOMAIN}`, message: 'Need Power BI', submitted_at: '2026-10-01T08:00:00Z',
    ai: { category: 'project', practice: 'data_bi', priority: 'high', spam_score: 5, summary: 'Wants Power BI', suggested_reply: 'Hi' } };
  r = await bot.post('/enquiries', { items: [relay, { name: 'No id' }] });
  assert.equal(r.json.created, 1); assert.equal(r.json.errors.length, 1);
  r = await bot.post('/enquiries', { items: [relay] });
  assert.equal(r.json.created, 0); assert.equal(r.json.existing, 1);
  const [er] = await sql`select * from enquiries where submission_id = ${relay.submission_id}`;
  assert.equal(er.source, 'relay'); assert.equal(er.triage_status, 'done'); assert.equal(er.ai.priority, 'high');
  ok('relay/backfill enquiries: idempotent by submission_id; pre-triaged rows are not queued again');

  // ── AI triage queue ──
  await sql`update enquiries set triage_status = 'done' where triage_status in ('pending','claimed') and email not like ${'%@' + DOMAIN}`; // isolate from real local rows
  r = await bot.post('/enquiries/claim', { limit: 20 });
  expect(r, 200, 'claim');
  const claimed = r.json.items.map((x) => x.id);
  assert.ok(claimed.includes(e1.id), 'website enquiry claimed'); assert.ok(!claimed.includes(er.id), 'triaged relay row not claimed');
  r = await bot.post('/enquiries/claim', { limit: 20 });
  assert.equal(r.json.items.filter((x) => claimed.includes(x.id)).length, 0, 'no double claim');
  r = await bot.patch(`/enquiries/${e1.id}/triage`, { ok: true, ai: { category: 'project', practice: 'engineering', priority: 'high', spam_score: 3, summary: 'Telemetry for 40 pumps', key_requirements: 'MQTT\nAlarms', questions_to_ask: 'Which PLCs?', suggested_reply: 'Thanks for reaching out' } });
  expect(r, 200, 'triage'); assert.equal(r.json.alert, true);
  const spamId = claimed.find((x) => x !== e1.id);
  r = await bot.patch(`/enquiries/${spamId}/triage`, { ok: true, ai: { category: 'spam', spam_score: 95, summary: 'junk' } });
  assert.equal(r.json.alert, false); assert.equal(r.json.status, 'spam');
  const failId = claimed.filter((x) => x !== e1.id && x !== spamId)[0];
  r = await bot.patch(`/enquiries/${failId}/triage`, { ok: false, error: 'ollama timeout' });
  assert.equal(r.json.triage_status, 'pending', 'first failure goes back to the queue'); assert.equal(r.json.alert, false);
  for (let i = 0; i < 2; i++) { await bot.post('/enquiries/claim', { limit: 20 }); r = await bot.patch(`/enquiries/${failId}/triage`, { ok: false, error: 'ollama timeout' }); }
  assert.equal(r.json.triage_status, 'failed', 'gives up after 3 attempts'); assert.equal(r.json.alert, true, 'partners still alerted after the last attempt');
  await sql`update enquiries set triage_claimed_at = now() - interval '30 minutes', triage_status = 'claimed' where id = ${claimed[claimed.length - 1]} and triage_status = 'claimed'`;
  expect(await bot.patch('/enquiries/999999999/triage', { ok: true, ai: {} }), 404, 'unknown enquiry');
  ok('triage queue: atomic claim, no double claim, results stored, spam not alerted, failures retried 3× then flagged and alerted');

  r = await member.post(`/api/crm/enquiries/${failId}/retriage`);
  assert.equal(r.json.triage_status, 'pending');
  r = await member.get('/api/crm/enquiries?status=open');
  assert.ok(r.json.some((x) => x.id === e1.id) && !r.json.some((x) => x.id === spamId), 'spam hidden from inbox');
  r = await member.get(`/api/crm/enquiries/${e1.id}`);
  assert.equal(r.json.enquiry.ai.summary, 'Telemetry for 40 pumps'); assert.equal(r.json.enquiry.ip, undefined, 'IP not exposed to the UI');
  expect(await viewer.patch(`/api/crm/enquiries/${e1.id}`, { status: 'reviewed' }), 403, 'read-only');
  expect(await member.del(`/api/crm/enquiries/${spamId}`), 403, 'member delete');
  expect(await admin.del(`/api/crm/enquiries/${spamId}`), 200, 'admin delete');
  ok('enquiries in the CRM: inbox excludes spam, AI fields shown, IP hidden, retriage, roles, admin-only delete');

  // ── conversions & pipeline ──
  r = await member.post(`/api/crm/enquiries/${e1.id}/lead`);
  expect(r, 200, 'enquiry → lead');
  const lead = r.json;
  assert.equal(lead.stage, 'new'); assert.equal(lead.source, 'website'); assert.equal(lead.practice, 'engineering'); assert.match(lead.notes, /Telemetry for 40 pumps/);
  r = await member.post(`/api/crm/enquiries/${e1.id}/lead`);
  assert.equal(r.json.id, lead.id, 'idempotent');
  r = await member.get(`/api/crm/enquiries/${e1.id}`);
  assert.equal(r.json.enquiry.status, 'converted'); assert.equal(r.json.enquiry.lead_id, lead.id);

  r = await member.post(`/api/crm/opportunities/${o1.id}/lead`);
  const oppLead = r.json;
  assert.equal(oppLead.stage, 'qualified'); assert.equal(oppLead.source, 'upwork'); assert.equal(oppLead.currency, 'USD');
  r = await member.post('/api/crm/leads', { title: 'ZZ Test Referral', source: 'referral', value: 50000, currency: 'NAD', stage: 'proposal' });
  expect(r, 200, 'manual lead');
  const ref = r.json;
  assert.equal(ref.probability, 60, 'stage default probability');
  expect(await member.post('/api/crm/leads', { title: 'ZZ Test bad', stage: 'maybe' }), 400, 'bad stage');
  expect(await member.post('/api/crm/leads/move', { id: lead.id, stage: 'discovery', ids: [lead.id] }), 200, 'move');
  expect(await member.post('/api/crm/leads/move', { id: oppLead.id, stage: 'won', ids: [oppLead.id] }), 200, 'win');
  r = await member.get(`/api/crm/opportunities/${o1.id}`);
  assert.equal(r.json.opportunity.status, 'won', 'won lead marks the listing won');
  r = await member.get(`/api/crm/leads/${oppLead.id}`);
  assert.ok(r.json.lead.closed_at); assert.ok(r.json.activities.some((a) => a.body === 'Moved to Won'));
  assert.equal(r.json.opportunity.id, o1.id);
  r = await member.post(`/api/crm/leads/${lead.id}/client`);
  expect(r, 200, 'lead → client');
  assert.equal(r.json.name, `ZZ Test Org ${RUN}`);
  const newClient = r.json;
  const [contact] = await sql`select * from contacts where client_id = ${newClient.id}`;
  assert.equal(contact.name, 'Zed Tester'); assert.equal(contact.is_primary, true);
  r = await member.get(`/api/crm/enquiries/${e1.id}`);
  assert.equal(r.json.enquiry.client_id, newClient.id, 'enquiry linked to the new client');
  r = await member.post(`/api/crm/leads/${lead.id}/project`);
  expect(r, 200, 'lead → project');
  assert.equal(r.json.client_id, newClient.id);
  r = await member.post(`/api/crm/leads/${lead.id}/project`);
  r = await member.get(`/api/crm/leads/${lead.id}`);
  assert.ok(r.json.project, 'project linked'); assert.equal((await sql`select count(*)::int as n from projects where client_id = ${newClient.id}`)[0].n, 1, 'no duplicate project');
  r = await member.put(`/api/crm/leads/${ref.id}`, { ...ref, stage: 'lost', lost_reason: 'Price' });
  assert.equal(r.json.stage, 'lost'); assert.ok(r.json.closed_at);
  r = await member.put(`/api/crm/leads/${ref.id}`, { ...r.json, stage: 'negotiation' });
  assert.equal(r.json.closed_at, null, 'reopened lead clears closed_at');
  ok('conversions: enquiry → lead (idempotent) → client with contact → project (once); listing → lead; won lead marks the listing won; stage defaults and closing dates');

  // ── tasks & timeline ──
  r = await member.post('/api/crm/tasks', { title: 'ZZ Test call back', entity: 'lead', entity_id: lead.id, due_date: '2026-01-02' });
  expect(r, 200, 'task'); const task = r.json;
  const me = (await member.get('/api/crm/auth/me')).json.user;
  assert.equal(task.assignee_user_id, me.id, 'defaults to the creator');
  expect(await member.post('/api/crm/tasks', { title: 'ZZ Test orphan', entity: 'lead', entity_id: '999999999' }), 400, 'link to missing record');
  r = await member.get('/api/crm/tasks?scope=open&assignee=me');
  assert.ok(r.json.some((t) => t.id === task.id && t.entity_label === lead.title));
  r = await member.get('/api/crm/leads');
  assert.equal(r.json.find((l) => l.id === lead.id).open_tasks, 1);
  r = await member.patch(`/api/crm/tasks/${task.id}/done`, { done: true });
  assert.equal(r.json.done, true); assert.ok(r.json.done_at);
  r = await member.post('/api/crm/activities', { entity: 'lead', entity_id: lead.id, kind: 'call', body: 'Discovery call booked' });
  expect(r, 200, 'lead activity');
  r = await member.get(`/api/crm/leads/${lead.id}`);
  assert.ok(r.json.activities.some((a) => a.body === 'Task done: ZZ Test call back') && r.json.activities.some((a) => a.kind === 'call'));
  expect(await viewer.post('/api/crm/tasks', { title: 'ZZ Test viewer' }), 403, 'read-only task');
  ok('tasks: linked records validated, default assignee, open counts on leads, done logs to the timeline; timelines on leads');

  // ── deletion keeps the enquiry ──
  r = await member.post('/api/crm/leads', { title: 'ZZ Test throwaway' });
  expect(await member.del(`/api/crm/leads/${r.json.id}`), 200, 'delete lead');
  r = await admin.get('/api/crm/export');
  assert.equal(r.json.schema, 'auvetric-crm/4'); assert.ok(r.json.leads.length >= 3 && r.json.enquiries.length >= 1 && Array.isArray(r.json.tasks));
  assert.ok(!('token_hash' in r.json) && !r.json.integration_tokens, 'tokens not exported');
  ok('lead delete; backup export includes sales data and never tokens');

  // ── revoke ──
  const tid = (await sql`select id from integration_tokens where name = 'ZZ Test n8n'`)[0].id;
  expect(await admin.del(`/api/crm/integrations/tokens/${tid}`), 200, 'revoke');
  expect(await bot.get('/ping'), 401, 'revoked token');
  r = await admin.get('/api/crm/integrations');
  assert.ok(r.json.tokens.find((t) => t.id === tid).revoked_at);
  ok('revoked token stops working at once');

  for (const p of ['/crm', '/crm/enquiries', '/crm/opportunities', '/crm/leads', '/crm/tasks', '/crm/integrations', `/crm/leads?open=${lead.id}`]) expect(await admin.req(p), 200, p);
  r = await admin.req('/crm');
  assert.match(r.text, /New enquiries/); assert.match(r.text, /Top job matches/);
  ok('all Phase 2 pages render; dashboard shows the sales row');

  console.log(`\nCRM Phase 2: ${passed} checks passed.`);
} catch (e) {
  console.error('\nFAILED:', e.stack || e.message);
  process.exitCode = 1;
} finally {
  await cleanup().catch((e) => console.error('cleanup:', e.message));
  await sql.end({ timeout: 5 });
}
