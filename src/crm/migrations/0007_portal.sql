-- Phase 5: client portal (email sign-in links, quote acceptance, proof-of-payment notices).

alter table clients add column portal_enabled boolean not null default false;

-- One-time sign-in links. Only the SHA-256 of the token is stored.
create table portal_tokens (
  id           bigint generated always as identity primary key,
  token_hash   text        not null unique,
  email        text        not null,
  ip           text,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index portal_tokens_email_idx on portal_tokens (lower(email), created_at);
create index portal_tokens_ip_idx on portal_tokens (ip, created_at);

-- Portal sessions: keyed by the SHA-256 of the cookie token. Access is re-checked on every request
-- (client still portal-enabled, address still on the client or a contact), so revoking is immediate.
create table portal_sessions (
  id           text        primary key,
  email        text        not null,
  ip           text,
  user_agent   text        not null default '',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index portal_sessions_email_idx on portal_sessions (lower(email));

-- What clients did in the portal (sign-ins, first views, acceptances, declines, payment notices).
create table portal_events (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  email        text        not null,
  client_id    bigint      references clients (id) on delete cascade,
  document_id  bigint      references documents (id) on delete cascade,
  kind         text        not null check (kind in ('invite', 'signin', 'view', 'accept', 'decline', 'proof')),
  ip           text,
  detail       jsonb       not null default '{}'::jsonb
);
create index portal_events_client_idx on portal_events (client_id, at desc);
create index portal_events_document_idx on portal_events (document_id, kind);

-- "I've paid" notices with proof of payment. Partners record the payment (or dismiss the notice) in the CRM.
create table payment_notices (
  id            bigint generated always as identity primary key,
  document_id   bigint      not null references documents (id) on delete cascade,
  client_id     bigint      references clients (id) on delete set null,
  email         text        not null,
  amount        numeric(14,2) not null check (amount > 0),
  date          date        not null,
  reference     text        not null default '',
  note          text        not null default '',
  attachment_id bigint      references attachments (id) on delete set null,
  status        text        not null default 'new' check (status in ('new', 'recorded', 'dismissed')),
  handled_by    bigint      references users (id) on delete set null,
  handled_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index payment_notices_status_idx on payment_notices (status, created_at desc);
create index payment_notices_document_idx on payment_notices (document_id);

alter table portal_tokens enable row level security;
alter table portal_sessions enable row level security;
alter table portal_events enable row level security;
alter table payment_notices enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on portal_tokens, portal_sessions, portal_events, payment_notices from anon, authenticated;
  end if;
end $$;
