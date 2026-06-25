create table if not exists organisation_settings (
  organisation_id uuid primary key references organisations(id),
  nfc_staff_code_format text not null default 'passcode={STAFFCODE}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into organisation_settings (organisation_id, nfc_staff_code_format)
select id, 'passcode={STAFFCODE}'
from organisations
on conflict (organisation_id) do nothing;
