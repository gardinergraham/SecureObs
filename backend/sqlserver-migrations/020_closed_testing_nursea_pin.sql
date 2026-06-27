update dbo.staff_members
set login_pin_hash = 'pbkdf2_sha256$120000$secureobs-nursea-closed-test$i24CCnqw-ZTTDlSeWvGow6y8ppFLCngH7MWnzd2h0mQ',
    login_pin = null,
    login_pin_must_change = 0,
    updated_at = sysdatetimeoffset()
where organisation_id = '00000000-0000-0000-0000-000000000001'
  and lower(staff_code) = lower('NurseA');
