-- Auvetric CRM · Phase 1: company profile, clients & contacts, services, quotes/invoices,
-- retainers, projects board, activity timeline.

create table companies (
  id          bigint generated always as identity primary key,
  name        text        not null,
  is_default  boolean     not null default false,
  data        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index companies_one_default on companies (is_default) where is_default;

create table clients (
  id                 bigint generated always as identity primary key,
  name               text        not null,
  trading_name       text        not null default '',
  industry           text        not null default '',
  address            text        not null default '',
  email              text        not null default '',
  phone              text        not null default '',
  website            text        not null default '',
  vat_no             text        not null default '',
  reg_no             text        not null default '',
  currency           text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  payment_terms_days integer,
  notes              text        not null default '',
  tags               text[]      not null default '{}',
  archived           boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index clients_name_idx on clients (lower(name));

create table contacts (
  id          bigint generated always as identity primary key,
  client_id   bigint      not null references clients (id) on delete cascade,
  name        text        not null,
  role        text        not null default '',
  email       text        not null default '',
  phone       text        not null default '',
  is_primary  boolean     not null default false,
  notes       text        not null default '',
  created_at  timestamptz not null default now()
);
create index contacts_client_idx on contacts (client_id);

create table services (
  id          bigint generated always as identity primary key,
  practice    text        not null check (practice in ('engineering', 'data', 'automation', 'consultancy')),
  code        text        not null default '',
  name        text        not null,
  description text        not null default '',
  unit        text        not null default 'Hour',
  rate        numeric(14,2) not null default 0,
  currency    text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table retainers (
  id           bigint generated always as identity primary key,
  company_id   bigint      not null references companies (id) on delete restrict,
  client_id    bigint      not null references clients (id) on delete restrict,
  name         text        not null default '',
  kind         text        not null default 'support' check (kind in ('support', 'hosting', 'sla', 'bi', 'other')),
  currency     text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  active       boolean     not null default true,
  auto         boolean     not null default false,
  day_of_month integer     not null default 1 check (day_of_month between 1 and 28),
  last_period  text,
  data         jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table projects (
  id              bigint generated always as identity primary key,
  title           text        not null,
  client_id       bigint      references clients (id) on delete set null,
  status          text        not null default 'planned',
  priority        text        not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  position        double precision not null default 0,
  practice        text        check (practice in ('engineering', 'data', 'automation', 'consultancy')),
  lead_user_id    bigint      references users (id) on delete set null,
  start_date      date,
  due_date        date,
  budget_amount   numeric(14,2),
  budget_currency text        not null default 'NAD' check (budget_currency in ('NAD', 'USD')),
  budget_hours    numeric(10,2),
  quote_id        bigint,
  data            jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index projects_status_idx on projects (status, position);

create table documents (
  id          bigint generated always as identity primary key,
  type        text        not null check (type in ('invoice', 'quote')),
  number      text        not null,
  company_id  bigint      not null references companies (id) on delete restrict,
  client_id   bigint      references clients (id) on delete set null,
  contact_id  bigint      references contacts (id) on delete set null,
  project_id  bigint      references projects (id) on delete set null,
  retainer_id bigint      references retainers (id) on delete set null,
  source_id   bigint      references documents (id) on delete set null,
  status      text        not null default 'draft',
  date        date        not null,
  due_date    date        not null,
  period      text,
  currency    text        not null default 'NAD' check (currency in ('NAD', 'USD')),
  fx_rate     numeric(14,6),          -- NAD per 1 unit of currency; null for NAD
  data        jsonb       not null default '{}'::jsonb,
  subtotal    numeric(14,2) not null default 0,
  vat         numeric(14,2) not null default 0,
  discount    numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0,
  sent_at     timestamptz,
  paid_at     timestamptz,
  created_by  bigint      references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, type, number),
  check ((type = 'invoice' and status in ('draft', 'sent', 'paid', 'overdue', 'cancelled'))
      or (type = 'quote' and status in ('draft', 'sent', 'accepted', 'declined', 'invoiced'))),
  check (currency = 'NAD' or fx_rate > 0)
);
-- A retainer can never be billed twice for the same month.
create unique index documents_retainer_period on documents (retainer_id, period) where retainer_id is not null and period is not null;
create index documents_type_date on documents (type, date desc);
create index documents_client on documents (client_id);
create index documents_project on documents (project_id);

alter table projects add constraint projects_quote_fk foreign key (quote_id) references documents (id) on delete set null;

-- Timeline for clients and projects (calls, emails, meetings, notes, system events).
create table activities (
  id          bigint generated always as identity primary key,
  entity      text        not null check (entity in ('client', 'project', 'document')),
  entity_id   bigint      not null,
  kind        text        not null default 'note' check (kind in ('note', 'call', 'email', 'meeting', 'system')),
  body        text        not null,
  at          timestamptz not null default now(),
  user_id     bigint      references users (id) on delete set null
);
create index activities_entity_idx on activities (entity, entity_id, at desc);

-- Default company with clearly marked placeholders until the partners confirm the details.
insert into companies (name, is_default, data) values ('Auvetric Data Solutions', true, jsonb_build_object(
  'legalName', 'Auvetric Data Solutions', 'tradingName', 'Auvetric Data Solutions',
  'regNo', '[to be confirmed]', 'vatRegistered', false, 'vatNo', '', 'vatRate', 15,
  'address', 'Windhoek, Namibia', 'email', 'info@auvetric.com', 'phone', '', 'website', 'auvetric.com',
  'bankName', '[to be confirmed]', 'bankAccountName', '[to be confirmed]', 'bankBranch', '[to be confirmed]',
  'bankBranchCode', '', 'bankAccount', '[to be confirmed]', 'bankSwift', '', 'bankExtra', '',
  'paymentTermsDays', 14, 'quoteValidDays', 30,
  'terms', 'Payment is due within the stated terms. Please use the invoice number as your payment reference.',
  'invoicePrefix', 'AUV-INV-{YYYY}-', 'quotePrefix', 'AUV-QUO-{YYYY}-', 'numberPad', 4,
  'nextInvoice', 1, 'nextQuote', 1, 'defaultCurrency', 'NAD', 'usdToNad', 18.5, 'footerText', ''));

insert into settings (key, value) values ('project_columns', '[
  {"key":"planned","label":"Planned","color":"#6b7c95"},
  {"key":"in_progress","label":"In progress","color":"#0069f5"},
  {"key":"waiting","label":"Waiting on client","color":"#8b6cf6"},
  {"key":"review","label":"Review / UAT","color":"#e0a03a"},
  {"key":"done","label":"Done","color":"#2fbf8f"}]'::jsonb)
on conflict (key) do nothing;
