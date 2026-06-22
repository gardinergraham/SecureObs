alter table medication_prescriptions
  add column if not exists prescription_type text not null default 'regular',
  add column if not exists prn_indication text;

create index if not exists medication_prescriptions_type_idx
  on medication_prescriptions (organisation_id, prescription_type);
