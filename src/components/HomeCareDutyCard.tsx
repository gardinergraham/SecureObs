import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { HomeCareDuty, HomeCareEvent } from '../types/homeCare';
import { saveHomeCareEvent } from '../services/api';

const label = (value:string) => value.replace(/_/g,' ');
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);});
export function HomeCareDutyCard({ duty, staffId, organisationId, canManage=false, now, events=[], onChanged }: {
  duty:HomeCareDuty; staffId:string; organisationId:string; canManage?:boolean; now:number;
  events?:HomeCareEvent[]; onChanged:()=>Promise<unknown>;
}) {
  const [notes,setNotes]=useState(''), [outcome,setOutcome]=useState('');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [needsRefresh,setNeedsRefresh]=useState(false);
  const lock=useRef(false), pending=useRef<{payload:string;id:string} | undefined>(undefined);
  const own=duty.staff_id===staffId;
  const active=['planned','present','break'].includes(duty.state);
  async function refresh() {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {await onChanged();setNeedsRefresh(false);} catch(e) {setError((e as Error).message);} finally {lock.current=false;setBusy(false);}
  }
  async function record(action:string) {
    if(lock.current||needsRefresh)return;
    if(['check_out','handover','wellness'].includes(action)&&!notes.trim()){setError('Enter handover or wellness notes before saving.');return;}
    const data={action,notes:notes.trim(),...(action==='wellness'?{wellnessOutcome:outcome}:{})};
    const payload=JSON.stringify(data);
    if(pending.current?.payload!==payload)pending.current={payload,id:uuid()};
    lock.current=true;setBusy(true);setError('');
    try {
      await saveHomeCareEvent(duty.id,{id:pending.current.id,...data},organisationId);
      pending.current=undefined;setNotes('');setNeedsRefresh(true);
      try {await onChanged();setNeedsRefresh(false);} catch {setError('Saved successfully, but the latest duty status could not be loaded. Refresh before another action.');}
    } catch(e) {setError((e as Error).message);} finally {lock.current=false;setBusy(false);}
  }
  const button=(title:string,action:()=>void,disabled=false)=><TouchableOpacity accessibilityRole="button" accessibilityState={{disabled:busy||needsRefresh||disabled}} disabled={busy||needsRefresh||disabled} onPress={action} style={[styles.button,(busy||needsRefresh||disabled)&&styles.disabled]}><Text style={styles.buttonText}>{title}</Text></TouchableOpacity>;
  return <View style={styles.card}>
    <Text style={styles.title}>{duty.staff_name} · {label(duty.kind)}</Text>
    <Text>{new Date(duty.starts_at).toLocaleString()} → {new Date(duty.ends_at).toLocaleString()}</Text>
    <Text>Status: {label(duty.state)}{duty.checked_in_at?` · arrived ${new Date(duty.checked_in_at).toLocaleString()}`:''}{duty.checked_out_at?` · left ${new Date(duty.checked_out_at).toLocaleString()}`:''}</Text>
    {duty.notes?<Text>{duty.notes}</Text>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {needsRefresh?<TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={()=>void refresh()}><Text style={styles.buttonText}>Refresh duty status</Text></TouchableOpacity>:null}
    {own&&active?<>
      {duty.state==='planned'?<Text>Check in from 30 minutes before the start until the duty ends. Signing into the app does not check you into a duty.</Text>:null}
      <Text style={styles.label}>Handover / wellness notes</Text>
      <TextInput accessibilityLabel="Handover / wellness notes" multiline editable={!busy&&!needsRefresh} value={notes} onChangeText={setNotes} style={styles.input}/>
      <View style={styles.row}>{(duty.state==='planned'?['check_in']:duty.state==='present'?['break','check_out','handover']:['resume','check_out','handover']).map(action=><React.Fragment key={action}>{button(label(action),()=>void record(action),action==='check_in'&&(now<Date.parse(duty.starts_at)-30*60*1000||now>=Date.parse(duty.ends_at)))}</React.Fragment>)}</View>
      {duty.kind==='wellness'&&duty.state!=='planned'?<>
        <View style={styles.row}>{['well','concern','no_answer'].map(value=><React.Fragment key={value}>{button(`${outcome===value?'✓ ':''}${label(value)}`,()=>setOutcome(value))}</React.Fragment>)}</View>
        <Text>Follow your organisation’s escalation procedure for concerns or no answer. Recording a check does not send an alert.</Text>
        {button('Record wellness check',()=>void record('wellness'),!outcome)}
      </>:null}
    </>:null}
    {canManage&&duty.state==='planned'?button('Cancel planned duty',()=>void record('cancel')):null}
    {events.filter(e=>e.duty_id===duty.id).map(e=><View key={e.id} style={styles.event}><Text>{new Date(e.recorded_at).toLocaleString()} · {e.actor_name} · {label(e.action)} {e.wellness_outcome?`· ${label(e.wellness_outcome)}`:''}</Text><Text>{e.notes}</Text></View>)}
  </View>;
}
const styles=StyleSheet.create({card:{backgroundColor:'#fff',padding:16,borderRadius:12,borderWidth:1,borderColor:'#cfdee5',gap:10},title:{fontSize:18,fontWeight:'700',color:'#092d48'},label:{fontWeight:'600',color:'#203e50'},input:{borderWidth:1,borderColor:'#91abb9',borderRadius:8,padding:12,minHeight:80,fontSize:16,color:'#142f40'},row:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{padding:14,minHeight:48,backgroundColor:'#007d89',borderRadius:8},buttonText:{color:'#fff',fontWeight:'600'},disabled:{opacity:.45},error:{color:'#a12a22'},event:{borderTopWidth:1,borderColor:'#dce6ed',paddingTop:8}});
