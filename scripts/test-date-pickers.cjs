// Exercise the shared picker props and callbacks without touching live records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const platform = { OS: 'android' };
let state, cursor;
const react = { ...React, useState(initial) {
  const index = cursor++;
  if (!(index in state)) state[index] = initial;
  return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
} };
function load(file, stubs = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true }
  }).outputText, { exports, require: name => name in stubs ? stubs[name] : require(name) });
  return exports;
}
const { SecureDateTimeField } = load('src/components/SecureDateTimeField.tsx', {
  react, 'react-native': { Platform: platform, StyleSheet: {create: x => x}, Text: 'Text', View: 'View', TouchableOpacity:'Button' },
  '@react-native-community/datetimepicker': { __esModule: true, default: 'NativePicker' }
});
const { calculateAge } = load('src/utils/patientDemographics.ts');
function find(node, type) {
  if (!node) return;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const result = typeof child === 'object' ? find(child, type) : undefined;
    if (result) return result;
  }
}
function fixture(os, props) {
  platform.OS = os; state = [true];
  const changes = [];
  const render = () => { cursor = 0; return SecureDateTimeField({label:'Date', mode:'date', value:'', onChange: value => changes.push(value), ...props}); };
  return { render, changes };
}
const today = new Date(2026,8,7,15,30);
for (const year of [1900,1935,1948,1969,1970,2000]) {
  const f = fixture('android', {maximumDate: today});
  const picker = find(f.render(), 'NativePicker');
  const selected = new Date(year,0,1,12);
  // Mirrors the installed Android listener's bound clamp, which used epoch 0
  // when maximumDate was present but minimumDate was omitted.
  const minimum = picker.props.minimumDate?.getTime() ?? 0;
  assert.equal(Math.max(selected.getTime(),minimum),selected.getTime());
  picker.props.onChange({type:'set'}, selected);
  assert.equal(f.changes[0],`${year}-01-01`);
  assert.equal(calculateAge(f.changes[0],today),2026-year);
}
console.log('PASS: Android DOB selection and patient age validation for 1900, 1935, 1948, 1969, 1970 and 2000');
for (const os of ['android','ios','web']) {
  const earliest = new Date(2026,8,7,0,0);
  const f = fixture(os,{minimumDate:earliest,maximumDate:today});
  const input = find(f.render(),os === 'web' ? 'input' : 'NativePicker');
  if (os === 'web') { assert.equal(input.props.min,'2026-09-07'); assert.equal(input.props.max,'2026-09-07'); }
  else { assert.equal(input.props.minimumDate,earliest); assert.equal(input.props.maximumDate,today); }
}
console.log('PASS: explicit future-date bounds preserved on Android, iOS and web');
for (const dateFormat of ['iso','uk']) {
  const f=fixture('web',{dateFormat,value:dateFormat==='iso'?'1948-02-29':'29/02/1948'});
  const input=find(f.render(),'input');
  assert.equal(input.props.value,'1948-02-29');
  input.props.onChange({target:{value:'1935-06-15'}});
  assert.equal(f.changes[0],dateFormat==='iso'?'1935-06-15':'15/06/1935');
  input.props.onChange({target:{value:'1935-02-29'}});
  assert.equal(f.changes.length,1);
}
console.log('PASS: historical ISO/UK dates round-trip; invalid leap day rejected');
for (const [mode,min,max] of [['datetime','2026-09-07T10:00','2026-09-07T15:30'],['time','10:00','15:30']]) {
  const f=fixture('web',{mode,minimumDate:new Date(2026,8,7,10),maximumDate:today});
  const input=find(f.render(),'input');
  assert.equal(input.props.min,min); assert.equal(input.props.max,max);
}
console.log('PASS: web datetime and time limits use the correct input format');
const f=fixture('android',{mode:'datetime',value:new Date(2026,8,7,10,0).toISOString()});
find(f.render(),'NativePicker').props.onChange({type:'set'},new Date(1948,1,29,12));
const timePicker=find(f.render(),'NativePicker');
assert.equal(timePicker.props.mode,'time');
assert.equal(timePicker.props.value.getFullYear(),1948);
timePicker.props.onChange({type:'set'},new Date(2026,8,7,16,45));
assert.equal(new Date(f.changes[0]).getFullYear(),1948);
assert.equal(new Date(f.changes[0]).getHours(),16);
assert.equal(new Date(f.changes[0]).getMinutes(),45);
const cancelled=fixture('android',{});
find(cancelled.render(),'NativePicker').props.onChange({type:'dismissed'});
assert.equal(cancelled.changes.length,0);
console.log('PASS: Android date/time steps retain the chosen historical date; cancellation makes no change');
