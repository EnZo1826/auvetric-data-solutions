-- Auvetric CRM · Phase 0 foundations: partners, sessions, sign-in throttling, audit trail.
-- Applied by scripts/crm/migrate.mjs inside a transaction. Never edit an applied migration; add a new file.

create table users (
  id               bigint generated always as identity primary key,
  email            text        not null,
  name             text        not null,
  role             text        not null default 'admin' check (role in ('admin', 'member', 'readonly')),
  password_hash    text        not null,
  must_change_password boolean not null default true,
  totp_secret      text,                 -- AES-256-GCM sealed (CRM_ENCRYPTION_KEY), never plain
  totp_enabled     boolean     not null default false,
  totp_last_step   bigint,               -- last accepted 30 s step; blocks code replay
  failed_logins    integer     not null default 0,
  locked_until     timestamptz,
  disabled         boolean     not null default false,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

-- Session id = sha256(cookie token). The raw token only ever exists in the browser cookie.
create table sessions (
  id               text        primary key,
  user_id          bigint      not null references users (id) on delete cascade,
  stage            text        not null check (stage in ('password_change', 'mfa_enroll', 'mfa', 'full')),
  pending_totp_secret text,              -- sealed; only during enrolment
  mfa_failures     integer     not null default 0,
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  expires_at       timestamptz not null
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expiry_idx on sessions (expires_at);

create table login_attempts (
  id               bigint generated always as identity primary key,
  email            text,
  ip               text,
  ok               boolean     not null,
  at               timestamptz not null default now()
);
create index login_attempts_ip_idx on login_attempts (ip, at);
create index login_attempts_email_idx on login_attempts (lower(email), at);

create table audit_log (
  id               bigint generated always as identity primary key,
  at               timestamptz not null default now(),
  user_id          bigint      references users (id) on delete set null,
  action           text        not null,
  entity           text,
  entity_id        text,
  ip               text,
  detail           jsonb       not null default '{}'::jsonb
);
create index audit_log_at_idx on audit_log (at desc);
create index audit_log_entity_idx on audit_log (entity, entity_id);

create table settings (
  key              text        primary key,
  value            jsonb       not null,
  updated_at       timestamptz not null default now()
);
