/** CRM JSON API · Phase 2 sales: enquiries, opportunities, leads pipeline, tasks, integrations. */
import { purgeAttachments } from "../attachments";
import { z } from "zod";
import { db } from "../db";
import { audit, HttpError } from "../http";
import { id, route } from "../router";
import { email, idRef, money, name, optDate, practice, currency, text } from "../validate";
import { logActivity, parse } from "./routes";
import { storeEnquiry } from "../enquiries";
import { newToken } from "../ingest";
import { ENQ_STATUSES, LEAD_SOURCES, LEAD_STAGE_KEYS, LEAD_STAGES, OPP_STATUSES, TASK_ENTITIES, stageLabel, type LeadSource } from "@/crm/shared/sales";
import { DEFAULT_PROJECT_COLUMNS, type BoardColumn } from "@/crm/shared/types";

const sql = () => db();
const likeOf = (q: string | null | undefined) => (q?.trim() ? `%${q.trim().replace(/[%_\\]/g, (m) => "\\" + m)}%` : null);
const optMoney = z.union([money, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v));
const optPractice = z.union([practice, z.literal(""), z.null()]).optional().transform((v) => v || null);

async function nextPosition(stage: string) {
  const [{ p }] = await sql()`select coalesce(max(position), 0) + 1000 as p from leads where stage = ${stage}`;
  return Number(p);
}

// ───────────────────────── enquiries ─────────────────────────
route("GET", "/enquiries", async ({ query }) => {
  const s = sql();
  const status = query.get("status");
  const like = likeOf(query.get("q"));
  return s`
    select e.id, e.submission_id, e.source, e.submitted_at, e.name, e.organisation, e.email, e.phone, e.intent, e.interest, e.budget, e.timeline,
           left(e.message, 400) as message, e.status, e.triage_status, e.triage_attempts, e.triaged_at, e.ai, e.client_id, e.lead_id
    from enquiries e where true
      ${status && (ENQ_STATUSES as readonly string[]).includes(status) ? s`and e.status = ${status}` : status === "open" ? s`and e.status in ('new','reviewed')` : s``}
      ${like ? s`and (e.name ilike ${like} or e.organisation ilike ${like} or e.email ilike ${like} or e.message ilike ${like})` : s``}
    order by e.submitted_at desc limit 500`;
});
route("GET", "/enquiries/:id", async ({ params }) => {
  const eid = id(params.id, "Enquiry");
  const [enquiry] = await sql()`select e.*, c.name as client_name, l.title as lead_title from enquiries e
    left join clients c on c.id = e.client_id left join leads l on l.id = e.lead_id where e.id = ${eid}`;
  if (!enquiry) throw new HttpError(404, "Enquiry not found.");
  delete enquiry.ip;
  const activities = await sql()`select a.*, u.name as user_name from activities a left join users u on u.id = a.user_id
    where a.entity = 'enquiry' and a.entity_id = ${eid} order by a.at desc limit 100`;
  return { enquiry, activities };
});
route("POST", "/enquiries", async ({ req, session }) => {
  const b = await parse(req, z.object({
    name: name("Name", 160), organisation: text(200), email, phone: text(60), interest: text(120), budget: text(80), timeline: text(80),
    message: name("Message", 8000), intent: text(60),
  }));
  const { enquiry } = await storeEnquiry({ ...b, source: "manual" }, null);
  await logActivity("enquiry", enquiry.id, "Enquiry captured manually", session.user.id);
  return enquiry;
});
route("PATCH", "/enquiries/:id", async ({ req, params, session }) => {
  const eid = id(params.id, "Enquiry");
  const b = await parse(req, z.object({ status: z.enum(ENQ_STATUSES).optional(), notes: z.string().max(10000).optional() }));
  const [before] = await sql()`select status from enquiries where id = ${eid}`;
  if (!before) throw new HttpError(404, "Enquiry not found.");
  const [row] = await sql()`update enquiries set status = coalesce(${b.status ?? null}, status), notes = coalesce(${b.notes ?? null}, notes), updated_at = now()
    where id = ${eid} returning *`;
  if (b.status && b.status !== before.status) await logActivity("enquiry", eid, `Marked ${b.status}`, session.user.id);
  delete row.ip;
  return row;
});
route("POST", "/enquiries/:id/retriage", async ({ params, session }) => {
  const eid = id(params.id, "Enquiry");
  const [row] = await sql()`update enquiries set triage_status = 'pending', triage_attempts = 0, triage_claimed_at = null,
      status = case when status = 'spam' then 'new' else status end, updated_at = now() where id = ${eid} returning id, triage_status, status`;
  if (!row) throw new HttpError(404, "Enquiry not found.");
  await logActivity("enquiry", eid, "AI triage requested again", session.user.id);
  return row;
});
route("POST", "/enquiries/:id/lead", async ({ params, session }) => {
  const eid = id(params.id, "Enquiry");
  return sql().begin(async (tx) => {
    const [e] = await tx`select * from enquiries where id = ${eid} for update`;
    if (!e) throw new HttpError(404, "Enquiry not found.");
    if (e.lead_id) return (await tx`select * from leads where id = ${e.lead_id}`)[0];
    const ai = (e.ai ?? {}) as Record<string, string>;
    const [{ p }] = await tx`select coalesce(max(position), 0) + 1000 as p from leads where stage = 'new'`;
    const title = `${e.organisation || e.name}${e.interest && e.interest !== "Not sure yet" ? ` · ${e.interest}` : ""}`.slice(0, 300);
    const notes = [ai.summary, ai.key_requirements && `Requirements:\n${ai.key_requirements}`, `Budget: ${e.budget || "n/a"} · Timeline: ${e.timeline || "n/a"}`].filter(Boolean).join("\n\n");
    const [lead] = await tx`insert into leads ${tx({
      title, stage: "new", position: Number(p), client_id: e.client_id, contact_name: e.name, organisation: e.organisation, email: e.email, phone: e.phone,
      practice: ["engineering", "data", "automation", "consultancy"].includes(ai.practice) ? ai.practice : null, source: "website",
      owner_user_id: session.user.id, enquiry_id: e.id, notes: notes.slice(0, 10000), probability: LEAD_STAGES[0].probability, created_by: session.user.id,
    } as never)} returning *`;
    await tx`update enquiries set lead_id = ${lead.id}, status = 'converted', updated_at = now() where id = ${e.id}`;
    await tx`insert into activities (entity, entity_id, kind, body, user_id) values
      ('lead', ${lead.id}, 'system', ${`Lead created from website enquiry by ${e.name}`}, ${session.user.id}),
      ('enquiry', ${e.id}, 'system', ${`Converted to lead “${title}”`}, ${session.user.id})`;
    return lead;
  });
});
route("POST", "/enquiries/:id/client", async ({ params, session }) => {
  const eid = id(params.id, "Enquiry");
  const [e] = await sql()`select * from enquiries where id = ${eid}`;
  if (!e) throw new HttpError(404, "Enquiry not found.");
  if (e.client_id) return (await sql()`select * from clients where id = ${e.client_id}`)[0];
  const client = await createClient({ organisation: e.organisation, contact: e.name, email: e.email, phone: e.phone, note: `From website enquiry (${String(e.submitted_at instanceof Date ? e.submitted_at.toISOString() : e.submitted_at).slice(0, 10)})` }, session.user.id);
  await sql()`update enquiries set client_id = ${client.id}, status = case when status in ('new','reviewed') then 'converted' else status end, updated_at = now() where id = ${eid}`;
  if (e.lead_id) await sql()`update leads set client_id = ${client.id}, updated_at = now() where id = ${e.lead_id} and client_id is null`;
  await logActivity("enquiry", eid, `Client “${client.name}” created`, session.user.id);
  return client;
});
route("DELETE", "/enquiries/:id", async ({ params, session, meta }) => {
  const eid = id(params.id, "Enquiry");
  const [e] = await sql()`delete from enquiries where id = ${eid} returning email`;
  if (!e) throw new HttpError(404, "Enquiry not found.");
  await sql()`delete from activities where entity = 'enquiry' and entity_id = ${eid}`;
  await purgeAttachments("enquiry", [eid]);
  await sql()`delete from tasks where entity = 'enquiry' and entity_id = ${eid}`;
  await audit(session.user.id, "enquiry.delete", meta, {}, "enquiry", eid);
  return { ok: true };
}, { admin: true });

async function createClient(f: { organisation: string; contact: string; email: string; phone: string; note: string }, userId: string) {
  const clientName = (f.organisation || f.contact || "New client").slice(0, 300);
  const [c] = await sql()`insert into clients ${sql()({ name: clientName, email: f.email.slice(0, 254), phone: f.phone.slice(0, 100), notes: f.note } as never)} returning *`;
  if (f.contact) await sql()`insert into contacts (client_id, name, email, phone, is_primary) values (${c.id}, ${f.contact.slice(0, 200)}, ${f.email.slice(0, 254)}, ${f.phone.slice(0, 100)}, true)`;
  await logActivity("client", c.id, `Client created (${f.note})`, userId);
  return c;
}

// ───────────────────────── opportunities ─────────────────────────
route("GET", "/opportunities", async ({ query }) => {
  const s = sql();
  const status = query.get("status");
  const minFit = Math.max(0, Math.min(100, Number(query.get("min_fit")) || 0));
  const source = query.get("source");
  const days = Number(query.get("days")) || 0;
  const like = likeOf(query.get("q"));
  return s`
    select o.*, l.title as lead_title from opportunities o left join leads l on l.id = o.lead_id where o.fit_score >= ${minFit}
      ${status && (OPP_STATUSES as readonly string[]).includes(status) ? s`and o.status = ${status}` : status === "open" ? s`and o.status in ('new','shortlisted','applied','interviewing')` : s``}
      ${source && /^[a-z]{2,20}$/.test(source) ? s`and o.source = ${source}` : s``}
      ${days > 0 && days <= 365 ? s`and o.received_at > now() - ${days + " days"}::interval` : s``}
      ${like ? s`and (o.title ilike ${like} or o.company ilike ${like} or o.skills ilike ${like} or o.summary ilike ${like})` : s``}
    order by o.received_at desc, o.fit_score desc limit 1000`;
});
route("GET", "/opportunities/:id", async ({ params }) => {
  const oid = id(params.id, "Opportunity");
  const [opportunity] = await sql()`select o.*, l.title as lead_title from opportunities o left join leads l on l.id = o.lead_id where o.id = ${oid}`;
  if (!opportunity) throw new HttpError(404, "Opportunity not found.");
  const activities = await sql()`select a.*, u.name as user_name from activities a left join users u on u.id = a.user_id
    where a.entity = 'opportunity' and a.entity_id = ${oid} order by a.at desc limit 100`;
  return { opportunity, activities };
});
route("PATCH", "/opportunities/:id", async ({ req, params, session }) => {
  const oid = id(params.id, "Opportunity");
  const b = await parse(req, z.object({ status: z.enum(OPP_STATUSES).optional(), notes: z.string().max(10000).optional() }));
  const [before] = await sql()`select status from opportunities where id = ${oid}`;
  if (!before) throw new HttpError(404, "Opportunity not found.");
  const [row] = await sql()`update opportunities set status = coalesce(${b.status ?? null}, status), notes = coalesce(${b.notes ?? null}, notes), updated_at = now()
    where id = ${oid} returning *`;
  if (b.status && b.status !== before.status) await logActivity("opportunity", oid, `Status: ${before.status} → ${b.status}`, session.user.id);
  return row;
});
route("POST", "/opportunities/bulk-status", async ({ req, session }) => {
  const b = await parse(req, z.object({ ids: z.array(z.union([z.string(), z.number()]).transform(String)).min(1).max(500), status: z.enum(OPP_STATUSES) }));
  const ids = b.ids.filter((x) => /^\d{1,18}$/.test(x));
  const rows = await sql()`update opportunities set status = ${b.status}, updated_at = now() where id in ${sql()(ids)} and status <> ${b.status} returning id`;
  for (const r of rows) await logActivity("opportunity", r.id, `Status → ${b.status} (bulk)`, session.user.id);
  return { updated: rows.length };
});
route("POST", "/opportunities/:id/lead", async ({ params, session }) => {
  const oid = id(params.id, "Opportunity");
  return sql().begin(async (tx) => {
    const [o] = await tx`select * from opportunities where id = ${oid} for update`;
    if (!o) throw new HttpError(404, "Opportunity not found.");
    if (o.lead_id) return (await tx`select * from leads where id = ${o.lead_id}`)[0];
    const source: LeadSource = (LEAD_SOURCES as readonly string[]).includes(o.source) ? o.source : "other";
    const [{ p }] = await tx`select coalesce(max(position), 0) + 1000 as p from leads where stage = 'qualified'`;
    const notes = [o.summary, o.budget && `Budget: ${o.budget}`, o.url && `Listing: ${o.url}`, o.reasons && `Fit (${o.fit_score}/100): ${o.reasons}`].filter(Boolean).join("\n\n");
    const [lead] = await tx`insert into leads ${tx({
      title: o.title.slice(0, 300), stage: "qualified", position: Number(p), organisation: o.company, practice: o.practice, source,
      owner_user_id: session.user.id, opportunity_id: o.id, notes: notes.slice(0, 10000), probability: LEAD_STAGES[1].probability,
      currency: /\$|usd/i.test(o.budget) ? "USD" : "NAD", created_by: session.user.id,
    } as never)} returning *`;
    await tx`update opportunities set lead_id = ${lead.id}, status = case when status = 'new' then 'shortlisted' else status end, updated_at = now() where id = ${o.id}`;
    await tx`insert into activities (entity, entity_id, kind, body, user_id) values
      ('lead', ${lead.id}, 'system', ${`Lead created from ${o.source} listing (fit ${o.fit_score}/100)`}, ${session.user.id}),
      ('opportunity', ${o.id}, 'system', 'Added to the leads pipeline', ${session.user.id})`;
    return lead;
  });
});

// ───────────────────────── leads pipeline ─────────────────────────
const LeadBody = z.object({
  title: name("Title"), stage: z.enum(LEAD_STAGE_KEYS as [string, ...string[]]).optional(), client_id: idRef,
  contact_name: text(200), organisation: text(200), email, phone: text(100), value: optMoney, currency: currency.default("NAD"),
  probability: z.union([z.coerce.number().int().min(0).max(100), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  practice: optPractice, source: z.enum(LEAD_SOURCES).default("direct"), owner_user_id: idRef, next_follow_up: optDate,
  notes: text(10000), lost_reason: text(1000),
});
const LEAD_SELECT = (s: ReturnType<typeof sql>) => s`
  select l.*, c.name as client_name, u.name as owner_name,
    (select count(*)::int from tasks t where t.entity = 'lead' and t.entity_id = l.id and not t.done) as open_tasks
  from leads l left join clients c on c.id = l.client_id left join users u on u.id = l.owner_user_id`;

async function syncOpportunity(leadId: string, stage: string, userId: string) {
  if (stage !== "won" && stage !== "lost") return;
  const rows = await sql()`update opportunities set status = ${stage}, updated_at = now() where lead_id = ${leadId} and status <> ${stage} returning id`;
  for (const r of rows) await logActivity("opportunity", r.id, `Lead ${stage}`, userId);
}

route("GET", "/leads", async () => { const s = sql(); return s`${LEAD_SELECT(s)} order by l.stage, l.position`; });
route("GET", "/leads/:id", async ({ params }) => {
  const lid = id(params.id, "Lead");
  const s = sql();
  const [lead] = await s`${LEAD_SELECT(s)} where l.id = ${lid}`;
  if (!lead) throw new HttpError(404, "Lead not found.");
  const [activities, tasks, enquiry, opportunity, project] = await Promise.all([
    s`select a.*, u.name as user_name from activities a left join users u on u.id = a.user_id where a.entity = 'lead' and a.entity_id = ${lid} order by a.at desc limit 200`,
    s`select t.*, u.name as assignee_name from tasks t left join users u on u.id = t.assignee_user_id where t.entity = 'lead' and t.entity_id = ${lid} order by t.done, t.due_date nulls last, t.id`,
    lead.enquiry_id ? s`select id, name, submitted_at, message from enquiries where id = ${lead.enquiry_id}` : Promise.resolve([]),
    lead.opportunity_id ? s`select id, title, url, fit_score, source from opportunities where id = ${lead.opportunity_id}` : Promise.resolve([]),
    lead.project_id ? s`select id, title, status from projects where id = ${lead.project_id}` : Promise.resolve([]),
  ]);
  return { lead, activities, tasks, enquiry: enquiry[0] ?? null, opportunity: opportunity[0] ?? null, project: project[0] ?? null };
});
route("POST", "/leads", async ({ req, session }) => {
  const b = await parse(req, LeadBody);
  const stage = b.stage ?? "new";
  const [lead] = await sql()`insert into leads ${sql()({
    ...b, stage, position: await nextPosition(stage), probability: b.probability ?? LEAD_STAGES.find((x) => x.key === stage)!.probability,
    owner_user_id: b.owner_user_id ?? session.user.id, created_by: session.user.id,
    closed_at: stage === "won" || stage === "lost" ? new Date() : null,
  } as never)} returning *`;
  await logActivity("lead", lead.id, "Lead created", session.user.id);
  if (lead.client_id) await logActivity("client", lead.client_id, `Lead “${lead.title}” created`, session.user.id);
  return lead;
});
route("PUT", "/leads/:id", async ({ req, params, session }) => {
  const lid = id(params.id, "Lead");
  const b = await parse(req, LeadBody);
  const [before] = await sql()`select stage from leads where id = ${lid}`;
  if (!before) throw new HttpError(404, "Lead not found.");
  const stage = b.stage ?? before.stage;
  const moved = stage !== before.stage;
  const [lead] = await sql()`update leads set ${sql()({ ...b, stage } as never)},
      position = case when ${moved} then ${moved ? await nextPosition(stage) : 0} else position end,
      closed_at = case when ${stage} in ('won','lost') then coalesce(closed_at, now()) else null end, updated_at = now()
    where id = ${lid} returning *`;
  if (moved) { await logActivity("lead", lid, `Moved to ${stageLabel(stage)}`, session.user.id); await syncOpportunity(lid, stage, session.user.id); }
  return lead;
});
route("POST", "/leads/move", async ({ req, session }) => {
  const b = await parse(req, z.object({ id: z.union([z.string(), z.number()]).transform(String), stage: z.enum(LEAD_STAGE_KEYS as [string, ...string[]]), ids: z.array(z.union([z.string(), z.number()]).transform(String)).max(1000) }));
  const lid = id(b.id, "Lead");
  let moved = false;
  await sql().begin(async (tx) => {
    const [before] = await tx`select stage from leads where id = ${lid} for update`;
    if (!before) throw new HttpError(404, "Lead not found.");
    moved = before.stage !== b.stage;
    await tx`update leads set stage = ${b.stage}, updated_at = now(),
      closed_at = case when ${b.stage} in ('won','lost') then coalesce(closed_at, now()) else null end where id = ${lid}`;
    for (let i = 0; i < b.ids.length; i++) if (/^\d{1,18}$/.test(b.ids[i])) await tx`update leads set position = ${(i + 1) * 1000} where id = ${b.ids[i]} and stage = ${b.stage}`;
    if (moved) await tx`insert into activities (entity, entity_id, kind, body, user_id) values ('lead', ${lid}, 'system', ${"Moved to " + stageLabel(b.stage)}, ${session.user.id})`;
  });
  if (moved) await syncOpportunity(lid, b.stage, session.user.id);
  return { ok: true };
});
route("POST", "/leads/:id/client", async ({ params, session }) => {
  const lid = id(params.id, "Lead");
  const [l] = await sql()`select * from leads where id = ${lid}`;
  if (!l) throw new HttpError(404, "Lead not found.");
  if (l.client_id) return (await sql()`select * from clients where id = ${l.client_id}`)[0];
  const client = await createClient({ organisation: l.organisation, contact: l.contact_name, email: l.email, phone: l.phone, note: `From lead “${l.title}”` }, session.user.id);
  await sql()`update leads set client_id = ${client.id}, updated_at = now() where id = ${lid}`;
  if (l.enquiry_id) await sql()`update enquiries set client_id = ${client.id} where id = ${l.enquiry_id} and client_id is null`;
  await logActivity("lead", lid, `Client “${client.name}” created`, session.user.id);
  return client;
});
route("POST", "/leads/:id/project", async ({ params, session }) => {
  const lid = id(params.id, "Lead");
  const [l] = await sql()`select * from leads where id = ${lid}`;
  if (!l) throw new HttpError(404, "Lead not found.");
  if (l.project_id) return (await sql()`select * from projects where id = ${l.project_id}`)[0];
  const [row] = await sql()`select value from settings where key = 'project_columns'`;
  const cols = (row?.value as BoardColumn[]) ?? DEFAULT_PROJECT_COLUMNS;
  const [{ p }] = await sql()`select coalesce(max(position), 0) + 1000 as p from projects where status = ${cols[0].key}`;
  const [proj] = await sql()`insert into projects ${sql()({
    title: l.title, client_id: l.client_id, status: cols[0].key, position: p, practice: l.practice, lead_user_id: l.owner_user_id ?? session.user.id,
    budget_amount: l.value, budget_currency: l.currency,
    data: sql().json({ description: l.notes, checklist: [], milestones: [], tags: [], hours: 0 }),
  } as never)} returning *`;
  await sql()`update leads set project_id = ${proj.id}, updated_at = now() where id = ${lid}`;
  await logActivity("project", proj.id, `Project created from lead “${l.title}”`, session.user.id);
  await logActivity("lead", lid, `Project “${proj.title}” created`, session.user.id);
  return proj;
});
route("DELETE", "/leads/:id", async ({ params, session, meta }) => {
  const lid = id(params.id, "Lead");
  const [l] = await sql()`delete from leads where id = ${lid} returning title, enquiry_id, opportunity_id`;
  if (!l) throw new HttpError(404, "Lead not found.");
  await sql()`delete from activities where entity = 'lead' and entity_id = ${lid}`;
  await purgeAttachments("lead", [lid]);
  await sql()`delete from tasks where entity = 'lead' and entity_id = ${lid}`;
  // The enquiry goes back to the inbox unless it also became a client.
  if (l.enquiry_id) await sql()`update enquiries set status = 'reviewed', updated_at = now() where id = ${l.enquiry_id} and status = 'converted' and client_id is null`;
  await audit(session.user.id, "lead.delete", meta, { title: l.title }, "lead", lid);
  return { ok: true };
});

// ───────────────────────── tasks ─────────────────────────
const ENTITY_TABLE = { client: "clients", project: "projects", lead: "leads", enquiry: "enquiries", opportunity: "opportunities" } as const;
const TaskBody = z.object({
  title: name("Task", 300), notes: text(5000), due_date: optDate, assignee_user_id: idRef,
  entity: z.union([z.enum(TASK_ENTITIES), z.literal(""), z.null()]).optional().transform((v) => v || null),
  entity_id: idRef, done: z.boolean().default(false),
});
async function checkTaskLink(b: z.infer<typeof TaskBody>) {
  if (!b.entity || !b.entity_id) return { entity: null, entity_id: null };
  const ok = await sql()`select 1 from ${sql()(ENTITY_TABLE[b.entity])} where id = ${b.entity_id}`;
  if (!ok.length) throw new HttpError(400, "The linked record no longer exists.");
  return { entity: b.entity, entity_id: b.entity_id };
}
route("GET", "/tasks", async ({ query, session }) => {
  const s = sql();
  const scope = query.get("scope") ?? "open";
  const assignee = query.get("assignee");
  const entity = query.get("entity");
  const entityId = query.get("entity_id");
  return s`
    select t.*, u.name as assignee_name,
      case t.entity when 'client' then (select name from clients where id = t.entity_id)
                    when 'project' then (select title from projects where id = t.entity_id)
                    when 'lead' then (select title from leads where id = t.entity_id)
                    when 'enquiry' then (select name from enquiries where id = t.entity_id)
                    when 'opportunity' then (select title from opportunities where id = t.entity_id) end as entity_label
    from tasks t left join users u on u.id = t.assignee_user_id where true
      ${scope === "open" ? s`and not t.done` : scope === "done" ? s`and t.done` : s``}
      ${assignee === "me" ? s`and t.assignee_user_id = ${session.user.id}` : assignee && /^\d+$/.test(assignee) ? s`and t.assignee_user_id = ${assignee}` : s``}
      ${entity && (TASK_ENTITIES as readonly string[]).includes(entity) && entityId && /^\d+$/.test(entityId) ? s`and t.entity = ${entity} and t.entity_id = ${entityId}` : s``}
    order by t.done, t.due_date nulls last, t.id desc limit 1000`;
});
route("POST", "/tasks", async ({ req, session }) => {
  const b = await parse(req, TaskBody);
  const link = await checkTaskLink(b);
  const [t] = await sql()`insert into tasks ${sql()({ ...b, ...link, assignee_user_id: b.assignee_user_id ?? session.user.id, created_by: session.user.id, done_at: b.done ? new Date() : null } as never)} returning *`;
  if (link.entity) await logActivity(link.entity, link.entity_id, `Task added: ${t.title}`, session.user.id);
  return t;
});
route("PUT", "/tasks/:id", async ({ req, params }) => {
  const b = await parse(req, TaskBody);
  const link = await checkTaskLink(b);
  const [t] = await sql()`update tasks set ${sql()({ ...b, ...link } as never)},
      done_at = case when ${b.done} then coalesce(done_at, now()) else null end, updated_at = now() where id = ${id(params.id, "Task")} returning *`;
  if (!t) throw new HttpError(404, "Task not found.");
  return t;
});
route("PATCH", "/tasks/:id/done", async ({ req, params, session }) => {
  const b = await parse(req, z.object({ done: z.boolean() }));
  const [t] = await sql()`update tasks set done = ${b.done}, done_at = case when ${b.done} then now() else null end, updated_at = now()
    where id = ${id(params.id, "Task")} returning *`;
  if (!t) throw new HttpError(404, "Task not found.");
  if (b.done && t.entity) await logActivity(t.entity, t.entity_id, `Task done: ${t.title}`, session.user.id);
  return t;
});
route("DELETE", "/tasks/:id", async ({ params }) => {
  await sql()`delete from tasks where id = ${id(params.id, "Task")}`;
  return { ok: true };
});

// ───────────────────────── integrations (n8n) ─────────────────────────
route("GET", "/integrations", async () => {
  const s = sql();
  const [tokens, [enq], [opp]] = await Promise.all([
    s`select t.id, t.name, t.prefix, t.last_used_at, t.last_used_ip, t.revoked_at, t.created_at, u.name as created_by_name
      from integration_tokens t left join users u on u.id = t.created_by order by t.revoked_at nulls first, t.id desc`,
    s`select count(*) filter (where triage_status = 'pending' and status <> 'spam')::int as pending,
             count(*) filter (where triage_status = 'claimed')::int as claimed,
             count(*) filter (where triage_status = 'failed')::int as failed,
             max(triaged_at) as last_triaged, max(submitted_at) as last_received,
             min(submitted_at) filter (where triage_status in ('pending','claimed') and status <> 'spam') as oldest_waiting
      from enquiries`,
    s`select count(*)::int as total, count(*) filter (where received_at > now() - interval '24 hours')::int as last24,
             max(updated_at) as last_ingest from opportunities`,
  ]);
  return { tokens, enquiries: enq, opportunities: opp };
}, { admin: true });
route("POST", "/integrations/tokens", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ name: name("Token name", 80) }));
  const t = newToken();
  const [row] = await sql()`insert into integration_tokens (name, token_hash, prefix, created_by) values (${b.name}, ${t.hash}, ${t.prefix}, ${session.user.id}) returning id, name, prefix, created_at`;
  await audit(session.user.id, "integration.token_create", meta, { name: b.name, prefix: t.prefix }, "integration_token", row.id);
  return { ...row, token: t.token };
}, { admin: true });
route("DELETE", "/integrations/tokens/:id", async ({ params, session, meta }) => {
  const tid = id(params.id, "Token");
  const [row] = await sql()`update integration_tokens set revoked_at = coalesce(revoked_at, now()) where id = ${tid} returning id, name`;
  if (!row) throw new HttpError(404, "Token not found.");
  await audit(session.user.id, "integration.token_revoke", meta, { name: row.name }, "integration_token", tid);
  return { ok: true };
}, { admin: true });
