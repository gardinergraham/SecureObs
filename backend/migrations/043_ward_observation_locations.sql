alter table wards
  add column if not exists observation_locations text[] not null default array[
    'Side room', 'Day room', 'Corridor', 'Dining room', 'Bathroom', 'Laundry', 'Off ward', 'LOA'
  ];

update wards
set observation_locations = array[
  'Bedroom', 'Lounge', 'Corridor', 'Dining room', 'Bathroom', 'Garden', 'Off site', 'Hospital'
]
where service_type = 'Care home'
  and observation_locations = array[
    'Side room', 'Day room', 'Corridor', 'Dining room', 'Bathroom', 'Laundry', 'Off ward', 'LOA'
  ];
