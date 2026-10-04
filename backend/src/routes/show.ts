import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { requireStaffRole, type AuthenticatedRequest } from '../auth.js';
import { checkoutLines, type PackageSelection } from '../billing/checkout.js';
import { catalogue } from '../billing/package-pricing.js';
import { showQuote, SHOW_TERMS_VERSION, validateStartDate } from '../show/offer.js';
import { hashPassword, verifyPassword, digest } from '../show/security.js';
import { ensureSchedule, scheduleParameters } from '../show/schedules.js';

const router = Router();
const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;
const emailSchema = z.string().trim().email().max(254).transform(s => s.toLowerCase());
const registration = z.object({ organisationName: z.string().trim().min(2).max(255), contactName: z.string().trim().min(2).max(255),
  contactRole: z.string().trim().min(2).max(120), billingEmail: emailSchema, billingPhone: z.string().trim().max(50).default(''),
  password: z.string().min(12).max(128), package: z.unknown(), acceptedTerms: z.literal(true), termsVersion: z.literal(SHOW_TERMS_VERSION),
  catalogueVersion: z.literal(catalogue.version), website: z.string().max(0).default('') });
const route = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req,res).catch(next); };
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
async function limit(key: string, maximum: number) {
  await pool.query("delete from care_show_rate_limits where window_start < now()-interval '1 day'");
  const result = await pool.query(`insert into care_show_rate_limits(key) values($1) on conflict(key) do update set
    attempts=case when care_show_rate_limits.window_start < now()-interval '15 minutes' then 1 else care_show_rate_limits.attempts+1 end,
    window_start=case when care_show_rate_limits.window_start < now()-interval '15 minutes' then now() else care_show_rate_limits.window_start end returning attempts`, [digest(key)]);
  return result.rows[0].attempts <= maximum;
}
async function session(orderId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('delete from care_show_sessions where expires_at < now()');
  await pool.query("insert into care_show_sessions(token_hash,order_id,expires_at) values($1,$2,now()+interval '2 hours')", [digest(token),orderId]);
  return token;
}
async function getOrder(req: Request, res: Response) {
  const token = req.header('authorization')?.match(/^Bearer (.{40,100})$/)?.[1];
  if (!token) { res.status(401).json({error:'Sign in to your show account.'}); return; }
  const result = await pool.query(`select o.*, o.proposed_start_date::text as proposed_start_date, b.organisation_id, b.billing_status from care_show_sessions s
    join care_show_orders o on o.id=s.order_id left join billing_accounts b on b.id=o.billing_account_id
    where s.token_hash=$1 and s.expires_at>now()`,[digest(token)]);
  if (!result.rows[0]) res.status(401).json({error:'Your session has expired. Please sign in again.'});
  return result.rows[0];
}
function publicOrder(o: any) {
  return {id:o.id,organisationName:o.organisation_name,contactName:o.contact_name,email:o.email,package:o.package_selection,quote:o.quote_snapshot,
    paymentReady:!!o.stripe_payment_method_id,proposedDate:o.proposed_start_date ? String(o.proposed_start_date).slice(0,10) : null,
    confirmedAt:o.confirmed_at,scheduled:!!o.software_schedule_id && (!o.package_selection.tablets || !!o.tablet_schedule_id),
    active:!!o.organisation_id && o.billing_status==='active',billingStatus:o.billing_status,organisationId:o.organisation_id,
    managerStaffCode:o.manager_staff_code,tabletReturned:!!o.tablet_returned_at,termsVersion:o.terms_version};
}
router.post('/register', route(async (req,res) => {
  if (!stripe) {res.status(503).json({error:'Online registration is not configured. Please contact SecureObs.'});return;}
  if (!await limit(`register:${req.ip}`,20)) {res.status(429).json({error:'Too many requests. Please try again in 15 minutes.'});return;}
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) {res.status(400).json({error:'Complete all details, use a password of at least 12 characters and accept the current show terms.'});return;}
  const data=parsed.data;
  let quote;
  try {quote=showQuote(data.package);} catch(e) {res.status(400).json({error:(e as Error).message});return;}
  // Validate every price before taking the order, including the future tablet price.
  await checkoutLines(stripe,{...quote.selection,tablets:0} as PackageSelection);
  if (quote.selection.tablets) await checkoutLines(stripe,{...quote.selection,interval:'monthly'} as PackageSelection);
  const id=crypto.randomUUID();
  const inserted=await pool.query(`insert into care_show_orders(id,email,password_hash,organisation_name,contact_name,contact_role,phone,package_selection,quote_snapshot,terms_version)
    values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10) on conflict(email) do nothing returning id`,
    [id,data.billingEmail,await hashPassword(data.password),data.organisationName,data.contactName,data.contactRole,data.billingPhone,JSON.stringify(quote.selection),JSON.stringify(quote),SHOW_TERMS_VERSION]);
  if (!inserted.rowCount) {res.status(409).json({error:'An account already exists for that email. Sign in to continue, or contact SecureObs for help.'});return;}
  res.status(201).json({token:await session(id)});
}));
router.post('/login',route(async(req,res)=>{
  const data=z.object({email:emailSchema,password:z.string().min(1).max(128)}).safeParse(req.body);
  if (!data.success) {res.status(400).json({error:'Enter your email and password.'});return;}
  if (!await limit(`login:${data.data.email}`,10) || !await limit(`login-ip:${req.ip}`,100)) {res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});return;}
  const found=await pool.query('select id,password_hash from care_show_orders where email=$1',[data.data.email]);
  if (!await verifyPassword(data.data.password,found.rows[0]?.password_hash)) {res.status(401).json({error:'Email or password was not accepted.'});return;}
  res.json({token:await session(found.rows[0].id)});
}));
router.post('/logout',route(async(req,res)=>{const token=req.header('authorization')?.slice(7)??'';await pool.query('delete from care_show_sessions where token_hash=$1',[digest(token)]);res.json({ok:true});}));
router.get('/account',route(async(req,res)=>{const o=await getOrder(req,res);if(o)res.json(publicOrder(o));}));
router.post('/setup',route(async(req,res)=>{
  const o=await getOrder(req,res);if(!o)return;
  if (!stripe) {res.status(503).json({error:'Payments are unavailable.'});return;}
  const db=await pool.connect();
  try {
    await db.query('begin');
    const row=(await db.query('select * from care_show_orders where id=$1 for update',[o.id])).rows[0];
    if (row.confirmed_at) {await db.query('rollback');res.status(409).json({error:'Billing is already scheduled. Contact SecureObs to change your payment method.'});return;}
    let customer=row.stripe_customer_id;
    if (!customer) {
      customer=(await stripe.customers.create({name:row.organisation_name,email:row.email,phone:row.phone||undefined,metadata:{showOrderId:o.id}}, {idempotencyKey:`show-customer-${o.id}`})).id;
      await db.query('update care_show_orders set stripe_customer_id=$2 where id=$1',[o.id,customer]);
    }
    if (row.stripe_setup_session_id) {
      const previous=await stripe.checkout.sessions.retrieve(row.stripe_setup_session_id);
      if (previous.status==='open' && previous.url) {await db.query('commit');res.json({checkoutUrl:previous.url});return;}
    }
    const checkout=await stripe.checkout.sessions.create({mode:'setup',currency:'gbp',customer,integration_identifier:'secureobs_care_show_qmrtvnpz',
      billing_address_collection:'required',customer_update:{address:'auto',name:'auto'},
      metadata:{showOrderId:o.id},setup_intent_data:{metadata:{showOrderId:o.id}},
      custom_text:{submit:{message:'Save your payment method for the SecureObs Care Show package. No charge today. Billing starts only after you confirm your activation date in your SecureObs show account.'}},
      success_url:`${config.publicWebsiteUrl}/show-account?setup=complete`,cancel_url:`${config.publicWebsiteUrl}/show-account?setup=cancelled`});
    await db.query('update care_show_orders set stripe_setup_session_id=$2 where id=$1',[o.id,checkout.id]);
    await db.query('commit');res.json({checkoutUrl:checkout.url});
  } catch(e){await db.query('rollback');throw e;} finally{db.release();}
}));
router.get('/admin/orders',requireStaffRole(['super_admin']),route(async(_req,res)=>{
  const rows=await pool.query(`select o.*,o.proposed_start_date::text as proposed_start_date,b.organisation_id,b.billing_status from care_show_orders o left join billing_accounts b on b.id=o.billing_account_id order by o.created_at desc limit 500`);
  res.json({orders:rows.rows.map(o=>({...publicOrder(o),phone:o.phone,contactRole:o.contact_role,createdAt:o.created_at}))});
}));
router.post('/admin/propose',requireStaffRole(['super_admin']),route(async(req,res)=>{
  const data=z.object({id:z.string().uuid(),date:z.string()}).safeParse(req.body);
  if(!data.success){res.status(400).json({error:'Choose an order and activation date.'});return;}
  try{validateStartDate(data.data.date);}catch(e){res.status(400).json({error:(e as Error).message});return;}
  const updated=await pool.query(`update care_show_orders set proposed_start_date=$2,proposed_by=$3,proposed_at=now() where id=$1 and confirmed_at is null returning id`,
    [data.data.id,data.data.date,(req as AuthenticatedRequest).auth!.staff.id]);
  if(!updated.rowCount){res.status(409).json({error:'This order is already confirmed or was not found.'});return;}
  res.json({ok:true});
}));
router.post('/confirm',route(async(req,res)=>{
  const o=await getOrder(req,res);if(!o)return;
  if(!stripe){res.status(503).json({error:'Payments are unavailable.'});return;}
  const data=z.object({date:z.string(),accepted:z.literal(true),termsVersion:z.literal(SHOW_TERMS_VERSION)}).safeParse(req.body);
  if(!data.success){res.status(400).json({error:'Confirm your activation date and payment authorisation.'});return;}
  const db=await pool.connect();
  try {
    await db.query('begin');
    const row=(await db.query("select *,proposed_start_date::text as start_date from care_show_orders where id=$1 for update",[o.id])).rows[0];
    if(!row.stripe_payment_method_id || row.start_date!==data.data.date){await db.query('rollback');res.status(409).json({error:'Save a payment method and review the latest proposed activation date first.'});return;}
    if(!row.confirmed_at) {
      try{validateStartDate(row.start_date);}catch(e){await db.query('rollback');res.status(400).json({error:(e as Error).message});return;}
    }
    const quote=showQuote(row.package_selection);
    const software=await checkoutLines(stripe,{...quote.selection,tablets:0} as PackageSelection);
    if(software.quote.gross!==row.quote_snapshot.software.gross || catalogue.vatRegistered) throw new Error('Your quote needs administrator review before activation.');
    let tabletPrice: string|undefined;
    if(quote.selection.tablets){const full=await checkoutLines(stripe,{...quote.selection,interval:'monthly'} as PackageSelection);tabletPrice=full.lineItems[full.quote.lines.findIndex((l:any)=>l.key==='tablets')].price;}
    const billingId=row.billing_account_id??crypto.randomUUID();
    if(!row.billing_account_id){
      await db.query(`insert into billing_accounts(id,organisation_name,billing_contact_name,billing_email,billing_phone,stripe_customer_id,subscription_plan,billing_interval,licensed_ward_quantity,package_selection,expected_amount,tablet_quantity,ordered_items)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb)`,
        [billingId,row.organisation_name,row.contact_name,row.email,row.phone,row.stripe_customer_id,quote.selection.enterprise?'enterprise':quote.selection.wards.every((w:any)=>w.plan==='professional')?'professional':'essential',quote.selection.interval,quote.selection.wards.length,JSON.stringify(quote.selection),software.quote.gross,quote.selection.tablets,JSON.stringify(software.lineItems.map((l,i)=>({...l,key:software.quote.lines[i].key})))]);
    }
    // Persist the customer's agreement before external calls. Retrying completes the same schedules.
    await db.query('update care_show_orders set billing_account_id=$2,confirmed_at=coalesce(confirmed_at,now()) where id=$1',[o.id,billingId]);
    await db.query('commit');
    const input={orderId:o.id,billingAccountId:billingId,customer:row.stripe_customer_id,paymentMethod:row.stripe_payment_method_id,date:row.start_date,softwareItems:software.lineItems,tabletPrice,tablets:quote.selection.tablets};
    const schedule=await ensureSchedule(stripe,scheduleParameters(input,'software'),`show-software-${o.id}`);
    await db.query('update care_show_orders set software_schedule_id=$2 where id=$1',[o.id,schedule.id]);
    if(quote.selection.tablets){const tablets=await ensureSchedule(stripe,scheduleParameters(input,'tablets'),`show-tablets-${o.id}`);await db.query('update care_show_orders set tablet_schedule_id=$2 where id=$1',[o.id,tablets.id]);}
    res.json({ok:true});
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}));
router.post('/manager',route(async(req,res)=>{
  const o=await getOrder(req,res);if(!o)return;
  if(!o.organisation_id || o.billing_status!=='active'){res.status(409).json({error:'Manager setup becomes available after activation and successful payment.'});return;}
  const parsed=z.object({pin:z.string().regex(/^\d{6}$/)}).safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Choose a six-digit manager PIN.'});return;}
  const pinHash=await hashPassword(parsed.data.pin);
  const db=await pool.connect();
  try{
    await db.query('begin');
    const row=(await db.query('select manager_staff_code from care_show_orders where id=$1 for update',[o.id])).rows[0];
    if(row.manager_staff_code){await db.query('rollback');res.status(409).json({error:'Your manager login has already been created. Use the existing login or contact support.'});return;}
    const wards=(await db.query('select id,site_id from wards where billing_account_id=$1 order by billing_ward_index',[o.billing_account_id])).rows;
    if(!wards.length)throw new Error('Ward setup is still pending.');
    const code=`SHOW${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    await db.query(`insert into staff_members(organisation_id,staff_code,display_name,role,designation,can_prescribe,employment_type,login_pin_hash,login_pin_must_change,ward_id,allowed_site_ids,allowed_ward_ids,active)
      values($1,$2,$3,'manager','Organisation manager',false,'permanent',$4,false,$5,$6,$7,true)`,[o.organisation_id,code,o.contact_name,pinHash,wards[0].id,[...new Set(wards.map(w=>w.site_id))],wards.map(w=>w.id)]);
    await db.query('update care_show_orders set manager_staff_code=$2 where id=$1',[o.id,code]);await db.query('commit');res.json({staffCode:code});
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}));
router.post('/admin/tablets-returned',requireStaffRole(['super_admin']),route(async(req,res)=>{
  const data=z.object({id:z.string().uuid(),allReturned:z.literal(true)}).safeParse(req.body);
  if(!data.success || !stripe){res.status(400).json({error:'Confirm that all tablets have been returned.'});return;}
  const row=(await pool.query('select * from care_show_orders where id=$1',[data.data.id])).rows[0];
  if(!row?.tablet_schedule_id){res.status(409).json({error:'No tablet billing schedule exists for this order.'});return;}
  const s=await stripe.subscriptionSchedules.retrieve(row.tablet_schedule_id);
  if(s.status==='released' && s.released_subscription){
    const subscriptionId=s.released_subscription;
    const subscription=await stripe.subscriptions.retrieve(subscriptionId);
    if(subscription.status!=='canceled')await stripe.subscriptions.cancel(subscriptionId,{invoice_now:false,prorate:false},{idempotencyKey:`show-return-renewed-${row.id}`});
  }else if(s.status!=='canceled' && s.status!=='completed')await stripe.subscriptionSchedules.cancel(s.id,{invoice_now:false,prorate:false},{idempotencyKey:`show-return-${row.id}`});
  await pool.query('update care_show_orders set tablet_returned_at=coalesce(tablet_returned_at,now()) where id=$1',[row.id]);res.json({ok:true});
}));
export async function handleShowSetup(stripeClient: Stripe, event: Stripe.Event) {
  if(event.type!=='checkout.session.completed' || event.data.object.mode!=='setup')return;
  const checkout=event.data.object;
  const id=checkout.metadata?.showOrderId;
  if(!id || typeof checkout.setup_intent!=='string' || typeof checkout.customer!=='string')return;
  const intent=await stripeClient.setupIntents.retrieve(checkout.setup_intent);
  if(intent.status!=='succeeded' || intent.customer!==checkout.customer || typeof intent.payment_method!=='string')return;
  await pool.query(`update care_show_orders set stripe_payment_method_id=$2 where id=$1 and stripe_customer_id=$3 and stripe_setup_session_id=$4 and confirmed_at is null`,[id,intent.payment_method,checkout.customer,checkout.id]);
}
export {router as showRouter};
