alter table staff_members
  add column if not exists organisation_id uuid references organisations(id);

update staff_members
set organisation_id = '00000000-0000-0000-0000-000000000001'
where organisation_id is null;

alter table staff_members
  alter column organisation_id set not null;

alter table staff_members
  drop constraint if exists staff_members_staff_code_key;

create unique index if not exists staff_members_organisation_staff_code_key
  on staff_members (organisation_id, staff_code);

create index if not exists staff_members_organisation_id_idx
  on staff_members (organisation_id);
