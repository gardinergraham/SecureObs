import type { HomeCareDuty, HomeCareProfile } from '../types/homeCare';
export function homeCoverage(home: HomeCareProfile, duties: HomeCareDuty[], now: number) {
    const here = duties.filter(d => d.ward_id === home.id);
    const current = here.filter(d => d.state !== 'cancelled' && Date.parse(d.starts_at) <= now && Date.parse(d.ends_at) > now);
    const present = current.filter(d => d.state === 'present' && d.kind !== 'wellness');
    const required = home.requiredCarers ?? 1;
    const overdue = here.filter(d => ['present', 'break'].includes(d.state) && Date.parse(d.ends_at) <= now);
    const horizon = now + 24 * 60 * 60 * 1000;
    const scheduled = here.filter(d => !['cancelled', 'completed'].includes(d.state) && d.kind !== 'wellness');
    const boundaries = [now, ...scheduled.flatMap(d => [Date.parse(d.starts_at), Date.parse(d.ends_at)]).filter(t => t > now && t < horizon)].sort((a, b) => a - b);
    const plannedGap = home.continuousCover !== false ? boundaries.find(t => scheduled.filter(d => Date.parse(d.starts_at) <= t && Date.parse(d.ends_at) > t).length < required) : undefined;
    return { plannedGap, present: present.length, required, gap: home.continuousCover !== false && present.length < required,
        late: current.filter(d => d.state === 'planned').length, overdue: overdue.length,
        next: here.filter(d => d.state === 'planned' && Date.parse(d.starts_at) > now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0],
        coverEnds: present.length ? Math.min(...present.map(d => Date.parse(d.ends_at))) : null };
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
