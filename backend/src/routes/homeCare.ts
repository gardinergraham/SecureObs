import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuthenticated, type AuthenticatedRequest } from '../auth.js';
import { roleInWard } from '../wardAccess.js';
import { dutyKinds, nextDutyState } from '../homeCare/rules.js';
export const homeCareRouter = Router();
const route = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
homeCareRouter.use((req: AuthenticatedRequest, res, next) => { res.setHeader('Cache-Control', 'no-store'); if (requireAuthenticated(req, res))
    next(); });
async function location(req: AuthenticatedRequest, res: Response, wardId: string, manager = false) {
    const staff = req.auth!.staff, role = roleInWard(staff, wardId);
    if (!role || (manager && !['manager', 'super_admin'].includes(role))) {
        res.status(403).json({ error: 'You do not have access to manage or view this home.' });
        return;
    }
    const found = await pool.query(`select w.id,w.service_type,s.organisation_id from wards w join sites s on s.id=w.site_id where w.id=$1`, [wardId]);
    const w = found.rows[0];
    if (!w || w.organisation_id !== staff.organisationId || w.service_type !== 'Home care') {
        res.status(404).json({ error: 'Home location not found in your organisation.' });
        return;
    }
    return w;
}
const profileSchema = z.object({ wardId: z.string().min(1).max(150), address: z.string().trim().min(1).max(1000), accessNotes: z.string().max(2000), emergencyContact: z.string().max(1000), careSummary: z.string().max(4000), requiredCarers: z.number().int().min(1).max(10), continuousCover: z.boolean() }).strict();
const dutySchema = z.object({ id: z.string().uuid(), wardId: z.string().min(1).max(150), staffId: z.string().uuid(), kind: z.enum(dutyKinds), startsAt: z.string().datetime(), endsAt: z.string().datetime(), notes: z.string().max(2000) }).strict().refine(d => Date.parse(d.endsAt) > Date.parse(d.startsAt) && Date.parse(d.endsAt) - Date.parse(d.startsAt) <= 24 * 60 * 60 * 1000, { message: 'Duty periods must be positive and no longer than 24 hours. Split live-in assignments into duty periods.' });
const eventSchema = z.object({ id: z.string().uuid(), action: z.enum(['check_in', 'break', 'resume', 'check_out', 'cancel', 'handover', 'wellness']), notes: z.string().trim().max(4000).default(''), wellnessOutcome: z.enum(['well', 'concern', 'no_answer']).optional() }).strict();
homeCareRouter.get('/', route(async (req, res) => {
    const staff = req.auth!.staff;
    const homes = await pool.query(`select w.id,w.site_id as "siteId",w.name,p.address,p.access_notes as "accessNotes",p.emergency_contact as "emergencyContact",p.care_summary as "careSummary",p.required_carers as "requiredCarers",p.continuous_cover as "continuousCover",p.updated_at as "updatedAt"
 from wards w join sites s on s.id=w.site_id left join home_care_profiles p on p.ward_id=w.id
 where s.organisation_id=$1 and w.service_type='Home care' and ($2::boolean or w.id=any($3::text[])) order by w.name`, [staff.organisationId, staff.role === 'super_admin', staff.allowedWardIds]);
    const ids = homes.rows.map(h => h.id);
    const duties = await pool.query(`select d.*,m.display_name as staff_name from home_care_duties d join staff_members m on m.id=d.staff_id where d.ward_id=any($1::text[]) and (d.ends_at>now()-interval '7 days' and d.starts_at<now()+interval '31 days' or d.state in ('present','break')) order by d.starts_at`, [ids]);
    const residents = await pool.query('select id,ward_id as "wardId",first_name as "firstName",surname from patients where organisation_id=$1 and ward_id=any($2::text[]) and archived=false', [staff.organisationId, ids]);
    const tasks = await pool.query(`select t.ward_id as "wardId",count(*)::int as outstanding,count(*) filter(where t.due_at<now())::int as overdue from patient_tasks t join patients p on p.id=t.patient_id where t.organisation_id=$1 and t.ward_id=any($2::text[]) and t.status in ('open','accepted') and p.archived=false group by t.ward_id`, [staff.organisationId, ids]);
    const events = await pool.query(`select e.*,m.display_name as actor_name from home_care_events e join home_care_duties d on d.id=e.duty_id join staff_members m on m.id=e.actor_id where d.ward_id=any($1::text[]) and e.recorded_at>now()-interval '7 days' order by e.recorded_at desc limit 500`, [ids]);
    res.json({ homes: homes.rows.map(h => ({ ...h, canManage: ['manager', 'super_admin'].includes(roleInWard(staff, h.id) ?? '') })), tasks: tasks.rows, patients: residents.rows, duties: duties.rows, events: events.rows, serverTime: new Date().toISOString() });
}));
homeCareRouter.post('/profile', route(async (req, res) => {
    const p = profileSchema.safeParse(req.body);
    if (!p.success) {
        res.status(400).json({ error: 'Complete the home address and valid staffing requirements.' });
        return;
    }
    const d = p.data;
    if (!await location(req, res, d.wardId, true))
        return;
    await pool.query(`insert into home_care_profiles(ward_id,address,access_notes,emergency_contact,care_summary,required_carers,continuous_cover) values($1,$2,$3,$4,$5,$6,$7)
 on conflict(ward_id) do update set address=excluded.address,access_notes=excluded.access_notes,emergency_contact=excluded.emergency_contact,care_summary=excluded.care_summary,required_carers=excluded.required_carers,continuous_cover=excluded.continuous_cover,updated_at=now()`, [d.wardId, d.address, d.accessNotes, d.emergencyContact, d.careSummary, d.requiredCarers, d.continuousCover]);
    res.json({ ok: true });
}));
homeCareRouter.post('/duties', route(async (req, res) => {
    const p = dutySchema.safeParse(req.body);
    if (!p.success) {
        res.status(400).json({ error: 'Choose a carer and a duty period of up to 24 hours. Split live-in cover into daily duty periods.' });
        return;
    }
    const d = p.data;
    if (!await location(req, res, d.wardId, true))
        return;
    const db = await pool.connect();
    try {
        await db.query('begin');
        const member = (await db.query('select * from staff_members where id=$1 and organisation_id=$2 and active=true for update', [d.staffId, req.auth!.staff.organisationId])).rows[0];
        if (!member || !member.allowed_ward_ids.includes(d.wardId) || (member.access_expires_at && Date.parse(member.access_expires_at) < Date.parse(d.endsAt)) || (member.access_starts_at && Date.parse(member.access_starts_at) > Date.parse(d.startsAt))) {
            await db.query('rollback');
            res.status(400).json({ error: 'Select an active carer with access to this home throughout the duty.' });
            return;
        }
        const previous = (await db.query('select * from home_care_duties where id=$1', [d.id])).rows[0];
        if (previous) {
            await db.query('rollback');
            const same = previous.ward_id === d.wardId && previous.staff_id === d.staffId && previous.kind === d.kind && Date.parse(previous.starts_at) === Date.parse(d.startsAt) && Date.parse(previous.ends_at) === Date.parse(d.endsAt) && previous.notes === d.notes;
            res.status(same ? 200 : 409).json(same ? { ok: true } : { error: 'This duty reference already exists with different details.' });
            return;
        }
        const overlap = await db.query("select id from home_care_duties where staff_id=$1 and state<>'cancelled' and starts_at<$3 and ends_at>$2", [d.staffId, d.startsAt, d.endsAt]);
        if (overlap.rows.length) {
            await db.query('rollback');
            res.status(409).json({ error: 'This carer already has an overlapping home-care duty.' });
            return;
        }
        const profile = await db.query('select ward_id from home_care_profiles where ward_id=$1', [d.wardId]);
        if (!profile.rows.length) {
            await db.query('rollback');
            res.status(400).json({ error: 'Save the home profile first.' });
            return;
        }
        await db.query('insert into home_care_duties(id,ward_id,staff_id,kind,starts_at,ends_at,notes,created_by) values($1,$2,$3,$4,$5,$6,$7,$8)', [d.id, d.wardId, d.staffId, d.kind, d.startsAt, d.endsAt, d.notes, req.auth!.staff.id]);
        await db.query('commit');
        res.status(201).json({ ok: true });
    }
    catch (e) {
        await db.query('rollback');
        throw e;
    }
    finally {
        db.release();
    }
}));
homeCareRouter.post('/duties/:id/events', route(async (req, res) => {
    const p = eventSchema.safeParse(req.body);
    if (!p.success || !z.string().uuid().safeParse(req.params.id).success) {
        res.status(400).json({ error: 'Invalid duty update.' });
        return;
    }
    const d = p.data;
    const existing = (await pool.query('select * from home_care_duties where id=$1', [req.params.id])).rows[0];
    if (!existing) {
        res.status(404).json({ error: 'Duty not found.' });
        return;
    }
    if (!await location(req, res, existing.ward_id, d.action === 'cancel'))
        return;
    if (d.action !== 'cancel' && existing.staff_id !== req.auth!.staff.id) {
        res.status(403).json({ error: 'Only the assigned carer can record attendance or handover.' });
        return;
    }
    if (['check_out', 'handover', 'wellness'].includes(d.action) && !d.notes) {
        res.status(400).json({ error: 'Enter handover or wellness notes before saving.' });
        return;
    }
    if (d.action === 'wellness' && !d.wellnessOutcome) {
        res.status(400).json({ error: 'Choose a wellness outcome.' });
        return;
    }
    const db = await pool.connect();
    try {
        await db.query('begin');
        const duty = (await db.query('select * from home_care_duties where id=$1 for update', [existing.id])).rows[0];
        const replay = (await db.query('select * from home_care_events where id=$1', [d.id])).rows[0];
        if (replay) {
            await db.query('rollback');
            if (replay.duty_id !== duty.id || replay.actor_id !== req.auth!.staff.id || replay.action !== d.action || replay.notes !== d.notes || (replay.wellness_outcome ?? undefined) !== d.wellnessOutcome) {
                res.status(409).json({ error: 'Update reference already used.' });
                return;
            }
            res.json({ ok: true });
            return;
        }
        const state = nextDutyState(duty.state, d.action);
        if (!state && !(['handover', 'wellness'].includes(d.action) && ['present', 'break'].includes(duty.state))) {
            await db.query('rollback');
            res.status(409).json({ error: 'Duty status changed. Refresh before updating.' });
            return;
        }
        if (d.action === 'check_in' && (Date.now() < Date.parse(duty.starts_at) - 30 * 60 * 1000 || Date.now() >= Date.parse(duty.ends_at))) {
            await db.query('rollback');
            res.status(409).json({ error: 'Check in within 30 minutes of the start and before the duty ends.' });
            return;
        }
        if (state)
            await db.query(`update home_care_duties set state=$2,checked_in_at=case when $3='check_in' then now() else checked_in_at end,checked_out_at=case when $3='check_out' then now() else checked_out_at end,updated_at=now() where id=$1`, [duty.id, state, d.action]);
        await db.query('insert into home_care_events(id,duty_id,actor_id,action,notes,wellness_outcome) values($1,$2,$3,$4,$5,$6)', [d.id, duty.id, req.auth!.staff.id, d.action, d.notes, d.wellnessOutcome ?? null]);
        await db.query('commit');
        res.json({ ok: true });
    }
    catch (e) {
        await db.query('rollback');
        if ((e as {
            code?: string;
        }).code === '23505') {
            res.status(409).json({ error: 'You already have an active duty, or this update was already saved. Refresh the dashboard.' });
            return;
        }
        throw e;
    }
    finally {
        db.release();
    }
}));
