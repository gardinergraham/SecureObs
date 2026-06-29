update assignment
set
  nurse_in_charge = 0,
  medication_nurse = 0,
  updated_at = sysdatetimeoffset()
from dbo.staff_shift_assignments as assignment
inner join dbo.staff_members as staff
  on staff.organisation_id = assignment.organisation_id
  and convert(nvarchar(36), staff.id) = assignment.staff_id
where staff.role = 'hcf'
  and (assignment.nurse_in_charge = 1 or assignment.medication_nurse = 1);
