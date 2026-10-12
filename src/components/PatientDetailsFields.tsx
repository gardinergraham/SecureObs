import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { SecureDateTimeField } from "./SecureDateTimeField";
import { calculateAge, formatDateOfBirth } from "../utils/patientDemographics";

export type PatientDetailsDraft = {
  hospitalNumber:string; firstName:string; surname:string; dateOfBirth:string; roomNumber:string;
  nextOfKinName:string; nextOfKinRelationship:string; nextOfKinTelephone:string; nextOfKinEmail:string;
};
export function PatientDetailsFields({draft,onChange,editable=true,homeCare=false,recordedDateOfBirth}: {
  draft:PatientDetailsDraft; onChange:(field:keyof PatientDetailsDraft,value:string)=>void;
  editable?:boolean; homeCare?:boolean; recordedDateOfBirth?:string;
}) {
 return <View style={styles.fields}>
          <TextInput placeholderTextColor="#6f7f87"
            editable={editable}
            onChangeText={(value) => onChange("hospitalNumber", value)}
            placeholder="Hospital / local patient number"
            style={styles.input}
            value={draft.hospitalNumber}
          />
          <View style={styles.formRow}>
            <TextInput placeholderTextColor="#6f7f87"
              editable={editable}
              onChangeText={(value) => onChange("firstName", value)}
              placeholder="First name"
              style={[styles.input, styles.flexInput]}
              value={draft.firstName}
            />
            <TextInput placeholderTextColor="#6f7f87"
              editable={editable}
              onChangeText={(value) => onChange("surname", value)}
              placeholder="Surname"
              style={[styles.input, styles.flexInput]}
              value={draft.surname}
            />
          </View>
          <View style={styles.demographicPanel}>
            <Text style={styles.label}>Date of birth</Text>
            <View style={styles.formRow}>
              <SecureDateTimeField
                disabled={!editable}
                label="Choose date of birth"
                maximumDate={new Date()}
                mode="date"
                onChange={(value) => onChange("dateOfBirth", value)}
                optional
                style={styles.flexInput}
                value={draft.dateOfBirth}
              />
              <View style={styles.ageBox}>
                <Text style={styles.currentWardLabel}>Age</Text>
                <Text style={styles.currentWardText}>
                  {calculateAge(draft.dateOfBirth) ?? "—"}
                </Text>
              </View>
            </View>
            {recordedDateOfBirth ? (
              <Text style={styles.helperText}>Recorded date: {formatDateOfBirth(recordedDateOfBirth)}</Text>
            ) : null}
          </View>
          <Text style={styles.label}>Room / bedroom number</Text>
          {homeCare ? <Text style={styles.helperText}>Defaults to 1. A home can have several patients; use room numbers to help identify their rooms.</Text> : null}
          <TextInput placeholderTextColor="#6f7f87"
            accessibilityLabel="Room / bedroom number"
            editable={editable}
            keyboardType="number-pad"
            onChangeText={(value) => onChange("roomNumber", value)}
            placeholder="Room number"
            style={styles.input}
            value={draft.roomNumber}
          />

          <View style={styles.demographicPanel}>
            <Text style={styles.label}>Next of kin / primary contact</Text>
            <View style={styles.formRow}>
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={editable}
                onChangeText={(value) => onChange("nextOfKinName", value)}
                placeholder="Contact name"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinName}
              />
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={editable}
                onChangeText={(value) => onChange("nextOfKinRelationship", value)}
                placeholder="Relationship to patient"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinRelationship}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={editable}
                keyboardType="phone-pad"
                onChangeText={(value) => onChange("nextOfKinTelephone", value)}
                placeholder="Telephone"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinTelephone}
              />
              <TextInput
                placeholderTextColor="#6f7f87"
                autoCapitalize="none"
                editable={editable}
                keyboardType="email-address"
                onChangeText={(value) => onChange("nextOfKinEmail", value)}
                placeholder="Email address"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinEmail}
              />
            </View>
            <Text style={styles.helperText}>Optional. Record only authorised contact information.</Text>
          </View>

</View>;
}
const styles=StyleSheet.create({
 fields:{gap:10}, input:{borderWidth:1,borderColor:"#c7d6dd",borderRadius:8,padding:12,fontSize:16,color:"#172d38",backgroundColor:"#fff"},
 formRow:{flexDirection:"row",flexWrap:"wrap",gap:8}, flexInput:{flex:1,minWidth:180},
 demographicPanel:{backgroundColor:"#f5f9fa",borderWidth:1,borderColor:"#d6e2e6",borderRadius:10,padding:12,gap:8},
 label:{fontSize:16,fontWeight:"700",color:"#204d5c"}, ageBox:{minWidth:72,padding:10,backgroundColor:"#e8f1f4",borderRadius:8},
 currentWardLabel:{fontSize:13,color:"#526c78"},currentWardText:{fontSize:18,fontWeight:"700",color:"#123a50"},helperText:{fontSize:14,color:"#526c78"}
});
