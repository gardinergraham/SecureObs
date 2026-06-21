import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { ObservationLevel, Patient, StaffMember, Ward } from "../types/domain";

const observationLevels: ObservationLevel[] = ["Intermittent", "Eyesight", "Within arms length"];

type PatientDraft = {
  hospitalNumber: string;
  firstName: string;
  surname: string;
  roomNumber: string;
  observationLevel: ObservationLevel;
};

type PatientManagementScreenProps = {
  patients: Patient[];
  selectedStaffId: string;
  selectedWardId: string;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onSavePatient: (patient: Patient) => Promise<void>;
};

export function PatientManagementScreen({
  patients,
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onBack,
  onSavePatient
}: PatientManagementScreenProps) {
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const canManagePatients = selectedStaff?.role === "manager" || selectedStaff?.staffCode === "GardinerG";
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [draft, setDraft] = useState<PatientDraft>(() => createDraft());
  const [targetWardId, setTargetWardId] = useState(selectedWardId);
  const [isSaving, setIsSaving] = useState(false);
  const activePatients = useMemo(
    () => patients.filter((patient) => !patient.archived).sort((a, b) => a.roomNumber - b.roomNumber),
    [patients]
  );
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);

  const selectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setTargetWardId(patient.wardId);
    setDraft({
      hospitalNumber: patient.hospitalNumber,
      firstName: patient.firstName,
      surname: patient.surname,
      roomNumber: String(patient.roomNumber),
      observationLevel: patient.observationLevel
    });
  };

  const clearDraft = () => {
    setSelectedPatientId("");
    setTargetWardId(selectedWardId);
    setDraft(createDraft());
  };

  const savePatient = async () => {
    if (!canManagePatients) {
      return;
    }

    const roomNumber = Number.parseInt(draft.roomNumber, 10);
    if (!draft.hospitalNumber.trim() || !draft.firstName.trim() || !draft.surname.trim() || Number.isNaN(roomNumber)) {
      Alert.alert("Patient details needed", "Enter patient number, name and room number before saving.");
      return;
    }

    const now = new Date().toISOString();
    const patient: Patient = {
      id: selectedPatient?.id ?? createPatientId(draft.hospitalNumber, draft.firstName, draft.surname),
      patientNumber: selectedPatient?.patientNumber ?? Date.now() % 100000,
      hospitalNumber: draft.hospitalNumber.trim(),
      firstName: draft.firstName.trim(),
      surname: draft.surname.trim(),
      wardId: targetWardId || selectedWardId,
      roomNumber,
      observationLevel: draft.observationLevel,
      latestObservationPlace: selectedPatient?.latestObservationPlace ?? "Side room",
      latestObservationTime: selectedPatient?.latestObservationTime ?? now,
      latestObservedBy: selectedPatient?.latestObservedBy ?? "",
      latestPresentation: selectedPatient?.latestPresentation ?? "Awake",
      onOffWard: selectedPatient?.onOffWard ?? "On ward",
      seclusion: selectedPatient?.seclusion ?? false,
      longTermSeclusion: selectedPatient?.longTermSeclusion ?? false,
      archived: selectedPatient?.archived ?? false,
      enhancedObservation: selectedPatient?.enhancedObservation,
      tesoHistory: selectedPatient?.tesoHistory
    };

    setIsSaving(true);
    try {
      await onSavePatient(patient);
      clearDraft();
      Alert.alert("Patient saved", `${patient.firstName} ${patient.surname} is ready on the ward.`);
    } finally {
      setIsSaving(false);
    }
  };

  const archivePatient = async () => {
    if (!selectedPatient || !canManagePatients) {
      return;
    }

    setIsSaving(true);
    try {
      await onSavePatient({ ...selectedPatient, archived: true });
      clearDraft();
      Alert.alert("Patient archived", `${selectedPatient.firstName} ${selectedPatient.surname} has been archived.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient management</Text>
          <Text style={styles.meta}>
            {selectedWard?.name ?? "Ward"} | {canManagePatients ? "Manager access" : "Manager locked"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.patientList}>
          <View style={styles.listHeader}>
            <Text style={styles.panelTitle}>Active patients</Text>
            <TouchableOpacity accessibilityRole="button" onPress={clearDraft} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>New</Text>
            </TouchableOpacity>
          </View>
          {activePatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => selectPatient(patient)}
              style={[styles.patientRow, patient.id === selectedPatientId && styles.patientRowActive]}
            >
              <Text style={styles.patientName}>
                Room {patient.roomNumber} | {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber} | {patient.observationLevel}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.editor}>
          <Text style={styles.panelTitle}>{selectedPatient ? "Edit patient" : "Add patient"}</Text>
          <TextInput
            editable={canManagePatients}
            onChangeText={(hospitalNumber) => setDraft((current) => ({ ...current, hospitalNumber }))}
            placeholder="Hospital / local patient number"
            style={styles.input}
            value={draft.hospitalNumber}
          />
          <View style={styles.formRow}>
            <TextInput
              editable={canManagePatients}
              onChangeText={(firstName) => setDraft((current) => ({ ...current, firstName }))}
              placeholder="First name"
              style={[styles.input, styles.flexInput]}
              value={draft.firstName}
            />
            <TextInput
              editable={canManagePatients}
              onChangeText={(surname) => setDraft((current) => ({ ...current, surname }))}
              placeholder="Surname"
              style={[styles.input, styles.flexInput]}
              value={draft.surname}
            />
          </View>
          <TextInput
            editable={canManagePatients}
            keyboardType="number-pad"
            onChangeText={(roomNumber) => setDraft((current) => ({ ...current, roomNumber }))}
            placeholder="Room number"
            style={styles.input}
            value={draft.roomNumber}
          />

          <Text style={styles.label}>Ward</Text>
          <View style={styles.optionRow}>
            {wards.map((ward) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canManagePatients}
                key={ward.id}
                onPress={() => setTargetWardId(ward.id)}
                style={[styles.optionButton, targetWardId === ward.id && styles.optionButtonActive]}
              >
                <Text style={[styles.optionText, targetWardId === ward.id && styles.optionTextActive]}>
                  {ward.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Observation level</Text>
          <View style={styles.optionRow}>
            {observationLevels.map((level) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canManagePatients}
                key={level}
                onPress={() => setDraft((current) => ({ ...current, observationLevel: level }))}
                style={[styles.optionButton, draft.observationLevel === level && styles.optionButtonActive]}
              >
                <Text style={[styles.optionText, draft.observationLevel === level && styles.optionTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            disabled={!canManagePatients || isSaving}
            onPress={savePatient}
            style={[styles.primaryButton, (!canManagePatients || isSaving) && styles.disabledControl]}
          >
            <Text style={styles.primaryButtonText}>{isSaving ? "Saving..." : "Save patient"}</Text>
          </TouchableOpacity>

          {selectedPatient ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canManagePatients || isSaving}
              onPress={archivePatient}
              style={[styles.archiveButton, (!canManagePatients || isSaving) && styles.disabledControl]}
            >
              <Text style={styles.archiveButtonText}>Archive patient</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function createDraft(): PatientDraft {
  return {
    hospitalNumber: "",
    firstName: "",
    surname: "",
    roomNumber: "",
    observationLevel: "Intermittent"
  };
}

function createPatientId(hospitalNumber: string, firstName: string, surname: string) {
  const slug = `${hospitalNumber}-${firstName}-${surname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return `patient-${slug || Date.now()}`;
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  title: { color: "#18262c", fontSize: 20, fontWeight: "900" },
  meta: { color: "#607078", fontSize: 13, fontWeight: "800", marginTop: 3 },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  backButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  split: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  patientList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.9,
    gap: 8,
    minWidth: 280,
    padding: 12
  },
  listHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  panelTitle: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  smallButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10
  },
  smallButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  patientRow: {
    borderColor: "#e1e7e9",
    borderRadius: 7,
    borderWidth: 1,
    padding: 10
  },
  patientRowActive: { backgroundColor: "#e8f2f5", borderColor: "#1f5262" },
  patientName: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  patientMeta: { color: "#607078", fontSize: 12, fontWeight: "800", marginTop: 3 },
  editor: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1.3,
    gap: 10,
    minWidth: 320,
    padding: 12
  },
  input: {
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 10
  },
  formRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flexInput: { flex: 1, minWidth: 160 },
  label: { color: "#31454d", fontSize: 12, fontWeight: "900", marginTop: 2 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#30434a", fontSize: 12, fontWeight: "900" },
  optionTextActive: { color: "#ffffff" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 46
  },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  archiveButton: {
    alignItems: "center",
    borderColor: "#a33b3b",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42
  },
  archiveButtonText: { color: "#a33b3b", fontSize: 13, fontWeight: "900" },
  disabledControl: { opacity: 0.45 }
});
