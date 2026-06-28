if col_length('dbo.wards', 'landing_page') is null
begin
  alter table dbo.wards add landing_page nvarchar(20) not null default 'overview';
end;

if not exists (
  select 1
  from sys.check_constraints
  where name = 'CK_wards_landing_page'
)
begin
  alter table dbo.wards
    add constraint CK_wards_landing_page
    check (landing_page in ('overview', 'observations'));
end;
