const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('App.tsx', 'utf8');
const handler = source.slice(source.indexOf('  const handleReadStaffCardData ='), source.indexOf('  const handleBankStaffPinLogin ='));
async function run(staffMembers) {
  let organisation, selected;
  const context = {
    organisationSettings: {}, staffMembers,
    selectedStaff: { organisationId: 'previous-admin-org' },
    parseStaffCardData: () => ({ staffCode: 'HOME-CARER' }),
    lookupStaffByCode: async (_code, org) => { organisation = org; return { staff: { id: 'carer', organisationId: 'home-org' } }; },
    setStaffMembers: () => {}, selectStaffSession: staff => { selected = staff; },
    flushSyncQueue: async () => {}
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(handler + '\nglobalThis.scan = handleReadStaffCardData;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await context.scan('passcode=HOME-CARER');
  assert.equal(selected.id, 'carer');
  return organisation;
}
(async () => {
  assert.equal(await run([{ staffCode: 'home-carer', organisationId: 'home-org' }]), 'home-org');
  assert.equal(await run([]), undefined);
  assert.equal(await run([{ staffCode: 'HOME-CARER', organisationId: 'one' }, { staffCode: 'HOME-CARER', organisationId: 'two' }]), undefined);
  console.log('PASS: NFC switching from admin uses card organisation; uncached and ambiguous codes do not inherit previous user organisation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
