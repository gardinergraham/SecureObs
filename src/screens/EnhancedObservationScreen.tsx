import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { createObservation } from "../services/api";
import type {
  MissedObservation,
  Observation,
  Patient,
  PatientLocation,
  PatientPresentation,
  RotaAssignment,
  StaffMember
} from "../types/domain";

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
const missedObservationReasons = ["Attending another incident", "Staff shortage", "Clinical emergency", "Other"];

type EnhancedObservationScreenProps = {
  observations: Observation[];
  missedObservations: MissedObservation[];
  patients: Patient[];
  rotaAssignments: RotaAssignment[];
  staff: StaffMember[];
  selectedStaffId: string;
  onBack: () => void;
  onMissedObservationSaved: (missedObservation: MissedObservation) => void;
  onObservationSaved: (observation: Observation) => void;
};

export function EnhancedObservationScreen({
  observations,
  missedObservations,
  patients,
  rotaAssignments,
  staff,
  selectedStaffId,
  onBack,
  onMissedObservationSaved,
  onObservationSaved
}: EnhancedObservationScreenProps) {
  const enhancedPatients = useMemo(
    () => patients.filter((patient) => patient.enhancedObservation || patient.observationLevel !== "Intermittent"),
    [patients]
  );
  const [selectedPatientId, setSelectedPatientId] = useState(enhancedPatients[0]?.id ?? "");
  const selectedPatient = enhancedPatients.find((patient) => patient.id === selectedPatientId) ?? enhancedPatients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const [now, setNow] = useState(() => Date.now());
  const [location, setLocation] = useState<PatientLocation>("Side room");
  const [presentation, setPresentation] = useState<PatientPresentation>("Awake");
  const [comments, setComments] = useState("");
  const [recordingStaffIds, setRecordingStaffIds] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [missedReason, setMissedReason] = useState(missedObservationReasons[0] ?? "Other");
  const [missedDetails, setMissedDetails] = useState("");
  const selectedEnhancedObservations = useMemo(
    () =>
      observations
        .filter((observation) => observation.patientId === selectedPatient?.id && observation.source === "Enhanced/TESO")
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
    [observations, selectedPatient?.id]
  );
  const selectedTesoDueAt = selectedPatient
    ? getTesoDueAt(selectedPatient, selectedEnhancedObservations)
    : undefined;
  const selectedTesoTiming =
    selectedPatient && selectedTesoDueAt
      ? getTesoTiming(selectedPatient, selectedEnhancedObservations, now)
      : undefined;
  const selectedTesoMissedObservationValidated = Boolean(
    selectedPatient &&
      selectedTesoDueAt &&
      missedObservations.some(
        (missedObservation) =>
          missedObservation.patientId === selectedPatient.id &&
          missedObservation.source === "Enhanced/TESO" &&
          new Date(missedObservation.dueAt).getTime() === new Date(selectedTesoDueAt).getTime()
      )
  );
  const tesoGeneralObservationOverdue =
    selectedPatient?.observationLevel === "General observation" &&
    selectedTesoTiming?.status === "overdue" &&
    !selectedTesoMissedObservationValidated;
  const selectedTesoMissedObservations = missedObservations
    .filter(
      (missedObservation) =>
        missedObservation.patientId === selectedPatient?.id && missedObservation.source === "Enhanced/TESO"
    )
    .slice(0, 3);
  const requiredStaffCount = getRequiredStaffCount(selectedPatient);
  const currentTimedAssignments = useMemo(
    () =>
      selectedPatient
        ? rotaAssignments.filter(
            (assignment) =>
              assignment.patientId === selectedPatient.id &&
              assignment.role === "Enhanced/TESO" &&
              isAssignmentActive(assignment, now)
          )
        : [],
    [now, rotaAssignments, selectedPatient]
  );
  const defaultRecordingStaffIds = useMemo(() => {
    const allocatedIds =
      currentTimedAssignments.length > 0
        ? currentTimedAssignments.map((assignment) => assignment.staffId)
        : selectedPatient?.enhancedObservation?.assignedStaffIds ?? [];
    return Array.from(new Set(allocatedIds));
  }, [currentTimedAssignments, selectedPatient?.enhancedObservation?.assignedStaffIds]);
  const defaultRecordingStaffKey = defaultRecordingStaffIds.join("|");
  const recordingStaff = recordingStaffIds
    .map((staffId) => staff.find((member) => member.id === staffId))
    .filter((member): member is StaffMember => Boolean(member));
  const searchResults = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    if (!query || !selectedPatient) {
      return [];
    }

    return staff
      .filter(
        (member) =>
          member.active !== false &&
          (member.wardId === selectedPatient.wardId || member.allowedWardIds.includes(selectedPatient.wardId))
      )
      .filter((member) =>
        [member.name, member.staffCode, member.designation ?? ""].some((value) =>
          value.toLowerCase().includes(query)
        )
      )
      .slice(0, 8);
  }, [selectedPatient, staff, staffSearch]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setRecordingStaffIds(defaultRecordingStaffKey ? defaultRecordingStaffKey.split("|") : []);
    setStaffSearch("");
  }, [defaultRecordingStaffKey, selectedPatient?.id]);

  const toggleRecordingStaff = (staffId: string) => {
    if (recordingStaffIds.includes(staffId)) {
      setRecordingStaffIds((currentIds) => currentIds.filter((id) => id !== staffId));
      return;
    }

    if (recordingStaffIds.length >= requiredStaffCount) {
      Alert.alert(
        `${requiredStaffCount}:1 observation`,
        "Remove the staff member who did not complete this observation before adding their replacement."
      );
      return;
    }

    setRecordingStaffIds((currentIds) => [...currentIds, staffId]);
  };

  const saveEnhancedEntry = async () => {
    if (!selectedPatient) {
      return;
    }

    if (recordingStaff.length !== requiredStaffCount) {
      Alert.alert(
        "Observation staff incomplete",
        `Select exactly ${requiredStaffCount} staff member${requiredStaffCount === 1 ? "" : "s"} for this ${requiredStaffCount}:1 observation.`
      );
      return;
    }

    if (tesoGeneralObservationOverdue) {
      Alert.alert(
        "Missed TESO observation needs recording",
        "Record the missed TESO observation reason before saving the new TESO general observation."
      );
      return;
    }

    const observedAt = new Date().toISOString();
    const assignedNames = recordingStaff.map((member) => member.name).join(", ");

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

  const saveMissedTesoObservation = () => {
    if (!selectedPatient || !selectedStaff || !selectedTesoDueAt) {
      return;
    }

    const allocatedStaff =
      defaultRecordingStaffIds
        .map((staffId) => staff.find((member) => member.id === staffId))
        .filter((member): member is StaffMember => Boolean(member));
    const assignedNames = allocatedStaff.map((member) => member.name).join(", ") || selectedStaff.name;

    const missedObservation: MissedObservation = {
      id: `missed-teso-observation-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.surname}`,
      wardId: selectedPatient.wardId,
      source: "Enhanced/TESO",
      dueAt: selectedTesoDueAt,
      recordedAt: new Date().toISOString(),
      allocatedStaffId: allocatedStaff[0]?.id ?? selectedStaff.id,
      allocatedStaffName: assignedNames,
      recordedByStaffId: selectedStaff.id,
      recordedByName: selectedStaff.name,
      reason: missedReason,
      details: missedDetails
    };

    onMissedObservationSaved(missedObservation);
    setMissedDetails("");
    Alert.alert("Missed TESO observation recorded", `${missedObservation.patientName} was recorded as missed.`);
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
                {patient.observationLevel === "General observation" ? (
                  <Text style={styles.lastObservationText}>
                    TESO interval {patient.enhancedObservation?.reviewFrequencyMinutes ?? 60}m
                  </Text>
                ) : null}
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

              {selectedPatient.observationLevel === "General observation" ? (
                <View
                  style={[
                    styles.tesoTimingPanel,
                    selectedTesoTiming?.status === "overdue" && styles.tesoTimingPanelOverdue
                  ]}
                >
                  <View>
                    <Text style={styles.tesoTimingTitle}>TESO general observation</Text>
                    <Text style={styles.tesoTimingMeta}>
                      Every {selectedPatient.enhancedObservation?.reviewFrequencyMinutes ?? 60}m |{" "}
                      Due {selectedTesoDueAt ? formatObservationTime(selectedTesoDueAt) : "--:--"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.tesoTimingBadge,
                      selectedTesoTiming?.status === "overdue" && styles.tesoTimingBadgeOverdue
                    ]}
                  >
                    {selectedTesoTiming?.label ?? "Not scheduled"}
                  </Text>
                </View>
              ) : null}

              {selectedPatient.enhancedObservation?.carePlan ? (
                <View style={styles.carePlanPanel}>
                  <Text style={styles.carePlanTitle}>Plan of care</Text>
                  <Text style={styles.carePlanText}>{selectedPatient.enhancedObservation.carePlan}</Text>
                </View>
              ) : null}

              <View style={styles.staffSelectionHeader}>
                <View style={styles.staffSelectionCopy}>
                  <Text style={styles.label}>Staff recording this observation</Text>
                  <Text style={styles.staffSelectionMeta}>
                    {currentTimedAssignments.length > 0
                      ? `Rota allocation ${formatAssignmentPeriod(currentTimedAssignments[0])}`
                      : "No timed rota allocation found; showing the care-plan assignment"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.staffCountBadge,
                    recordingStaff.length !== requiredStaffCount && styles.staffCountBadgeWarning
                  ]}
                >
                  {recordingStaff.length}/{requiredStaffCount} selected
                </Text>
              </View>

              {recordingStaff.length > 0 ? (
                <View style={styles.optionRow}>
                  {recordingStaff.map((member) => (
                    <TouchableOpacity
                      accessibilityHint="Removes this staff member from the observation entry"
                      accessibilityRole="button"
                      key={member.id}
                      onPress={() => toggleRecordingStaff(member.id)}
                      style={[styles.optionButton, styles.optionButtonActive]}
                    >
                      <Text style={[styles.optionText, styles.optionTextActive]}>{member.name} · Remove</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.noAssignedStaff}>
                  No staff are selected. Search below for the staff who completed this observation.
                </Text>
              )}

              <Text style={styles.searchLabel}>Different staff member?</Text>
              <TextInput
                accessibilityLabel="Search staff for this observation"
                autoCapitalize="none"
                onChangeText={setStaffSearch}
                placeholder="Search by name, staff code or role"
                placeholderTextColor="#6f7f87"
                style={styles.staffSearchInput}
                value={staffSearch}
              />
              {staffSearch.trim() ? (
                <View style={styles.staffSearchResults}>
                  {searchResults.length > 0 ? (
                    searchResults.map((member) => {
                      const active = recordingStaffIds.includes(member.id);
                      return (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          key={member.id}
                          onPress={() => toggleRecordingStaff(member.id)}
                          style={[styles.staffSearchResult, active && styles.staffSearchResultActive]}
                        >
                          <View>
                            <Text style={styles.staffSearchName}>{member.name}</Text>
                            <Text style={styles.staffSearchMeta}>
                              {member.staffCode} · {member.designation ?? member.role}
                            </Text>
                          </View>
                          <Text style={styles.staffSearchAction}>{active ? "Selected" : "Select"}</Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.noSearchResults}>No authorised ward staff match that search.</Text>
                  )}
                </View>
              ) : null}

              <Text style={styles.label}>Current location</Text>
              <OptionRow options={locations} selected={location} onSelect={(value) => setLocation(value as PatientLocation)} />

              <Text style={styles.label}>Presentation</Text>
              <OptionRow
                options={presentations}
                selected={presentation}
                onSelect={(value) => setPresentation(value as PatientPresentation)}
              />

              <Text style={styles.label}>TESO entry notes</Text>
              <TextInput placeholderTextColor="#6f7f87"
                multiline
                numberOfLines={4}
                onChangeText={setComments}
                placeholder="Optional enhanced observation notes"
                style={styles.notes}
                value={comments}
              />

              <TouchableOpacity
                accessibilityRole="button"
                disabled={tesoGeneralObservationOverdue}
                onPress={saveEnhancedEntry}
                style={[styles.saveButton, tesoGeneralObservationOverdue && styles.disabledSaveButton]}
              >
                <Text style={styles.saveButtonText}>
                  {tesoGeneralObservationOverdue ? "Record missed TESO observation first" : "Save enhanced entry"}
                </Text>
              </TouchableOpacity>

              {selectedPatient.observationLevel === "General observation" && selectedTesoTiming?.status === "overdue" ? (
                <View style={styles.missedPanel}>
                  <Text style={styles.missedTitle}>
                    {selectedTesoMissedObservationValidated
                      ? "Missed TESO observation validated"
                      : "Record missed TESO observation"}
                  </Text>
                  <Text style={styles.missedMeta}>
                    Due {selectedTesoDueAt ? formatObservationTime(selectedTesoDueAt) : "--:--"} | Source Enhanced/TESO
                  </Text>
                  <OptionRow options={missedObservationReasons} selected={missedReason} onSelect={setMissedReason} />
                  <TextInput placeholderTextColor="#6f7f87"
                    multiline
                    numberOfLines={3}
                    onChangeText={setMissedDetails}
                    placeholder="Add detail, incident reference or staffing context"
                    style={styles.notes}
                    value={missedDetails}
                  />
                  {selectedTesoMissedObservationValidated ? (
                    <Text style={styles.missedValidatedText}>Reason recorded for this overdue TESO observation.</Text>
                  ) : (
                    <TouchableOpacity accessibilityRole="button" onPress={saveMissedTesoObservation} style={styles.missedButton}>
                      <Text style={styles.missedButtonText}>Record missed TESO observation</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {selectedTesoMissedObservations.length > 0 ? (
                <View style={styles.missedHistory}>
                  <Text style={styles.missedTitle}>Recent missed TESO observations</Text>
                  {selectedTesoMissedObservations.map((missedObservation) => (
                    <Text key={missedObservation.id} style={styles.missedHistoryText}>
                      {formatObservationDate(missedObservation.dueAt)} {formatObservationTime(missedObservation.dueAt)} |{" "}
                      {missedObservation.reason} | {missedObservation.recordedByName}
                    </Text>
                  ))}
                </View>
              ) : null}

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

function getRequiredStaffCount(patient?: Patient) {
  const ratio = patient?.enhancedObservation?.staffRatio ?? "1:1";
  const count = Number.parseInt(ratio.split(":")[0] ?? "1", 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function isAssignmentActive(assignment: RotaAssignment, nowValue: number) {
  const startTimestamp = Date.parse(assignment.startsAt);
  const endTimestamp = Date.parse(assignment.endsAt);
  if (!Number.isNaN(startTimestamp) && !Number.isNaN(endTimestamp)) {
    return nowValue >= startTimestamp && nowValue < endTimestamp;
  }

  const startMinutes = timeValueToMinutes(assignment.startsAt);
  const endMinutes = timeValueToMinutes(assignment.endsAt);
  if (startMinutes === undefined || endMinutes === undefined) {
    return false;
  }

  const now = new Date(nowValue);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return endMinutes <= startMinutes
    ? nowMinutes >= startMinutes || nowMinutes < endMinutes
    : nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

function formatAssignmentPeriod(assignment?: RotaAssignment) {
  if (!assignment) return "for the current observation period";
  return `${formatAssignmentTime(assignment.startsAt)}–${formatAssignmentTime(assignment.endsAt)}`;
}

function formatAssignmentTime(value: string) {
  const minutes = timeValueToMinutes(value);
  if (minutes !== undefined && /^\d{1,2}:\d{2}$/.test(value)) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeValueToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : undefined;
}

function locationFromPatient(place: string): PatientLocation {
  if (locations.includes(place as PatientLocation)) {
    return place as PatientLocation;
  }

  return "Side room";
}

function getTesoDueAt(patient: Patient, observations: Observation[]) {
  if (patient.observationLevel !== "General observation") {
    return undefined;
  }

  const intervalMinutes = patient.enhancedObservation?.reviewFrequencyMinutes ?? 60;
  const latestObservation = observations[0];
  const baseline = latestObservation?.observedAt ?? patient.enhancedObservation?.startedAt;
  if (!baseline) {
    return undefined;
  }

  const baselineTime = new Date(baseline).getTime();
  if (Number.isNaN(baselineTime)) {
    return undefined;
  }

  return new Date(baselineTime + intervalMinutes * 60 * 1000).toISOString();
}

function getTesoTiming(patient: Patient, observations: Observation[], now: number) {
  const dueAt = getTesoDueAt(patient, observations);
  if (!dueAt) {
    return undefined;
  }

  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) {
    return undefined;
  }

  const minutes = Math.round((dueTime - now) / 60000);
  if (minutes < 0) {
    return { label: `${Math.abs(minutes)}m overdue`, status: "overdue" as const };
  }
  if (minutes === 0) {
    return { label: "Due now", status: "due" as const };
  }
  if (minutes <= 5) {
    return { label: `Due in ${minutes}m`, status: "soon" as const };
  }
  return { label: `Due in ${minutes}m`, status: "ok" as const };
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
  tesoTimingPanel: {
    alignItems: "center",
    backgroundColor: "#edf7f4",
    borderColor: "#b9d8ca",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 12
  },
  tesoTimingPanelOverdue: {
    backgroundColor: "#fff0ee",
    borderColor: "#d78b82"
  },
  tesoTimingTitle: {
    color: "#18262c",
    fontSize: 14,
    fontWeight: "900"
  },
  tesoTimingMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  tesoTimingBadge: {
    backgroundColor: "#dcead7",
    borderRadius: 6,
    color: "#253e2c",
    fontSize: 13,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  tesoTimingBadgeOverdue: {
    backgroundColor: "#c43d35",
    color: "#ffffff"
  },
  label: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 10
  },
  staffSelectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  staffSelectionCopy: {
    flex: 1
  },
  staffSelectionMeta: {
    color: "#65767d",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: -3
  },
  staffCountBadge: {
    backgroundColor: "#e2f2eb",
    borderRadius: 999,
    color: "#2b624e",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  staffCountBadgeWarning: {
    backgroundColor: "#fff0cc",
    color: "#79561d"
  },
  noAssignedStaff: {
    backgroundColor: "#fff7df",
    borderColor: "#ead49a",
    borderRadius: 6,
    borderWidth: 1,
    color: "#755820",
    fontSize: 12,
    fontWeight: "700",
    padding: 10
  },
  searchLabel: {
    color: "#52656e",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
    marginTop: 10
  },
  staffSearchInput: {
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 10
  },
  staffSearchResults: {
    borderColor: "#d9e1e4",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden"
  },
  staffSearchResult: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#e7ecee",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  staffSearchResultActive: {
    backgroundColor: "#edf7f4"
  },
  staffSearchName: {
    color: "#233840",
    fontSize: 12,
    fontWeight: "900"
  },
  staffSearchMeta: {
    color: "#687980",
    fontSize: 10,
    marginTop: 2,
    textTransform: "capitalize"
  },
  staffSearchAction: {
    color: "#17677a",
    fontSize: 11,
    fontWeight: "900"
  },
  noSearchResults: {
    color: "#687980",
    fontSize: 12,
    padding: 10
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
  disabledSaveButton: {
    opacity: 0.45
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  missedPanel: {
    backgroundColor: "#fff8e8",
    borderColor: "#e4b75f",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12
  },
  missedTitle: {
    color: "#62430f",
    fontSize: 14,
    fontWeight: "900"
  },
  missedMeta: {
    color: "#7b5a1a",
    fontSize: 12,
    fontWeight: "800"
  },
  missedButton: {
    alignItems: "center",
    backgroundColor: "#9a5c00",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 42
  },
  missedButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  missedValidatedText: {
    color: "#315748",
    fontSize: 12,
    fontWeight: "900"
  },
  missedHistory: {
    borderColor: "#ead8a7",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 10
  },
  missedHistoryText: {
    color: "#604817",
    fontSize: 12,
    fontWeight: "800"
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
