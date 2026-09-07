-- Preserve existing access and roles; future changes are per ward.
alter table staff_members add column if not exists ward_roles jsonb not null default '{}'::jsonb;
update staff_members s
set ward_roles = coalesce((
  select jsonb_object_agg(ward_id, lower(s.role))
  from unnest(s.allowed_ward_ids) as assigned(ward_id)
), '{}'::jsonb)
where lower(s.role) <> 'super_admin' and s.ward_roles = '{}'::jsonb;
