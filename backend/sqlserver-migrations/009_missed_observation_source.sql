if col_length('dbo.missed_observations', 'source') is null
begin
  alter table dbo.missed_observations
    add source nvarchar(100) not null default 'General observations';
end;

if not exists (select 1 from sys.indexes where name = 'ix_missed_observations_organisation_source' and object_id = object_id('dbo.missed_observations'))
begin
  create index ix_missed_observations_organisation_source on dbo.missed_observations(organisation_id, source, due_at desc);
end;
