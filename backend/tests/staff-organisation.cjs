// Route regression checks with isolated storage; no live records are touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
function load(relative, stubs = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, relative), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  }).outputText, { exports, require: name => name in stubs ? stubs[name] : require(name), Buffer, console });
  return exports;
}
const wardAccess = load('../src/wardAccess.ts');
const org = '11111111-1111-4111-8111-111111111111';
const otherOrg = '22222222-2222-4222-8222-222222222222';
let handler, results, saved, companyStaff = [];
const router = { get() {}, post(route, ...handlers) { if (route === '/') handler = handlers.at(-1); } };
load('../src/routes/staff.ts', {
  express: { Router: () => router }, zod: { z },
  '../wardAccess.js': wardAccess,
  '../audit.js': { recordAuditEvent: async () => {}, auditActorFromBody: () => ({}) },
  '../auth.js': { requireStaffRole: () => () => {} },
  '../data/provider.js': { dataProvider: { staff: {
    list: async () => companyStaff,
    upsert: async staff => { saved = staff; return staff; }
  } } },
  '../data/types.js': { DuplicateStaffCodeError: class extends Error {}, StaffLookupAmbiguousError: class extends Error {} },
  '../db/pool.js': { pool: { query: async () => ({ rows: results.shift() }) } },
  './organisation.js': { optionalOrganisationIdSchema: z.string().uuid().optional(), requireOrganisationId: () => org }
});
const manager = { organisationId: org, role: 'manager', allowedWardIds: ['ward-a'], wardRoles: { 'ward-a': 'manager' } };
const sally = { id: 'sally', organisationId: org, role: 'manager', staffCode: 'SALLY', name: 'Sally Jones',
  allowedWardIds: ['ward-a'], allowedSiteIds: ['site-a'], wardId: 'ward-a', wardRoles: { 'ward-a': 'manager' }, canPrescribe: false };
async function check(name, rows, expected, body = {}, actor = manager, wardId = 'ward-a') {
  results = rows; saved = undefined;
  let status = 200;
  const response = { status(code) { status = code; return this; }, json() {} };
  await handler({ body: {
    id: 'existing-staff', organisationId: org, staffCode: 'N001', name: 'Test Nurse', role: 'nurse',
    wardId: 'ward-a', allowedWardIds: ['ward-a'], allowedSiteIds: ['site-a'], ...body
  }, auth: { staff: actor, wardId } }, response, error => { throw error; });
  assert.equal(status, expected, name);
  assert.equal(Boolean(saved), expected === 201, `${name}: persistence`);
  console.log(`PASS: ${name}`);
}
(async () => {
  await check('same company assignment accepted', [[{id:'ward-a'}], [{id:'site-a'}], [{organisation_id:org}]], 201);
  await check('foreign or missing ward rejected', [[], [{id:'site-a'}], [{organisation_id:org}]], 403);
  await check('foreign or missing site rejected', [[{id:'ward-a'}], [], [{organisation_id:org}]], 403);
  await check('foreign staff record rejected', [[{id:'ward-a'}], [{id:'site-a'}], [{organisation_id:otherOrg}]], 403);
  companyStaff = [sally];
  const assignment = { ...sally, allowedWardIds: ['ward-a', 'ward-b'], wardRoles: { 'ward-a': 'manager', 'ward-b': 'nurse' }, canPrescribe: true };
  const ownRows = () => [[{id:'ward-a'}, {id:'ward-b'}], [{id:'site-a'}], [{organisation_id:org}]];
  await check('assign Sally as nurse on B and prescriber without demoting A', ownRows(), 201, assignment, { ...manager, allowedWardIds: ['ward-b'], wardRoles: { 'ward-b': 'manager' } }, 'ward-b');
  assert.equal(saved.role, 'manager');
  assert.equal(saved.wardRoles['ward-a'], 'manager');
  assert.equal(saved.wardRoles['ward-b'], 'nurse');
  assert.equal(saved.canPrescribe, true);
  await check('manager of A cannot assign roles on B', ownRows(), 403, assignment);
  companyStaff = [assignment];
  await check('nurse on B cannot promote herself on B', ownRows(), 403, { ...assignment, wardRoles: { 'ward-a':'manager', 'ward-b':'manager' } }, assignment, 'ward-b');
  await check('manager of B cannot demote manager of A', ownRows(), 403, { ...assignment, wardRoles: { 'ward-a':'nurse', 'ward-b':'nurse' } }, { ...manager, allowedWardIds:['ward-b'], wardRoles:{'ward-b':'manager'} }, 'ward-b');
})().catch(error => { console.error(error); process.exitCode = 1; });
