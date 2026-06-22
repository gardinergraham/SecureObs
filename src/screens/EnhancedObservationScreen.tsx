import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { createObservation } from "../services/api";
import type { Observation, Patient, PatientLocation, PatientPresentation, StaffMember } from "../types/domain";

const locations: PatientLocation[] = [
  "Side room",
  "Day room",
  "Corridor",
  "Dining room",
  "Bathroom",
  "Laundry",
  "Off ward",
  "LOA"
];
const presentations: PatientPresentation[] = ["Awake", "Asleep"];

type EnhancedObservationScreenProps = {
  observations: Observation[];
  patients: Patient[];
  staff: StaffMember[];
  selectedStaffId: string;
  onBack: () => void;
  onObservationSaved: (observation: Observation) => void;
  onUpdatePatient: (patient: Patient) => void;
};

export function EnhancedObservationScreen({
  observations,
  patients,
  staff,
  selectedStaffId,
  onBack,
  onObservationSaved,
  onUpdatePatient
}: EnhancedObservationScreenProps) {
  const enhancedPatients = useMemo(
    () => patients.filter((patient) => patient.observationLevel !== "Intermittent"),
    [patients]
  );
  const [selectedPatientId, setSelectedPatientId] = useState(enhancedPatients[0]?.id ?? "");
  const selectedPatient = enhancedPatients.find((patient) => patient.id === selectedPatientId) ?? enhancedPatients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const [now, setNow] = useState(() => Date.now());
  const [location, setLocation] = useState<PatientLocation>("Side room");
  const [presentation, setPresentation] = useState<PatientPresentation>("Awake");
  const [comments, setComments] = useState("");
  const selectedEnhancedObservations = useMemo(
    () =>
      observations
        .filter((observation) => observation.patientId === selectedPatient?.id && observation.source === "Enhanced/TESO")
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
    [observations, selectedPatient?.id]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleAssignedStaff = (staffId: string) => {
    if (!selectedPatient?.enhancedObservation) {
      return;
    }

    const currentAssigned = selectedPatient.enhancedObservation.assignedStaffIds;
    const assignedStaffIds = currentAssigned.includes(staffId)
      ? currentAssigned.filter((id) => id !== staffId)
      : [...currentAssigned, staffId];

    onUpdatePatient({
      ...selectedPatient,
      enhancedObservation: {
        ...selectedPatient.enhancedObservation,
        assignedStaffIds
      }
    });
  };

  const saveEnhancedEntry = async () => {
    if (!selectedPatient) {
      return;
    }

    const observedAt = new Date().toISOString();
    const assignedNames =
      selectedPatient.enhancedObservation?.assignedStaffIds
        .map((staffId) => staff.find((member) => member.id === staffId)?.name)
        .filter(Boolean)
        .join(", ") || selectedStaff?.name || "Unknown";

    const observation = await createObservation({
      patientId: selectedPatient.id,
      observerName: assignedNames,
      source: "Enhanced/TESO",
      type: selectedPatient.observationLevel,
      location,
      presentation,
      comments,
      observedAt,
      organisationId: selectedStaff?.organisationId,
      actorStaffId: selectedStaff?.id,
      actorStaffCode: selectedStaff?.staffCode
    });

    onObservationSaved(observation);
    setComments("");
    Alert.alert("Enhanced observation saved", `${selectedPatient.firstName} ${selectedPatient.surname} checked.`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Enhanced observations</Text>
          <Text style={styles.meta}>TESO entries for eyesight and arms-length patients</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <ClockStrip now={now} />

      <View style={styles.split}>
        <View style={styles.patientList}>
          <Text style={styles.panelTitle}>Enhanced patients</Text>
          {enhancedPatients.length === 0 ? (
            <Text style={styles.empty}>No enhanced observations active.</Text>
          ) : (
            enhancedPatients.map((patient) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={patient.id}
                onPress={() => {
                  setSelectedPatientId(patient.id);
                  setLocation(locationFromPatient(patient.latestObservationPlace));
                }}
                style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
              >
                <Text style={styles.patientName}>
                  Room {patient.roomNumber} | {patient.firstName} {patient.surname}
                </Text>
                <Text style={styles.patientMeta}>
                  {patient.observationLevel} | {patient.enhancedObservation?.staffRatio ?? "1:1"}
                </Text>
                <Text style={styles.lastObservationText}>
                  Last {formatObservationTime(patient.latestObservationTime)} | {patient.latestObservationPlace} |{" "}
                  {patient.latestPresentation}
                </Text>
                <Text style={styles.lastObservationText}>By {patient.latestObservedBy || "Unknown"}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.detailPane}>
          {selectedPatient ? (
            <>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.patientTitle}>
                    {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.detailMeta}>
                    {selectedPatient.enhancedObservation?.reasons.join(", ") || "No reason recorded"}
                  </Text>
                </View>
                <Text style={styles.ratioBadge}>{selectedPatient.enhancedObservation?.staffRatio ?? "1:1"}</Text>
              </View>

              {selectedPatient.enhancedObservation?.carePlan ? (
                <View style={styles.carePlanPanel}>
                  <Text style={styles.carePlanTitle}>Plan of care</Text>
                  <Text style={styles.carePlanText}>{selectedPatient.enhancedObservation.carePlan}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Assigned enhanced staff</Text>
              <View style={styles.optionRow}>
                {staff.map((member) => {
                  const active = selectedPatient.enhancedObservation?.assignedStaffIds.includes(member.id) ?? false;

                  return (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={member.id}
                      onPress={() => toggleAssignedStaff(member.id)}
                      style={[styles.optionButton, active && styles.optionButtonActive]}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{member.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Current location</Text>
              <OptionRow options={locations} selected={location} onSelect={(value) => setLocation(value as PatientLocation)} />

              <Text style={styles.label}>Presentation</Text>
              <OptionRow
                options={presentations}
                selected={presentation}
                onSelect={(value) => setPresentation(value as PatientPresentation)}
              />

              <Text style={styles.label}>TESO entry notes</Text>
              <TextInput
                multiline
                numberOfLines={4}
                onChangeText={setComments}
                placeholder="Optional enhanced observation notes"
                style={styles.notes}
                value={comments}
              />

              <TouchableOpacity accessibilityRole="button" onPress={saveEnhancedEntry} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save enhanced entry</Text>
              </TouchableOpacity>

              <ObservationHistory
                emptyText="No enhanced observations saved for this patient yet."
                observations={selectedEnhancedObservations}
                title="Enhanced obs history"
              />
            </>
          ) : (
            <Text style={styles.empty}>No enhanced patient selected.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function ObservationHistory({
  emptyText,
  observations,
  title
}: {
  emptyText: string;
  observations: Observation[];
  title: string;
}) {
  return (
    <View style={styles.historyPanel}>
      <Text style={styles.historyTitle}>{title}</Text>
      {observations.length === 0 ? (
        <Text style={styles.historyEmpty}>{emptyText}</Text>
      ) : (
        observations.slice(0, 6).map((observation) => (
          <View key={observation.id} style={styles.historyRow}>
            <View>
              <Text style={styles.historyTime}>
                {formatObservationDate(observation.observedAt)} {formatObservationTime(observation.observedAt)}
              </Text>
              <Text style={styles.historyMeta}>
                {observation.location} | {observation.presentation} | {observation.type}
              </Text>
              {observation.comments ? <Text style={styles.historyComments}>{observation.comments}</Text> : null}
            </View>
            <Text style={styles.historyStaff}>{observation.observerName}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function ClockStrip({ now }: { now: number }) {
  return (
    <View style={styles.clockStrip}>
      <Text style={styles.clockStripLabel}>Time</Text>
      <View style={styles.clockBox}>
        <Text style={styles.clockDate}>{formatObservationDate(new Date(now).toISOString())}</Text>
        <Text style={styles.clockText}>{formatClockTime(now)}</Text>
      </View>
    </View>
  );
}

type OptionRowProps = {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
};

function OptionRow({ options, selected, onSelect }: OptionRowProps) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => (
        <TouchableOpacity
          accessibilityRole="button"
          key={option}
          onPress={() => onSelect(option)}
          style={[styles.optionButton, option === selected && styles.optionButtonActive]}
        >
          <Text style={[styles.optionText, option === selected && styles.optionTextActive]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function locationFromPatient(place: string): PatientLocation {
  if (locations.includes(place as PatientLocation)) {
    return place as PatientLocation;
  }

  return "Side room";
}

function formatObservationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatClockTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatObservationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short"
  });
}

const styles = StyleSheet.create({
  screen: {
    gap: 12
  },
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
  title: {
    color: "#18262c",
    fontSize: 20,
    fontWeight: "900"
  },
  meta: {
    color: "#607078",
    fontSize: 13,
    marginTop: 3
  },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  backButtonText: {
    color: "#1f5262",
    fontSize: 13,
    fontWeight: "900"
  },
  clockStrip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    padding: 8,
    position: "sticky" as "relative",
    top: 0,
    zIndex: 20
  },
  clockStripLabel: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "900"
  },
  clockBox: {
    alignItems: "center",
    backgroundColor: "#18262c",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minWidth: 226,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  clockText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900"
  },
  clockDate: {
    color: "#c9d8dd",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 24
  },
  split: {
    flexDirection: "row",
    gap: 12
  },
  patientList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.38,
    minWidth: 320,
    padding: 12
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10
  },
  patientRow: {
    borderColor: "#edf1f2",
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
    padding: 10
  },
  patientRowActive: {
    backgroundColor: "#edf7f4",
    borderColor: "#1f5262"
  },
  patientName: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  patientMeta: {
    color: "#607078",
    fontSize: 12,
    marginTop: 3
  },
  lastObservationText: {
    color: "#52656e",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3
  },
  detailPane: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.62,
    minWidth: 430,
    padding: 14
  },
  detailHeader: {
    alignItems: "center",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 12
  },
  patientTitle: {
    color: "#18262c",
    fontSize: 22,
    fontWeight: "900"
  },
  detailMeta: {
    color: "#607078",
    fontSize: 13,
    marginTop: 3
  },
  ratioBadge: {
    backgroundColor: "#ffe6bf",
    borderRadius: 6,
    color: "#53390d",
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  carePlanPanel: {
    backgroundColor: "#edf7f4",
    borderColor: "#b9d8ca",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  carePlanTitle: {
    color: "#315748",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4
  },
  carePlanText: {
    color: "#203c32",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  label: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 10
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  optionButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  optionText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "800"
  },
  optionTextActive: {
    color: "#ffffff"
  },
  notes: {
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 15,
    minHeight: 92,
    padding: 10,
    textAlignVertical: "top"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 50
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  historyPanel: {
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    paddingTop: 14
  },
  historyTitle: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8
  },
  historyEmpty: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    color: "#607078",
    fontSize: 13,
    fontWeight: "700",
    padding: 10
  },
  historyRow: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 8,
    padding: 10
  },
  historyTime: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900"
  },
  historyMeta: {
    color: "#52656e",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  historyComments: {
    color: "#607078",
    fontSize: 12,
    marginTop: 5
  },
  historyStaff: {
    color: "#30434a",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  empty: {
    color: "#607078",
    fontSize: 14
  }
});
