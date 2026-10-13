const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{z}=require('zod');
function load(file,stubs={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>stubs[n]??require(n)});return exports;}
const {ukNoteDay,canEditPatientNote}=load('src/utils/patientNoteEditing.ts');
const original={recordedByStaffId:'author',recordedAt:'2026-10-12T23:30:00Z'};
assert.equal(ukNoteDay(original.recordedAt),'13/10/2026');
assert.equal(canEditPatientNote(original,'author',Date.parse('2026-10-13T12:00:00Z')),true);
assert.equal(canEditPatientNote(original,'someone-else',Date.parse('2026-10-13T12:00:00Z')),false);
assert.equal(canEditPatientNote(original,'author',Date.parse('2026-10-13T23:00:00Z')),false);
assert.equal(ukNoteDay('2026-12-12T23:30:00Z'),'12/12/2026');
let note,queries=[],failAudit=false;
const db={release(){},query:async(sql,args)=>{queries.push({sql,args});if(sql.includes('select *, '))return {rows:note?[note]:[]};if(sql.includes('insert into audit_events')&&failAudit)throw Error('audit unavailable');if(sql.startsWith('select id,patient_id'))return {rows:[{id:'note',body:'corrected',version:2}]};return {rows:[]};}};
const routes={},router={};for(const method of ['get','post','delete','put','patch'])router[method]=(path,...handlers)=>{routes[method+' '+path]=handlers.at(-1);};
load('backend/src/routes/activity.ts',{
 express:{Router:()=>router},'../rotaAccess.js':{},'../db/pool.js':{pool:{connect:async()=>db}},
 '../audit.js':{},'../auth.js':{requireStaffRole:()=>()=>{},requirePrescriber:()=>()=>{}},
 './organisation.js':{optionalOrganisationIdSchema:z.string().uuid().optional(),requireOrganisationId:()=> 'company'}
});
const staff={id:'author',staffCode:'A',role:'nurse',allowedWardIds:['ward']};
const base={id:'note',body:'original',version:1,recorded_by_staff_id:'author',ward_id:'ward',editable_today:true};
async function run(member=staff,body={body:'corrected',expectedVersion:1}) {queries=[];const res={code:200,status(c){this.code=c;return this;},json(x){this.body=x;}};await routes['patch /patient-notes/:id']({auth:member?{staff:member}:undefined,params:{id:'note'},body},res,e=>{res.error=e;});return res;}
(async()=>{
 note={...base};assert.equal((await run()).code,200);
 assert.equal(queries.find(q=>q.sql.startsWith('insert into patient_note_revisions')).args[3],'original');
 assert.equal(queries.find(q=>q.sql.startsWith('insert into patient_note_revisions')).args[4],'corrected');
 assert.equal(queries.some(q=>q.sql==='commit'),true);
 for(const member of [{...staff,id:'other'},{...staff,id:'admin',role:'super_admin'},{...staff,allowedWardIds:[]}]){assert.equal((await run(member)).code,403);assert.equal(queries.some(q=>q.sql.startsWith('update patient_notes')),false);}
 note={...base,editable_today:false};assert.equal((await run()).code,403);
 note={...base,version:2};assert.equal((await run()).code,409);
 note=undefined;assert.equal((await run()).code,404);
 assert.equal((await run(null)).code,401);
 note={...base};failAudit=true;assert.ok((await run()).error);assert.equal(queries.some(q=>q.sql==='rollback'),true);assert.equal(queries.some(q=>q.sql==='commit'),false);
 console.log('PASS: UK calendar-day edit rules, author-only and ward access, stale version rejection, retained before/after revision, atomic audit failure rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
