update staff_shift_assignments as assignment
set
  nurse_in_charge = false,
  medication_nurse = false,
  updated_at = now()
from staff_members as staff
where assignment.organisation_id = staff.organisation_id
  and assignment.staff_id = staff.id
  and staff.role = 'hcf'
  and (assignment.nurse_in_charge = true or assignment.medication_nurse = true);
