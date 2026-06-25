if col_length('dbo.patients', 'patient_forms') is null
begin
  alter table dbo.patients add patient_forms nvarchar(max) not null default '[]';
end;
