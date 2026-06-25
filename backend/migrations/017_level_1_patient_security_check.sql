insert into security_areas (
  id, organisation_id, ward_id, name, frequency_minutes, requires_count, category, frequency_type, active
)
select
  'area-' || wards.id || '-level-1-patient-search',
  sites.organisation_id,
  wards.id,
  'Level 1 patient checks',
  10080,
  false,
  'level_1_patient_search',
  'weekly_ad_hoc',
  true
from wards
inner join sites on sites.id = wards.site_id
where not exists (
  select 1
  from security_areas existing
  where existing.ward_id = wards.id
    and existing.organisation_id = sites.organisation_id
    and existing.category = 'level_1_patient_search'
)
on conflict (id) do nothing;
