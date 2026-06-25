alter table missed_observations
  add column if not exists source text not null default 'General observations';

create index if not exists missed_observations_organisation_source_idx
  on missed_observations (organisation_id, source, due_at desc);
