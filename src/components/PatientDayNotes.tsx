import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PatientNote } from '../types/domain';
import { ukNoteDay } from '../utils/patientNoteEditing';
export function PatientDayNotes({notes,patientId,wardId,day}:{notes:PatientNote[];patientId:string;wardId:string;day:string}) {
 const [open,setOpen]=useState(false),[selected,setSelected]=useState('');
 const daily=notes.filter(n=>n.patientId===patientId&&n.wardId===wardId&&ukNoteDay(n.recordedAt)===day).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));
 const note=daily.find(n=>n.id===selected);
 return <View style={styles.panel}>
   <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(v=>!v)} style={styles.button}><Text style={styles.buttonText}>Patient notes · {day} ({daily.length}) {open?'▲':'▼'}</Text></TouchableOpacity>
   {open?<>{!daily.length?<Text>No patient notes written on this day.</Text>:daily.map(n=><TouchableOpacity accessibilityRole="button" accessibilityState={{selected:n.id===selected}} key={n.id} onPress={()=>setSelected(n.id)} style={styles.choice}><Text>{n.id===selected?'✓ ':''}{new Date(n.recordedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})} · {n.recordedByName}</Text></TouchableOpacity>)}
   {note?<View style={styles.note}><Text style={styles.author}>{note.recordedByName}</Text><Text selectable>{note.body}</Text>{note.editedAt?<Text>Edited {new Date(note.editedAt).toLocaleString('en-GB',{timeZone:'Europe/London'})}</Text>:null}</View>:null}
   </>:null}
 </View>;
}
const styles=StyleSheet.create({panel:{gap:8,marginVertical:12},button:{backgroundColor:'#e2f0f3',padding:14,borderRadius:8,borderWidth:1,borderColor:'#007d89',minHeight:48},buttonText:{fontWeight:'700',color:'#174f61'},choice:{padding:12,borderBottomWidth:1,borderColor:'#cfdee5'},note:{padding:12,backgroundColor:'#f5f9fa',gap:8},author:{fontWeight:'700'}});
