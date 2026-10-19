-- Auvetric CRM · Phase 3: time tracking, payments (partial), expenses, marketplace earnings.
-- Every table gets row-level security (Supabase Data API lockdown; see 0003).

-- Running total of payments per invoice, maintained by the app in the same transaction as each payment.
alter table documents add column amount_paid numeric(14,2) not null default 0;

create table payments (
  id           bigint generated always as identity primary key,
  document_id  bigint      not null references documents (id) on delete restrict,
  date         date        not null,
  amount       numeric(14,2) not null check (amount > 0),
  method       text        not null default 'eft' check (method in ('eft', 'cash', 'card', 'upwork', 'paypal', 'wise', 'other')),
  reference    text        not null default '',
  notes        text        not null default '',
  auto         boolean     not null default false,   -- created by "Mark paid"; removed again when the invoice is reopened
  created_by   bigint      references users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index payments_document_idx on payments (document_id);
create index payments_date_idx on payments (date desc);

create table time_entries (
  id               bigint generated always as identity primary key,
  user_id          bigint      not null references users (id) on delete restrict,
  project_id       bigint      references projects (id) on delete set null,
  client_id        bigint      references clients (id) on delete set null,
  date             date        not null,
  minutes          integer     not null check (minutes > 0 and minutes <= 1440),
  description      text        not null default '',
  billable         boolean     not null default true,
  rate             numeric(14,2),                     -- per hour, in currency
  currency         text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  invoice_id       bigint      references documents (id) on delete set null,
  invoice_line_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (not billable or rate is not null)
);
create index time_entries_date_idx on time_entries (date desc);
create index time_entries_project_idx on time_entries (project_id);
create index time_entries_unbilled_idx on time_entries (client_id) where billable and invoice_id is null;

create table expenses (
  id                 bigint generated always as identity primary key,
  date               date        not null,
  supplier           text        not null default '',
  category           text        not null default 'other' check (category in ('hosting', 'software', 'hardware', 'travel', 'subcontractor', 'fees', 'office', 'other')),
  description        text        not null default '',
  amount             numeric(14,2) not null check (amount > 0),   -- including VAT, as paid
  vat_amount         numeric(14,2) not null default 0 check (vat_amount >= 0),
  currency           text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  fx_rate            numeric(14,6),                               -- NAD per unit; null for NAD
  client_id          bigint      references clients (id) on delete set null,
  project_id         bigint      references projects (id) on delete set null,
  billable           boolean     not null default false,          -- to be re-billed to the client
  markup_pct         numeric(6,2) not null default 0 check (markup_pct >= 0 and markup_pct <= 500),
  invoice_id         bigint      references documents (id) on delete set null,
  invoice_line_id    text,
  receipt_ref        text        not null default '',
  paid_by_user_id    bigint      references users (id) on delete set null,
  notes              text        not null default '',
  created_by         bigint      references users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (currency = 'NAD' or fx_rate > 0),
  check (vat_amount <= amount),
  check (not billable or client_id is not null)
);
create index expenses_date_idx on expenses (date desc);
create index expenses_unbilled_idx on expenses (client_id) where billable and invoice_id is null;

-- Upwork / Fiverr contract income: paid through the platform, so no invoice exists.
create table marketplace_earnings (
  id             bigint generated always as identity primary key,
  platform       text        not null default 'upwork' check (platform in ('upwork', 'fiverr', 'freelancer', 'other')),
  date           date        not null,
  client_name    text        not null default '',
  client_id      bigint      references clients (id) on delete set null,
  project_id     bigint      references projects (id) on delete set null,
  contract       text        not null default '',
  description    text        not null default '',
  gross          numeric(14,2) not null check (gross >= 0),
  fee            numeric(14,2) not null default 0 check (fee >= 0),
  currency       text        not null default 'USD' check (currency in ('NAD', 'USD')),
  fx_rate        numeric(14,6),
  reference      text        not null default '',
  created_by     bigint      references users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (fee <= gross),
  check (currency = 'NAD' or fx_rate > 0)
);
create index marketplace_date_idx on marketplace_earnings (date desc);

alter table payments enable row level security;
alter table time_entries enable row level security;
alter table expenses enable row level security;
alter table marketplace_earnings enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on payments, time_entries, expenses, marketplace_earnings from anon, authenticated;
  end if;
end $$;
