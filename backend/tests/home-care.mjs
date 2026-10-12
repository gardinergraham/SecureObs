import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function moduleAt(path,stubs={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>stubs[n]??require(n),Date,console});return exports;}
const rules=moduleAt('../src/homeCare/rules.ts');
assert.equal(rules.nextDutyState('planned','check_out'),undefined);
assert.equal(rules.nextDutyState('planned','check_in'),'present');
assert.equal(rules.nextDutyState('present','break'),'break');
assert.equal(rules.nextDutyState('break','resume'),'present');
assert.equal(rules.nextDutyState('break','check_out'),'completed');
assert.equal(rules.nextDutyState('completed','check_in'),undefined);
assert.equal(rules.nextDutyState('present','cancel'),undefined);
const {homeCoverage,parseLocalDutyDate}=moduleAt('../../src/utils/homeCare.ts');
const now=Date.parse('2026-10-12T12:00:00Z');
const home={id:'home',requiredCarers:2,continuousCover:true};
const duty={id:'a',ward_id:'home',state:'present',kind:'day',starts_at:'2026-10-12T08:00:00Z',ends_at:'2026-10-12T20:00:00Z'};
assert.equal(homeCoverage(home,[duty],now).gap,true);
assert.equal(homeCoverage(home,[duty,{...duty,id:'b'}],now).gap,false);
assert.equal(homeCoverage(home,[duty,{...duty,id:'b',state:'break'}],now).gap,true);
assert.equal(homeCoverage(home,[duty,{...duty,id:'b',kind:'wellness'}],now).gap,true);
assert.equal(homeCoverage({...home,requiredCarers:1},[duty],now).plannedGap,Date.parse(duty.ends_at));
assert.equal(homeCoverage({...home,requiredCarers:1},[{...duty,ends_at:'2026-10-12T11:00:00Z'}],now).present,0);
assert.equal(homeCoverage(home,[{...duty,ends_at:'2026-10-12T11:00:00Z'}],now).overdue,1);
assert.equal(homeCoverage({...home,continuousCover:false},[],now).gap,false);
assert.throws(()=>parseLocalDutyDate('2026-02-30 12:00'));
assert.throws(()=>parseLocalDutyDate('12/10/26'));
assert.ok(parseLocalDutyDate('2026-10-12 12:00'));
let locationMode=false,siteAllowed=true,locationLimit=null;
const routes={},middleware=[];let queries=[],resultDuty={id:'47f992bd-1b24-4611-b621-9b31c5910b03',ward_id:'home',staff_id:'11111111-1111-4111-8111-111111111111',state:'planned',starts_at:new Date(Date.now()-60000),ends_at:new Date(Date.now()+3600000)},org='org',replay;
const query=async(sql,args)=>{queries.push({sql,args});if(locationMode){if(sql.startsWith('select id from sites'))return {rows:siteAllowed?[{id:'site'}]:[]};if(sql.startsWith('select id from wards where site_id'))return {rows:[{id:'home'}]};if(sql.startsWith('select w.id,w.site_id from wards'))return {rows:[{id:'home',site_id:'site'}]};return {rows:[]};}if(sql.includes('from wards w'))return {rows:[{id:'home',organisation_id:org,service_type:'Home care'}]};if(sql.includes('from home_care_duties where id'))return {rows:[resultDuty]};if(sql.includes('from home_care_events where id'))return {rows:replay?[replay]:[]};return {rows:[]};};
moduleAt('../src/routes/homeCare.ts',{
 './config.js':{organisationResourceLimit:async()=>locationLimit,organisationFeatureEnabled:async()=>true},
 express:{Router:()=>({use:f=>middleware.push(f),get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f})},
 '../db/pool.js':{pool:{query,connect:async()=>({query,release(){}})}},
 '../auth.js':{requireAuthenticated:(req,res)=>{if(!req.auth){res.status(401).json({error:'Sign in'});return;}return req.auth;}},
 '../wardAccess.js':{roleInWard:(s,id)=>s.role==='super_admin'?'super_admin':s.allowedWardIds.includes(id)?s.role:undefined},
 '../homeCare/rules.js':rules
});
const staff={id:resultDuty.staff_id,organisationId:'org',role:'hcf',allowedWardIds:['home']};
async function run(path,body,member=staff){const req={body,auth:member?{staff:member}:undefined,params:{id:resultDuty.id},query:{}};const res={code:200,setHeader(){},status(n){this.code=n;return this;}};await new Promise((resolve,reject)=>{res.json=x=>{res.body=x;resolve();};middleware[0](req,res,()=>routes[path](req,res,reject));});return res;}
assert.equal((await run('GET /',{},null)).code,401);
const event={id:'7b7d4f7e-99bc-48ae-b7d5-17e79f62db6b',action:'check_in',notes:''};
assert.equal((await run('POST /duties/:id/events',event,{...staff,allowedWardIds:[]})).code,403);
org='other-org';assert.equal((await run('POST /duties/:id/events',event)).code,404);org='org';
assert.equal((await run('POST /duties/:id/events',event,{...staff,id:'another'})).code,403);
queries=[];assert.equal((await run('POST /duties/:id/events',event)).code,200);assert.ok(queries.some(q=>q.sql.startsWith('insert into home_care_events')));assert.ok(queries.some(q=>q.sql==='commit'));
resultDuty={...resultDuty,state:'completed'};assert.equal((await run('POST /duties/:id/events',event)).code,409);
replay={id:event.id,duty_id:resultDuty.id,actor_id:staff.id,action:'check_in',notes:''};assert.equal((await run('POST /duties/:id/events',event)).code,200);replay=undefined;
resultDuty={...resultDuty,state:'present'};assert.equal((await run('POST /duties/:id/events',{...event,action:'check_out'})).code,400);
assert.equal((await run('POST /duties/:id/events',{...event,action:'wellness',notes:'Review needed'})).code,400);
console.log('PASS: cover counts, breaks, wellness exclusion, planned gaps, expired cover, date validation, state transitions, authentication, cross-organisation denial, own attendance, replay and required handover.');

locationMode=true;
const newHome={id:'0ba6bcec-023a-4b6a-b5de-4328f0cf63c8',siteId:'site',name:'17 Test Road',address:'17 Test Road'};
const manager={...staff,role:'manager',staffCode:'TEST'};
assert.equal((await run('POST /locations',newHome,staff)).code,403);
assert.equal((await run('POST /locations',newHome,{...manager,allowedWardIds:[]})).code,403);
siteAllowed=false;assert.equal((await run('POST /locations',newHome,manager)).code,403);siteAllowed=true;
locationLimit=1;queries=[];assert.equal((await run('POST /locations',newHome,manager)).code,403);assert.ok(!queries.some(q=>q.sql.startsWith('insert into wards')));
locationLimit=null;queries=[];assert.equal((await run('POST /locations',newHome,manager)).code,201);assert.ok(queries.some(q=>q.sql.startsWith('update staff_members')&&q.args[2]===manager.id));assert.ok(queries.some(q=>q.sql.includes('home_care.location_created')));assert.ok(queries.some(q=>q.sql==='commit'));
console.log('PASS: manager home creation, carer denial, unrelated-site denial, location limits, manager access grant and audit.');
