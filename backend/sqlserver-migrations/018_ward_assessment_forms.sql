if col_length('dbo.wards', 'assessment_forms_enabled') is null
begin
  alter table dbo.wards add assessment_forms_enabled bit not null default 0;
end;

update dbo.wards
set assessment_forms_enabled = 1
where service_type = 'Care home';
