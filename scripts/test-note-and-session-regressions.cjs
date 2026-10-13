const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, stubs) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  }).outputText, { exports, Buffer, require: name => name in stubs ? stubs[name] : require(name) });
  return exports;
}
(async () => {
  let unblock;
  const storage = { setItem: async () => {}, getItem: async () => null, removeItem: async () => {} };
  const sessions = load('src/services/authSession.ts', { '@react-native-async-storage/async-storage': storage });
  const session = token => ({ token, expiresAt: '2099-01-01T00:00:00Z' });
  let notifications = 0;
  sessions.subscribeToAuthSessionExpiry(() => notifications++);
  await sessions.storeAuthSession(session('old'));
  storage.removeItem = () => new Promise(resolve => { unblock = resolve; storage.removeItem = async () => {}; });
  const expiring = sessions.expireAuthSession('old');
  await Promise.resolve();
  const signingIn = sessions.storeAuthSession(session('new'));
  unblock();
  assert.equal(await expiring, false);
  await signingIn;
  assert.equal(notifications, 0);
  assert.equal((await sessions.getAuthSession()).token, 'new');
  assert.equal(await sessions.expireAuthSession('old'), false);
  assert.equal(await sessions.expireAuthSession('new'), true);
  assert.equal(notifications, 1);

  let fail = false;
  let staff = { id: 'staff', organisationId: 'org', role: 'nurse', allowedWardIds: ['home'], allowedSiteIds: ['site'] };
  const auth = load('backend/src/auth.ts', {
    './audit.js': {}, './db/pool.js': {}, './wardAccess.js': {},
    './config.js': { config: { sessionTtlMinutes: 60, sessionSecret: 'local-regression-test-secret' } },
    './data/provider.js': { dataProvider: { staff: { findActiveById: async () => { if (fail) throw Error('database unavailable'); return staff; } } } }
  });
  const token = auth.createStaffSession(staff).token;
  const request = () => ({ header: () => `Bearer ${token}` });
  let error;
  let req = request();
  await auth.authenticateRequest(req, {}, e => { error = e; });
  assert.equal(req.auth.staff.id, 'staff');
  fail = true; req = request();
  await auth.authenticateRequest(req, {}, e => { error = e; });
  assert.equal(error.message, 'database unavailable');
  fail = false; staff = null; req = request();
  await auth.authenticateRequest(req, {}, e => { error = e; });
  assert.equal(error, undefined);
  assert.equal(req.auth, undefined);
  req = { header: () => 'Bearer invalid' };
  await auth.authenticateRequest(req, {}, e => { error = e; });
  assert.equal(error, undefined);
  assert.equal(req.auth, undefined);

  // Execute the real App handler with a superadmin operating in a customer organisation.
  const app = fs.readFileSync('App.tsx', 'utf8');
  const handler = app.slice(app.indexOf('  const handleCreatePatientNote ='), app.indexOf('  const handleCreatePatientCarePlan ='));
  let sent;
  const context = { selectedStaff: { id: 'admin', organisationId: 'admin-org', staffCode: 'ADMIN' },
    activePatientOrganisationId: () => 'patient-org', persistPatientNote: async value => { sent = value; return value; },
    persistOrQueue: async (_label, run) => run(), setPatientNotes: () => {}, upsertById: () => {} };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(handler + '\nglobalThis.saveNote = handleCreatePatientNote;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await context.saveNote({ id: 'note', patientId: 'patient', wardId: 'ward', body: 'Test note' });
  assert.equal(sent.organisationId, 'patient-org');
  assert.equal(sent.actorStaffId, 'admin');
  assert.equal(sent.wardId, 'ward');
  console.log('PASS: customer note context, session expiry/sign-in race, genuine invalid sessions, and database failure preserves authentication.');
})().catch(error => { console.error(error); process.exitCode = 1; });
