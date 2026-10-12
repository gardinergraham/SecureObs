-- Keep combined home/patient creation retry-safe without retaining a second copy of patient data.
alter table home_care_profiles add column if not exists setup_fingerprint text;
