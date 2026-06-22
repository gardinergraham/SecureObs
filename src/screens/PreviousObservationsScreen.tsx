import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { MissedObservation, Observation, ObservationSource, Patient, Ward } from "../types/domain";

type HistoryType = ObservationSource | "Missed observations";

const historyTypes: HistoryType[] = ["General observations", "Enhanced/TESO", "Missed observations"];

type PreviousObservationsScreenProps = {
  missedObservations: MissedObservation[];
  observations: Observation[];
  patients: Patient[];
  selectedPatientId: string;
  selectedWardId: string;
  wards: Ward[];
  onBack: () => void;
  onSelectPatient: (patientId: string) => void;
};

export function PreviousObservationsScreen({
  missedObservations,
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
  const [selectedSource, setSelectedSource] = useState<HistoryType>("General observations");
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    getMostUsefulDateKey(observations, missedObservations, selectedPatient?.id, selectedSource)
  );
  const monthDays = useMemo(() => buildCalendarDays(selectedDateKey), [selectedDateKey]);
  const selectedPatientObservations = useMemo(
    () =>
      observations
        .filter(
          (observation) =>
            selectedSource !== "Missed observations" &&
            observation.patientId === selectedPatient?.id &&
            observation.source === selectedSource
        )
        .sort((left, right) => right.observedAt.localeCompare(left.observedAt)),
    [observations, selectedPatient?.id, selectedSource]
  );
  const selectedPatientMissedObservations = useMemo(
    () =>
      missedObservations
        .filter((missedObservation) => missedObservation.patientId === selectedPatient?.id)
        .sort((left, right) => right.dueAt.localeCompare(left.dueAt)),
    [missedObservations, selectedPatient?.id]
  );
  const selectedHistoryItems =
    selectedSource === "Missed observations" ? selectedPatientMissedObservations : selectedPatientObservations;
  const observationCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();

    selectedHistoryItems.forEach((item) => {
      const dateKey = formatDateKey(new Date(getHistoryItemDate(item)));
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    });

    return counts;
  }, [selectedHistoryItems]);
  const selectedDateItems = selectedHistoryItems.filter(
    (item) => formatDateKey(new Date(getHistoryItemDate(item))) === selectedDateKey
  );

  const selectPatient = (patientId: string) => {
    onSelectPatient(patientId);
    setSelectedDateKey(getMostUsefulDateKey(observations, missedObservations, patientId, selectedSource));
  };

  const selectSource = (source: HistoryType) => {
    setSelectedSource(source);
    setSelectedDateKey(getMostUsefulDateKey(observations, missedObservations, selectedPatient?.id, source));
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
                        {source === "General observations"
                          ? "General"
                          : source === "Enhanced/TESO"
                            ? "Enhanced"
                            : "Missed"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>{formatMonthTitle(selectedDateKey)}</Text>
                <Text style={styles.calendarMeta}>{selectedDateItems.length} entries selected</Text>
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
                  {historyLabel(selectedSource)} on {formatFullDate(selectedDateKey)}
                </Text>
                {selectedDateItems.length === 0 ? (
                  <Text style={styles.empty}>
                    No {historyLabel(selectedSource).toLowerCase()} saved for this patient on this day.
                  </Text>
                ) : (
                  selectedDateItems.map((item) =>
                    "dueAt" in item ? (
                      <View key={item.id} style={[styles.entryRow, styles.missedEntryRow]}>
                        <View>
                          <Text style={styles.entryTime}>Due {formatTime(item.dueAt)}</Text>
                          <Text style={styles.entryMeta}>Recorded {formatTime(item.recordedAt)} | {item.reason}</Text>
                          {item.details ? <Text style={styles.entryComments}>{item.details}</Text> : null}
                          <Text style={styles.entryComments}>Allocated to {item.allocatedStaffName}</Text>
                        </View>
                        <View style={styles.entryStaffBlock}>
                          <Text style={styles.entryStaffLabel}>Recorded by</Text>
                          <Text style={styles.entryStaff}>{item.recordedByName}</Text>
                        </View>
                      </View>
                    ) : (
                      <View key={item.id} style={styles.entryRow}>
                        <View>
                          <Text style={styles.entryTime}>{formatTime(item.observedAt)}</Text>
                          <Text style={styles.entryMeta}>
                            {item.location} | {item.presentation} | {item.type}
                          </Text>
                          {item.comments ? <Text style={styles.entryComments}>{item.comments}</Text> : null}
                        </View>
                        <View style={styles.entryStaffBlock}>
                          <Text style={styles.entryStaffLabel}>Observed by</Text>
                          <Text style={styles.entryStaff}>{item.observerName}</Text>
                        </View>
                      </View>
                    )
                  )
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

function getMostUsefulDateKey(
  observations: Observation[],
  missedObservations: MissedObservation[],
  patientId: string | undefined,
  source: HistoryType
) {
  const latestObservation =
    source === "Missed observations"
      ? missedObservations
          .filter((missedObservation) => missedObservation.patientId === patientId)
          .sort((left, right) => right.dueAt.localeCompare(left.dueAt))[0]
      : observations
          .filter((observation) => observation.patientId === patientId && observation.source === source)
          .sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];

  return formatDateKey(latestObservation ? new Date(getHistoryItemDate(latestObservation)) : new Date());
}

function getHistoryItemDate(item: Observation | MissedObservation) {
  return "dueAt" in item ? item.dueAt : item.observedAt;
}

function historyLabel(source: HistoryType) {
  if (source === "General observations") return "General observations";
  if (source === "Enhanced/TESO") return "Enhanced observations";
  return "Missed observations";
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
  missedEntryRow: {
    backgroundColor: "#fff8e8",
    borderColor: "#e4b75f"
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
