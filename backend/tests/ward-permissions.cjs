const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, stubs = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  }).outputText, { exports, require: name => name in stubs ? stubs[name] : require(name), Buffer });
  return exports;
}
const { roleInWard } = load('../src/wardAccess.ts');
const { staffForWard } = load('../../src/utils/staffRole.ts');
let resourceWard = 'ward-b';
const auth = load('../src/auth.ts', {
  './wardAccess.js': { roleInWard }, './audit.js': { recordAuditEvent: async () => {} },
  './config.js': { config: {} }, './data/provider.js': {},
  './db/pool.js': { pool: { query: async () => ({rows: [{ward_id: resourceWard}]}) } }
});
const sally = { id: 'sally', organisationId: 'company', name: 'Sally Jones', staffCode:'SALLY',
  role:'manager', canPrescribe: false, wardId:'ward-a', allowedWardIds:['ward-a','ward-b'],
  wardRoles:{'ward-a':'manager','ward-b':'nurse'} };
async function check(name, middleware, request, expected, staff = sally) {
  let status = 200, continued = false;
  const req = {auth:{staff}, method:'POST', baseUrl:'/api/config', path:'/wards', params:{}, query:{},
    header: () => 'ward-a', body:{id:'ward-b'}, ...request};
  await middleware(req, {status(code) {status = code; return this;}, json() {}}, error => {
    if (error) throw error; continued = true;
  });
  assert.equal(status, expected, name);
  assert.equal(continued, expected === 200, name);
  console.log(`PASS: ${name}`);
}
(async () => {
  assert.equal(staffForWard(sally,'ward-a').role,'manager');
  assert.equal(staffForWard(sally,'ward-b').role,'nurse');
  assert.equal(sally.role,'manager');
  assert.equal(roleInWard(sally,'foreign-ward'),undefined);
  assert.equal(roleInWard({...sally,wardRoles:undefined},'ward-a'),'manager');
  console.log('PASS: UI roles switch by ward, raw identity stays unchanged, legacy roles preserved');
  await check('manager can manage ward A',auth.requireStaffRole(['manager']),{body:{id:'ward-a'}},200);
  await check('manager on A cannot manage B using A header',auth.requireStaffRole(['manager']),{},403);
  await check('no selected ward does not grant global manager access',auth.requireStaffRole(['manager']),{baseUrl:'/api/staff',path:'/reset-pin',body:{},header:()=>undefined},403);
  await check('patient resource determines role despite spoofed ward header',auth.requireStaffRole(['manager']),{baseUrl:'/api/patients',path:'/patient/archive',params:{id:'patient'},body:{}},403);
  await check('nurse can perform nurse workflow in B',auth.requireStaffRole(['nurse']),{baseUrl:'/api',path:'/news2-readings',body:{patientId:'patient'}},200);
  await check('nurse without prescribing permission denied',auth.requirePrescriber(),{baseUrl:'/api',path:'/medication-prescriptions',body:{patientId:'patient'}},403);
  await check('authorised nurse prescriber accepted',auth.requirePrescriber(),{baseUrl:'/api',path:'/medication-prescriptions',body:{patientId:'patient'}},200,{...sally,canPrescribe:true});
  resourceWard='foreign-ward';
  await check('prescriber cannot prescribe on inaccessible ward',auth.requirePrescriber(),{baseUrl:'/api',path:'/medication-prescriptions',body:{patientId:'patient'}},403,{...sally,canPrescribe:true});
})().catch(error => {console.error(error); process.exitCode=1;});
