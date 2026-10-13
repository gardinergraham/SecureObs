import type { PatientNote } from '../types/domain';
export function ukNoteDay(value:string|number):string {
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function canEditPatientNote(note:PatientNote,staffId:string,now=Date.now()) {
 return Boolean(staffId)&&note.recordedByStaffId===staffId&&ukNoteDay(note.recordedAt)===ukNoteDay(now);
}
