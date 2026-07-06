import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { createObservation } from "../services/api";
import type {
  News2Reading,
  MissedObservation,
  Observation,
  Patient,
  PatientLocation,
  PatientPresentation,
  PatientTask,
  SafetyIncident,
  StaffShiftAssignment,
  StaffMember,
  Ward
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
const patientSortModes = ["Rooms", "Ending soonest", "On Enhanced observations"] as const;
const missedObservationReasons = ["Attending another incident", "Staff shortage", "Clinical emergency", "Other"];

type PatientSortMode = (typeof patientSortModes)[number];

type WardDashboardProps = {
  wards: Ward[];
  patients: Patient[];
  news2Readings: News2Reading[];
  missedObservations: MissedObservation[];
  observations: Observation[];
  incidents: SafetyIncident[];
  patientTasks: PatientTask[];
  staffShiftAssignments: StaffShiftAssignment[];
  staff: StaffMember[];
  selectedStaffId: string;
  selectedWardId: string;
  selectedPatientId: string;
  onBackToHome: () => void;
  onOpenAnalytics: () => void;
  onOpenOverview: () => void;
  onOpenFoodFluidChart: () => void;
  onOpenNews2: () => void;
  onOpenEnhanced: () => void;
  onOpenPatientCarePlans: () => void;
  onOpenPatientDashboard: () => void;
  onOpenPatientNotes: () => void;
  onOpenPatientTasks: () => void;
  onOpenPatientSettings: () => void;
  onOpenPreviousObservations: () => void;
  onOpenSafetyCentre: () => void;
  onOpenShiftHandover: () => void;
  onOpenSecurityChecks: () => void;
  onOpenMedicationChart: () => void;
  onOpenStaffRota: () => void;
  onOpenPatientManagement: () => void;
  onObservationSaved: (observation: Observation) => void;
  onMissedObservationSaved: (missedObservation: MissedObservation) => void;
  onSelectPatient: (patientId: string) => void;
};

export function WardDashboard({
  wards,
  patients,
  news2Readings,
  missedObservations,
  observations,
  incidents,
  patientTasks,
  staffShiftAssignments,
  staff,
  selectedStaffId,
  selectedWardId,
  selectedPatientId,
  onBackToHome,
  onOpenAnalytics,
  onOpenOverview,
  onOpenFoodFluidChart,
  onOpenNews2,
  onOpenEnhanced,
  onOpenPatientCarePlans,
  onOpenPatientDashboard,
  onOpenPatientNotes,
  onOpenPatientTasks,
  onOpenPatientSettings,
  onOpenPreviousObservations,
  onOpenSafetyCentre,
  onOpenShiftHandover,
  onOpenSecurityChecks,
  onOpenMedicationChart,
  onOpenStaffRota,
  onOpenPatientManagement,
  onObservationSaved,
  onMissedObservationSaved,
  onSelectPatient
}: WardDashboardProps) {
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const [now, setNow] = useState(() => Date.now());
  const activeIncidents = incidents.filter(
    (incident) => incident.wardId === selectedWardId && incident.status !== "resolved"
  );
  const redIncidentCount = activeIncidents.filter((incident) => incident.severity === "red").length;
  const amberIncidentCount = activeIncidents.filter((incident) => incident.severity === "amber").length;
  const activePatientTasks = patientTasks.filter(
    (task) =>
      task.wardId === selectedWardId && (task.status === "open" || task.status === "accepted")
  );
  const taskAlertCount = activePatientTasks.filter(
    (task) => task.priority === "red" || new Date(task.dueAt).getTime() < now
  ).length;
  const currentShift = selectedWard ? getCurrentShift(selectedWard, now) : undefined;
  const currentShiftAssignments = currentShift
    ? staffShiftAssignments.filter(
        (assignment) =>
          assignment.wardId === selectedWardId &&
          assignment.shiftId === currentShift.shiftId &&
          assignment.date === currentShift.dateKey
      )
    : [];
  const nurseInChargeNames = currentShiftAssignments
    .filter((assignment) => assignment.nurseInCharge)
    .map((assignment) => staff.find((member) => member.id === assignment.staffId)?.name)
    .filter((name): name is string => Boolean(name));
  const medicationNurseNames = currentShiftAssignments
    .filter((assignment) => assignment.medicationNurse)
    .map((assignment) => staff.find((member) => member.id === assignment.staffId)?.name)
    .filter((name): name is string => Boolean(name));
  const [location, setLocation] = useState<PatientLocation>("Side room");
  const [presentation, setPresentation] = useState<PatientPresentation>("Awake");
  const [comments, setComments] = useState("");
  const [missedReason, setMissedReason] = useState(missedObservationReasons[0] ?? "Other");
  const [missedDetails, setMissedDetails] = useState("");
  const [patientSortMode, setPatientSortMode] = useState<PatientSortMode>("Rooms");
  const selectedPatientTiming = selectedPatient
    ? getObservationTiming(selectedPatient, selectedWard?.observationIntervalMinutes ?? 15, now)
    : undefined;
  const selectedPatientDueAt = selectedPatient
    ? getDueAt(selectedPatient, selectedWard?.observationIntervalMinutes ?? 15)
    : undefined;
  const selectedPatientMissedObservationValidated = Boolean(
    selectedPatient &&
      selectedPatientDueAt &&
      missedObservations.some(
        (missedObservation) =>
          missedObservation.patientId === selectedPatient.id &&
          (missedObservation.source ?? "General observations") === "General observations" &&
          new Date(missedObservation.dueAt).getTime() === new Date(selectedPatientDueAt).getTime()
      )
  );
  const mustValidateMissedObservation =
    selectedPatientTiming?.status === "overdue" && !selectedPatientMissedObservationValidated;
  const selectedPatientMissedObservations = missedObservations
    .filter(
      (missedObservation) =>
        missedObservation.patientId === selectedPatient?.id &&
        (missedObservation.source ?? "General observations") === "General observations"
    )
    .slice(0, 3);

  const orderedPatients = useMemo(() => {
    const wardIntervalMinutes = selectedWard?.observationIntervalMinutes ?? 15;

    return [...patients].sort((a, b) => {
      if (patientSortMode === "Ending soonest") {
        const dueDifference = getMinutesUntilDue(a, wardIntervalMinutes, now) - getMinutesUntilDue(b, wardIntervalMinutes, now);
        if (dueDifference !== 0) {
          return dueDifference;
        }
      }

      if (patientSortMode === "On Enhanced observations") {
        const enhancedDifference = Number(b.observationLevel !== "Intermittent") - Number(a.observationLevel !== "Intermittent");
        if (enhancedDifference !== 0) {
          return enhancedDifference;
        }
      }

      return a.roomNumber - b.roomNumber;
    });
  }, [now, patientSortMode, patients, selectedWard?.observationIntervalMinutes]);
  const latestNews2ByPatientId = useMemo(() => {
    const latestByPatientId = new Map<string, News2Reading>();

    news2Readings.forEach((reading) => {
      const latestReading = latestByPatientId.get(reading.patientId);
      if (!latestReading || reading.recordedAt > latestReading.recordedAt) {
        latestByPatientId.set(reading.patientId, reading);
      }
    });

    return latestByPatientId;
  }, [news2Readings]);
  const latestEnhancedObservationByPatientId = useMemo(() => {
    const latestByPatientId = new Map<string, Observation>();

    observations
      .filter((observation) => observation.source === "Enhanced/TESO")
      .forEach((observation) => {
        const latestObservation = latestByPatientId.get(observation.patientId);
        if (!latestObservation || observation.observedAt > latestObservation.observedAt) {
          latestByPatientId.set(observation.patientId, observation);
        }
      });

    return latestByPatientId;
  }, [observations]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      setLocation(locationFromPatient(selectedPatient.latestObservationPlace));
    }
  }, [selectedPatient]);

  const saveObservation = async () => {
    if (!selectedPatient) {
      return;
    }

    if (mustValidateMissedObservation) {
      Alert.alert(
        "Missed observation needs recording",
        "Record the missed observation reason before saving the new observation."
      );
      return;
    }

    const observedAt = new Date().toISOString();
    const observerName = selectedStaff?.name ?? "Unknown";

    const observation = await createObservation({
      patientId: selectedPatient.id,
      observerName,
      source: "General observations",
      type: "Intermittent",
      location,
      presentation,
      comments,
      observedAt,
      organisationId: selectedStaff?.organisationId,
      actorStaffId: selectedStaff?.id,
      actorStaffCode: selectedStaff?.staffCode
    });

    onObservationSaved(observation);
    setNow(Date.now());
    Alert.alert("Observation saved", `${selectedPatient.firstName} ${selectedPatient.surname} checked.`);
    setComments("");
    onSelectPatient("");
  };

  const saveMissedObservation = () => {
    if (!selectedPatient || !selectedWard || !selectedStaff || !selectedPatientDueAt) {
      return;
    }

    const missedObservation: MissedObservation = {
      id: `missed-observation-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.surname}`,
      wardId: selectedWard.id,
      source: "General observations",
      dueAt: selectedPatientDueAt,
      recordedAt: new Date().toISOString(),
      allocatedStaffId: selectedStaff.id,
      allocatedStaffName: selectedStaff.name,
      recordedByStaffId: selectedStaff.id,
      recordedByName: selectedStaff.name,
      reason: missedReason,
      details: missedDetails
    };

    onMissedObservationSaved(missedObservation);
    setMissedDetails("");
    Alert.alert("Missed observation recorded", `${missedObservation.patientName} was recorded as missed.`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.sessionBar}>
        <View>
          <Text style={styles.sessionTitle}>{selectedWard?.name ?? "Ward observations"}</Text>
          <Text style={styles.sessionMeta}>
            {selectedStaff?.name ?? "No staff selected"} | Intermittent every{" "}
            {selectedWard?.observationIntervalMinutes ?? 15}m
          </Text>
        </View>
        <View style={styles.sessionActions}>
          <TouchableOpacity accessibilityRole="button" onPress={onOpenOverview} style={styles.changeButton}>
            <Text style={styles.changeButtonText}>Ward overview</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onBackToHome} style={styles.changeButton}>
            <Text style={styles.changeButtonText}>Change staff or ward</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modeBar}>
        <TouchableOpacity accessibilityRole="button" style={[styles.modeButton, styles.modeButtonActive]}>
          <Text style={[styles.modeButtonText, styles.modeButtonTextActive]}>General observations</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenAnalytics} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Analytics</Text>
        </TouchableOpacity>
        {selectedWard?.news2Enabled ? (
          <TouchableOpacity accessibilityRole="button" onPress={onOpenNews2} style={styles.modeButton}>
            <Text style={styles.modeButtonText}>NEWS2</Text>
          </TouchableOpacity>
        ) : null}
        {selectedWard?.foodFluidChartEnabled ? (
          <TouchableOpacity accessibilityRole="button" onPress={onOpenFoodFluidChart} style={styles.modeButton}>
            <Text style={styles.modeButtonText}>Food &amp; fluid</Text>
          </TouchableOpacity>
        ) : null}
        {selectedWard?.enhancedObservationsEnabled ? (
          <TouchableOpacity accessibilityRole="button" onPress={onOpenEnhanced} style={styles.modeButton}>
            <Text style={styles.modeButtonText}>Enhanced/TESO</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="button" onPress={onOpenPatientSettings} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Patient settings</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenPatientManagement} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Patient management</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenPatientDashboard} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Patient dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenPatientNotes} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onOpenPatientTasks}
          style={[styles.modeButton, taskAlertCount > 0 && styles.safetyButtonAmber]}
        >
          <Text style={styles.modeButtonText}>
            Tasks {activePatientTasks.length > 0 ? `(${activePatientTasks.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenPatientCarePlans} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Care plans</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onOpenSafetyCentre}
          style={[
            styles.modeButton,
            redIncidentCount > 0 && styles.safetyButtonRed,
            redIncidentCount === 0 && amberIncidentCount > 0 && styles.safetyButtonAmber
          ]}
        >
          <Text style={[styles.modeButtonText, redIncidentCount > 0 && styles.safetyButtonTextRed]}>
            Safety centre {activeIncidents.length > 0 ? `(${activeIncidents.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenShiftHandover} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Shift handover</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenPreviousObservations} style={styles.modeButton}>
          <Text style={styles.modeButtonText}>Previous obs</Text>
        </TouchableOpacity>
        {selectedWard?.securityChecksEnabled ? (
          <TouchableOpacity accessibilityRole="button" onPress={onOpenSecurityChecks} style={styles.modeButton}>
            <Text style={styles.modeButtonText}>Security checks</Text>
          </TouchableOpacity>
        ) : null}
        {selectedWard?.medicationChartEnabled ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onOpenMedicationChart}
            style={styles.modeButton}
          >
            <Text style={styles.modeButtonText}>Medication chart</Text>
          </TouchableOpacity>
        ) : null}
        {selectedWard?.staffRotaEnabled ? (
          <TouchableOpacity accessibilityRole="button" onPress={onOpenStaffRota} style={styles.modeButton}>
            <Text style={styles.modeButtonText}>Staff rota</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ClockStrip
        medicationNurseNames={medicationNurseNames}
        now={now}
        nurseInChargeNames={nurseInChargeNames}
        shiftLabel={currentShift?.label}
      />

      <View style={styles.split}>
        <View style={[styles.patientList, !selectedPatient && styles.patientListWide]}>
          <View style={styles.listHeader}>
            <Text style={styles.panelTitle}>{selectedWard?.name ?? "Ward"} patients</Text>
            <Text style={styles.headerMeta}>
              {selectedStaff?.name ?? "No staff selected"} | {patientSortMode}
            </Text>
            <View style={styles.sortRow}>
              {patientSortModes.map((sortMode) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={sortMode}
                  onPress={() => setPatientSortMode(sortMode)}
                  style={[styles.sortButton, patientSortMode === sortMode && styles.sortButtonActive]}
                >
                  <Text style={[styles.sortButtonText, patientSortMode === sortMode && styles.sortButtonTextActive]}>
                    {sortMode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {orderedPatients.map((patient) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              selected={patient.id === selectedPatient?.id}
              latestEnhancedObservation={latestEnhancedObservationByPatientId.get(patient.id)}
              latestNews2Reading={latestNews2ByPatientId.get(patient.id)}
              wardIntervalMinutes={selectedWard?.observationIntervalMinutes ?? 15}
              now={now}
              onPress={() => {
                setLocation(locationFromPatient(patient.latestObservationPlace));
                onSelectPatient(patient.id);
              }}
            />
          ))}
        </View>

        {selectedPatient ? (
          <View style={styles.detailPane}>
            <>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.patientTitle}>
                    {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.detailMeta}>
                    Room {selectedPatient.roomNumber} | {selectedPatient.hospitalNumber}
                  </Text>
                </View>
                <ObservationPill patient={selectedPatient} />
              </View>

              <View style={styles.detailGrid}>
                <FieldLabel label="Current location" />
                <OptionGrid
                  options={locations}
                  selected={location}
                  onSelect={(value) => setLocation(value as PatientLocation)}
                />

                <FieldLabel label="Presentation" />
                <OptionGrid
                  options={presentations}
                  selected={presentation}
                  onSelect={(value) => setPresentation(value as PatientPresentation)}
                />

                <FieldLabel label="Notes" />
                <TextInput placeholderTextColor="#6f7f87"
                  multiline
                  numberOfLines={4}
                  onChangeText={setComments}
                  placeholder="Optional observation notes"
                  style={styles.notes}
                  value={comments}
                />

                {mustValidateMissedObservation ? (
                  <Text style={styles.validationNotice}>
                    This check is overdue. Record the missed observation reason before saving a new check.
                  </Text>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={mustValidateMissedObservation}
                  onPress={saveObservation}
                  style={[styles.saveButton, mustValidateMissedObservation && styles.disabledSaveButton]}
                >
                  <Text style={styles.saveButtonText}>
                    {mustValidateMissedObservation ? "Record missed observation first" : "Save check"}
                  </Text>
                </TouchableOpacity>

                {selectedPatientTiming?.status === "overdue" ? (
                  <View style={styles.missedPanel}>
                    <Text style={styles.missedTitle}>
                      {selectedPatientMissedObservationValidated
                        ? "Missed observation validated"
                        : "Record missed observation"}
                    </Text>
                    <Text style={styles.missedMeta}>
                      Due {selectedPatientDueAt ? formatObservationTime(selectedPatientDueAt) : "--:--"} | Allocated to{" "}
                      {selectedStaff?.name ?? "current staff"}
                    </Text>
                    <OptionGrid options={missedObservationReasons} selected={missedReason} onSelect={setMissedReason} />
                    <TextInput placeholderTextColor="#6f7f87"
                      multiline
                      numberOfLines={3}
                      onChangeText={setMissedDetails}
                      placeholder="Add detail, incident reference or staffing context"
                      style={styles.notes}
                      value={missedDetails}
                    />
                    {selectedPatientMissedObservationValidated ? (
                      <Text style={styles.missedValidatedText}>Reason recorded for this overdue check.</Text>
                    ) : (
                      <TouchableOpacity accessibilityRole="button" onPress={saveMissedObservation} style={styles.missedButton}>
                        <Text style={styles.missedButtonText}>Record missed observation</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

                {selectedPatientMissedObservations.length > 0 ? (
                  <View style={styles.missedHistory}>
                    <Text style={styles.missedTitle}>Recent missed observations</Text>
                    {selectedPatientMissedObservations.map((missedObservation) => (
                      <Text key={missedObservation.id} style={styles.missedHistoryText}>
                        {formatObservationDate(missedObservation.dueAt)} {formatObservationTime(missedObservation.dueAt)} |{" "}
                        {missedObservation.reason} | {missedObservation.recordedByName}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ClockStrip({
  medicationNurseNames,
  now,
  nurseInChargeNames,
  shiftLabel
}: {
  medicationNurseNames: string[];
  now: number;
  nurseInChargeNames: string[];
  shiftLabel?: string;
}) {
  return (
    <View style={styles.clockStrip}>
      <View style={styles.clockMain}>
        <Text style={styles.clockStripLabel}>Time</Text>
        <View style={styles.clockBox}>
          <Text style={styles.clockDate}>{formatObservationDate(new Date(now).toISOString())}</Text>
          <Text style={styles.clockText}>{formatClockTime(now)}</Text>
        </View>
      </View>
      <View style={styles.shiftLeadPanel}>
        <Text style={styles.shiftLeadTitle}>{shiftLabel ?? "Current shift"}</Text>
        <View style={styles.shiftLeadRow}>
          <Text style={styles.shiftLeadLabel}>Nurse in charge</Text>
          <Text style={styles.shiftLeadValue}>{formatStaffNames(nurseInChargeNames)}</Text>
        </View>
        <View style={styles.shiftLeadRow}>
          <Text style={styles.shiftLeadLabel}>Medication nurse</Text>
          <Text style={styles.shiftLeadValue}>{formatStaffNames(medicationNurseNames)}</Text>
        </View>
      </View>
    </View>
  );
}

type PatientRowProps = {
  patient: Patient;
  selected: boolean;
  latestEnhancedObservation?: Observation;
  latestNews2Reading?: News2Reading;
  wardIntervalMinutes: number;
  now: number;
  onPress: () => void;
};

function PatientRow({
  patient,
  selected,
  latestEnhancedObservation,
  latestNews2Reading,
  wardIntervalMinutes,
  now,
  onPress
}: PatientRowProps) {
  const timing = getObservationTiming(patient, wardIntervalMinutes, now);
  const tesoTiming = getTesoGeneralObservationTiming(patient, latestEnhancedObservation, now);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.patientRow,
        selected && styles.selectedPatientRow,
        timing.status === "ok" && styles.patientRowOk,
        timing.status === "soon" && styles.patientRowSoon,
        timing.status === "due" && styles.patientRowDue,
        timing.status === "overdue" && styles.patientRowOverdue,
        patient.seclusion && styles.seclusionRow,
        patient.longTermSeclusion && styles.longTermSeclusionRow
      ]}
    >
      <View style={styles.roomBadge}>
        <Text style={styles.roomText}>{patient.roomNumber}</Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>
          {patient.firstName} {patient.surname}
        </Text>
        <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
        <Text style={styles.lastObservationText}>
          Last {formatObservationTime(patient.latestObservationTime)} | {patient.latestObservationPlace} |{" "}
          {patient.latestPresentation}
        </Text>
        <Text style={styles.lastObservationText}>By {patient.latestObservedBy || "Unknown"}</Text>
      </View>
      <View style={styles.patientTiming}>
        <LatestNews2Box reading={latestNews2Reading} />
        <ObservationPill patient={patient} tesoTiming={tesoTiming} />
        <Text
          style={[
            styles.timerText,
            timing.status === "soon" && styles.soonText,
            (timing.status === "due" || timing.status === "overdue") && styles.overdueText
          ]}
        >
          {timing.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ObservationPill({
  patient,
  tesoTiming
}: {
  patient: Patient;
  tesoTiming?: ReturnType<typeof getTesoGeneralObservationTiming>;
}) {
  return (
    <View style={[styles.obsPill, observationLevelStyle(patient.observationLevel)]}>
      <Text style={styles.obsPillText}>{patient.observationLevel}</Text>
      {tesoTiming ? (
        <Text
          style={[
            styles.tesoTimerText,
            tesoTiming.status === "soon" && styles.soonText,
            (tesoTiming.status === "due" || tesoTiming.status === "overdue") && styles.overdueText
          ]}
        >
          TESO {tesoTiming.label}
        </Text>
      ) : null}
    </View>
  );
}

function LatestNews2Box({ reading }: { reading?: News2Reading }) {
  if (!reading) {
    return (
      <View style={[styles.news2Box, styles.news2NoReadingBox]}>
        <Text style={styles.news2Summary}>NEWS2 - No score</Text>
        <Text style={styles.news2Time}>Not recorded</Text>
      </View>
    );
  }

  return (
    <View style={[styles.news2Box, news2ScoreStyle(reading.totalScore)]}>
      <Text style={styles.news2Summary}>NEWS2 - Score {reading.totalScore}</Text>
      <Text style={styles.news2Time}>
        {formatObservationDate(reading.recordedAt)} {formatObservationTime(reading.recordedAt)}
      </Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

type OptionGridProps = {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
};

function OptionGrid({ options, selected, onSelect }: OptionGridProps) {
  return (
    <View style={styles.optionGrid}>
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

function getObservationTiming(patient: Patient, wardIntervalMinutes: number, now: number) {
  const minutes = getMinutesUntilDue(patient, wardIntervalMinutes, now);

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

function getMinutesUntilDue(patient: Patient, wardIntervalMinutes: number, now: number) {
  const last = new Date(patient.latestObservationTime).getTime();

  if (Number.isNaN(last)) {
    return Number.NEGATIVE_INFINITY;
  }

  const due = last + wardIntervalMinutes * 60 * 1000;
  return Math.round((due - now) / 60000);
}

function getDueAt(patient: Patient, wardIntervalMinutes: number) {
  const last = new Date(patient.latestObservationTime).getTime();
  if (Number.isNaN(last)) return undefined;
  return new Date(last + wardIntervalMinutes * 60 * 1000).toISOString();
}

function getTesoGeneralObservationTiming(patient: Patient, latestEnhancedObservation: Observation | undefined, now: number) {
  if (patient.observationLevel !== "General observation") {
    return undefined;
  }

  const intervalMinutes = patient.enhancedObservation?.reviewFrequencyMinutes ?? 60;
  const baseline = latestEnhancedObservation?.observedAt ?? patient.enhancedObservation?.startedAt;
  if (!baseline) {
    return undefined;
  }

  const baselineTime = new Date(baseline).getTime();
  if (Number.isNaN(baselineTime)) {
    return undefined;
  }

  const dueAt = baselineTime + intervalMinutes * 60 * 1000;
  const minutes = Math.round((dueAt - now) / 60000);

  if (minutes < 0) {
    return { label: `${Math.abs(minutes)}m overdue`, status: "overdue" as const };
  }
  if (minutes === 0) {
    return { label: "due now", status: "due" as const };
  }
  if (minutes <= 5) {
    return { label: `due in ${minutes}m`, status: "soon" as const };
  }
  return { label: `due in ${minutes}m`, status: "ok" as const };
}

function observationLevelStyle(level: Patient["observationLevel"]) {
  switch (level) {
    case "Eyesight":
      return styles.eyesightPill;
    case "Within arms length":
      return styles.armsLengthPill;
    case "Intermittent":
      return styles.intermittentPill;
    case "General observation":
      return styles.generalObservationPill;
  }
}

function news2ScoreStyle(score: number) {
  if (score >= 7) return styles.news2RedBox;
  if (score >= 5) return styles.news2AmberBox;
  if (score >= 1) return styles.news2YellowBox;
  return styles.news2WhiteBox;
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

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatClockTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatStaffNames(names: string[]) {
  return names.length > 0 ? names.join(", ") : "Not set";
}

function getCurrentShift(ward: Ward, nowValue: number) {
  const shifts = ward.rotaShifts.slice(0, ward.rotaShiftCount);
  const nowDate = new Date(nowValue);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  for (const [index, shift] of shifts.entries()) {
    const startMinutes = timeToMinutes(shift.startsAt);
    const endMinutes = timeToMinutes(shift.endsAt);
    const crossesMidnight = endMinutes <= startMinutes;
    const isActive = crossesMidnight
      ? nowMinutes >= startMinutes || nowMinutes < endMinutes
      : nowMinutes >= startMinutes && nowMinutes < endMinutes;

    if (isActive) {
      const shiftDate = new Date(nowDate);
      if (crossesMidnight && nowMinutes < endMinutes) {
        shiftDate.setDate(shiftDate.getDate() - 1);
      }

      return {
        dateKey: formatDateKey(shiftDate),
        label: `Shift ${index + 1} | ${shift.startsAt}-${shift.endsAt}`,
        shiftId: shift.id
      };
    }
  }

  const firstShift = shifts[0];
  return firstShift
    ? {
        dateKey: formatDateKey(nowDate),
        label: `Shift 1 | ${firstShift.startsAt}-${firstShift.endsAt}`,
        shiftId: firstShift.id
      }
    : undefined;
}

function timeToMinutes(time: string) {
  const [hourText = "0", minuteText = "0"] = time.split(":");
  return Number(hourText) * 60 + Number(minuteText);
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

function locationFromPatient(place: string): PatientLocation {
  if (place === "Day room") {
    return "Day room";
  }
  if (place === "Corridor") {
    return "Corridor";
  }
  if (place === "Dining room") {
    return "Dining room";
  }
  if (place === "Bathroom") {
    return "Bathroom";
  }
  if (place === "Laundry") {
    return "Laundry";
  }
  if (place === "Off ward") {
    return "Off ward";
  }
  if (place === "LOA") {
    return "LOA";
  }
  return "Side room";
}

const styles = StyleSheet.create({
  screen: {
    gap: 12
  },
  sessionBar: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  sessionTitle: {
    color: "#18262c",
    fontSize: 18,
    fontWeight: "900"
  },
  sessionMeta: {
    color: "#607078",
    fontSize: 13,
    marginTop: 3
  },
  sessionActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
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
  clockMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  clockStrip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
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
  shiftLeadPanel: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  shiftLeadTitle: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900"
  },
  shiftLeadRow: {
    flex: 1
  },
  shiftLeadLabel: {
    color: "#607078",
    fontSize: 11,
    fontWeight: "900"
  },
  shiftLeadValue: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2
  },
  changeButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  changeButtonText: {
    color: "#1f5262",
    fontSize: 13,
    fontWeight: "900"
  },
  modeBar: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8
  },
  modeButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    flexBasis: "10%",
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 54,
    minWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  modeButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  safetyButtonRed: { backgroundColor: "#f7c2b9", borderColor: "#bd4034" },
  safetyButtonAmber: { backgroundColor: "#fff0b8", borderColor: "#d19a24" },
  safetyButtonTextRed: { color: "#7f2b23" },
  modeButtonText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
    textAlign: "center"
  },
  modeButtonTextActive: {
    color: "#ffffff"
  },
  filters: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12
  },
  selectorRow: {
    marginBottom: 10
  },
  selectorLabel: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6
  },
  selectorOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorButton: {
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  selectorButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  selectorText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "700"
  },
  selectorTextActive: {
    color: "#ffffff"
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
    flex: 0.44,
    minWidth: 330,
    overflow: "hidden"
  },
  patientListWide: {
    flex: 1
  },
  listHeader: {
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: 12
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "800"
  },
  headerMeta: {
    color: "#68777d",
    fontSize: 12,
    marginTop: 3
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  sortButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 9
  },
  sortButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  sortButtonText: {
    color: "#30434a",
    fontSize: 11,
    fontWeight: "900"
  },
  sortButtonTextActive: {
    color: "#ffffff"
  },
  patientRow: {
    alignItems: "center",
    borderBottomColor: "#cfd9dd",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    minHeight: 112,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  selectedPatientRow: {
    backgroundColor: "#edf7f4"
  },
  patientRowOk: {
    backgroundColor: "#f8fbf7"
  },
  patientRowSoon: {
    backgroundColor: "#fff4d7"
  },
  patientRowDue: {
    backgroundColor: "#f9d0cc"
  },
  patientRowOverdue: {
    backgroundColor: "#f9d0cc"
  },
  seclusionRow: {
    borderLeftColor: "#c43d35",
    borderLeftWidth: 6
  },
  longTermSeclusionRow: {
    borderLeftColor: "#7750a6",
    borderLeftWidth: 6
  },
  roomBadge: {
    alignItems: "center",
    backgroundColor: "#e7edf0",
    borderRadius: 6,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  roomText: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900"
  },
  patientInfo: {
    flex: 1
  },
  patientName: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "800"
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
  patientTiming: {
    alignItems: "flex-end",
    gap: 6,
    width: 124
  },
  obsPill: {
    alignItems: "center",
    borderRadius: 6,
    minWidth: 104,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  eyesightPill: {
    backgroundColor: "#cfe9f4"
  },
  armsLengthPill: {
    backgroundColor: "#ffe6bf"
  },
  intermittentPill: {
    backgroundColor: "#ddebd6"
  },
  generalObservationPill: {
    backgroundColor: "#e6f1f7"
  },
  obsPillText: {
    color: "#16262c",
    fontSize: 11,
    fontWeight: "900"
  },
  tesoTimerText: {
    color: "#31454d",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center"
  },
  timerText: {
    color: "#3d565f",
    fontSize: 12,
    fontWeight: "800"
  },
  news2Box: {
    alignItems: "center",
    borderColor: "#293840",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 5,
    width: 104
  },
  news2WhiteBox: {
    backgroundColor: "#ffffff"
  },
  news2YellowBox: {
    backgroundColor: "#fff3a3"
  },
  news2AmberBox: {
    backgroundColor: "#ffc785"
  },
  news2RedBox: {
    backgroundColor: "#f08f78"
  },
  news2NoReadingBox: {
    backgroundColor: "#eef2f3",
    borderColor: "#c8d2d6"
  },
  news2Summary: {
    color: "#18262c",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  news2Time: {
    color: "#18262c",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
    textAlign: "center"
  },
  soonText: {
    color: "#9a5c00"
  },
  overdueText: {
    color: "#b3261e"
  },
  detailPane: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.56,
    minWidth: 390,
    padding: 16
  },
  detailHeader: {
    alignItems: "flex-start",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14
  },
  patientTitle: {
    color: "#18262c",
    fontSize: 24,
    fontWeight: "900"
  },
  detailMeta: {
    color: "#607078",
    fontSize: 14,
    marginTop: 4
  },
  detailGrid: {
    paddingTop: 12
  },
  fieldLabel: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 12
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionButton: {
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    minWidth: 104,
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  optionButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  optionText: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
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
    backgroundColor: "#97a9b0"
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  validationNotice: {
    backgroundColor: "#fff8e8",
    borderColor: "#e4b75f",
    borderRadius: 6,
    borderWidth: 1,
    color: "#7b5a1a",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
    padding: 10
  },
  missedPanel: {
    backgroundColor: "#fff8e8",
    borderColor: "#e4b75f",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginTop: 14,
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
    minHeight: 44
  },
  missedButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  missedValidatedText: {
    color: "#315748",
    fontSize: 13,
    fontWeight: "900"
  },
  missedHistory: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 12
  },
  missedHistoryText: {
    color: "#52656e",
    fontSize: 12,
    fontWeight: "800"
  },
  empty: {
    color: "#607078",
    fontSize: 14
  }
});
