const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const native={StyleSheet:{create:x=>x}};
for(const [name,tag] of Object.entries({View:'div',Text:'span',TouchableOpacity:'button',TextInput:'textarea'}))native[name]=({children,disabled,value})=>React.createElement(tag,{disabled,...(tag==='textarea'?{defaultValue:value}:{})},children);
const exportsObj={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/HomeCareDutyCard.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports:exportsObj,require:n=>n==='react-native'?native:n==='../services/api'?{saveHomeCareEvent:()=>{throw Error('Rendering must not save attendance');}}:require(n)});
const now=Date.parse('2026-10-13T10:00:00Z');
const duty={id:'duty',ward_id:'home',staff_id:'carer',staff_name:'Test Carer',kind:'day',starts_at:'2026-10-13T09:00:00Z',ends_at:'2026-10-13T17:00:00Z',state:'planned',notes:'',checked_in_at:null,checked_out_at:null};
function render(changes={},props={}){return renderToStaticMarkup(React.createElement(exportsObj.HomeCareDutyCard,{duty:{...duty,...changes},staffId:'carer',organisationId:'company',now,onChanged:async()=>{},...props}));}
assert.match(render(),/<button><span>check in<\/span><\/button>/);
assert.doesNotMatch(render({}, {staffId:'other'}),/Handover \/ wellness notes|<span>check in<\/span>/);
assert.match(render({starts_at:'2026-10-13T15:00:00Z'}),/<button disabled=""><span>check in<\/span>/);
assert.match(render({ends_at:'2026-10-13T09:30:00Z'}),/<button disabled=""><span>check in<\/span>/);
assert.match(render({state:'present'}),/<span>check out<\/span>/);
assert.match(render({state:'break'}),/<span>resume<\/span>/);
assert.match(render({state:'present',kind:'wellness'}),/Record wellness check/);
assert.doesNotMatch(render(),/Cancel planned duty/);
assert.match(render({}, {canManage:true,staffId:'manager'}),/Cancel planned duty/);
console.log('PASS: shared duty card exposes only own attendance, observes check-in window, supports breaks/wellness, and reserves cancellation for managers.');
