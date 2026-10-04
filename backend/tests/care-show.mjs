import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {showQuote,validateStartDate,addCalendarMonths,SHOW_TERMS_VERSION} from '../dist/show/offer.js';
import {scheduleParameters,ensureSchedule} from '../dist/show/schedules.js';
import {hashPassword,verifyPassword,digest} from '../dist/show/security.js';
import {catalogue,pricePackage} from '../dist/billing/package-pricing.js';
const require=createRequire(import.meta.url);const ts=require('typescript');const {z}=require('zod');
const selection={interval:'monthly',enterprise:false,tablets:2,wards:[{site:'Home',name:'Ward A',plan:'essential',modules:['medication']}]};
const quote=showQuote(selection);
assert.equal(quote.dueToday,0);assert.equal(quote.software.gross,19400);assert.equal(quote.tabletMonthly,7598);
assert.equal(showQuote({...selection,interval:'yearly'}).software.gross,194000);
assert.throws(()=>showQuote({...selection,tablets:3}),/two tablets/);
assert.throws(()=>showQuote({...selection,tablets:-1}));
assert.throws(()=>validateStartDate('2027-02-30',Date.parse('2027-01-01')));
assert.throws(()=>validateStartDate('2027-01-01',Date.parse('2027-01-01')));
assert.equal(new Date(addCalendarMonths('2027-08-31',6)*1000).toISOString(),'2028-02-29T12:00:00.000Z');
const input={orderId:'order',billingAccountId:'billing',customer:'cus',paymentMethod:'pm',date:'2027-01-31',softwareItems:[{price:'base',quantity:1},{price:'extra',quantity:1}],tabletPrice:'tablet',tablets:2};
const software=scheduleParameters(input,'software'),tablets=scheduleParameters(input,'tablets');
assert.equal(software.start_date,addCalendarMonths(input.date,0));assert.equal(software.phases[0].trial_end,undefined);
assert.equal(software.end_behavior,'release');assert.equal(software.phases[0].metadata.billingAccountId,'billing');
assert.equal(tablets.phases[0].trial_end,addCalendarMonths(input.date,6));assert.equal(tablets.phases[0].metadata.billingAccountId,undefined);
assert.equal(tablets.default_settings.automatic_tax.enabled,false);
assert.equal(tablets.phases[0].items[0].quantity,2);
let creates=0;
const existing={id:'sched',metadata:software.metadata};
const client={subscriptionSchedules:{list:async()=>({data:[existing],has_more:false}),create:async()=>{creates++;}}};
assert.equal((await ensureSchedule(client,software,'key')).id,'sched');assert.equal(creates,0);
client.subscriptionSchedules.list=async()=>({data:[],has_more:true});await assert.rejects(()=>ensureSchedule(client,software,'key'),/review/);
const hash=await hashPassword('a-long-test-password');assert.equal(await verifyPassword('a-long-test-password',hash),true);assert.equal(await verifyPassword('wrong',hash),false);assert.equal(await verifyPassword('wrong'),false);assert.notEqual(hash,'a-long-test-password');
console.log('PASS: monthly/annual totals, tablet limit, date validation, calendar-month offer, no software trial, automatic renewal and schedule recovery');
const handlers=new Map();let savedOrder={id:'123',email:'test@example.com',organisation_name:'Test',package_selection:selection,quote_snapshot:quote,terms_version:SHOW_TERMS_VERSION};
let dbQueries=[];let setupRequest;let scheduleCalls=0;
const fakeStripe={prices:{},customers:{create:async()=>({id:'cus'})},checkout:{sessions:{create:async p=>{setupRequest=p;return{id:'cs',url:'https://checkout.stripe.com/test'};}}},setupIntents:{retrieve:async()=>({status:'succeeded',customer:'cus',payment_method:'pm'})}};
const query=async(sql,params)=>{dbQueries.push({sql,params});if(sql.includes('care_show_rate_limits'))return{rows:[{attempts:1}],rowCount:1};if(sql.includes('care_show_sessions s'))return{rows:[savedOrder],rowCount:1};if(sql.includes('select id,site_id from wards'))return{rows:[{id:'ward',site_id:'site'}]};if(sql.includes('select manager_staff_code'))return{rows:[{manager_staff_code:null}]};if(sql.includes('select * from care_show_orders'))return{rows:[savedOrder],rowCount:1};if(sql.includes('select *,proposed_start_date'))return{rows:[savedOrder],rowCount:1};return{rows:[],rowCount:1};};
const pool={query,connect:async()=>({query,release(){}})};
const exports={};const stubs={
 'node:crypto':require('node:crypto'),express:{Router:()=>({use(){},get(p,...f){handlers.set(`GET ${p}`,f);},post(p,...f){handlers.set(`POST ${p}`,f);}})},stripe:class{constructor(){return fakeStripe;}},zod:{z},'../db/pool.js':{pool},'../config.js':{config:{stripeSecretKey:'sk_test_fake',publicWebsiteUrl:'https://example.com'}},'../auth.js':{requireStaffRole:roles=>(req,res,next)=>{if(!roles.includes(req.auth?.staff.role)){res.status(403).json({error:'forbidden'});return;}next();}},'../billing/checkout.js':{checkoutLines:async(_s,selection)=>{const q=pricePackage(selection);return{quote:q,lineItems:q.lines.map(l=>({price:'price_'+l.key,quantity:l.quantity}))};}},'../billing/package-pricing.js':{catalogue},'../show/offer.js':{showQuote,SHOW_TERMS_VERSION,validateStartDate},'../show/security.js':{hashPassword,verifyPassword,digest},'../show/schedules.js':{scheduleParameters,ensureSchedule:async()=>{scheduleCalls++;return{id:'sched'};}}
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/routes/show.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:name=>stubs[name]??require(name),console,Date,Buffer});
function response(){return{code:200,status(c){this.code=c;return this;},json(value){this.body=value;},setHeader(){}};}
async function run(path,body={},auth=true){const res=response();const req={body,ip:'test',header:()=>auth?'Bearer '+'a'.repeat(43):undefined};const f=handlers.get(path).at(-1);await new Promise((resolve,reject)=>{res.json=value=>{res.body=value;resolve();};f(req,res,reject);});return res;}
assert.equal((await run('GET /account',{},false)).code,401);
await run('POST /setup');assert.equal(setupRequest.mode,'setup');assert.equal(setupRequest.line_items,undefined);assert.equal(setupRequest.subscription_data,undefined);assert.equal(scheduleCalls,0);
let res=await run('POST /confirm',{date:'2027-01-01',accepted:true,termsVersion:SHOW_TERMS_VERSION});assert.equal(res.code,409);assert.equal(scheduleCalls,0);
res=await run('POST /manager',{pin:'123456'});assert.equal(res.code,409);
dbQueries=[];await exports.handleShowSetup(fakeStripe,{type:'checkout.session.completed',data:{object:{mode:'setup',metadata:{showOrderId:'123'},setup_intent:'seti',customer:'cus',id:'cs'}}});assert.equal(dbQueries.length,1);assert.match(dbQueries[0].sql,/stripe_customer_id=\$3 and stripe_setup_session_id=\$4/);assert.equal(dbQueries[0].params[1],'pm');
fakeStripe.setupIntents.retrieve=async()=>({status:'processing',customer:'cus',payment_method:'pm'});dbQueries=[];await exports.handleShowSetup(fakeStripe,{type:'checkout.session.completed',data:{object:{mode:'setup',metadata:{showOrderId:'123'},setup_intent:'seti',customer:'cus',id:'cs'}}});assert.equal(dbQueries.length,0);
const adminGuard=handlers.get('POST /admin/propose')[0];res=response();let next=false;adminGuard({auth:{staff:{role:'manager'}}},res,()=>{next=true;});assert.equal(res.code,403);assert.equal(next,false);
console.log('PASS: unauthenticated access blocked, setup never charges, incomplete setup cannot schedule, manager blocked before payment, webhook ownership checks and admin role required');

// Complete a confirmed order: software items and delayed tablet items must stay separate.
savedOrder={...savedOrder,stripe_payment_method_id:'pm',stripe_customer_id:'cus',start_date:'2027-01-15'};
dbQueries=[];res=await run('POST /confirm',{date:'2027-01-15',accepted:true,termsVersion:SHOW_TERMS_VERSION});assert.equal(res.code,200);assert.equal(scheduleCalls,2);
const insert=dbQueries.find(q=>q.sql.includes('insert into billing_accounts'));assert.ok(insert);assert.equal(insert.params[10],19400);assert.equal(JSON.parse(insert.params[12]).some(i=>i.key==='tablets'),false);
assert.ok(dbQueries.some(q=>q.sql.includes('confirmed_at=coalesce')));
savedOrder={...savedOrder,organisation_id:'org',billing_account_id:'billing',billing_status:'active'};
dbQueries=[];res=await run('POST /manager',{pin:'629147'});assert.equal(res.code,200);assert.match(res.body.staffCode,/^SHOW/);const manager=dbQueries.find(q=>q.sql.includes('insert into staff_members'));assert.ok(manager);assert.equal(await verifyPassword('629147',manager.params[3]),true);assert.deepEqual([...manager.params[6]],['ward']);
console.log('PASS: confirmed order schedules software and tablets separately; paid account can create a scoped manager with a hashed PIN');
