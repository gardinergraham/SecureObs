import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { ObservationLevel, Patient, StaffMember, Ward } from "../types/domain";
import { calculateAge, formatDateOfBirth } from "../utils/patientDemographics";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

const observationLevels: ObservationLevel[] = ["Intermittent", "Eyesight", "Within arms length"];

type PatientDraft = {
  hospitalNumber: string;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinTelephone: string;
  nextOfKinEmail: string;
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
  onTransferPatient: (patientId: string, wardId: string, reason: string) => Promise<void>;
  onArchivePatient: (patientId: string, reason: string) => Promise<void>;
  onRestorePatient: (patientId: string, wardId: string, reason: string) => Promise<void>;
};

export function PatientManagementScreen({
  patients,
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onBack,
  onSavePatient,
  onTransferPatient,
  onArchivePatient,
  onRestorePatient
}: PatientManagementScreenProps) {
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const canManagePatients = hasStaffRole(selectedStaff, "manager") || hasAdminAccess(selectedStaff);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [draft, setDraft] = useState<PatientDraft>(() => createDraft());
  const [targetWardId, setTargetWardId] = useState(selectedWardId);
  const [transferReason, setTransferReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [restoreReason, setRestoreReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const activePatients = useMemo(
    () =>
      patients
        .filter((patient) => !patient.archived && patient.wardId === selectedWardId)
        .sort((a, b) => a.roomNumber - b.roomNumber),
    [patients, selectedWardId]
  );
  const archivedPatients = useMemo(
    () => patients.filter((patient) => patient.archived).sort((a, b) => a.surname.localeCompare(b.surname)),
    [patients]
  );
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const selectedPatientWard = wards.find((ward) => ward.id === selectedPatient?.wardId);

  const selectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setTargetWardId(patient.wardId);
    setDraft({
      hospitalNumber: patient.hospitalNumber,
      firstName: patient.firstName,
      surname: patient.surname,
      dateOfBirth: patient.dateOfBirth ?? "",
      nextOfKinName: patient.nextOfKinName ?? "",
      nextOfKinRelationship: patient.nextOfKinRelationship ?? "",
      nextOfKinTelephone: patient.nextOfKinTelephone ?? "",
      nextOfKinEmail: patient.nextOfKinEmail ?? "",
      roomNumber: String(patient.roomNumber),
      observationLevel: patient.observationLevel
    });
  };

  const confirmTransferPatient = (wardId: string) => {
    if (!selectedPatient || !canManagePatients) {
      return;
    }
    const targetWard = wards.find((ward) => ward.id === wardId);
    if (!targetWard) {
      Alert.alert("Ward not found", "The destination ward is no longer available.");
      return;
    }
    if (transferReason.trim().length < 3) {
      Alert.alert("Transfer reason needed", "Record why the patient is moving before confirming the transfer.");
      return;
    }

    Alert.alert(
      "Confirm patient transfer",
      `Transfer ${selectedPatient.firstName} ${selectedPatient.surname} from ${selectedPatientWard?.name ?? "their current ward"} to ${targetWard.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm transfer",
          onPress: () => void transferPatient(wardId, targetWard.name, transferReason.trim())
        }
      ]
    );
  };

  const transferPatient = async (wardId: string, targetWardName: string, reason: string) => {
    if (!selectedPatient || !canManagePatients) return;

    setIsSaving(true);
    try {
      await onTransferPatient(selectedPatient.id, wardId, reason);
      clearDraft();
      setTransferReason("");
      Alert.alert("Patient transferred", `${selectedPatient.firstName} ${selectedPatient.surname} is now on ${targetWardName}.`);
    } catch (error) {
      Alert.alert(
        "Transfer not completed",
        error instanceof Error ? error.message : "The patient remains on their current ward. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const setTrialLeave = async (onLeave: boolean) => {
    if (!selectedPatient || !canManagePatients) {
      return;
    }

    setIsSaving(true);
    try {
      await onSavePatient({
        ...selectedPatient,
        onOffWard: onLeave ? "Off ward" : "On ward",
        latestObservationPlace: onLeave ? "LOA" : "Side room"
      });
      Alert.alert(
        onLeave ? "Trial leave recorded" : "Patient returned",
        `${selectedPatient.firstName} ${selectedPatient.surname} updated.`
      );
    } finally {
      setIsSaving(false);
    }
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
    if (draft.dateOfBirth.trim() && calculateAge(draft.dateOfBirth.trim()) === undefined) {
      Alert.alert("Check date of birth", "Enter a valid date of birth as YYYY-MM-DD. It cannot be in the future.");
      return;
    }
    if (draft.nextOfKinEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.nextOfKinEmail.trim())) {
      Alert.alert("Check next-of-kin email", "Enter a valid email address or leave the field blank.");
      return;
    }

    const now = new Date().toISOString();
    const patient: Patient = {
      ...(selectedPatient ?? {}),
      id: selectedPatient?.id ?? createPatientId(draft.hospitalNumber, draft.firstName, draft.surname),
      patientNumber: selectedPatient?.patientNumber ?? Date.now() % 100000,
      hospitalNumber: draft.hospitalNumber.trim(),
      firstName: draft.firstName.trim(),
      surname: draft.surname.trim(),
      dateOfBirth: draft.dateOfBirth.trim(),
      nextOfKinName: draft.nextOfKinName.trim(),
      nextOfKinRelationship: draft.nextOfKinRelationship.trim(),
      nextOfKinTelephone: draft.nextOfKinTelephone.trim(),
      nextOfKinEmail: draft.nextOfKinEmail.trim(),
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

  const confirmArchivePatient = () => {
    if (!selectedPatient || !canManagePatients) {
      return;
    }
    if (archiveReason.trim().length < 3) {
      Alert.alert("Archive reason needed", "Record why the patient is being archived.");
      return;
    }

    Alert.alert(
      "Archive patient?",
      `Archive ${selectedPatient.firstName} ${selectedPatient.surname}? They will be removed from active ward lists but their record and history will be retained.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive patient", style: "destructive", onPress: () => void archivePatient(archiveReason.trim()) }
      ]
    );
  };

  const archivePatient = async (reason: string) => {
    if (!selectedPatient || !canManagePatients) return;

    setIsSaving(true);
    try {
      await onArchivePatient(selectedPatient.id, reason);
      clearDraft();
      setArchiveReason("");
      Alert.alert("Patient archived", `${selectedPatient.firstName} ${selectedPatient.surname} has been archived.`);
    } catch (error) {
      Alert.alert("Patient not archived", error instanceof Error ? error.message : "The patient remains active.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRestorePatient = (patient: Patient) => {
    if (!canManagePatients || !selectedWard) return;
    if (restoreReason.trim().length < 3) {
      Alert.alert("Restoration reason needed", "Record why the patient is returning before restoring them.");
      return;
    }
    Alert.alert(
      "Restore patient?",
      `Restore ${patient.firstName} ${patient.surname} to ${selectedWard.name}? Their existing SecureObs history will be retained.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restore to ward", onPress: () => void restorePatient(patient, restoreReason.trim()) }
      ]
    );
  };

  const restorePatient = async (patient: Patient, reason: string) => {
    if (!canManagePatients || !selectedWard) return;
    setIsSaving(true);
    try {
      await onRestorePatient(patient.id, selectedWard.id, reason);
      setRestoreReason("");
      Alert.alert("Patient restored", `${patient.firstName} ${patient.surname} is active on ${selectedWard.name}.`);
    } catch (error) {
      Alert.alert("Patient not restored", error instanceof Error ? error.message : "The patient remains archived.");
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
            <Text style={styles.panelTitle}>{selectedWard?.name ?? "Ward"} patients</Text>
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
              <Text style={styles.patientMeta}>
                {patient.hospitalNumber}
                {calculateAge(patient.dateOfBirth) !== undefined ? ` | Age ${calculateAge(patient.dateOfBirth)}` : ""}
                {" | "}{patient.observationLevel}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.archivedSection}>
            <Text style={styles.label}>Archived patients ({archivedPatients.length})</Text>
            <Text style={styles.patientMeta}>Restore a returning patient to {selectedWard?.name ?? "this ward"} without losing their history.</Text>
            <TextInput
              placeholderTextColor="#6f7f87"
              editable={canManagePatients}
              onChangeText={setRestoreReason}
              placeholder="Reason for restoration (required)"
              style={styles.input}
              value={restoreReason}
            />
            {archivedPatients.length === 0 ? (
              <Text style={styles.patientMeta}>No archived patients.</Text>
            ) : archivedPatients.map((patient) => {
              const previousWard = wards.find((ward) => ward.id === patient.wardId);
              return (
                <View key={patient.id} style={styles.archivedRow}>
                  <View style={styles.archivedCopy}>
                    <Text style={styles.patientName}>{patient.firstName} {patient.surname}</Text>
                    <Text style={styles.patientMeta}>{patient.hospitalNumber} · previously {previousWard?.name ?? patient.wardId}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={!canManagePatients || isSaving || !selectedWard}
                    onPress={() => confirmRestorePatient(patient)}
                    style={[styles.smallButton, (!canManagePatients || isSaving || !selectedWard) && styles.disabledControl]}
                  >
                    <Text style={styles.smallButtonText}>Restore</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.editor}>
          <Text style={styles.panelTitle}>{selectedPatient ? "Edit patient" : "Add patient"}</Text>
          <TextInput placeholderTextColor="#6f7f87"
            editable={canManagePatients}
            onChangeText={(hospitalNumber) => setDraft((current) => ({ ...current, hospitalNumber }))}
            placeholder="Hospital / local patient number"
            style={styles.input}
            value={draft.hospitalNumber}
          />
          <View style={styles.formRow}>
            <TextInput placeholderTextColor="#6f7f87"
              editable={canManagePatients}
              onChangeText={(firstName) => setDraft((current) => ({ ...current, firstName }))}
              placeholder="First name"
              style={[styles.input, styles.flexInput]}
              value={draft.firstName}
            />
            <TextInput placeholderTextColor="#6f7f87"
              editable={canManagePatients}
              onChangeText={(surname) => setDraft((current) => ({ ...current, surname }))}
              placeholder="Surname"
              style={[styles.input, styles.flexInput]}
              value={draft.surname}
            />
          </View>
          <View style={styles.demographicPanel}>
            <Text style={styles.label}>Date of birth</Text>
            <View style={styles.formRow}>
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={canManagePatients}
                onChangeText={(dateOfBirth) => setDraft((current) => ({ ...current, dateOfBirth }))}
                placeholder="YYYY-MM-DD"
                style={[styles.input, styles.flexInput]}
                value={draft.dateOfBirth}
              />
              <View style={styles.ageBox}>
                <Text style={styles.currentWardLabel}>Age</Text>
                <Text style={styles.currentWardText}>
                  {calculateAge(draft.dateOfBirth) ?? "—"}
                </Text>
              </View>
            </View>
            {selectedPatient?.dateOfBirth ? (
              <Text style={styles.helperText}>Recorded date: {formatDateOfBirth(selectedPatient.dateOfBirth)}</Text>
            ) : null}
          </View>
          <TextInput placeholderTextColor="#6f7f87"
            editable={canManagePatients}
            keyboardType="number-pad"
            onChangeText={(roomNumber) => setDraft((current) => ({ ...current, roomNumber }))}
            placeholder="Room number"
            style={styles.input}
            value={draft.roomNumber}
          />

          <View style={styles.demographicPanel}>
            <Text style={styles.label}>Next of kin / primary contact</Text>
            <View style={styles.formRow}>
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={canManagePatients}
                onChangeText={(nextOfKinName) => setDraft((current) => ({ ...current, nextOfKinName }))}
                placeholder="Contact name"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinName}
              />
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={canManagePatients}
                onChangeText={(nextOfKinRelationship) => setDraft((current) => ({ ...current, nextOfKinRelationship }))}
                placeholder="Relationship to patient"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinRelationship}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                placeholderTextColor="#6f7f87"
                editable={canManagePatients}
                keyboardType="phone-pad"
                onChangeText={(nextOfKinTelephone) => setDraft((current) => ({ ...current, nextOfKinTelephone }))}
                placeholder="Telephone"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinTelephone}
              />
              <TextInput
                placeholderTextColor="#6f7f87"
                autoCapitalize="none"
                editable={canManagePatients}
                keyboardType="email-address"
                onChangeText={(nextOfKinEmail) => setDraft((current) => ({ ...current, nextOfKinEmail }))}
                placeholder="Email address"
                style={[styles.input, styles.flexInput]}
                value={draft.nextOfKinEmail}
              />
            </View>
            <Text style={styles.helperText}>Optional. Record only authorised contact information.</Text>
          </View>

          <View style={styles.currentWardBox}>
            <Text style={styles.currentWardLabel}>Current ward</Text>
            <Text style={styles.currentWardText}>
              {selectedPatient ? selectedPatientWard?.name ?? selectedPatient.wardId : selectedWard?.name ?? "No ward"}
            </Text>
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
            <>
              <View style={styles.transferPanel}>
                <Text style={styles.label}>Transfer patient</Text>
                <TextInput
                  placeholderTextColor="#6f7f87"
                  editable={canManagePatients}
                  onChangeText={setTransferReason}
                  placeholder="Reason for transfer (required)"
                  style={styles.input}
                  value={transferReason}
                />
                <View style={styles.optionRow}>
                  {wards
                    .filter((ward) => ward.id !== selectedPatient.wardId)
                    .map((ward) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={!canManagePatients || isSaving}
                        key={ward.id}
                        onPress={() => confirmTransferPatient(ward.id)}
                        style={[styles.transferButton, (!canManagePatients || isSaving) && styles.disabledControl]}
                      >
                        <Text style={styles.transferButtonText}>{ward.name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>

              <TextInput
                placeholderTextColor="#6f7f87"
                editable={canManagePatients}
                onChangeText={setArchiveReason}
                placeholder="Reason for archiving (required)"
                style={styles.input}
                value={archiveReason}
              />
              <View style={styles.leaveRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canManagePatients || isSaving}
                  onPress={() => setTrialLeave(selectedPatient.onOffWard !== "Off ward")}
                  style={[styles.leaveButton, (!canManagePatients || isSaving) && styles.disabledControl]}
                >
                  <Text style={styles.leaveButtonText}>
                    {selectedPatient.onOffWard === "Off ward" ? "Return on ward" : "Trial leave / off ward"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canManagePatients || isSaving}
                  onPress={confirmArchivePatient}
                  style={[styles.archiveButton, (!canManagePatients || isSaving) && styles.disabledControl]}
                >
                  <Text style={styles.archiveButtonText}>Archive patient</Text>
                </TouchableOpacity>
              </View>
            </>
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
    dateOfBirth: "",
    nextOfKinName: "",
    nextOfKinRelationship: "",
    nextOfKinTelephone: "",
    nextOfKinEmail: "",
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
  archivedSection: { borderTopColor: "#d8e0e3", borderTopWidth: 1, gap: 8, marginTop: 6, paddingTop: 10 },
  archivedRow: { alignItems: "center", borderColor: "#e1e7e9", borderRadius: 7, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "space-between", padding: 9 },
  archivedCopy: { flex: 1 },
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
  demographicPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    gap: 8,
    padding: 10
  },
  ageBox: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 90,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  helperText: { color: "#607078", fontSize: 11, lineHeight: 16 },
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
  currentWardBox: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    padding: 10
  },
  currentWardLabel: { color: "#607078", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  currentWardText: { color: "#18262c", fontSize: 14, fontWeight: "900", marginTop: 3 },
  transferPanel: {
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingTop: 10
  },
  transferButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  transferButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  leaveRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  leaveButton: {
    alignItems: "center",
    backgroundColor: "#31454d",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 160
  },
  leaveButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
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
