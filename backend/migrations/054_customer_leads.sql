create table if not exists customer_leads (
 id uuid primary key,
 organisation_id uuid not null references organisations(id),
 created_by uuid not null,
 data jsonb not null,
 privacy_version text not null default 'customer-capture-2026-10-05',
 created_at timestamptz not null default now()
);
create index if not exists customer_leads_org_created on customer_leads(organisation_id,created_at desc);
