alter table medication_prescriptions
  add column if not exists depot_interval_days integer;
