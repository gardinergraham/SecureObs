import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { loadHomeCare } from '../services/api';
import type { HomeCareSnapshot } from '../types/homeCare';
import { ownHomeCareDuties } from '../utils/homeCare';
import { HomeCareDutyCard } from './HomeCareDutyCard';

// Mounted with a user/location key so notes and duty state never carry into another login.
export function HomeCareCheckInPanel({staffId,wardId,siteId,organisationId}:{staffId:string;wardId:string;siteId:string;organisationId:string}) {
  const [snapshot,setSnapshot]=useState<HomeCareSnapshot>();
  const [error,setError]=useState(''), [now,setNow]=useState(Date.now()), [received,setReceived]=useState(0);
  const alive=useRef(true), sequence=useRef(0);
  async function refresh() {
    const request=++sequence.current;
    try {
      const data=await loadHomeCare(organisationId,siteId);
      if(alive.current&&request===sequence.current){setSnapshot(data);setReceived(Date.now());setNow(Date.now());setError('');}
    } catch(e) {if(alive.current&&request===sequence.current)setError((e as Error).message);throw e;}
  }
  useEffect(()=>{alive.current=true;void refresh().catch(()=>{});const timer=setInterval(()=>{setNow(Date.now());void refresh().catch(()=>{});},30000);return()=>{alive.current=false;sequence.current++;clearInterval(timer);};},[organisationId,siteId,wardId,staffId]);
  const serverNow=snapshot?Date.parse(snapshot.serverTime)+Math.max(0,now-received):now;
  const duties=ownHomeCareDuties(snapshot?.duties??[],staffId,wardId,serverNow);
  return <View style={styles.panel}>
    <Text style={styles.title}>My duty at this home</Text>
    <Text>Check in, record a break, add handover notes or complete a wellness check here.</Text>
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {received?<Text>Last updated: {new Date(received).toLocaleTimeString()}{now-received>90000?' — refresh needed':''}</Text>:null}
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>void refresh().catch(()=>{})}><Text style={styles.buttonText}>Refresh my duty</Text></TouchableOpacity>
    {!snapshot&&!error?<Text>Loading your duty…</Text>:null}
    {snapshot&&!duties.length?<Text>No active or upcoming duty is scheduled for you here. Ask your manager to add you to the Home Care schedule.</Text>:null}
    {duties.map(d=><HomeCareDutyCard key={d.id} duty={d} staffId={staffId} organisationId={organisationId} now={serverNow} events={snapshot?.events} onChanged={refresh}/>)}
  </View>;
}
const styles=StyleSheet.create({panel:{gap:12,marginTop:14},title:{fontSize:20,fontWeight:'700',color:'#092d48'},error:{color:'#a12a22'},button:{padding:12,minHeight:48,borderRadius:8,backgroundColor:'#007d89'},buttonText:{color:'#fff',fontWeight:'600'}});
