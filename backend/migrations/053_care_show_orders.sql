create table if not exists care_show_orders (
 id uuid primary key,
 billing_account_id uuid unique references billing_accounts(id),
 email text not null unique,
 password_hash text not null,
 organisation_name text not null,
 contact_name text not null,
 contact_role text not null,
 phone text not null default '',
 package_selection jsonb not null,
 quote_snapshot jsonb not null,
 terms_version text not null,
 terms_accepted_at timestamptz not null default now(),
 stripe_customer_id text unique,
 stripe_setup_session_id text,
 stripe_payment_method_id text,
 proposed_start_date date,
 proposed_by text,
 proposed_at timestamptz,
 confirmed_at timestamptz,
 software_schedule_id text unique,
 tablet_schedule_id text unique,
 tablet_returned_at timestamptz,
 manager_staff_code text,
 created_at timestamptz not null default now()
);
create table if not exists care_show_sessions (
 token_hash text primary key,
 order_id uuid not null references care_show_orders(id) on delete cascade,
 expires_at timestamptz not null
);
create index if not exists care_show_sessions_expiry on care_show_sessions(expires_at);
create table if not exists care_show_rate_limits (
 key text primary key,
 window_start timestamptz not null default now(),
 attempts integer not null default 1
);
