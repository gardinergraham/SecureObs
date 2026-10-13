import type { HomeCareDuty, HomeCareProfile } from '../types/homeCare';
const uniqueCarers = (duties: HomeCareDuty[]) => [...new Map(duties.map(d=>[d.staff_id ?? d.id,d])).values()];
export function homeCoverage(home: HomeCareProfile, duties: HomeCareDuty[], now: number) {
    const here = duties.filter(d => d.ward_id === home.id);
    const current = here.filter(d => !['cancelled','completed'].includes(d.state) && Date.parse(d.starts_at) <= now && Date.parse(d.ends_at) > now);
    const presentStaff = uniqueCarers(current.filter(d => d.state === 'present' && d.kind !== 'wellness'));
    const awaitingStaff = uniqueCarers(current.filter(d => d.state === 'planned'));
    const breakStaff = uniqueCarers(current.filter(d => d.state === 'break'));
    const required = home.requiredCarers ?? 1;
    const overdue = here.filter(d => ['present', 'break'].includes(d.state) && Date.parse(d.ends_at) <= now);
    const missed = here.filter(d => d.state === 'planned' && Date.parse(d.ends_at) <= now);
    const horizon = now + 24 * 60 * 60 * 1000;
    const scheduled = here.filter(d => !['cancelled', 'completed'].includes(d.state) && d.kind !== 'wellness');
    const boundaries = [now, ...scheduled.flatMap(d => [Date.parse(d.starts_at), Date.parse(d.ends_at)]).filter(t => t > now && t < horizon)].sort((a, b) => a - b);
    const plannedGap = home.continuousCover !== false ? boundaries.find(t => uniqueCarers(scheduled.filter(d => Date.parse(d.starts_at) <= t && Date.parse(d.ends_at) > t)).length < required) : undefined;
    return { plannedGap, present: presentStaff.length, required, gap: home.continuousCover !== false && presentStaff.length < required,
        planned:uniqueCarers(current.filter(d=>d.kind!=='wellness')).length,
        late:awaitingStaff.length, onBreak:breakStaff.length, missed:missed.length, overdue:overdue.length,
        presentStaff,awaitingStaff,breakStaff,
        next: here.filter(d => d.state === 'planned' && Date.parse(d.starts_at) > now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0],
        coverEnds: presentStaff.length ? Math.min(...presentStaff.map(d => Date.parse(d.ends_at))) : null };
}
export function validateDutyPeriod(start:string,end:string) {
    const duration=Date.parse(end)-Date.parse(start);
    if(!Number.isFinite(duration)||duration<=0||duration>24*60*60*1000)
      throw Error('Choose an end after the start, up to 24 hours later. Split live-in care into separate duty periods.');
}
export function parseLocalDutyDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
        throw Error('Use YYYY-MM-DD HH:MM for each time.');
    const d = new Date(value.replace(' ', 'T'));
    const parts = value.split(/[- :]/).map(Number);
    if (!Number.isFinite(d.getTime()) || d.getFullYear() !== parts[0] || d.getMonth() + 1 !== parts[1] || d.getDate() !== parts[2] || d.getHours() !== parts[3] || d.getMinutes() !== parts[4])
        throw Error('Enter a valid local date and time.');
    return d.toISOString();
}

// Keep the sign-in page focused: unfinished attendance plus today's upcoming duties,
// or the next booked duty when none are due today. Never include another carer's work.
export function ownHomeCareDuties(duties:HomeCareDuty[],staffId:string,wardId:string,now:number) {
 const own=duties.filter(d=>d.staff_id===staffId&&d.ward_id===wardId&&!['cancelled','completed'].includes(d.state));
 const active=own.filter(d=>['present','break'].includes(d.state));
 const planned=own.filter(d=>d.state==='planned'&&Date.parse(d.ends_at)>now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
 const today=planned.filter(d=>Date.parse(d.starts_at)<=now+24*60*60*1000);
 return [...active,...(today.length?today:planned.slice(0,1))];
}
