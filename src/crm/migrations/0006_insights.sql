-- Phase 4: attachments (files in Netlify Blobs), sent-email log, backup register.
-- Mail server settings live in settings (key 'mail'), with the password sealed by CRM_ENCRYPTION_KEY.

create table attachments (
  id           bigint generated always as identity primary key,
  entity       text        not null check (entity in ('client', 'project', 'document', 'lead', 'expense', 'enquiry')),
  entity_id    bigint      not null,
  name         text        not null check (length(name) between 1 and 200),
  content_type text        not null,
  size         integer     not null check (size between 1 and 10485760),
  sha256       text        not null,
  blob_key     text        not null unique,
  uploaded_by  bigint      references users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index attachments_entity_idx on attachments (entity, entity_id);

create table emails (
  id           bigint generated always as identity primary key,
  kind         text        not null check (kind in ('invoice', 'quote', 'statement', 'test')),
  document_id  bigint      references documents (id) on delete set null,
  client_id    bigint      references clients (id) on delete set null,
  to_addrs     text[]      not null,
  cc_addrs     text[]      not null default '{}',
  subject      text        not null,
  attachments  text[]      not null default '{}',   -- file names as sent
  status       text        not null check (status in ('sent', 'failed')),
  error        text        not null default '',
  message_id   text        not null default '',
  sent_by      bigint      references users (id) on delete set null,
  sent_at      timestamptz not null default now()
);
create index emails_document_idx on emails (document_id, sent_at desc);
create index emails_client_idx on emails (client_id, sent_at desc);

create table backups (
  id           bigint generated always as identity primary key,
  kind         text        not null check (kind in ('nightly', 'manual')),
  blob_key     text        not null unique,
  size         integer     not null,
  sha256       text        not null,
  counts       jsonb       not null default '{}'::jsonb,
  created_by   bigint      references users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index backups_created_idx on backups (created_at desc);

-- Reports: "who was at work" capacity for utilisation.
alter table users add column weekly_hours numeric(5,2) not null default 40 check (weekly_hours between 0 and 80);

alter table attachments enable row level security;
alter table emails enable row level security;
alter table backups enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on attachments, emails, backups from anon, authenticated;
  end if;
end $$;
