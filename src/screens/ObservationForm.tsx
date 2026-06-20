import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Panel } from "../components/Panel";
import { createObservation } from "../services/api";
import type { Patient, PatientLocation, PatientPresentation, StaffMember } from "../types/domain";

type ObservationFormProps = {
  patient: Patient;
  staff: StaffMember[];
};

export function ObservationForm({ patient, staff }: ObservationFormProps) {
  const [location, setLocation] = useState<PatientLocation>(
    isPatientLocation(patient.latestObservationPlace) ? patient.latestObservationPlace : "Side room"
  );
  const [presentation, setPresentation] = useState<PatientPresentation>("Awake");
  const [comments, setComments] = useState("");

  const observer = staff[0];

  const submitObservation = async () => {
    await createObservation({
      patientId: patient.id,
      observerName: observer?.name ?? "Unknown",
      source: "General observations",
      type: patient.observationLevel,
      location,
      presentation,
      comments,
      observedAt: new Date().toISOString(),
      organisationId: observer?.organisationId
    });

    Alert.alert("Observation saved", "This prototype currently saves through mock/API-ready logic.");
    setComments("");
  };

  return (
    <Panel title={`Record observation: ${patient.firstName} ${patient.surname}`}>
      <Text style={styles.label}>Location</Text>
      <View style={styles.optionGrid}>
        {patientLocations.map((item) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={item}
            onPress={() => setLocation(item)}
            style={[styles.optionButton, location === item ? styles.optionButtonSelected : null]}
          >
            <Text style={[styles.optionText, location === item ? styles.optionTextSelected : null]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Presentation</Text>
      <View style={styles.optionGrid}>
        {patientPresentations.map((item) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={item}
            onPress={() => setPresentation(item)}
            style={[styles.optionButton, presentation === item ? styles.optionButtonSelected : null]}
          >
            <Text style={[styles.optionText, presentation === item ? styles.optionTextSelected : null]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Comments</Text>
      <TextInput
        multiline
        numberOfLines={4}
        style={[styles.input, styles.textArea]}
        value={comments}
        onChangeText={setComments}
      />

      <TouchableOpacity accessibilityRole="button" onPress={submitObservation} style={styles.submit}>
        <Text style={styles.submitText}>Save observation</Text>
      </TouchableOpacity>
    </Panel>
  );
}

const patientLocations: PatientLocation[] = [
  "Side room",
  "Day room",
  "Corridor",
  "Dining room",
  "Bathroom",
  "Laundry",
  "Off ward",
  "LOA"
];

const patientPresentations: PatientPresentation[] = ["Awake", "Asleep"];

function isPatientLocation(value: string): value is PatientLocation {
  return patientLocations.includes(value as PatientLocation);
}

const styles = StyleSheet.create({
  label: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10
  },
  input: {
    backgroundColor: "#f8fafb",
    borderColor: "#c8d3d8",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 10
  },
  textArea: {
    minHeight: 96,
    paddingTop: 10,
    textAlignVertical: "top"
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionButton: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#c8d3d8",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  optionButtonSelected: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  optionText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "700"
  },
  optionTextSelected: {
    color: "#ffffff"
  },
  submit: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48
  },
  submitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700"
  }
});
