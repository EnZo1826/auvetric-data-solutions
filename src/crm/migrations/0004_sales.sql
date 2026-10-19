-- Auvetric CRM · Phase 2: sales (enquiries, opportunities, leads pipeline), tasks, n8n integration tokens.
-- Every table gets row-level security (Supabase Data API lockdown; see 0003). crm:migrate re-checks it.

-- Website form submissions. Stored by the site itself (PC may be off); n8n claims untriaged rows,
-- runs the local AI model and writes the triage fields back.
create table enquiries (
  id               bigint generated always as identity primary key,
  submission_id    text        not null unique,          -- browser UUID or relay key; makes ingestion idempotent
  source           text        not null default 'website' check (source in ('website', 'relay', 'manual')),
  submitted_at     timestamptz not null default now(),
  name             text        not null,
  organisation     text        not null default '',
  email            text        not null default '',
  phone            text        not null default '',
  intent           text        not null default '',
  interest         text        not null default '',
  budget           text        not null default '',
  timeline         text        not null default '',
  message          text        not null default '',
  ip               text,
  status           text        not null default 'new' check (status in ('new', 'reviewed', 'converted', 'spam', 'archived')),
  triage_status    text        not null default 'pending' check (triage_status in ('pending', 'claimed', 'done', 'failed')),
  triage_claimed_at timestamptz,
  triage_attempts  integer     not null default 0,
  triaged_at       timestamptz,
  ai               jsonb       not null default '{}'::jsonb, -- category, practice, priority, spam_score, summary, key_requirements, questions_to_ask, suggested_reply
  notes            text        not null default '',
  client_id        bigint      references clients (id) on delete set null,
  lead_id          bigint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index enquiries_status_idx on enquiries (status, submitted_at desc);
create index enquiries_triage_idx on enquiries (triage_status, submitted_at) where triage_status in ('pending', 'claimed');
create index enquiries_ip_idx on enquiries (ip, created_at);

-- Upwork / LinkedIn listings scored by n8n. Upserted by job_key; CRM-side fields (status, notes, lead_id) are never overwritten by ingest.
create table opportunities (
  id               bigint generated always as identity primary key,
  job_key          text        not null unique,
  source           text        not null default 'other',
  url              text        not null default '',
  title            text        not null,
  company          text        not null default '',
  location         text        not null default '',
  remote           text        not null default 'unknown',
  employment_type  text        not null default 'unknown',
  budget           text        not null default '',
  skills           text        not null default '',
  experience_level text        not null default '',
  summary          text        not null default '',
  fit_score        integer     not null default 0 check (fit_score between 0 and 100),
  practice         text        check (practice in ('engineering', 'data', 'automation', 'consultancy')),
  reasons          text        not null default '',
  red_flags        text        not null default '',
  action           text        not null default 'review',
  extraction_status text       not null default 'ok',
  received_at      timestamptz not null default now(),
  status           text        not null default 'new' check (status in ('new', 'shortlisted', 'applied', 'interviewing', 'won', 'lost', 'skipped')),
  notes            text        not null default '',
  lead_id          bigint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index opportunities_status_idx on opportunities (status, received_at desc);
create index opportunities_fit_idx on opportunities (fit_score desc, received_at desc);

-- Sales pipeline. Stages are fixed (reports depend on them); position orders cards within a stage.
create table leads (
  id               bigint generated always as identity primary key,
  title            text        not null,
  stage            text        not null default 'new' check (stage in ('new', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost')),
  position         double precision not null default 0,
  client_id        bigint      references clients (id) on delete set null,
  contact_name     text        not null default '',
  organisation     text        not null default '',
  email            text        not null default '',
  phone            text        not null default '',
  value            numeric(14,2),
  currency         text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  probability      integer     check (probability between 0 and 100),
  practice         text        check (practice in ('engineering', 'data', 'automation', 'consultancy')),
  source           text        not null default 'direct' check (source in ('website', 'upwork', 'linkedin', 'referral', 'direct', 'other')),
  owner_user_id    bigint      references users (id) on delete set null,
  next_follow_up   date,
  enquiry_id       bigint      references enquiries (id) on delete set null,
  opportunity_id   bigint      references opportunities (id) on delete set null,
  project_id       bigint      references projects (id) on delete set null,
  notes            text        not null default '',
  lost_reason      text        not null default '',
  closed_at        timestamptz,
  created_by       bigint      references users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index leads_stage_idx on leads (stage, position);
create index leads_follow_up_idx on leads (next_follow_up) where stage not in ('won', 'lost');

alter table enquiries add constraint enquiries_lead_fk foreign key (lead_id) references leads (id) on delete set null;
alter table opportunities add constraint opportunities_lead_fk foreign key (lead_id) references leads (id) on delete set null;

-- Follow-ups for Jakes and Alex, optionally linked to a record.
create table tasks (
  id               bigint generated always as identity primary key,
  title            text        not null,
  notes            text        not null default '',
  due_date         date,
  done             boolean     not null default false,
  done_at          timestamptz,
  assignee_user_id bigint      references users (id) on delete set null,
  entity           text        check (entity in ('client', 'project', 'lead', 'enquiry', 'opportunity')),
  entity_id        bigint,
  created_by       bigint      references users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((entity is null) = (entity_id is null))
);
create index tasks_open_idx on tasks (done, due_date);
create index tasks_entity_idx on tasks (entity, entity_id);

-- Bearer tokens for the n8n ingest API. Only sha256(token) is stored; the token is shown once.
create table integration_tokens (
  id               bigint generated always as identity primary key,
  name             text        not null,
  token_hash       text        not null unique,
  prefix           text        not null,                 -- first characters, to recognise a token in the UI
  last_used_at     timestamptz,
  last_used_ip     text,
  revoked_at       timestamptz,
  created_by       bigint      references users (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Timelines now also cover leads, enquiries and opportunities.
alter table activities drop constraint activities_entity_check;
alter table activities add constraint activities_entity_check check (entity in ('client', 'project', 'document', 'lead', 'enquiry', 'opportunity'));

alter table enquiries enable row level security;
alter table opportunities enable row level security;
alter table leads enable row level security;
alter table tasks enable row level security;
alter table integration_tokens enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on enquiries, opportunities, leads, tasks, integration_tokens from anon, authenticated;
  end if;
end $$;
