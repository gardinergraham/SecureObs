import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireStaffRole, type AuthenticatedRequest } from '../auth.js';

export const leadSchema = z.object({
eventName: z.string().trim().max(255),
eventDate: z.string().trim().max(255),
leadReference: z.string().trim().max(255),
representative: z.string().trim().max(255),
conversationTime: z.string().trim().max(255),
followUpOwner: z.string().trim().max(255),
contactStatus: z.array(z.enum(["New prospect", "Existing customer"])).max(2).default([]),
interest: z.array(z.enum(["Hot", "Warm", "Exploring"])).max(3).default([]),
followUp: z.array(z.enum(["Quote", "Demo", "Trial"])).max(3).default([]),
contactName: z.string().trim().max(255).min(1),
role: z.string().trim().max(255),
organisation: z.string().trim().max(255).min(1),
tradingName: z.string().trim().max(255),
email: z.union([z.literal(''), z.string().trim().email().max(254)]),
phone: z.string().trim().max(255),
address: z.string().trim().max(255),
townPostcode: z.string().trim().max(255),
organisationType: z.array(z.enum(["Limited company", "Charity", "NHS / public body", "Partnership", "Other"])).max(5).default([]),
preferredContact: z.array(z.enum(["Email", "Telephone", "Video meeting"])).max(3).default([]),
sites: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
wards: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
beds: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
staff: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
shiftStaff: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
currentSystem: z.string().trim().max(255),
setting: z.array(z.enum(["Care home", "Nursing home", "Mental health", "Secure hospital", "Supported living", "Hospital / NHS"])).max(6).default([]),
needs: z.array(z.enum(["Timed observations", "NEWS2", "Care notes", "Care plans", "Risk assessments", "Patient tasks", "Medication / eMAR", "Incidents / safeguarding", "Security checks", "Audits", "CQC governance", "Digital audit trail", "Rostering / attendance", "Staff allocation", "Role-based access", "NFC staff cards", "Offline working", "Dashboards / analytics", "Desktop documentation", "Family / designated portal", "Multi-site management", "Data migration", "Integration / API", "Training / onboarding"])).max(24).default([]),
problem: z.string().trim().max(4000),
outcome: z.string().trim().max(4000),
decisionMakers: z.string().trim().max(255),
stakeholders: z.string().trim().max(255),
targetDate: z.string().trim().max(255),
budget: z.string().trim().max(255),
renewal: z.string().trim().max(255),
nextStep: z.array(z.enum(["Guided demo", "Private trial", "Quotation", "Technical call", "Follow-up email", "No follow-up"])).max(6).default([]),
package: z.array(z.enum(["Essential", "Professional", "Enterprise", "Hospital / custom quotation"])).max(4).default([]),
billing: z.array(z.enum(["Monthly", "Yearly", "To be agreed"])).max(3).default([]),
configuration: z.string().trim().max(4000),
proposedWards: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
proposedStart: z.string().trim().max(255),
indicativeValue: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
eligibility: z.array(z.enum(["New customer", "Existing customer \u2014 upgrade / review", "To be confirmed"])).max(3).default([]),
subscribedWards: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
freeTablets: z.string().max(20).refine(v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 10000000)),
offerCode: z.string().trim().max(255),
offerExpiry: z.string().trim().max(255),
afterSixMonths: z.array(z.enum(["Continue tablet rental", "Return tablets", "Decide before month six ends"])).max(3).default([]),
modules: z.array(z.enum(["Medication / eMAR", "Security checks", "Analytics dashboard", "Family / designated-person portal", "Training / onboarding", "Rostering & attendance", "CQC reporting & governance", "Desktop notes & care plans", "NFC staff cards / tags", "Data migration / integration"])).max(10).default([]),
hardware: z.string().trim().max(4000),
implementation: z.string().trim().max(4000),
decision: z.array(z.enum(["Proceed \u2014 prepare agreement", "Follow up", "Needs internal approval", "Not proceeding"])).max(4).default([]),
authorisedContact: z.string().trim().max(255),
authorisedRole: z.string().trim().max(255),
decisionDate: z.string().trim().max(255),
purchaseOrder: z.array(z.enum(["Yes", "No", "To be confirmed"])).max(3).default([]),
action: z.string().trim().max(4000),
owner: z.string().trim().max(255),
dueDate: z.string().trim().max(255),
meeting: z.string().trim().max(255),
quotationReference: z.string().trim().max(255),
notes: z.string().trim().max(4000),
risks: z.string().trim().max(4000),
marketingOptIn: z.boolean()
}).strict().refine(v => !!(v.email || v.phone), { message: 'Enter an email address or telephone number.' });
export const leadsRouter = Router();
leadsRouter.use((_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
leadsRouter.use(requireStaffRole(['super_admin']));
leadsRouter.post('/', async (req: AuthenticatedRequest,res,next) => {
  const parsed = z.object({ id:z.string().uuid(), data:leadSchema }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({error:'Check the required fields and enter a valid email address or telephone number.'}); return; }
  try {
    const {id,data}=parsed.data;
    const result=await pool.query(`insert into customer_leads (id, organisation_id, created_by, data)
      values ($1,$2,$3,$4::jsonb) on conflict (id) do update set id=customer_leads.id
      where customer_leads.organisation_id=excluded.organisation_id and customer_leads.data=excluded.data
      returning id,created_at`,[id,req.auth!.staff.organisationId,req.auth!.staff.id,JSON.stringify(data)]);
    if (!result.rows[0]) { res.status(409).json({error:'This record was already saved with different details. Start a new record.'}); return; }
    res.status(201).json(result.rows[0]);
  } catch(error) { next(error); }
});
leadsRouter.get('/', async (req: AuthenticatedRequest,res,next) => {
  try {
    const page=z.coerce.number().int().min(0).max(100000).safeParse(req.query.page ?? 0);
    const search=z.string().trim().max(150).safeParse(req.query.search ?? '');
    if(!search.success){res.status(400).json({error:'Search is too long'});return;}
    if(!page.success){res.status(400).json({error:'Invalid page'});return;}
    const result=await pool.query(`select id,created_at,data from customer_leads where organisation_id=$1 and ($3 = '' or strpos(lower(data->>'contactName'),lower($3))>0 or strpos(lower(data->>'organisation'),lower($3))>0 or strpos(lower(data->>'email'),lower($3))>0) order by created_at desc,id desc limit 51 offset $2`,[req.auth!.staff.organisationId,page.data*50,search.data]);
    res.json({leads:result.rows.slice(0,50),hasMore:result.rows.length>50});
  } catch(error) { next(error); }
});
