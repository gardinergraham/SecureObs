import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { Patient, StaffMember, StaffRatio, TesoReason, ObservationLevel } from "../types/domain";

const observationLevels: ObservationLevel[] = ["Intermittent", "Eyesight", "Within arms length"];
const ratios: StaffRatio[] = ["1:1", "2:1", "3:1", "4:1", "5:1", "6:1"];
const reasons: TesoReason[] = [
  "Risk to self",
  "Risk to others",
  "Risk from others",
  "Medication intervention",
  "Security",
  "Physical health",
  "Other"
];

type PatientSettingsScreenProps = {
  patients: Patient[];
  staff: StaffMember[];
  selectedStaffId: string;
  onBack: () => void;
  onUpdatePatient: (patient: Patient) => void;
};

export function PatientSettingsScreen({
  patients,
  staff,
  selectedStaffId,
  onBack,
  onUpdatePatient
}: PatientSettingsScreenProps) {
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit = selectedStaff?.role === "nurse" || selectedStaff?.role === "manager";
  const orderedPatients = useMemo(
    () => [...patients].sort((a, b) => a.roomNumber - b.roomNumber),
    [patients]
  );
  const [selectedPatientId, setSelectedPatientId] = useState(orderedPatients[0]?.id ?? "");
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];

  const updatePatient = (patient: Patient, nextPatient: Patient) => {
    if (!canEdit) {
      return;
    }

    onUpdatePatient(nextPatient);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient settings</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} | {canEdit ? "Nurse/manager access" : "HCF locked"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.patientList}>
          <Text style={styles.panelTitle}>Patients</Text>
          {orderedPatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => setSelectedPatientId(patient.id)}
              style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
            >
              <View>
                <Text style={styles.patientName}>
                  Room {patient.roomNumber} | {patient.firstName} {patient.surname}
                </Text>
                <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
              </View>
              <Text style={styles.levelBadge}>{patient.observationLevel}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.detailPane}>
          {selectedPatient ? (
            <>
              <View style={styles.patientHeader}>
                <View>
                  <Text style={styles.detailTitle}>
                    Room {selectedPatient.roomNumber} | {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.patientMeta}>{selectedPatient.hospitalNumber}</Text>
                </View>
                <Text style={styles.levelBadge}>{selectedPatient.observationLevel}</Text>
              </View>

              <Text style={styles.label}>Observation level</Text>
              <OptionRow
                disabled={!canEdit}
                options={observationLevels}
                selected={selectedPatient.observationLevel}
                onSelect={(level) => {
                  const observationLevel = level as ObservationLevel;
                  updatePatient(selectedPatient, {
                    ...selectedPatient,
                    observationLevel,
                    enhancedObservation:
                      observationLevel === "Intermittent"
                        ? undefined
                        : selectedPatient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "")
                  });
                }}
              />

              <Text style={styles.label}>Seclusion</Text>
              <OptionRow
                disabled={!canEdit}
                options={["No seclusion", "Seclusion", "Long-term seclusion"]}
                selected={
                  selectedPatient.longTermSeclusion
                    ? "Long-term seclusion"
                    : selectedPatient.seclusion
                      ? "Seclusion"
                      : "No seclusion"
                }
                onSelect={(value) =>
                  updatePatient(selectedPatient, {
                    ...selectedPatient,
                    seclusion: value === "Seclusion",
                    longTermSeclusion: value === "Long-term seclusion"
                  })
                }
              />

              {selectedPatient.observationLevel !== "Intermittent" ? (
              <View style={styles.tesoPanel}>
                <Text style={styles.label}>TESO staff ratio</Text>
                <OptionRow
                  disabled={!canEdit}
                  options={ratios}
                  selected={selectedPatient.enhancedObservation?.staffRatio ?? "1:1"}
                  onSelect={(staffRatio) =>
                    updatePatient(selectedPatient, {
                      ...selectedPatient,
                      enhancedObservation: {
                        ...(selectedPatient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "")),
                        staffRatio: staffRatio as StaffRatio
                      }
                    })
                  }
                />

                <Text style={styles.label}>Reason for enhanced observation</Text>
                <OptionRow
                  disabled={!canEdit}
                  multi
                  options={reasons}
                  selected={selectedPatient.enhancedObservation?.reasons ?? []}
                  onSelect={(reason) => {
                    const currentPlan = selectedPatient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "");
                    const nextReasons = currentPlan.reasons.includes(reason as TesoReason)
                      ? currentPlan.reasons.filter((item) => item !== reason)
                      : [...currentPlan.reasons, reason as TesoReason];

                    updatePatient(selectedPatient, {
                      ...selectedPatient,
                      enhancedObservation: {
                        ...currentPlan,
                        reasons: nextReasons
                      }
                    });
                  }}
                />

                <Text style={styles.label}>Other reason</Text>
                <TextInput
                  editable={canEdit}
                  onChangeText={(otherReason) =>
                    updatePatient(selectedPatient, {
                      ...selectedPatient,
                      enhancedObservation: {
                        ...(selectedPatient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "")),
                        otherReason
                      }
                    })
                  }
                  placeholder="Required when Other is selected"
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.otherReason ?? ""}
                />

                <Text style={styles.label}>TESO started</Text>
                <TextInput
                  editable={canEdit}
                  onChangeText={(startedAt) =>
                    updatePatient(selectedPatient, {
                      ...selectedPatient,
                      enhancedObservation: {
                        ...(selectedPatient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "")),
                        startedAt
                      }
                    })
                  }
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.startedAt ?? ""}
                />

                <Text style={styles.label}>Authorised by</Text>
                <TextInput
                  editable={canEdit}
                  onChangeText={(authorisedBy) =>
                    updatePatient(selectedPatient, {
                      ...selectedPatient,
                      enhancedObservation: {
                        ...(selectedPatient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "")),
                        authorisedBy
                      }
                    })
                  }
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.authorisedBy ?? ""}
                />
              </View>
              ) : (
                <Text style={styles.infoText}>This patient is on general intermittent observation only.</Text>
              )}
            </>
          ) : (
            <Text style={styles.infoText}>No patient selected.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

type OptionRowProps = {
  options: string[];
  selected: string | string[];
  disabled: boolean;
  multi?: boolean;
  onSelect: (value: string) => void;
};

function OptionRow({ options, selected, disabled, multi, onSelect }: OptionRowProps) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = Array.isArray(selected) ? selected.includes(option) : selected === option;

        return (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={disabled}
            key={option}
            onPress={() => onSelect(option)}
            style={[
              styles.optionButton,
              active && styles.optionButtonActive,
              disabled && styles.disabledControl,
              multi && styles.multiButton
            ]}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createDefaultPlan(authorisedBy: string) {
  return {
    staffRatio: "1:1" as StaffRatio,
    reasons: ["Risk to self"] as TesoReason[],
    otherReason: "",
    startedAt: new Date().toISOString(),
    authorisedBy,
    assignedStaffIds: []
  };
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
  split: {
    alignItems: "stretch",
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
  detailPane: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.62,
    minWidth: 430,
    padding: 14
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10
  },
  patientHeader: {
    alignItems: "center",
    borderBottomColor: "#edf1f2",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 12
  },
  patientRow: {
    alignItems: "flex-start",
    borderColor: "#edf1f2",
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
    minHeight: 72,
    padding: 10
  },
  patientRowActive: {
    backgroundColor: "#edf7f4",
    borderColor: "#1f5262"
  },
  patientName: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900"
  },
  detailTitle: {
    color: "#18262c",
    fontSize: 22,
    fontWeight: "900"
  },
  patientMeta: {
    color: "#607078",
    fontSize: 12,
    marginTop: 2
  },
  levelBadge: {
    backgroundColor: "#ddebd6",
    borderRadius: 6,
    color: "#243f2b",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6
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
  multiButton: {
    minWidth: 120
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
  tesoPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    padding: 12
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 10
  },
  infoText: {
    color: "#607078",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12
  },
  disabledControl: {
    opacity: 0.45
  }
});
