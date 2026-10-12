import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { organisationFeatureEnabled, organisationResourceLimit } from './config.js';
import { pool } from '../db/pool.js';
import { requireAuthenticated, type AuthenticatedRequest } from '../auth.js';
import { roleInWard } from '../wardAccess.js';
import { dutyKinds, nextDutyState } from '../homeCare/rules.js';
type HomeCareRequest = AuthenticatedRequest & { homeCareOrganisationId?: string };
export const homeCareRouter = Router();
const route = (fn: (req: HomeCareRequest, res: Response) => Promise<unknown>) => (req: HomeCareRequest, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
// Older app builds already send the selected location in X-Ward-Id.
// Resolve that context for super-admins instead of silently loading their home organisation.
homeCareRouter.use(async (req: HomeCareRequest, res, next) => {
 res.setHeader('Cache-Control','no-store');
 if(!requireAuthenticated(req,res))return;
 try {
  const staff=req.auth!.staff;
  const requested=req.header('x-organisation-id');
  if(requested && !z.string().uuid().safeParse(requested).success){res.status(400).json({error:'Invalid organisation context.'});return;}
  if(staff.role!=='super_admin'){
   if(requested && requested!==staff.organisationId){res.status(403).json({error:'This account cannot access another organisation.'});return;}
   req.homeCareOrganisationId=staff.organisationId;
  }else if(requested){req.homeCareOrganisationId=requested;}
  else {
   const wardId=req.header('x-ward-id');
   if(wardId){
    const selected=await pool.query('select s.organisation_id from wards w join sites s on s.id=w.site_id where w.id=$1',[wardId]);
    if(!selected.rows[0]){res.status(404).json({error:'Selected home location no longer exists. Select the site again.'});return;}
    req.homeCareOrganisationId=selected.rows[0].organisation_id;
   }else req.homeCareOrganisationId=staff.organisationId;
  }
  next();
 }catch(error){next(error);}
});
async function location(req: HomeCareRequest, res: Response, wardId: string, manager = false) {
    const staff = req.auth!.staff, role = roleInWard(staff, wardId);
    if (!role || (manager && !['manager', 'super_admin'].includes(role))) {
        res.status(403).json({ error: 'You do not have access to manage or view this home.' });
        return;
    }
    const found = await pool.query(`select w.id,w.service_type,s.organisation_id from wards w join sites s on s.id=w.site_id where w.id=$1`, [wardId]);
    const w = found.rows[0];
    if (!w || w.organisation_id !== req.homeCareOrganisationId || w.service_type !== 'Home care') {
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
 where s.organisation_id=$1 and w.service_type='Home care' and ($2::boolean or w.id=any($3::text[])) order by w.name`, [req.homeCareOrganisationId, staff.role === 'super_admin', staff.allowedWardIds]);
    const ids = homes.rows.map(h => h.id);
    const duties = await pool.query(`select d.*,m.display_name as staff_name from home_care_duties d join staff_members m on m.id=d.staff_id where d.ward_id=any($1::text[]) and (d.ends_at>now()-interval '7 days' and d.starts_at<now()+interval '31 days' or d.state in ('present','break')) order by d.starts_at`, [ids]);
    const residents = await pool.query('select id,ward_id as "wardId",first_name as "firstName",surname from patients where organisation_id=$1 and ward_id=any($2::text[]) and archived=false', [req.homeCareOrganisationId, ids]);
    const tasks = await pool.query(`select t.ward_id as "wardId",count(*)::int as outstanding,count(*) filter(where t.due_at<now())::int as overdue from patient_tasks t join patients p on p.id=t.patient_id where t.organisation_id=$1 and t.ward_id=any($2::text[]) and t.status in ('open','accepted') and p.archived=false group by t.ward_id`, [req.homeCareOrganisationId, ids]);
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
        const member = (await db.query('select * from staff_members where id=$1 and organisation_id=$2 and active=true for update', [d.staffId, req.homeCareOrganisationId])).rows[0];
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

const newHomeSchema = z.object({id:z.string().uuid(),siteId:z.string().min(1).max(150),name:z.string().trim().min(1).max(200),address:z.string().trim().min(1).max(1000)}).strict();
homeCareRouter.post('/locations',route(async(req,res)=>{
 const parsed=newHomeSchema.safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:'Choose a home-care site and enter the location name and address.'});return;}
 const d=parsed.data,staff=req.auth!.staff,organisationId=req.homeCareOrganisationId!;
 // Existing home-management access is required; a request cannot promote an ordinary carer.
 const site=(await pool.query('select id from sites where id=$1 and organisation_id=$2',[d.siteId,organisationId])).rows[0];
 const existingHomes=(await pool.query("select id from wards where site_id=$1 and service_type='Home care'",[d.siteId])).rows;
 if(!site || !existingHomes.length || !existingHomes.some(h=>['manager','super_admin'].includes(roleInWard(staff,h.id)??''))){res.status(403).json({error:'You must manage an existing home in this home-care site to add a location.'});return;}
 const [limit,medication,rostering,security,verified]=await Promise.all([
  organisationResourceLimit(organisationId,'wardsPerSite'),organisationFeatureEnabled(organisationId,'medication'),organisationFeatureEnabled(organisationId,'rostering'),organisationFeatureEnabled(organisationId,'securityChecks'),organisationFeatureEnabled(organisationId,'verifiedObservations')]);
 const db=await pool.connect();
 try{
  await db.query('begin');
  await db.query('select id from organisations where id=$1 for update',[organisationId]);
  const previous=(await db.query('select w.site_id,w.name,p.address from wards w left join home_care_profiles p on p.ward_id=w.id where w.id=$1',[d.id])).rows[0];
  if(previous){await db.query('rollback');const same=previous.site_id===d.siteId&&previous.name===d.name&&previous.address===d.address;res.status(same?200:409).json(same?{id:d.id}:{error:'This location reference is already in use.'});return;}
  const counts=(await db.query('select w.id,w.site_id from wards w join sites s on s.id=w.site_id where s.organisation_id=$1',[organisationId])).rows;
  const licensed=(await db.query('select licensed_ward_quantity from billing_accounts where organisation_id=$1 and package_selection is not null',[organisationId])).rows[0];
  if((licensed&&counts.length>=licensed.licensed_ward_quantity)||(limit!==null&&counts.filter(w=>w.site_id===d.siteId).length>=limit)){await db.query('rollback');res.status(403).json({error:'The current location allowance is fully used. Increase the subscription allowance before adding another home.'});return;}
  await db.query(`insert into wards(id,site_id,name,service_type,medication_chart_enabled,staff_rota_enabled,security_checks_enabled,verified_observations_enabled,assessment_forms_enabled,food_fluid_chart_enabled) values($1,$2,$3,'Home care',$4,$5,$6,$7,true,true)`,[d.id,d.siteId,d.name,medication,rostering,security,verified]);
  await db.query('insert into home_care_profiles(ward_id,address) values($1,$2)',[d.id,d.address]);
  if(staff.role!=='super_admin') await db.query(`update staff_members set allowed_ward_ids=array_append(allowed_ward_ids,$1),allowed_site_ids=case when $2=any(allowed_site_ids) then allowed_site_ids else array_append(allowed_site_ids,$2) end,ward_roles=coalesce(ward_roles,'{}'::jsonb)||jsonb_build_object($1::text,'manager'),updated_at=now() where id=$3 and organisation_id=$4`,[d.id,d.siteId,staff.id,organisationId]);
  await db.query(`insert into audit_events(id,organisation_id,actor_staff_id,actor_staff_code,event_type,entity_type,entity_id,outcome,details) values($1,$2,$3,$4,'home_care.location_created','ward',$5,'success',$6::jsonb)`,['home-created-'+d.id,organisationId,staff.id,staff.staffCode,d.id,JSON.stringify({siteId:d.siteId})]);
  await db.query('commit');res.status(201).json({id:d.id});
 }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}));
