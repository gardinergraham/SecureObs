import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type {
  FoodFluidEntry,
  MedicationAdministration,
  MedicationPrescription,
  MissedObservation,
  News2Reading,
  Observation,
  Patient,
  PatientTask,
  SafetyIncident,
  ShiftHandover,
  ShiftHandoverPatientSummary,
  StaffMember,
  Ward
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

type ShiftHandoverScreenProps = {
  foodFluidEntries: FoodFluidEntry[];
  handovers: ShiftHandover[];
  incidents: SafetyIncident[];
  medicationAdministrations: MedicationAdministration[];
  medicationPrescriptions: MedicationPrescription[];
  missedObservations: MissedObservation[];
  news2Readings: News2Reading[];
  observations: Observation[];
  patients: Patient[];
  patientTasks: PatientTask[];
  selectedStaffId: string;
  staff: StaffMember[];
  ward?: Ward;
  onBack: () => void;
  onCreateHandover: (handover: ShiftHandover) => Promise<void>;
};

export function ShiftHandoverScreen({
  foodFluidEntries,
  handovers,
  incidents,
  medicationAdministrations,
  medicationPrescriptions,
  missedObservations,
  news2Readings,
  observations,
  patients,
  patientTasks,
  selectedStaffId,
  staff,
  ward,
  onBack,
  onCreateHandover
}: ShiftHandoverScreenProps) {
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const now = Date.now();
  const shift = ward ? getCurrentShift(ward, now) : undefined;
  const shiftCutoff = shift ? Math.min(now, shift.endsAt) : now;
  const [staffNotes, setStaffNotes] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [pdfHandoverId, setPdfHandoverId] = useState("");
  const wardIncidents = useMemo(
    () => incidents.filter((incident) => incident.wardId === ward?.id),
    [incidents, ward?.id]
  );
  const wardMissedObservations = useMemo(
    () => missedObservations.filter((missed) => missed.wardId === ward?.id),
    [missedObservations, ward?.id]
  );
  const wardPatientTasks = useMemo(
    () => patientTasks.filter((task) => task.wardId === ward?.id),
    [patientTasks, ward?.id]
  );

  const generatedSummaries = useMemo(
    () =>
      shift
        ? [...patients]
            .sort((left, right) => left.roomNumber - right.roomNumber)
            .map((patient) =>
              buildPatientSummary({
                cutoff: shiftCutoff,
                foodFluidEntries,
                incidents: wardIncidents,
                medicationAdministrations,
                medicationPrescriptions,
                news2Readings,
                observations,
                patient,
                patientTasks: wardPatientTasks,
                shiftStartsAt: shift.startsAt
              })
            )
        : [],
    [
      foodFluidEntries,
      wardIncidents,
      medicationAdministrations,
      medicationPrescriptions,
      news2Readings,
      observations,
      patients,
      wardPatientTasks,
      shift?.shiftId,
      shift?.startsAt,
      shiftCutoff
    ]
  );
  const patientSummaries = generatedSummaries.map((summary) => ({
    ...summary,
    staffNotes: staffNotes[summary.patientId] ?? ""
  }));
  const overallSummary = shift
    ? buildOverallSummary({
        cutoff: shiftCutoff,
        incidents: wardIncidents,
        missedObservations: wardMissedObservations,
        patientSummaries,
        patientTasks: wardPatientTasks,
        shiftStartsAt: shift.startsAt
      })
    : "No active shift could be identified from the ward rota.";
  const wardHandovers = handovers
    .filter((handover) => handover.wardId === ward?.id)
    .sort((left, right) => right.shiftStartedAt.localeCompare(left.shiftStartedAt));
  const canSign = Boolean(
    hasStaffRole(selectedStaff, "nurse") ||
      hasStaffRole(selectedStaff, "manager") ||
      hasStaffRole(selectedStaff, "doctor") ||
      hasAdminAccess(selectedStaff)
  );

  const currentHandover = (): ShiftHandover | undefined => {
    if (!ward || !shift || !selectedStaff) return undefined;
    return {
      id: `shift-handover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      wardId: ward.id,
      shiftId: shift.shiftId,
      shiftLabel: shift.label,
      shiftStartedAt: new Date(shift.startsAt).toISOString(),
      shiftEndedAt: new Date(shiftCutoff).toISOString(),
      overallSummary,
      patientSummaries,
      createdByStaffId: selectedStaff.id,
      createdByName: selectedStaff.name,
      createdByStaffCode: selectedStaff.staffCode,
      createdAt: new Date().toISOString()
    };
  };

  const saveHandover = async () => {
    const handover = currentHandover();
    if (!handover || !canSign) {
      Alert.alert("Unable to sign handover", "An active shift and nurse, doctor or manager session are required.");
      return;
    }
    setIsSaving(true);
    try {
      await onCreateHandover(handover);
      setStaffNotes({});
      Alert.alert("Shift handover signed", `${handover.shiftLabel} has been saved as a clinical record.`);
    } catch (error) {
      Alert.alert("Handover not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const printHandover = async (handover?: ShiftHandover) => {
    const record = handover ?? currentHandover();
    if (!record || !ward) {
      Alert.alert("Handover unavailable", "An active shift is required.");
      return;
    }
    setPdfHandoverId(record.id);
    try {
      await Print.printAsync({ html: buildHandoverHtml(record, ward.name) });
    } catch (error) {
      Alert.alert("Unable to print", error instanceof Error ? error.message : "The print dialog could not be opened.");
    } finally {
      setPdfHandoverId("");
    }
  };

  const shareHandover = async (handover: ShiftHandover) => {
    if (!ward) return;
    setPdfHandoverId(handover.id);
    try {
      const pdf = await Print.printToFileAsync({ html: buildHandoverHtml(handover, ward.name) });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Choose Print and save the handover as a PDF.");
        return;
      }
      await Sharing.shareAsync(pdf.uri, {
        dialogTitle: `Share ${handover.shiftLabel}`,
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf"
      });
    } catch (error) {
      Alert.alert("Unable to create PDF", error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setPdfHandoverId("");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Clinical handover</Text>
          <Text style={styles.title}>Shift handover</Text>
          <Text style={styles.meta}>
            {ward?.name ?? "Ward"} · {shift?.label ?? "No active shift"} · evidence through{" "}
            {formatTime(new Date(shiftCutoff).toISOString())}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Generated from recorded evidence</Text>
        <Text style={styles.noticeText}>
          Location and sleep statements describe recorded checks during this shift. They do not claim continuous
          monitoring between observations. Review every summary and add clinical context before signing.
        </Text>
      </View>

      <View style={styles.summaryPanel}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryCopy}>
            <Text style={styles.sectionTitle}>Ward summary</Text>
            <Text style={styles.overallSummary}>{overallSummary}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!shift || Boolean(pdfHandoverId)}
              onPress={() => void printHandover()}
              style={[styles.outlineButton, (!shift || Boolean(pdfHandoverId)) && styles.disabledButton]}
            >
              <Text style={styles.outlineButtonText}>Print draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!shift || !canSign || isSaving}
              onPress={() => void saveHandover()}
              style={[styles.primaryButton, (!shift || !canSign || isSaving) && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? "Signing…" : "Review and sign handover"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.patientGrid}>
        {patientSummaries.map((summary) => (
          <View key={summary.patientId} style={styles.patientCard}>
            <View style={styles.patientHeader}>
              <View>
                <Text style={styles.patientName}>{summary.patientName}</Text>
                <Text style={styles.patientMeta}>
                  Room {summary.roomNumber} · {summary.observationCount} general observation
                  {summary.observationCount === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={styles.checkCount}>
                <Text style={styles.checkCountValue}>{summary.observationCount}</Text>
                <Text style={styles.checkCountLabel}>Checks</Text>
              </View>
            </View>
            <Text style={styles.narrative}>{summary.narrative}</Text>
            <SummaryRow label="Movement" value={summary.movementSummary} />
            <SummaryRow label="Presentation" value={summary.presentationSummary} />
            <SummaryRow label="Food & fluid" value={summary.nutritionSummary} />
            <SummaryRow label="NEWS2" value={summary.news2Summary} />
            <SummaryRow label="Medication" value={summary.medicationSummary} />
            <SummaryRow label="Incidents" value={summary.incidentSummary} />
            <SummaryRow label="Outstanding tasks" value={summary.taskSummary ?? "No outstanding patient tasks."} />
            <SummaryRow
              label="Patient voice"
              value={summary.patientVoiceSummary ?? "No new patient feedback recorded during this shift."}
            />
            <Text style={styles.fieldLabel}>Staff handover notes</Text>
            <TextInput
              multiline
              onChangeText={(value) =>
                setStaffNotes((current) => ({ ...current, [summary.patientId]: value }))
              }
              placeholder="Add clinical context, outstanding actions or information for the incoming shift."
              placeholderTextColor="#77868c"
              style={styles.notesInput}
              textAlignVertical="top"
              value={staffNotes[summary.patientId] ?? ""}
            />
          </View>
        ))}
      </View>

      <View style={styles.historyPanel}>
        <Text style={styles.sectionTitle}>Signed handovers</Text>
        <Text style={styles.meta}>Saved handovers are retained as signed snapshots and can be printed or shared as PDF.</Text>
        {wardHandovers.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No signed handovers saved for this ward</Text>
          </View>
        ) : (
          wardHandovers.map((handover) => (
            <View key={handover.id} style={styles.historyRow}>
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>{handover.shiftLabel}</Text>
                <Text style={styles.historyMeta}>
                  {formatDateTime(handover.shiftStartedAt)} · signed by {handover.createdByName} ·{" "}
                  {handover.patientSummaries.length} patients
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={Boolean(pdfHandoverId)}
                  onPress={() => void printHandover(handover)}
                  style={[styles.outlineButton, Boolean(pdfHandoverId) && styles.disabledButton]}
                >
                  <Text style={styles.outlineButtonText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={Boolean(pdfHandoverId)}
                  onPress={() => void shareHandover(handover)}
                  style={[styles.primaryButton, Boolean(pdfHandoverId) && styles.disabledButton]}
                >
                  <Text style={styles.primaryButtonText}>Share / save PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function buildPatientSummary({
  cutoff,
  foodFluidEntries,
  incidents,
  medicationAdministrations,
  medicationPrescriptions,
  news2Readings,
  observations,
  patient,
  patientTasks,
  shiftStartsAt
}: {
  cutoff: number;
  foodFluidEntries: FoodFluidEntry[];
  incidents: SafetyIncident[];
  medicationAdministrations: MedicationAdministration[];
  medicationPrescriptions: MedicationPrescription[];
  news2Readings: News2Reading[];
  observations: Observation[];
  patient: Patient;
  patientTasks: PatientTask[];
  shiftStartsAt: number;
}): ShiftHandoverPatientSummary {
  const patientObservations = observations
    .filter(
      (observation) =>
        observation.patientId === patient.id &&
        observation.source === "General observations" &&
        isWithin(observation.observedAt, shiftStartsAt, cutoff)
    )
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  const locationCounts = countValues(patientObservations.map((observation) => observation.location));
  const presentationCounts = countValues(patientObservations.map((observation) => observation.presentation));
  const orderedLocations = Object.entries(locationCounts).sort((left, right) => right[1] - left[1]);
  const dominantLocation = orderedLocations[0];
  const movementSummary =
    patientObservations.length === 0
      ? "No general observation locations were recorded during this shift."
      : `${dominantLocation?.[1] ?? 0} of ${patientObservations.length} checks were recorded in ${lowerFirst(
          dominantLocation?.[0] ?? "an unknown location"
        )}${orderedLocations.length > 1 ? `; also ${orderedLocations.slice(1).map(([location, count]) => `${location} (${count})`).join(", ")}` : ""}.`;
  const awakeCount = presentationCounts.Awake ?? 0;
  const asleepCount = presentationCounts.Asleep ?? 0;
  const presentationSummary =
    patientObservations.length === 0
      ? "No presentation was recorded during this shift."
      : `Recorded awake at ${awakeCount} check${awakeCount === 1 ? "" : "s"} and asleep at ${asleepCount} check${
          asleepCount === 1 ? "" : "s"
        }.`;

  const nutrition = foodFluidEntries
    .filter((entry) => entry.patientId === patient.id && isWithin(entry.recordedAt, shiftStartsAt, cutoff))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const fluidTotal = nutrition.reduce((total, entry) => total + (entry.fluidTakenMl ?? 0), 0);
  const nutritionSummary =
    nutrition.length === 0
      ? "No food or fluid entries were recorded during this shift."
      : `${nutrition
          .map((entry) => `${entry.mealPeriod}: ${entry.itemDescription} (${lowerFirst(entry.intakeLevel)})`)
          .join("; ")}${fluidTotal > 0 ? `. Recorded fluid taken: ${fluidTotal} ml` : ""}.`;

  const patientNews2 = news2Readings
    .filter((reading) => reading.patientId === patient.id && isWithin(reading.recordedAt, shiftStartsAt, cutoff))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const latestNews2 = patientNews2[patientNews2.length - 1];
  const highestNews2 = patientNews2.reduce((highest, reading) => Math.max(highest, reading.totalScore), 0);
  const news2Summary = latestNews2
    ? `Latest NEWS2 ${latestNews2.totalScore} at ${formatTime(latestNews2.recordedAt)}; highest this shift ${highestNews2}.`
    : "No NEWS2 reading recorded during this shift.";

  const administrations = medicationAdministrations.filter(
    (administration) =>
      administration.patientId === patient.id && isWithin(administration.recordedAt, shiftStartsAt, cutoff)
  );
  const administrationCounts = countValues(administrations.map((administration) => administration.status));
  const medicationNames = Array.from(
    new Set(
      administrations
        .map(
          (administration) =>
            medicationPrescriptions.find((prescription) => prescription.id === administration.prescriptionId)?.drugName
        )
        .filter((name): name is string => Boolean(name))
    )
  );
  const medicationSummary =
    administrations.length === 0
      ? "No medication administrations were recorded during this shift."
      : `${administrationCounts.Given ?? 0} given, ${administrationCounts.Refused ?? 0} refused and ${
          administrationCounts.Omitted ?? 0
        } omitted${medicationNames.length > 0 ? `: ${medicationNames.join(", ")}` : ""}.`;

  const shiftIncidents = incidents.filter(
    (incident) =>
      incident.patientId === patient.id &&
      (isWithin(incident.reportedAt, shiftStartsAt, cutoff) || incident.status !== "resolved")
  );
  const incidentSummary =
    shiftIncidents.length === 0
      ? "No incidents recorded during this shift and no active incidents carried forward."
      : shiftIncidents
          .map(
            (incident) =>
              `${incident.severity.toUpperCase()} ${incident.title} (${incident.status.replace("_", " ")})`
          )
          .join("; ");
  const activeTasks = patientTasks
    .filter(
      (task) =>
        task.patientId === patient.id && (task.status === "open" || task.status === "accepted")
    )
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const taskSummary =
    activeTasks.length === 0
      ? "No outstanding patient tasks."
      : activeTasks
          .map((task) => {
            const overdue = new Date(task.dueAt).getTime() < cutoff;
            return `${task.priority.toUpperCase()} ${task.title} (${overdue ? "overdue" : `due ${formatDateTime(task.dueAt)}`})`;
          })
          .join("; ");
  const voiceCheckIns = (patient.patientVoiceCheckIns ?? [])
    .filter((checkIn) => isWithin(checkIn.submittedAt, shiftStartsAt, cutoff))
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
  const latestVoiceCheckIn = voiceCheckIns[voiceCheckIns.length - 1];
  const profileUpdatedThisShift =
    patient.patientVoiceProfile &&
    isWithin(patient.patientVoiceProfile.updatedAt, shiftStartsAt, cutoff);
  const patientVoiceSummary = latestVoiceCheckIn
    ? `${latestVoiceCheckIn.frequency} check-in rated overall ${latestVoiceCheckIn.overallRating}/5 and safety ${latestVoiceCheckIn.safetyRating}/5.${
        latestVoiceCheckIn.concerns
          ? ` Concern recorded: ${latestVoiceCheckIn.concerns}`
          : latestVoiceCheckIn.wouldChange
            ? ` Would change: ${latestVoiceCheckIn.wouldChange}`
            : ""
      }`
    : profileUpdatedThisShift
      ? `Patient priorities or special needs were updated with ${
          patient.patientVoiceProfile?.updatedWithPatient ? "the patient" : "staff"
        } during this shift.`
      : "No new patient feedback recorded during this shift.";

  const narrative = [
    movementSummary,
    presentationSummary,
    nutrition.length > 0 ? nutritionSummary : "",
    shiftIncidents.length > 0 ? incidentSummary : "",
    activeTasks.length > 0 ? `Outstanding actions: ${taskSummary}` : "",
    latestVoiceCheckIn || profileUpdatedThisShift ? `Patient voice: ${patientVoiceSummary}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.surname}`,
    roomNumber: patient.roomNumber,
    observationCount: patientObservations.length,
    movementSummary,
    presentationSummary,
    nutritionSummary,
    news2Summary,
    medicationSummary,
    incidentSummary,
    taskSummary,
    patientVoiceSummary,
    narrative,
    staffNotes: ""
  };
}

function buildOverallSummary({
  cutoff,
  incidents,
  missedObservations,
  patientSummaries,
  patientTasks,
  shiftStartsAt
}: {
  cutoff: number;
  incidents: SafetyIncident[];
  missedObservations: MissedObservation[];
  patientSummaries: ShiftHandoverPatientSummary[];
  patientTasks: PatientTask[];
  shiftStartsAt: number;
}) {
  const shiftIncidents = incidents.filter((incident) => isWithin(incident.reportedAt, shiftStartsAt, cutoff));
  const activeIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const shiftMissed = missedObservations.filter((missed) => isWithin(missed.recordedAt, shiftStartsAt, cutoff));
  const observations = patientSummaries.reduce((total, summary) => total + summary.observationCount, 0);
  const outstandingTasks = patientTasks.filter(
    (task) => task.status === "open" || task.status === "accepted"
  ).length;
  return `${patientSummaries.length} patients covered with ${observations} general observations recorded. ${
    shiftIncidents.length
  } incident${shiftIncidents.length === 1 ? "" : "s"} reported during the shift; ${
    activeIncidents.length
  } active incident${activeIncidents.length === 1 ? "" : "s"} require onward awareness. ${
    shiftMissed.length
  } missed observation${shiftMissed.length === 1 ? "" : "s"} recorded. ${outstandingTasks} patient task${
    outstandingTasks === 1 ? "" : "s"
  } remain outstanding.`;
}

function getCurrentShift(ward: Ward, nowValue: number) {
  const shifts = ward.rotaShifts.slice(0, ward.rotaShiftCount);
  const nowDate = new Date(nowValue);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  for (const [index, shift] of shifts.entries()) {
    const startMinutes = timeToMinutes(shift.startsAt);
    const endMinutes = timeToMinutes(shift.endsAt);
    const crossesMidnight = endMinutes <= startMinutes;
    const active = crossesMidnight
      ? nowMinutes >= startMinutes || nowMinutes < endMinutes
      : nowMinutes >= startMinutes && nowMinutes < endMinutes;
    if (!active) continue;
    const startDate = new Date(nowDate);
    startDate.setHours(0, 0, 0, 0);
    if (crossesMidnight && nowMinutes < endMinutes) startDate.setDate(startDate.getDate() - 1);
    const startsAt = startDate.getTime() + startMinutes * 60_000;
    const endsAt = startDate.getTime() + (crossesMidnight ? endMinutes + 1440 : endMinutes) * 60_000;
    return {
      endsAt,
      label: `Shift ${index + 1} · ${shift.startsAt}–${shift.endsAt}`,
      shiftId: shift.id,
      startsAt
    };
  }
  return undefined;
}

function timeToMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isWithin(value: string, startsAt: number, endsAt: number) {
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp >= startsAt && timestamp <= endsAt;
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function lowerFirst(value: string) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildHandoverHtml(handover: ShiftHandover, wardName: string) {
  const patientSections = handover.patientSummaries
    .map(
      (summary) => `
        <section>
          <h2>${escapeHtml(summary.patientName)} <small>Room ${summary.roomNumber}</small></h2>
          <p class="narrative">${escapeHtml(summary.narrative)}</p>
          ${htmlRow("Movement", summary.movementSummary)}
          ${htmlRow("Presentation", summary.presentationSummary)}
          ${htmlRow("Food & fluid", summary.nutritionSummary)}
          ${htmlRow("NEWS2", summary.news2Summary)}
          ${htmlRow("Medication", summary.medicationSummary)}
          ${htmlRow("Incidents", summary.incidentSummary)}
          ${htmlRow("Outstanding tasks", summary.taskSummary ?? "No outstanding patient tasks.")}
          ${htmlRow("Patient voice", summary.patientVoiceSummary ?? "No new patient feedback recorded during this shift.")}
          ${summary.staffNotes ? htmlRow("Staff handover notes", summary.staffNotes) : ""}
        </section>
      `
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#20343c;font-size:10.5pt;line-height:1.4}
    h1{font-size:22pt;margin:0 0 4px}h2{font-size:14pt;margin:0 0 8px}h2 small{font-size:9pt;color:#68777d}
    .eyebrow{color:#9b4337;font-size:9pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .meta,.footer{color:#69777d;font-size:9pt}.summary{background:#eef4f5;border:1px solid #cad9dd;padding:12px;margin:16px 0}
    section{border:1px solid #cad5d8;border-radius:6px;padding:12px;margin:0 0 12px;break-inside:avoid}
    .narrative{font-weight:700}.row{border-top:1px solid #e1e7e9;padding:7px 0}.label{font-weight:700;text-transform:uppercase;font-size:8pt;color:#5f7077}
  </style></head><body>
    <div class="eyebrow">Confidential clinical handover</div>
    <h1>${escapeHtml(wardName)} shift handover</h1>
    <div class="meta">${escapeHtml(handover.shiftLabel)} · Evidence ${escapeHtml(formatDateTime(handover.shiftStartedAt))} to ${escapeHtml(formatDateTime(handover.shiftEndedAt))}</div>
    <div class="summary"><strong>Ward summary</strong><br>${escapeHtml(handover.overallSummary)}</div>
    ${patientSections}
    <div class="footer">Signed ${escapeHtml(formatDateTime(handover.createdAt))} by ${escapeHtml(handover.createdByName)} (${escapeHtml(handover.createdByStaffCode)}). Generated summaries must be read with the underlying clinical record.</div>
  </body></html>`;
}

function htmlRow(label: string, value: string) {
  return `<div class="row"><div class="label">${escapeHtml(label)}</div><div>${escapeHtml(value)}</div></div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const styles = StyleSheet.create({
  screen: { alignSelf: "center", gap: 14, maxWidth: 1320, padding: 16, width: "100%" },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
  },
  eyebrow: { color: "#17677a", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#16282f", fontSize: 28, fontWeight: "900", marginTop: 3 },
  meta: { color: "#64747b", fontSize: 11, fontWeight: "700", marginTop: 4 },
  notice: { backgroundColor: "#fff8df", borderColor: "#e3cd89", borderRadius: 9, borderWidth: 1, padding: 13 },
  noticeTitle: { color: "#684c17", fontSize: 12, fontWeight: "900" },
  noticeText: { color: "#776331", fontSize: 10, lineHeight: 15, marginTop: 3 },
  summaryPanel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, padding: 16 },
  summaryHeading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  summaryCopy: { flex: 1, minWidth: 280 },
  sectionTitle: { color: "#1b3038", fontSize: 19, fontWeight: "900" },
  overallSummary: { color: "#344b54", fontSize: 12, lineHeight: 18, marginTop: 6 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  outlineButton: { borderColor: "#1c596a", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 12 },
  outlineButtonText: { color: "#1c596a", fontSize: 10, fontWeight: "900" },
  primaryButton: { backgroundColor: "#18596a", borderRadius: 7, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 },
  primaryButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  patientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  patientCard: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexBasis: "48%", flexGrow: 1, minWidth: 330, padding: 15 },
  patientHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  patientName: { color: "#17313a", fontSize: 18, fontWeight: "900" },
  patientMeta: { color: "#68787e", fontSize: 10, fontWeight: "800", marginTop: 3 },
  checkCount: { alignItems: "center", backgroundColor: "#eaf3f5", borderRadius: 8, minWidth: 62, padding: 7 },
  checkCountValue: { color: "#174f60", fontSize: 19, fontWeight: "900" },
  checkCountLabel: { color: "#60737a", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  narrative: { color: "#2c434c", fontSize: 11, fontWeight: "800", lineHeight: 17, marginVertical: 11 },
  summaryRow: { borderTopColor: "#e2e8ea", borderTopWidth: 1, paddingVertical: 8 },
  summaryLabel: { color: "#65767d", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  summaryValue: { color: "#334a53", fontSize: 10, lineHeight: 15, marginTop: 3 },
  fieldLabel: { color: "#405861", fontSize: 9, fontWeight: "900", marginTop: 8, textTransform: "uppercase" },
  notesInput: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#243940", fontSize: 11, marginTop: 5, minHeight: 76, padding: 9 },
  historyPanel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, gap: 9, padding: 16 },
  emptyPanel: { backgroundColor: "#f5f8f9", borderRadius: 8, padding: 14 },
  emptyTitle: { color: "#50646c", fontSize: 11, fontWeight: "800" },
  historyRow: { alignItems: "center", borderColor: "#dce4e6", borderRadius: 8, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between", padding: 12 },
  historyCopy: { flex: 1, minWidth: 240 },
  historyTitle: { color: "#203740", fontSize: 13, fontWeight: "900" },
  historyMeta: { color: "#68787f", fontSize: 9, fontWeight: "700", marginTop: 4 }
});
