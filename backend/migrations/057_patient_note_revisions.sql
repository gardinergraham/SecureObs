alter table patient_notes add column if not exists version integer not null default 1;
alter table patient_notes add column if not exists edited_at timestamptz;
create table if not exists patient_note_revisions (
 note_id text not null references patient_notes(id),
 version integer not null,
 organisation_id uuid not null references organisations(id),
 previous_body text not null,
 replacement_body text not null,
 edited_by_staff_id text not null,
 edited_at timestamptz not null default now(),
 primary key(note_id, version)
);
