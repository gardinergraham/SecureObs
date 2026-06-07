import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Observation, ObservationSource, Patient, Ward } from "../types/domain";

const historyTypes: ObservationSource[] = ["General observations", "Enhanced/TESO"];

type PreviousObservationsScreenProps = {
  observations: Observation[];
  patients: Patient[];
  selectedPatientId: string;
  selectedWardId: string;
  wards: Ward[];
  onBack: () => void;
  onSelectPatient: (patientId: string) => void;
};

export function PreviousObservationsScreen({
  observations,
  patients,
  selectedPatientId,
  selectedWardId,
  wards,
  onBack,
  onSelectPatient
}: PreviousObservationsScreenProps) {
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const [selectedSource, setSelectedSource] = useState<ObservationSource>("General observations");
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    getMostUsefulDateKey(observations, selectedPatient?.id, selectedSource)
  );
  const monthDays = useMemo(() => buildCalendarDays(selectedDateKey), [selectedDateKey]);
  const selectedPatientObservations = useMemo(
    () =>
      observations
        .filter((observation) => observation.patientId === selectedPatient?.id && observation.source === selectedSource)
        .sort((left, right) => right.observedAt.localeCompare(left.observedAt)),
    [observations, selectedPatient?.id, selectedSource]
  );
  const observationCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();

    selectedPatientObservations.forEach((observation) => {
      const dateKey = formatDateKey(new Date(observation.observedAt));
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    });

    return counts;
  }, [selectedPatientObservations]);
  const selectedDateObservations = selectedPatientObservations.filter(
    (observation) => formatDateKey(new Date(observation.observedAt)) === selectedDateKey
  );

  const selectPatient = (patientId: string) => {
    onSelectPatient(patientId);
    setSelectedDateKey(getMostUsefulDateKey(observations, patientId, selectedSource));
  };

  const selectSource = (source: ObservationSource) => {
    setSelectedSource(source);
    setSelectedDateKey(getMostUsefulDateKey(observations, selectedPatient?.id, source));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Previous observations</Text>
          <Text style={styles.meta}>{selectedWard?.name ?? "Ward"} | Patient history by date</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.patientPanel}>
          <Text style={styles.panelTitle}>Patients</Text>
          {orderedPatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => selectPatient(patient.id)}
              style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
            >
              <Text style={styles.patientName}>
                Room {patient.roomNumber} | {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.historyPanel}>
          {selectedPatient ? (
            <>
              <View style={styles.patientHeader}>
                <View>
                  <Text style={styles.patientTitle}>
                    {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.headerMeta}>
                    Room {selectedPatient.roomNumber} | {selectedPatient.hospitalNumber}
                  </Text>
                </View>
                <View style={styles.sourceToggle}>
                  {historyTypes.map((source) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={source}
                      onPress={() => selectSource(source)}
                      style={[styles.sourceButton, source === selectedSource && styles.sourceButtonActive]}
                    >
                      <Text style={[styles.sourceText, source === selectedSource && styles.sourceTextActive]}>
                        {source === "General observations" ? "General" : "Enhanced"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>{formatMonthTitle(selectedDateKey)}</Text>
                <Text style={styles.calendarMeta}>{selectedDateObservations.length} entries selected</Text>
              </View>
              <View style={styles.weekHeader}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <Text key={day} style={styles.weekday}>
                    {day}
                  </Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {monthDays.map((day) => {
                  const count = day.dateKey ? observationCountsByDate.get(day.dateKey) ?? 0 : 0;
                  const selected = day.dateKey === selectedDateKey;

                  return (
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={!day.dateKey}
                      key={day.key}
                      onPress={() => day.dateKey && setSelectedDateKey(day.dateKey)}
                      style={[
                        styles.dayButton,
                        !day.dateKey && styles.dayButtonBlank,
                        count > 0 && styles.dayButtonHasHistory,
                        selected && styles.dayButtonSelected
                      ]}
                    >
                      <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day.label}</Text>
                      {count > 0 ? (
                        <Text style={[styles.dayCount, selected && styles.dayTextSelected]}>{count}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.entriesPanel}>
                <Text style={styles.entriesTitle}>
                  {selectedSource === "General observations" ? "General obs" : "Enhanced obs"} on{" "}
                  {formatFullDate(selectedDateKey)}
                </Text>
                {selectedDateObservations.length === 0 ? (
                  <Text style={styles.empty}>No {selectedSource === "General observations" ? "general" : "enhanced"} observations saved for this patient on this day.</Text>
                ) : (
                  selectedDateObservations.map((observation) => (
                    <View key={observation.id} style={styles.entryRow}>
                      <View>
                        <Text style={styles.entryTime}>{formatTime(observation.observedAt)}</Text>
                        <Text style={styles.entryMeta}>
                          {observation.location} | {observation.presentation} | {observation.type}
                        </Text>
                        {observation.comments ? <Text style={styles.entryComments}>{observation.comments}</Text> : null}
                      </View>
                      <View style={styles.entryStaffBlock}>
                        <Text style={styles.entryStaffLabel}>Observed by</Text>
                        <Text style={styles.entryStaff}>{observation.observerName}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : (
            <Text style={styles.empty}>No patient selected.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function getMostUsefulDateKey(observations: Observation[], patientId: string | undefined, source: ObservationSource) {
  const latestObservation = observations
    .filter((observation) => observation.patientId === patientId && observation.source === source)
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];

  return formatDateKey(latestObservation ? new Date(latestObservation.observedAt) : new Date());
}

function buildCalendarDays(selectedDateKey: string) {
  const [yearText = "", monthText = ""] = selectedDateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const days: Array<{ dateKey?: string; key: string; label: string }> = [];

  for (let index = 0; index < mondayOffset; index += 1) {
    days.push({ key: `blank-${index}`, label: "" });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    days.push({
      dateKey: formatDateKey(date),
      key: formatDateKey(date),
      label: String(day)
    });
  }

  return days;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthTitle(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });
}

function formatFullDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
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
  split: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  patientPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.32,
    minWidth: 300,
    padding: 12
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10
  },
  patientRow: {
    borderColor: "#d8e0e3",
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
    fontSize: 14,
    fontWeight: "900"
  },
  patientMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  historyPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.68,
    minWidth: 560,
    padding: 14
  },
  patientHeader: {
    alignItems: "center",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12
  },
  patientTitle: {
    color: "#18262c",
    fontSize: 22,
    fontWeight: "900"
  },
  headerMeta: {
    color: "#607078",
    fontSize: 13,
    marginTop: 3
  },
  sourceToggle: {
    flexDirection: "row",
    gap: 8
  },
  sourceButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 96,
    paddingHorizontal: 10
  },
  sourceButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  sourceText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "900"
  },
  sourceTextActive: {
    color: "#ffffff"
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14
  },
  calendarTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900"
  },
  calendarMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800"
  },
  weekHeader: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10
  },
  weekday: {
    color: "#607078",
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6
  },
  dayButton: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    width: "13.45%"
  },
  dayButtonBlank: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  dayButtonHasHistory: {
    backgroundColor: "#e9f4f6",
    borderColor: "#8bbac4"
  },
  dayButtonSelected: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  dayText: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "900"
  },
  dayTextSelected: {
    color: "#ffffff"
  },
  dayCount: {
    color: "#1f5262",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2
  },
  entriesPanel: {
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 12
  },
  entriesTitle: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8
  },
  entryRow: {
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
  entryTime: {
    color: "#18262c",
    fontSize: 14,
    fontWeight: "900"
  },
  entryMeta: {
    color: "#52656e",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  entryComments: {
    color: "#607078",
    fontSize: 12,
    marginTop: 5
  },
  entryStaff: {
    color: "#30434a",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  entryStaffBlock: {
    alignItems: "flex-end",
    justifyContent: "center"
  },
  entryStaffLabel: {
    color: "#607078",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "right"
  },
  empty: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    color: "#607078",
    fontSize: 13,
    fontWeight: "700",
    padding: 10
  }
});
