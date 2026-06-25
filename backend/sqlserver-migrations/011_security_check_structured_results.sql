if col_length('dbo.security_areas', 'expected_items') is null
begin
  alter table dbo.security_areas
    add expected_items nvarchar(max) not null default '{}';
end;

if col_length('dbo.security_checks', 'result_details') is null
begin
  alter table dbo.security_checks
    add result_details nvarchar(max) not null default '{}';
end;
