alter table wards
  add column if not exists assessment_forms_enabled boolean not null default false;

update wards
set assessment_forms_enabled = true
where service_type = 'Care home';
