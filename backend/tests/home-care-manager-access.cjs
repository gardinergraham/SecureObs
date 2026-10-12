const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file,stubs={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>stubs[n]??require(n)});
 return exports;
}
const backend=load('backend/src/homeCareAccess.ts');
const frontend=load('src/utils/staffRole.ts');
const staff={id:'manager',organisationId:'company-a',role:'nurse',wardId:'a',allowedWardIds:['a','hospital'],allowedSiteIds:['site-a'],wardRoles:{a:'manager',hospital:'nurse'}};
const homes=[{id:'a',siteId:'site-a'},{id:'b',siteId:'site-a'},{id:'c',siteId:'site-a'},{id:'other',siteId:'site-b'}];
const wards=[...homes.map(h=>({...h,serviceType:'Home care'})),{id:'hospital',siteId:'site-a',serviceType:'Hospital'}];
for(const effective of [backend.homeCareManagerAccess(staff,homes),frontend.homeCareManagerAccess(staff,wards)]) {
 assert.equal(effective.allowedWardIds.includes('b'),true);
 assert.equal(effective.allowedWardIds.includes('c'),true);
 assert.equal(effective.allowedWardIds.includes('other'),false);
 assert.equal(effective.wardRoles.b,'manager');
 assert.equal(effective.wardRoles.hospital,'nurse');
}
assert.equal(staff.allowedWardIds.length,2,'explicit assignments unchanged');
const signedInWithoutWard=frontend.staffForWard(frontend.homeCareManagerAccess(staff,wards),'');
assert.equal(signedInWithoutWard.role,'nurse');
assert.equal(frontend.canOpenHomeCareDashboard(signedInWithoutWard,'site-a',wards),true,'dashboard eligibility does not depend on selecting a ward');
assert.equal(frontend.canOpenHomeCareDashboard(signedInWithoutWard,'site-b',wards),false);
assert.equal(frontend.canOpenHomeCareDashboard({...signedInWithoutWard,loginPinMustChange:true},'site-a',wards),false);
assert.equal(frontend.canOpenHomeCareDashboard({...staff,role:'hcf',wardRoles:{a:'hcf'}},'site-a',wards),false);

const effective=backend.homeCareManagerAccess(staff,homes);
assert.equal(backend.explicitStaff({...effective,name:'Changed'}).allowedWardIds.length,2,'spread/save cannot persist derived grants');
assert.equal(backend.explicitStaff({...effective,name:'Changed'}).name,'Changed');
const demoted={...staff,wardRoles:{a:'hcf',hospital:'nurse'}};
assert.equal(backend.homeCareManagerAccess(demoted,homes).allowedWardIds.includes('b'),false,'demotion removes site-wide rights');
assert.equal(frontend.homeCareManagerAccess(demoted,wards).allowedWardIds.includes('b'),false);
const newHomes=[...homes,{id:'new',siteId:'site-a'}];
assert.equal(backend.homeCareManagerAccess(staff,newHomes).allowedWardIds.includes('new'),true);
const carer={...staff,role:'hcf',allowedWardIds:['a','c'],wardRoles:{a:'hcf',c:'hcf'}};
assert.equal(backend.homeCareManagerAccess(carer,homes).allowedWardIds.includes('b'),false);
let queries=[];
const repository=load('backend/src/data/postgres/staffRepository.ts',{
 '../../homeCareAccess.js':backend,
 '../types.js':{DuplicateStaffCodeError:Error,StaffLookupAmbiguousError:Error},
 '../../db/pool.js':{pool:{query:async(sql,args)=>{queries.push({sql,args});return {rows:sql.includes('from wards w')?homes:[staff]};}}}
}).postgresStaffRepository;
(async()=>{
 const signedIn=await repository.findActiveById('manager','company-a');
 assert.equal(signedIn.allowedWardIds.includes('c'),true);
 assert.equal(queries[1].args[0],'company-a','database expansion scoped to company');
 assert.ok(queries[1].sql.includes('s.organisation_id=$1'));
 assert.equal((await repository.list('company-a'))[0].allowedWardIds.length,2,'editor receives explicit assignments');
 queries=[];
 await repository.upsert({...signedIn,name:'Updated'});
 assert.equal(queries[0].args[15].length,2,'upsert keeps only explicit assignments');
 console.log('PASS: Home Care site-wide manager access, future homes, carer subsets, hospital isolation, demotion, company-scoped lookup, and non-persistent derived rights.');
})().catch(e=>{console.error(e);process.exitCode=1;});
