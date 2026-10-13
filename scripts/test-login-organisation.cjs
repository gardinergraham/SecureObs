const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), {z} = require('zod');
const source = fs.readFileSync('backend/src/routes/staff.ts','utf8');
const start = source.indexOf('async function resolveLoginOrganisation');
const end = source.indexOf('router.post("/lookup"',start);
let rows=[], queried;
const context = {z, pool:{query:async(sql,params)=>{queried=params;return {rows};}}};
vm.createContext(context);
vm.runInContext(ts.transpileModule(source.slice(start,end)+'\nglobalThis.resolve = resolveLoginOrganisation;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText, context);
async function run(name) { const req={body:{organisationName:name,organisationId:'wrong-org'}};const res={status(c){this.code=c;return this;},json(b){this.body=b;}};let continued=false;await context.resolve(req,res,()=>{continued=true;});return {req,res,continued}; }
(async()=>{
 rows=[{id:'home-org'}];let r=await run('  St Thomas Care  ');assert.equal(r.req.body.organisationId,'home-org');assert.equal(queried[0],'St Thomas Care');assert.equal(r.continued,true);
 for(const matches of [[],[{id:'one'},{id:'two'}]]) {rows=matches;r=await run('St Thomas Care');assert.equal(r.res.code,409);assert.equal(r.continued,false);}
 r=await run(undefined);assert.equal(r.continued,true);
 r=await run({bad:true});assert.equal(r.res.code,400);assert.equal(r.continued,false);
 for(const route of ['lookup','pin-login','bank-pin-login'])assert.ok(source.includes(`router.post("/${route}", resolveLoginOrganisation,`));
 console.log('PASS: exact company resolution, explicit company overrides stale context, unknown/ambiguous company rejected, all three login routes covered.');
})().catch(e=>{console.error(e);process.exitCode=1;});
