// Run screen callbacks with synthetic patients; never contacts the API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
let current;
const alerts = [];
let requests = [], failSave = false;
const react = { ...React,
  useState(initial) {
    const instance = current, index = instance.cursor++;
    if (!(index in instance.state)) instance.state[index] = typeof initial === 'function' ? initial() : initial;
    return [instance.state[index], value => {
      instance.state[index] = typeof value === 'function' ? value(instance.state[index]) : value;
      instance.dirty = true;
    }];
  },
  useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
  useMemo(fn) { return fn(); },
  useEffect(fn, deps) {
    const index = current.cursor++;
    if (!current.deps[index] || deps.some((value, i) => value !== current.deps[index][i])) {
      current.deps[index] = deps;
      current.effects.push(fn);
    }
  }
};
const native = { Alert: { alert: (...args) => alerts.push(args) }, StyleSheet: { create: x => x },
  ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'Button', View: 'View' };
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const exports = cache[file] = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true }
  }).outputText, { exports, Date, Error, setTimeout, setInterval: () => 1, clearInterval() {}, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name.endsWith('/SecureDateTimeField')) return { SecureDateTimeField: 'DateTimeField' };
    if (name.endsWith('/services/api')) return { createObservation: async data => {
      requests.push(data);
      if (failSave) throw new Error('Test save failure');
      return { id: 'test-observation', ...data };
    } };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
    return require(name);
  } });
  return exports;
}
const root = path.resolve(__dirname, '..');
const { PatientSettingsScreen } = load(path.join(root, 'src/screens/PatientSettingsScreen.tsx'));
const { EnhancedObservationScreen } = load(path.join(root, 'src/screens/EnhancedObservationScreen.tsx'));
function mount(component, props) {
  const instance = { state: [], deps: [], cursor: 0, effects: [], props };
  return { props, render() {
    let tree;
    do {
      current = instance; instance.cursor = 0; instance.effects = []; instance.dirty = false;
      tree = component(props); instance.effects.forEach(fn => fn());
    } while (instance.dirty);
    return tree;
  } };
}
function nodes(node) {
  if (!React.isValidElement(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}
function text(node) {
  if (!React.isValidElement(node)) return typeof node === 'string' ? node : '';
  return React.Children.toArray(node.props.children).map(text).join('');
}
function button(tree, label) { return nodes(tree).find(n => n.type === 'Button' && text(n) === label); }
function picker(tree, label) { return nodes(tree).find(n => n.type === 'DateTimeField' && n.props.label === label); }
const flush = () => new Promise(resolve => setImmediate(resolve));
const member = { id: 'staff', name: 'Test Nurse', role: 'nurse', wardId: 'ward', allowedWardIds: ['ward'], staffCode: 'TEST' };
const patient = { id: 'patient', firstName: 'Test', surname: 'Patient', roomNumber: 1, wardId: 'ward', observationLevel: 'Intermittent', tesoHistory: [] };
let updated;
function settings(p = patient, save = async value => { updated = value; }) {
  return mount(PatientSettingsScreen, { patients: [p], staff: [member], selectedStaffId: member.id, onUpdatePatient: save });
}
function configureStart(f) {
  nodes(f.render()).find(n => n.props.options?.includes('Eyesight')).props.onSelect('General observation');
  nodes(f.render()).find(n => n.props.options?.includes('Risk to self')).props.onSelect('Risk to self');
}
(async () => {
  const startedAt = new Date(Date.now() - 3 * 3600000).toISOString();
  const endedAt = new Date(Date.now() - 3600000).toISOString();
  let f = settings(); configureStart(f);
  picker(f.render(), 'TESO start date and time').props.onChange(startedAt);
  button(f.render(), 'Start TESO').props.onPress(); await flush();
  assert.equal(updated.enhancedObservation.startedAt, startedAt);
  assert.equal(updated.tesoHistory[0].startedAt, startedAt);
  assert.equal(Date.parse(updated.enhancedObservation.nextReviewAt), Date.parse(startedAt) + 3600000);
  const active = updated;
  console.log('PASS: backdated start persists in plan/history and anchors the first review');

  for (const label of ['End TESO', 'End active TESO']) {
    f = settings(active);
    picker(f.render(), 'TESO end date and time').props.onChange(endedAt);
    button(f.render(), label).props.onPress(); await flush();
    assert.equal(updated.tesoHistory[0].endedAt, endedAt);
    assert.equal(updated.observationLevel, 'Intermittent');
    assert.equal(updated.enhancedObservation, undefined);
  }
  console.log('PASS: both end buttons persist the chosen end timestamp');

  for (const invalid of [new Date(Date.now() + 3600000).toISOString(), new Date(Date.parse(startedAt) - 60000).toISOString()]) {
    updated = null; f = settings(active);
    picker(f.render(), 'TESO end date and time').props.onChange(invalid);
    button(f.render(), 'End TESO').props.onPress(); await flush();
    assert.equal(updated, null); assert.match(alerts.at(-1)[0], /Invalid TESO/);
  }
  f = settings(); configureStart(f);
  const before = Date.now(); button(f.render(), 'Start TESO').props.onPress(); await flush();
  assert.ok(Date.parse(updated.enhancedObservation.startedAt) >= before);
  f = settings(active);
  const beforeEnd = Date.now(); button(f.render(), 'End TESO').props.onPress(); await flush();
  assert.ok(Date.parse(updated.tesoHistory[0].endedAt) >= beforeEnd);
  updated = null; f = settings(); configureStart(f);
  picker(f.render(), 'TESO start date and time').props.onChange(new Date(Date.now() + 3600000).toISOString());
  button(f.render(), 'Start TESO').props.onPress(); await flush();
  assert.equal(updated, null);
  console.log('PASS: future starts/invalid ends blocked; untouched start and end default to save time');

  f = settings(active, async () => { throw new Error('Test update failure'); });
  button(f.render(), 'End TESO').props.onPress(); await flush();
  assert.equal(alerts.at(-1)[0], 'TESO not ended');
  assert.equal(button(f.render(), 'End TESO').props.disabled, false);
  console.log('PASS: failed end reports an error and allows retry');

  const props = { patients: [active], staff: [member], selectedStaffId: member.id,
    observations: [], missedObservations: [], rotaAssignments: [], onObservationSaved() {},
    onMissedObservationSaved(value) { props.missedObservations = [...props.missedObservations, value]; } };
  f = mount(EnhancedObservationScreen, props);
  assert.ok(button(f.render(), 'Save missed TESO reason'));
  assert.equal(button(f.render(), 'Save enhanced entry'), undefined);
  button(f.render(), 'Save missed TESO reason').props.onPress();
  assert.equal(button(f.render(), 'Save missed TESO reason'), undefined);
  assert.ok(button(f.render(), 'Save enhanced entry'));
  button(f.render(), 'Save enhanced entry').props.onPress(); await flush();
  assert.equal(requests.length, 0); assert.equal(alerts.at(-1)[0], 'Choose observation staff');
  console.log('PASS: saved late reason collapses panel; missing observation staff blocks saving with a popup');

  props.selectedStaffId = '';
  button(f.render(), 'Save enhanced entry').props.onPress(); await flush();
  assert.equal(requests.length, 0); assert.equal(alerts.at(-1)[0], 'Choose a staff member');
  props.selectedStaffId = member.id;
  props.patients = [{ ...active, enhancedObservation: { ...active.enhancedObservation, assignedStaffIds: [member.id] } }];
  failSave = true;
  button(f.render(), 'Save enhanced entry').props.onPress(); await flush();
  assert.equal(alerts.at(-1)[0], 'Enhanced observation not saved');
  assert.equal(button(f.render(), 'Save enhanced entry').props.disabled, false);
  failSave = false;
  button(f.render(), 'Save enhanced entry').props.onPress(); await flush();
  assert.equal(alerts.at(-1)[0], 'Enhanced observation saved');
  console.log('PASS: no actor blocks saving; API failure is visible and successful retry works');
  props.observations = [{ ...requests.at(-1), id: "later-observation",
    observedAt: new Date(Date.now() - 90 * 60000).toISOString() }];
  assert.ok(button(f.render(), 'Save missed TESO reason'));
  console.log('PASS: a reason for the previous due time does not hide a newly overdue observation');
})().catch(error => { console.error(error); process.exitCode = 1; });
