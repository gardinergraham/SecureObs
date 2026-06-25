if col_length('dbo.wards', 'session_timeout_minutes') is null
begin
  alter table dbo.wards add session_timeout_minutes int not null default 15;
end;
