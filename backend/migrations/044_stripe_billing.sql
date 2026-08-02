create table if not exists billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid unique references organisations(id) on delete set null,
  organisation_name text not null,
  billing_contact_name text not null,
  billing_email text not null,
  billing_phone text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  subscription_plan text not null check (subscription_plan in ('essential', 'professional', 'enterprise')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  licensed_ward_quantity integer not null default 1 check (licensed_ward_quantity >= 1),
  billing_status text not null default 'pending_checkout'
    check (billing_status in ('pending_checkout', 'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_payment_at timestamptz,
  payment_failed_at timestamptz,
  grace_period_ends_at timestamptz,
  last_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_accounts_organisation_idx on billing_accounts (organisation_id);
create index if not exists billing_accounts_customer_idx on billing_accounts (stripe_customer_id);
create index if not exists billing_accounts_subscription_idx on billing_accounts (stripe_subscription_id);

create table if not exists stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
