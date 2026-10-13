import { HomeCareDutyCard } from "../components/HomeCareDutyCard";
import { SecureDateTimeField } from "../components/SecureDateTimeField";
import { PatientDetailsFields } from "../components/PatientDetailsFields";
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { StaffMember, Site } from '../types/domain';
import type { HomeCareSnapshot, HomeCareProfile, HomeCareDuty } from '../types/homeCare';
import { createHomeCareLocation, loadHomeCare, saveHomeCareDuty, saveHomeCareProfile } from '../services/api';
import { homeCoverage, validateDutyPeriod } from '../utils/homeCare';
const emptyIntake={roomNumber:'1',accessNotes:'',emergencyContact:'',careSummary:'',requiredCarers:'1',continuousCover:true,firstName:'',surname:'',reference:'',dateOfBirth:'',nextOfKinName:'',nextOfKinRelationship:'',nextOfKinTelephone:'',nextOfKinEmail:''};
const kinds: HomeCareDuty['kind'][] = ['day', 'waking_night', 'sleep_in', 'live_in', 'wellness'];
const label = (s: string) => s.replace(/_/g, ' ');
const date = (s: string | number) => new Date(s).toLocaleString();
// RFC4122 identifier for retry-safe writes; it is not an authentication token.
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); }); }
function Field({ label, value, onChange, multi = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    multi?: boolean;
}) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multi} style={[styles.input, multi && { minHeight: 80 }]}/></View>; }
function Button({ title, onPress, disabled = false }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
}) { return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: .45 }]}><Text style={styles.buttonText}>{title}</Text></TouchableOpacity>; }
export function HomeCareScreen({ organisationId, siteId, staff, staffMembers, sites, onViewChanged, onLocationsChanged, onOpenPatients, onBack, onOpenCare }: {
    organisationId: string;
    siteId: string;
    staff: StaffMember;
    staffMembers: StaffMember[];
    sites: Site[];
    onViewChanged: () => void;
    onLocationsChanged: () => Promise<void>;
    onOpenPatients: (wardId:string,siteId:string)=>void;
    onBack: () => void;
    onOpenCare: (wardId: string, siteId: string) => void;
}) {
    const [snapshot, setSnapshot] = useState<HomeCareSnapshot>();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [selected, setSelected] = useState('');
    const [view,setView] = useState<'overview'|'schedule'|'profile'>('overview');
    const changeView = (next:'overview'|'schedule'|'profile') => {setView(next);onViewChanged();};
    const [adding,setAdding]=useState(false);
    const [newSite,setNewSite]=useState('');
    const [newName,setNewName]=useState('');
    const [newAddress,setNewAddress]=useState('');
    const [withPatient,setWithPatient]=useState(true);
    const [intake,setIntake]=useState(emptyIntake);
    const [savedMessage,setSavedMessage]=useState('');
    const [refreshed, setRefreshed] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [address, setAddress] = useState(''), [access, setAccess] = useState(''), [emergency, setEmergency] = useState(''), [summary, setSummary] = useState(''), [required, setRequired] = useState('1'), [continuous, setContinuous] = useState(true);
    const [carer, setCarer] = useState(''), [kind, setKind] = useState<HomeCareDuty['kind']>('day'), [start, setStart] = useState(''), [end, setEnd] = useState(''), [dutyNotes, setDutyNotes] = useState('');
    const pending = useRef<Record<string, {
        id: string;
        payload: string;
    }>>({});
    async function refresh() { const data = await loadHomeCare(organisationId,siteId); setSnapshot(data); setRefreshed(Date.now()); return data; }
    useEffect(() => { let alive = true; const read = async () => { try {
        const data = await loadHomeCare(organisationId,siteId);
        if (alive) {
            setSnapshot(data);
            setRefreshed(Date.now());
        }
    }
    catch (e) {
        if (alive)
            setError((e as Error).message);
    } }; void read(); const t = setInterval(() => { setNow(Date.now()); void read(); }, 30000); return () => { alive = false; clearInterval(t); }; }, [organisationId,siteId]);
    async function action(fn: () => Promise<unknown>) { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        await fn();
        await refresh();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    function retryId(key: string, payload: unknown) { const text = JSON.stringify(payload); if (pending.current[key]?.payload !== text)
        pending.current[key] = { id: uuid(), payload: text }; return pending.current[key].id; }
    function choose(h: HomeCareProfile) { setView('overview'); setSelected(h.id); setAddress(h.address ?? ''); setAccess(h.accessNotes ?? ''); setEmergency(h.emergencyContact ?? ''); setSummary(h.careSummary ?? ''); setRequired(String(h.requiredCarers ?? 1)); setContinuous(h.continuousCover !== false); setCarer(''); setError(''); }
    const managedSites = sites.filter(site => snapshot?.homes.some(h=>h.siteId===site.id&&h.canManage));
    const home = snapshot?.homes.find(h => h.id === selected);
    const serverNow = snapshot ? Date.parse(snapshot.serverTime) + Math.max(0, now - refreshed) : now;

    if(home && view==='profile') return <View style={styles.page}>
      <Button title="← Back to home overview" onPress={()=>changeView('overview')}/>
      <Text style={styles.title}>{home.name} · Home profile</Text>
      {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
      {home.canManage ? <View style={styles.card}><Text style={styles.heading}>Home profile</Text><Field label="Home address" value={address} onChange={setAddress}/><Field label="Access instructions" value={access} onChange={setAccess} multi/><Field label="Emergency contact" value={emergency} onChange={setEmergency}/><Field label="Care needs and risks" value={summary} onChange={setSummary} multi/><Field label="Required carers at a time (1–10)" value={required} onChange={setRequired}/><Button title={continuous ? 'Continuous cover required ✓' : 'Scheduled visits only'} onPress={() => setContinuous(!continuous)}/><Button title="Save home profile" disabled={busy} onPress={() => void action(() => saveHomeCareProfile({ wardId: home.id, address, accessNotes: access, emergencyContact: emergency, careSummary: summary, requiredCarers: Number(required), continuousCover: continuous },organisationId))}/></View> : null}
    </View>;
    if(home && view==='schedule') return <View style={styles.page}>
      <Button title="← Back to home overview" onPress={()=>changeView('overview')}/>
      <Text style={styles.title}>{home.name} · Home Care schedule</Text>
      <Text>Plan cover and record attendance here. This schedule is separate from the ward Rota.</Text>
      {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
      <Button title="Refresh schedule" disabled={busy} onPress={()=>void action(refresh)}/>
      {home.canManage && home.address ? <View style={styles.card}><Text style={styles.heading}>Schedule cover</Text><Text>This is the Home Care schedule, separate from Rota. Schedule each live-in duty period separately (maximum 24 hours); include relief cover.</Text><View style={styles.row}>{staffMembers.filter(s => s.active && s.allowedWardIds.includes(home.id)).map(s => <Button key={s.id} title={(carer === s.id ? '✓ ' : '') + s.name} onPress={() => setCarer(s.id)}/>)}</View><View style={styles.row}>{kinds.map(k => <Button key={k} title={(kind === k ? '✓ ' : '') + label(k)} onPress={() => setKind(k)}/>)}</View><SecureDateTimeField label="Duty start — local date and time" mode="datetime" value={start} disabled={busy} onChange={v=>{setStart(v);if(!end||Date.parse(end)<=Date.parse(v))setEnd(new Date(Date.parse(v)+8*60*60*1000).toISOString());}}/><SecureDateTimeField label="Duty end — local date and time" mode="datetime" value={end} disabled={busy} minimumDate={start?new Date(start):undefined} onChange={setEnd}/><Field label="Duty instructions / planned relief" value={dutyNotes} onChange={setDutyNotes} multi/><Button title="Add duty" disabled={busy || !carer || !start || !end} onPress={() => void action(async () => { validateDutyPeriod(start,end); const data = { wardId: home.id, staffId: carer, kind, startsAt: start, endsAt: end, notes: dutyNotes }; await saveHomeCareDuty({ id: retryId('newDuty', data), ...data },organisationId); delete pending.current.newDuty; setDutyNotes(''); })}/></View> : null}
      {home.canManage&&!home.address?<Text>Set the home address in Home profile before adding cover.</Text>:null}
      <Text style={styles.heading}>Duties · previous 7 days and next 31 days</Text>
      {!snapshot?.duties.some(d=>d.ward_id===home.id)?<Text>No Home Care duties scheduled yet.</Text>:null}
      {snapshot?.duties.filter(d=>d.ward_id===home.id).sort((a,b)=>{const rank=(d:HomeCareDuty)=>['present','break'].includes(d.state)?0:Date.parse(d.ends_at)>serverNow?1:2;return rank(a)-rank(b)||Date.parse(a.starts_at)-Date.parse(b.starts_at);}).map(d=><HomeCareDutyCard key={d.id} duty={d} staffId={staff.id} organisationId={organisationId} canManage={home.canManage} now={serverNow} events={snapshot.events} onChanged={refresh}/>)}
    </View>;
    return <View style={styles.page}><View style={styles.row}><Button title="Back" onPress={onBack}/><Button title="Refresh" disabled={busy} onPress={() => void action(refresh)}/></View><Text style={styles.title}>Home Care</Text><Text style={styles.muted}>Continuous care, live-in duty periods and wellness checks</Text><Text>Last successful update: {refreshed ? date(refreshed) : 'Loading…'}{refreshed && now - refreshed > 90000 ? ' — OUT OF DATE: refresh before relying on cover' : ''}</Text><Text style={styles.muted}>Each location has its own Home Care schedule. Open a home, then choose View / manage schedule. Entries in Rota do not appear here. Planned cover is a booking; carers must check in to confirm arrival.</Text><Text style={styles.muted}>Attendance is a carer’s recorded confirmation, not verified physical presence. Live-in cover must include duty periods, breaks and relief.</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
 {savedMessage?<Text accessibilityRole="alert" style={styles.good}>{savedMessage}</Text>:null}
 {managedSites.length && !home ? <View style={styles.card}>
  <Button title={adding ? "Close new home form" : "Add home location / patient"} disabled={busy} onPress={()=>{setAdding(!adding);setSavedMessage('');if(!newSite)setNewSite(managedSites[0]!.id);}}/>
  {adding ? <>
   <Text style={styles.heading}>Home, patient &amp; care setup</Text>
   <Text>Save the home and patient together, or add just the location. Detailed clinical assessments and care plans can be completed afterwards.</Text>
   <View style={styles.row}>{managedSites.map(site=><Button key={site.id} title={(newSite===site.id?'✓ ':'')+site.name} onPress={()=>setNewSite(site.id)}/>)}</View>
   <Field label="Home location name *" value={newName} onChange={setNewName}/>
   <Field label="Home address *" value={newAddress} onChange={setNewAddress} multi/>
   <Field label="Access instructions" value={intake.accessNotes} onChange={v=>setIntake(d=>({...d,accessNotes:v}))} multi/>
   <View style={styles.row}>
    <Button title={(withPatient?'✓ ':'')+'Add home and patient'} disabled={busy} onPress={()=>setWithPatient(true)}/>
    <Button title={(!withPatient?'✓ ':'')+'Add location only'} disabled={busy} onPress={()=>setWithPatient(false)}/>
   </View>
   {withPatient?<>
    <Text style={styles.heading}>Patient details</Text>
    <PatientDetailsFields draft={{...intake,hospitalNumber:intake.reference}} homeCare editable={!busy} onChange={(field,value)=>setIntake(d=>({...d,[field==='hospitalNumber'?'reference':field]:value}))}/>
   </>:null}
   <Text style={styles.heading}>Care requirements</Text>
   <Field label="Care needed and risks" value={intake.careSummary} onChange={v=>setIntake(d=>({...d,careSummary:v}))} multi/>
   <Field label="Emergency contact" value={intake.emergencyContact} onChange={v=>setIntake(d=>({...d,emergencyContact:v}))}/>
   <Field label="Carers required at a time (1–10)" value={intake.requiredCarers} onChange={v=>setIntake(d=>({...d,requiredCarers:v}))}/>
   <Button title={intake.continuousCover?'Continuous / live-in care ✓':'Scheduled visits / wellness checks'} disabled={busy} onPress={()=>setIntake(d=>({...d,continuousCover:!d.continuousCover}))}/>
   <Button title={withPatient?'Save home and patient':'Save location only'} disabled={busy||!newName.trim()||!newAddress.trim()||!newSite||(withPatient&&(!intake.firstName.trim()||!intake.surname.trim()||!intake.reference.trim()))} onPress={()=>void action(async()=>{
    const data={siteId:newSite,name:newName.trim(),address:newAddress.trim(),accessNotes:intake.accessNotes.trim(),emergencyContact:intake.emergencyContact.trim(),careSummary:intake.careSummary.trim(),requiredCarers:Number(intake.requiredCarers),continuousCover:intake.continuousCover,
     ...(withPatient?{patient:{roomNumber:Number(intake.roomNumber),firstName:intake.firstName.trim(),surname:intake.surname.trim(),reference:intake.reference.trim(),dateOfBirth:intake.dateOfBirth.trim(),nextOfKinName:intake.nextOfKinName.trim(),nextOfKinRelationship:intake.nextOfKinRelationship.trim(),nextOfKinTelephone:intake.nextOfKinTelephone.trim(),nextOfKinEmail:intake.nextOfKinEmail.trim()}}:{})};
    const result=await createHomeCareLocation({id:retryId('newHome',data),...data},organisationId);
    setSavedMessage(result.patientId?'Home, patient and care requirements saved.':'Home and care requirements saved.');
    // Once saved, clear the intake before refreshing: a failed refresh must not encourage duplicate creation.
    delete pending.current.newHome;setAdding(false);setNewName('');setNewAddress('');setIntake(emptyIntake);
    await onLocationsChanged();const dataAfter=await refresh();const created=dataAfter.homes.find(h=>h.id===result.id);if(created)choose(created);
   })}/>
  </>:null}
 </View>:null}
 {!snapshot?.homes.length ? <Text style={styles.card}>No home locations available. A SecureObs administrator can create a location in Admin settings using service type “Home care”, then assign staff and patients using the existing setup.</Text> : null}
 {selected ? <Button title="← All home locations" onPress={()=>setSelected('')}/> : <Text style={styles.heading}>Choose a home to see its patients, carers and duties</Text>}
 <View style={styles.row}>{snapshot?.homes.filter(h=>!selected||h.id===selected).map(h => { const c = homeCoverage(h, snapshot.duties, Date.parse(snapshot.serverTime) + Math.max(0, now - refreshed)); return <TouchableOpacity accessibilityRole="button" accessibilityState={{selected:selected===h.id}} key={h.id} onPress={() => choose(h)} style={[styles.card, styles.tile, selected === h.id && styles.selected]}><Text style={styles.heading}>{h.name}</Text><Text>{h.address || 'Home profile needs setup'}</Text><Text style={c.gap ? styles.error : styles.good}>{h.address ? (h.continuousCover !== false ? `${c.present}/${c.required} carers checked in for current cover` : `${c.present} carers on duty · scheduled visits`) : 'Set address and cover requirements'}</Text>{c.gap && h.address ? <Text style={styles.error}>Check-ins below required cover</Text> : null}{c.plannedGap && h.address ? <Text style={styles.error}>Planned cover gap: {date(c.plannedGap)}</Text> : null}{snapshot.events.some(e => snapshot.duties.some(d => d.id === e.duty_id && d.ward_id === h.id) && ['concern', 'no_answer'].includes(e.wellness_outcome ?? '')) ? <Text style={styles.error}>Wellness concern recorded — review duty notes</Text> : null}<Text>{c.planned} carers scheduled now · {c.late} awaiting check-in · {c.onBreak} on break</Text><Text>{c.missed} duties ended without check-in (past 7 days) · {c.overdue} overdue check-outs</Text><Text>{c.next ? `Next: ${c.next.staff_name} · ${date(c.next.starts_at)}` : 'No upcoming duty scheduled'}</Text>{c.coverEnds ? <Text>Current cover first ends: {date(c.coverEnds)}</Text> : null}<Text>Care tasks: {snapshot.tasks.find(t => t.wardId === h.id)?.outstanding ?? 0} outstanding · {snapshot.tasks.find(t => t.wardId === h.id)?.overdue ?? 0} overdue</Text><Text>{snapshot.patients.filter(p => p.wardId === h.id).map(p => `${p.firstName} ${p.surname}`).join(', ') || 'Open care records to review patients'}</Text></TouchableOpacity>; })}</View>
 {home ? <><View style={styles.card}><Text style={styles.heading}>{home.name}</Text><Button title={home.canManage ? "View / manage schedule" : "View schedule / my duties"} onPress={()=>changeView('schedule')}/>{home.canManage?<Button title="Edit home profile" onPress={()=>changeView('profile')}/>:null}<Button title="Open patient care records & handovers" onPress={() => onOpenCare(home.id, home.siteId)}/>{home.canManage?<Button title="Add another patient / manage patients" disabled={busy} onPress={()=>onOpenPatients(home.id,home.siteId)}/>:null}<Text style={styles.heading}>Current staffing</Text>
 {(() => { const c=homeCoverage(home,snapshot?.duties??[],Date.parse(snapshot!.serverTime)+Math.max(0,now-refreshed)); return <>
 <Text>Checked in: {c.presentStaff.map(d=>d.staff_name).join(', ') || 'None'}</Text>
 <Text>Awaiting check-in: {c.awaitingStaff.map(d=>d.staff_name).join(', ') || 'None'}</Text>
 <Text>On break: {c.breakStaff.map(d=>d.staff_name).join(', ') || 'None'}</Text>
 <Text style={styles.muted}>Awaiting check-in means a scheduled duty has started but the assigned carer has not checked in. Signing into the app does not check in to a duty.</Text>
 </>; })()}
 <Text style={styles.heading}>Patients at this home</Text>
 {snapshot?.patients.filter(p=>p.wardId===home.id).map(p=><Text key={p.id}>{p.firstName} {p.surname}</Text>)}
 <Text>{home.careSummary || 'No care summary recorded'}</Text><Text>Emergency contact: {home.emergencyContact || 'Not recorded'}</Text><Text>Access instructions: {home.accessNotes || 'Not recorded'}</Text></View>

</> : null}</View>;
}
const styles = StyleSheet.create({ page: { gap: 14, padding: 16 }, title: { fontSize: 30, fontWeight: '700', color: '#092d48' }, heading: { fontSize: 19, fontWeight: '700', color: '#092d48', marginBottom: 10 }, muted: { color: '#4f6571', fontSize: 15 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, card: { backgroundColor: '#fff', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#cfdee5', gap: 10 }, tile: { minWidth: 260, maxWidth: 430, flexGrow: 1 }, selected: { borderColor: '#007d89', borderWidth: 2 }, field: { gap: 6, marginVertical: 8 }, label: { fontWeight: '600', color: '#203e50' }, input: { borderWidth: 1, borderColor: '#91abb9', borderRadius: 8, padding: 12, minHeight: 48, fontSize: 16, color: '#142f40' }, button: { padding: 14, minHeight: 48, backgroundColor: '#007d89', borderRadius: 8, marginVertical: 4 }, buttonText: { color: 'white', fontWeight: '600' }, error: { color: '#a12a22', fontWeight: '600' }, good: { color: '#176144', fontWeight: '600' }, event: { borderTopWidth: 1, borderColor: '#dce6ed', paddingTop: 10 } });
