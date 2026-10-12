const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{z}=require('zod');
function load(file,stubs){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>stubs[n]??require(n)});return exports;}
let home=true,queries=[];
const pool={query:async(sql,args)=>{queries.push({sql,args});return {rows:sql.includes('w.service_type')?[{service_type:home?'Home care':'Care home'}]:sql.includes('insert into')?[{id:'saved'}]:[],rowCount:1};}};
const access=load('backend/src/rotaAccess.ts',{'./db/pool.js':{pool}});
const routes={};const router={};for(const method of ['get','post','delete','put','patch']) router[method]=(path,...handlers)=>{routes[method+' '+path]=handlers.at(-1);};
load('backend/src/routes/activity.ts',{
 '../rotaAccess.js':access,express:{Router:()=>router},'../db/pool.js':{pool},
 '../audit.js':{auditActorFromBody:()=>({}),recordAuditEvent:async()=>{}},
 '../auth.js':{requireStaffRole:()=>()=>{},requirePrescriber:()=>()=>{}},
 './organisation.js':{optionalOrganisationIdSchema:z.string().uuid().optional(),requireOrganisationId:()=> 'company'}
});
async function run(path,body){const res={code:200,status(c){this.code=c;return this;},json(body){this.body=body;}};await routes['post '+path]({body},res,e=>{throw e;});return res;}
(async()=>{
 for(const [path,body] of [
 ['/rota-assignments',{id:'a',wardId:'home',staffId:'carer',role:'General observations',startsAt:'2026-10-13T08:00:00Z',endsAt:'2026-10-13T20:00:00Z'}],
 ['/staff-shift-assignments',{id:'b',wardId:'home',staffId:'carer',shiftId:'day',date:'2026-10-13'}]
 ]) {
 home=true;queries=[];assert.equal((await run(path,body)).code,409);assert.equal(queries.some(q=>q.sql.includes('insert into')),false);
 assert.equal(JSON.stringify(queries.find(q=>q.sql.includes('w.service_type')).args),JSON.stringify(['home','company']));
 home=false;assert.equal((await run(path,body)).code,201);
 }
 console.log('PASS: both rota assignment endpoints reject Home Care writes and still accept institutional ward assignments.');
})().catch(e=>{console.error(e);process.exitCode=1;});
