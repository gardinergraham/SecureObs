import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type {
  FoodFluidEntry,
  MedicationAdministration,
  MedicationPrescription,
  News2Reading,
  Observation,
  Patient,
  PatientCarePlan,
  PatientNote,
  PatientTask,
  SafetyIncident,
  Ward
} from "../types/domain";

type PatientDashboardScreenProps = {
  carePlans: PatientCarePlan[];
  foodFluidEntries: FoodFluidEntry[];
  incidents: SafetyIncident[];
  medicationAdministrations: MedicationAdministration[];
  medicationPrescriptions: MedicationPrescription[];
  news2Readings: News2Reading[];
  notes: PatientNote[];
  observations: Observation[];
  patients: Patient[];
  patientTasks: PatientTask[];
  selectedPatientId: string;
  ward?: Ward;
  onBack: () => void;
  onSelectPatient: (patientId: string) => void;
};

type TimelineCategory = "all" | "observations" | "clinical" | "care" | "safety";
type TimelineRange = 7 | 30 | 0;
type TimelineTone = "blue" | "green" | "amber" | "red" | "slate";

type TimelineItem = {
  id: string;
  category: Exclude<TimelineCategory, "all">;
  occurredAt: string;
  title: string;
  detail: string;
  meta: string;
  tone: TimelineTone;
};

const timelineCategories: Array<{ id: TimelineCategory; label: string }> = [
  { id: "all", label: "All activity" },
  { id: "observations", label: "Observations" },
  { id: "clinical", label: "Physical health" },
  { id: "care", label: "Care & notes" },
  { id: "safety", label: "Safety" }
];

const timelineRanges: Array<{ days: TimelineRange; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "All" }
];

const sharedLocations = new Set(["Day room", "Dining room", "Corridor", "Laundry"]);

export function PatientDashboardScreen({
  carePlans,
  foodFluidEntries,
  incidents,
  medicationAdministrations,
  medicationPrescriptions,
  news2Readings,
  notes,
  observations,
  patients,
  patientTasks,
  selectedPatientId,
  ward,
  onBack,
  onSelectPatient
}: PatientDashboardScreenProps) {
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient =
    orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const [timelineCategory, setTimelineCategory] = useState<TimelineCategory>("all");
  const [timelineRange, setTimelineRange] = useState<TimelineRange>(7);

  const patientRecords = useMemo(() => {
    if (!selectedPatient) return undefined;
    const patientId = selectedPatient.id;
    const patientPrescriptions = medicationPrescriptions.filter(
      (prescription) => prescription.patientId === patientId
    );
    const prescriptionIds = new Set(patientPrescriptions.map((prescription) => prescription.id));

    return {
      carePlans: carePlans
        .filter((plan) => plan.patientId === patientId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      foodFluidEntries: foodFluidEntries
        .filter((entry) => entry.patientId === patientId)
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
      incidents: incidents
        .filter((incident) => incident.patientId === patientId)
        .sort((left, right) => right.reportedAt.localeCompare(left.reportedAt)),
      medicationAdministrations: medicationAdministrations
        .filter(
          (administration) =>
            administration.patientId === patientId || prescriptionIds.has(administration.prescriptionId)
        )
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
      medicationPrescriptions: patientPrescriptions,
      news2Readings: news2Readings
        .filter((reading) => reading.patientId === patientId)
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
      notes: notes
        .filter((note) => note.patientId === patientId)
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
      observations: observations
        .filter((observation) => observation.patientId === patientId)
        .sort((left, right) => right.observedAt.localeCompare(left.observedAt)),
      tasks: patientTasks
        .filter((task) => task.patientId === patientId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    };
  }, [
    carePlans,
    foodFluidEntries,
    incidents,
    medicationAdministrations,
    medicationPrescriptions,
    news2Readings,
    notes,
    observations,
    patientTasks,
    selectedPatient
  ]);

  const dashboard = useMemo(
    () =>
      selectedPatient && patientRecords
        ? buildDashboardSummary(selectedPatient, patientRecords)
        : undefined,
    [patientRecords, selectedPatient]
  );

  const timelineItems = useMemo(() => {
    if (!patientRecords) return [];
    const prescriptionNames = new Map(
      patientRecords.medicationPrescriptions.map((prescription) => [
        prescription.id,
        prescription.drugName
      ])
    );
    const cutoff =
      timelineRange === 0 ? Number.NEGATIVE_INFINITY : startOfDayOffset(-timelineRange + 1).getTime();

    return buildTimeline(patientRecords, prescriptionNames)
      .filter((item) => timelineCategory === "all" || item.category === timelineCategory)
      .filter((item) => safeDateTime(item.occurredAt) >= cutoff)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 100);
  }, [patientRecords, timelineCategory, timelineRange]);

  if (!selectedPatient || !patientRecords || !dashboard) {
    return (
      <View style={styles.screen}>
        <ScreenHeader onBack={onBack} wardName={ward?.name} />
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No patients available</Text>
          <Text style={styles.emptyText}>Add a patient to this ward to begin their dashboard.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader onBack={onBack} wardName={ward?.name} />

      <View style={styles.workspace}>
        <View style={styles.patientRail}>
          <Text style={styles.railTitle}>Patients</Text>
          <Text style={styles.railMeta}>Choose a patient to review their progress.</Text>
          {orderedPatients.map((patient) => {
            const selected = patient.id === selectedPatient.id;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={patient.id}
                onPress={() => onSelectPatient(patient.id)}
                style={[styles.patientButton, selected && styles.patientButtonActive]}
              >
                <Text style={[styles.patientButtonName, selected && styles.patientButtonNameActive]}>
                  Room {patient.roomNumber} · {patient.firstName} {patient.surname}
                </Text>
                <Text style={styles.patientButtonMeta}>
                  {patient.hospitalNumber} · {patient.observationLevel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dashboard}>
          <View style={styles.patientHero}>
            <View style={styles.patientIdentity}>
              <Text style={styles.patientName}>
                {selectedPatient.firstName} {selectedPatient.surname}
              </Text>
              <Text style={styles.patientMeta}>
                Room {selectedPatient.roomNumber} · {selectedPatient.hospitalNumber} ·{" "}
                {selectedPatient.onOffWard}
              </Text>
            </View>
            <View style={styles.heroPills}>
              <StatusPill label={selectedPatient.observationLevel} tone="blue" />
              <StatusPill
                label={
                  dashboard.activeIncidents === 0
                    ? "No active incidents"
                    : `${dashboard.activeIncidents} active incident${dashboard.activeIncidents === 1 ? "" : "s"}`
                }
                tone={dashboard.redIncidents > 0 ? "red" : dashboard.activeIncidents > 0 ? "amber" : "green"}
              />
            </View>
          </View>

          <View style={styles.safetyStrip}>
            <SafetyFact
              label="Allergies"
              value={selectedPatient.allergies?.trim() || "None recorded"}
              warning={Boolean(selectedPatient.allergies?.trim())}
            />
            <SafetyFact
              label="Adverse drug reactions"
              value={selectedPatient.adverseDrugReactions?.trim() || "None recorded"}
              warning={Boolean(selectedPatient.adverseDrugReactions?.trim())}
            />
            <SafetyFact label="Current location" value={selectedPatient.latestObservationPlace} />
            <SafetyFact
              label="Latest presentation"
              value={`${selectedPatient.latestPresentation} · ${formatRelativeTime(
                selectedPatient.latestObservationTime
              )}`}
            />
          </View>

          <View style={styles.snapshotGrid}>
            <SnapshotMetric
              label="Latest NEWS2"
              value={dashboard.latestNews2?.totalScore.toString() ?? "—"}
              detail={
                dashboard.latestNews2
                  ? formatDateTime(dashboard.latestNews2.recordedAt)
                  : "No reading recorded"
              }
              tone={news2Tone(dashboard.latestNews2?.totalScore)}
            />
            <SnapshotMetric
              label="Fluid recorded today"
              value={`${dashboard.fluidToday} ml`}
              detail={`${dashboard.foodFluidToday} food/fluid entries`}
              tone="blue"
            />
            <SnapshotMetric
              label="Medication records · 7d"
              value={`${dashboard.medicationGiven}/${dashboard.medicationRecorded}`}
              detail={
                dashboard.medicationRecorded === 0
                  ? "No administrations recorded"
                  : "Recorded as given"
              }
              tone={
                dashboard.medicationRecorded > 0 &&
                dashboard.medicationGiven < dashboard.medicationRecorded
                  ? "amber"
                  : "green"
              }
            />
            <SnapshotMetric
              label="Tasks needing action"
              value={dashboard.openTasks.toString()}
              detail={`${dashboard.overdueTasks} overdue`}
              tone={dashboard.overdueTasks > 0 ? "red" : dashboard.openTasks > 0 ? "amber" : "green"}
            />
          </View>

          <View style={styles.progressGrid}>
            <View style={styles.progressPanel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelEyebrow}>Physical health</Text>
                  <Text style={styles.panelTitle}>NEWS2 pattern · 7 days</Text>
                </View>
                <StatusPill
                  label={
                    dashboard.latestNews2
                      ? `Latest ${dashboard.latestNews2.totalScore}`
                      : "No readings"
                  }
                  tone={news2Tone(dashboard.latestNews2?.totalScore)}
                />
              </View>
              <SevenDayChart
                emptyLabel="No NEWS2 readings in this period"
                maxValue={Math.max(7, ...dashboard.news2Pattern.map((item) => item.value ?? 0))}
                series={dashboard.news2Pattern}
                tone="blue"
              />
              <Text style={styles.panelFootnote}>
                Displays the latest NEWS2 score recorded on each day. Review the chart alongside the
                underlying observations and clinical judgement.
              </Text>
            </View>

            <View style={styles.progressPanel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelEyebrow}>Mental wellbeing & daily living</Text>
                  <Text style={styles.panelTitle}>Observed awake pattern · 7 days</Text>
                </View>
                <StatusPill
                  label={`${dashboard.awakePercent}% awake`}
                  tone={dashboard.observationCount7Days > 0 ? "green" : "slate"}
                />
              </View>
              <SevenDayChart
                emptyLabel="No observation pattern available"
                maxValue={100}
                series={dashboard.awakePattern}
                suffix="%"
                tone="green"
              />
              <View style={styles.patternFacts}>
                <PatternFact
                  label="Shared areas"
                  value={`${dashboard.sharedAreaPercent}% of observations`}
                />
                <PatternFact
                  label="Most recorded location"
                  value={dashboard.mostCommonLocation || "No observations"}
                />
                <PatternFact
                  label="Observations reviewed"
                  value={dashboard.observationCount7Days.toString()}
                />
              </View>
              <Text style={styles.panelFootnote}>
                These are recorded activity and location patterns—not a mental-health score. Staff
                notes, patient views and clinical review remain essential.
              </Text>
            </View>
          </View>

          <View style={styles.careGrid}>
            <CareHighlight
              eyebrow="Latest patient note"
              empty="No patient notes recorded"
              meta={
                dashboard.latestNote
                  ? `${dashboard.latestNote.recordedByName} · ${formatDateTime(
                      dashboard.latestNote.recordedAt
                    )}`
                  : undefined
              }
              text={dashboard.latestNote?.body}
            />
            <CareHighlight
              eyebrow="Current care-plan picture"
              empty="No general care plan recorded"
              meta={
                dashboard.latestCarePlan
                  ? `Review ${formatDate(dashboard.latestCarePlan.reviewDate)} · ${
                      dashboard.latestCarePlan.createdByName
                    }`
                  : undefined
              }
              text={
                dashboard.latestCarePlan
                  ? `${dashboard.latestCarePlan.title}\n${dashboard.latestCarePlan.goals}`
                  : undefined
              }
            />
          </View>

          <View style={styles.timelinePanel}>
            <View style={styles.timelineHeader}>
              <View>
                <Text style={styles.panelEyebrow}>Whole patient record</Text>
                <Text style={styles.timelineTitle}>Patient timeline</Text>
                <Text style={styles.timelineSubtitle}>
                  Observations, physical health, care, medication and safety events together.
                </Text>
              </View>
              <Text style={styles.timelineCount}>{timelineItems.length} shown</Text>
            </View>

            <View style={styles.filterBlock}>
              <View style={styles.filterRow}>
                {timelineCategories.map((category) => (
                  <FilterButton
                    active={timelineCategory === category.id}
                    key={category.id}
                    label={category.label}
                    onPress={() => setTimelineCategory(category.id)}
                  />
                ))}
              </View>
              <View style={styles.filterRow}>
                {timelineRanges.map((range) => (
                  <FilterButton
                    active={timelineRange === range.days}
                    key={range.label}
                    label={range.label}
                    onPress={() => setTimelineRange(range.days)}
                    small
                  />
                ))}
              </View>
            </View>

            {timelineItems.length === 0 ? (
              <View style={styles.timelineEmpty}>
                <Text style={styles.emptyTitle}>No matching timeline records</Text>
                <Text style={styles.emptyText}>Try a longer period or another record type.</Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {timelineItems.map((item, index) => (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineMarkerColumn}>
                      <View style={[styles.timelineDot, timelineToneStyle(item.tone)]} />
                      {index < timelineItems.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineItemHeader}>
                        <View style={styles.timelineItemTitleWrap}>
                          <Text style={styles.timelineItemTitle}>{item.title}</Text>
                          <Text style={styles.timelineItemMeta}>{item.meta}</Text>
                        </View>
                        <Text style={styles.timelineDate}>{formatDateTime(item.occurredAt)}</Text>
                      </View>
                      <Text style={styles.timelineDetail}>{item.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function ScreenHeader({
  onBack,
  wardName
}: {
  onBack: () => void;
  wardName?: string;
}) {
  return (
    <View style={styles.screenHeader}>
      <View>
        <Text style={styles.screenEyebrow}>Patient progress</Text>
        <Text style={styles.screenTitle}>Patient dashboard & timeline</Text>
        <Text style={styles.screenMeta}>
          {wardName ?? "Ward"} · A joined-up view of physical health, wellbeing and care
        </Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function SnapshotMetric({
  detail,
  label,
  tone,
  value
}: {
  detail: string;
  label: string;
  tone: TimelineTone;
  value: string;
}) {
  return (
    <View style={[styles.snapshotMetric, metricToneStyle(tone)]}>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={styles.snapshotValue}>{value}</Text>
      <Text style={styles.snapshotDetail}>{detail}</Text>
    </View>
  );
}

function SafetyFact({
  label,
  value,
  warning = false
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <View style={[styles.safetyFact, warning && styles.safetyFactWarning]}>
      <Text style={styles.safetyLabel}>{label}</Text>
      <Text style={[styles.safetyValue, warning && styles.safetyValueWarning]}>{value}</Text>
    </View>
  );
}

function PatternFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.patternFact}>
      <Text style={styles.patternFactLabel}>{label}</Text>
      <Text style={styles.patternFactValue}>{value}</Text>
    </View>
  );
}

function CareHighlight({
  empty,
  eyebrow,
  meta,
  text
}: {
  empty: string;
  eyebrow: string;
  meta?: string;
  text?: string;
}) {
  return (
    <View style={styles.careHighlight}>
      <Text style={styles.panelEyebrow}>{eyebrow}</Text>
      <Text style={text ? styles.careText : styles.emptyText} numberOfLines={5}>
        {text || empty}
      </Text>
      {meta ? <Text style={styles.careMeta}>{meta}</Text> : null}
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: TimelineTone }) {
  return (
    <View style={[styles.statusPill, statusToneStyle(tone)]}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

function FilterButton({
  active,
  label,
  onPress,
  small = false
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.filterButton,
        small && styles.filterButtonSmall,
        active && styles.filterButtonActive
      ]}
    >
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SevenDayChart({
  emptyLabel,
  maxValue,
  series,
  suffix = "",
  tone
}: {
  emptyLabel: string;
  maxValue: number;
  series: Array<{ dateKey: string; label: string; value: number | null }>;
  suffix?: string;
  tone: "blue" | "green";
}) {
  const hasData = series.some((item) => item.value !== null);
  if (!hasData) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.chart}>
      {series.map((item) => {
        const value = item.value;
        const height = value === null ? 2 : Math.max(5, (value / Math.max(maxValue, 1)) * 76);
        return (
          <View key={item.dateKey} style={styles.chartColumn}>
            <Text style={styles.chartValue}>{value === null ? "—" : `${value}${suffix}`}</Text>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartBar,
                  tone === "green" ? styles.chartBarGreen : styles.chartBarBlue,
                  { height },
                  value === null && styles.chartBarEmpty
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

type PatientRecordSet = {
  carePlans: PatientCarePlan[];
  foodFluidEntries: FoodFluidEntry[];
  incidents: SafetyIncident[];
  medicationAdministrations: MedicationAdministration[];
  medicationPrescriptions: MedicationPrescription[];
  news2Readings: News2Reading[];
  notes: PatientNote[];
  observations: Observation[];
  tasks: PatientTask[];
};

function buildDashboardSummary(patient: Patient, records: PatientRecordSet) {
  const sevenDayCutoff = startOfDayOffset(-6).getTime();
  const todayKey = localDateKey(new Date());
  const observations7Days = records.observations.filter(
    (observation) => safeDateTime(observation.observedAt) >= sevenDayCutoff
  );
  const awakeObservations = observations7Days.filter(
    (observation) => observation.presentation === "Awake"
  );
  const sharedAreaObservations = observations7Days.filter((observation) =>
    sharedLocations.has(observation.location)
  );
  const locationCounts = observations7Days.reduce<Map<string, number>>((counts, observation) => {
    counts.set(observation.location, (counts.get(observation.location) ?? 0) + 1);
    return counts;
  }, new Map());
  const mostCommonLocation =
    [...locationCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
  const medication7Days = records.medicationAdministrations.filter(
    (administration) => safeDateTime(administration.recordedAt) >= sevenDayCutoff
  );
  const foodFluidToday = records.foodFluidEntries.filter(
    (entry) => localDateKey(new Date(entry.recordedAt)) === todayKey
  );
  const activeIncidents = records.incidents.filter((incident) => incident.status !== "resolved");
  const activeTasks = records.tasks.filter(
    (task) => task.status === "open" || task.status === "accepted"
  );

  return {
    activeIncidents: activeIncidents.length,
    awakePattern: buildDailyPattern((dateKey) => {
      const daily = observations7Days.filter(
        (observation) => localDateKey(new Date(observation.observedAt)) === dateKey
      );
      if (daily.length === 0) return null;
      return Math.round(
        (daily.filter((observation) => observation.presentation === "Awake").length / daily.length) *
          100
      );
    }),
    awakePercent: percent(awakeObservations.length, observations7Days.length),
    fluidToday: foodFluidToday.reduce((total, entry) => total + (entry.fluidTakenMl ?? 0), 0),
    foodFluidToday: foodFluidToday.length,
    latestCarePlan: records.carePlans[0],
    latestNews2: records.news2Readings[0],
    latestNote: records.notes[0],
    medicationGiven: medication7Days.filter(
      (administration) => administration.status === "Given"
    ).length,
    medicationRecorded: medication7Days.length,
    mostCommonLocation,
    news2Pattern: buildDailyPattern((dateKey) => {
      const reading = records.news2Readings.find(
        (item) => localDateKey(new Date(item.recordedAt)) === dateKey
      );
      return reading?.totalScore ?? null;
    }),
    observationCount7Days: observations7Days.length,
    openTasks: activeTasks.length,
    overdueTasks: activeTasks.filter((task) => safeDateTime(task.dueAt) < Date.now()).length,
    redIncidents: activeIncidents.filter((incident) => incident.severity === "red").length,
    sharedAreaPercent: percent(sharedAreaObservations.length, observations7Days.length),
    patient
  };
}

function buildDailyPattern(getValue: (dateKey: string) => number | null) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = startOfDayOffset(index - 6);
    const dateKey = localDateKey(date);
    return {
      dateKey,
      label: date.toLocaleDateString([], { weekday: "short" }).slice(0, 2),
      value: getValue(dateKey)
    };
  });
}

function buildTimeline(
  records: PatientRecordSet,
  prescriptionNames: Map<string, string>
): TimelineItem[] {
  const items: TimelineItem[] = [];

  records.observations.forEach((observation) => {
    items.push({
      id: `observation-${observation.id}`,
      category: "observations",
      occurredAt: observation.observedAt,
      title: `${observation.presentation} · ${observation.location}`,
      detail: observation.comments.trim() || `${observation.type} observation recorded.`,
      meta: `${observation.source} · ${observation.observerName}`,
      tone: observation.source === "Enhanced/TESO" ? "amber" : "blue"
    });
  });

  records.news2Readings.forEach((reading) => {
    items.push({
      id: `news2-${reading.id}`,
      category: "clinical",
      occurredAt: reading.recordedAt,
      title: `NEWS2 score ${reading.totalScore}`,
      detail: `Resp ${reading.respirationRate} · SpO₂ ${reading.spo2}% · BP ${reading.systolicBp} · pulse ${reading.pulse} · temperature ${reading.temperature}°C`,
      meta: `Physical health · ${reading.recordedBy}`,
      tone: news2Tone(reading.totalScore)
    });
  });

  records.foodFluidEntries.forEach((entry) => {
    items.push({
      id: `food-fluid-${entry.id}`,
      category: "clinical",
      occurredAt: entry.recordedAt,
      title: `${entry.mealPeriod} · ${entry.itemDescription}`,
      detail: `${entry.intakeLevel}${entry.fluidTakenMl !== undefined ? ` · ${entry.fluidTakenMl} ml taken` : ""}${entry.comments ? ` · ${entry.comments}` : ""}`,
      meta: `Food & fluid · ${entry.recordedBy}`,
      tone:
        entry.intakeLevel === "Refused" || entry.intakeLevel === "Less than half"
          ? "amber"
          : "green"
    });
  });

  records.medicationAdministrations.forEach((administration) => {
    items.push({
      id: `medication-${administration.id}`,
      category: "clinical",
      occurredAt: administration.recordedAt,
      title: `${prescriptionNames.get(administration.prescriptionId) ?? "Medication"} · ${
        administration.status
      }`,
      detail:
        administration.notes.trim() ||
        `Scheduled ${formatDateTime(administration.scheduledAt)}${
          administration.omissionCode ? ` · code ${administration.omissionCode}` : ""
        }`,
      meta: `Medication · ${administration.recordedBy}`,
      tone: administration.status === "Given" ? "green" : "amber"
    });
  });

  records.notes.forEach((note) => {
    items.push({
      id: `note-${note.id}`,
      category: "care",
      occurredAt: note.recordedAt,
      title: "Patient note added",
      detail: note.body,
      meta: `Patient notes · ${note.recordedByName}`,
      tone: "slate"
    });
  });

  records.carePlans.forEach((plan) => {
    items.push({
      id: `care-plan-${plan.id}`,
      category: "care",
      occurredAt: plan.createdAt,
      title: `Care plan · ${plan.title}`,
      detail: `Goals: ${plan.goals}`,
      meta: `Review ${formatDate(plan.reviewDate)} · ${plan.createdByName}`,
      tone: "blue"
    });
  });

  records.tasks.forEach((task) => {
    items.push({
      id: `task-${task.id}`,
      category: "care",
      occurredAt: task.completedAt ?? task.createdAt,
      title: `${task.status === "completed" ? "Task completed" : "Patient task"} · ${task.title}`,
      detail: task.completionNotes?.trim() || task.details || `Due ${formatDateTime(task.dueAt)}`,
      meta: `${task.category} · ${task.completedByName ?? task.createdByName}`,
      tone:
        task.status === "completed"
          ? "green"
          : task.priority === "red"
            ? "red"
            : task.priority === "amber"
              ? "amber"
              : "slate"
    });
  });

  records.incidents.forEach((incident) => {
    items.push({
      id: `incident-${incident.id}`,
      category: "safety",
      occurredAt: incident.resolvedAt ?? incident.reportedAt,
      title: `${incident.status === "resolved" ? "Incident resolved" : "Safety incident"} · ${
        incident.title
      }`,
      detail:
        incident.status === "resolved" && incident.resolutionNotes
          ? incident.resolutionNotes
          : incident.details,
      meta: `${incident.category} · ${incident.reportedByName}`,
      tone: incident.status === "resolved" ? "green" : incident.severity
    });
  });

  return items;
}

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function safeDateTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function startOfDayOffset(dayOffset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function localDateKey(date: Date) {
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })
    : "Not set";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Time unavailable";
}

function formatRelativeTime(value: string) {
  const time = safeDateTime(value);
  if (!time) return "time unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function news2Tone(score?: number): TimelineTone {
  if (score === undefined) return "slate";
  if (score >= 7) return "red";
  if (score >= 5) return "amber";
  return "green";
}

function metricToneStyle(tone: TimelineTone) {
  if (tone === "red") return styles.metricRed;
  if (tone === "amber") return styles.metricAmber;
  if (tone === "green") return styles.metricGreen;
  if (tone === "blue") return styles.metricBlue;
  return styles.metricSlate;
}

function statusToneStyle(tone: TimelineTone) {
  if (tone === "red") return styles.statusRed;
  if (tone === "amber") return styles.statusAmber;
  if (tone === "green") return styles.statusGreen;
  if (tone === "blue") return styles.statusBlue;
  return styles.statusSlate;
}

function timelineToneStyle(tone: TimelineTone) {
  if (tone === "red") return styles.dotRed;
  if (tone === "amber") return styles.dotAmber;
  if (tone === "green") return styles.dotGreen;
  if (tone === "blue") return styles.dotBlue;
  return styles.dotSlate;
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 1280,
    padding: 16,
    width: "100%"
  },
  screenHeader: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
  },
  screenEyebrow: {
    color: "#17677a",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  screenTitle: { color: "#17272e", fontSize: 27, fontWeight: "900", marginTop: 3 },
  screenMeta: { color: "#61727a", fontSize: 12, fontWeight: "700", marginTop: 4 },
  backButton: {
    borderColor: "#1d5262",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 18
  },
  backButtonText: { color: "#1d5262", fontSize: 13, fontWeight: "900" },
  workspace: { alignItems: "flex-start", flexDirection: "row", gap: 14 },
  patientRail: {
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    minWidth: 235,
    padding: 14,
    width: "24%"
  },
  railTitle: { color: "#17272e", fontSize: 19, fontWeight: "900" },
  railMeta: { color: "#687980", fontSize: 11, lineHeight: 16, marginBottom: 3 },
  patientButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e1e4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 11
  },
  patientButtonActive: { backgroundColor: "#e8f2f4", borderColor: "#1d6678" },
  patientButtonName: { color: "#253940", fontSize: 12, fontWeight: "900" },
  patientButtonNameActive: { color: "#174f60" },
  patientButtonMeta: { color: "#6a7980", fontSize: 9, fontWeight: "700", marginTop: 4 },
  dashboard: { flex: 1, gap: 12, minWidth: 0 },
  patientHero: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 17
  },
  patientIdentity: { flex: 1, paddingRight: 12 },
  patientName: { color: "#17272e", fontSize: 27, fontWeight: "900" },
  patientMeta: { color: "#63747b", fontSize: 12, fontWeight: "800", marginTop: 4 },
  heroPills: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: 7 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusPillText: { color: "#263c44", fontSize: 10, fontWeight: "900" },
  statusBlue: { backgroundColor: "#dceff4" },
  statusGreen: { backgroundColor: "#dff2e8" },
  statusAmber: { backgroundColor: "#fff0c7" },
  statusRed: { backgroundColor: "#f7cbc4" },
  statusSlate: { backgroundColor: "#e8eef0" },
  safetyStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  safetyFact: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e1e4",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "23%",
    flexGrow: 1,
    minWidth: 170,
    padding: 10
  },
  safetyFactWarning: { backgroundColor: "#fff4ee", borderColor: "#e8bbaa" },
  safetyLabel: {
    color: "#6b7b82",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  safetyValue: { color: "#263a42", fontSize: 11, fontWeight: "900", marginTop: 4 },
  safetyValueWarning: { color: "#8b3d31" },
  snapshotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  snapshotMetric: {
    borderRadius: 9,
    borderWidth: 1,
    flexBasis: "22%",
    flexGrow: 1,
    minWidth: 160,
    padding: 13
  },
  metricBlue: { backgroundColor: "#ecf6f8", borderColor: "#c2dce2" },
  metricGreen: { backgroundColor: "#edf8f2", borderColor: "#c4dfd0" },
  metricAmber: { backgroundColor: "#fff7df", borderColor: "#e6d298" },
  metricRed: { backgroundColor: "#fff0ed", borderColor: "#e6b2a8" },
  metricSlate: { backgroundColor: "#f4f7f8", borderColor: "#d8e1e4" },
  snapshotLabel: {
    color: "#66767d",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  snapshotValue: { color: "#193741", fontSize: 24, fontWeight: "900", marginTop: 4 },
  snapshotDetail: { color: "#68787f", fontSize: 9, fontWeight: "700", marginTop: 3 },
  progressGrid: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  progressPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 330,
    padding: 15
  },
  panelHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  panelEyebrow: {
    color: "#17677a",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  panelTitle: { color: "#1d3037", fontSize: 17, fontWeight: "900", marginTop: 3 },
  panelFootnote: { color: "#708087", fontSize: 9, lineHeight: 14, marginTop: 12 },
  chart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 5,
    height: 120,
    justifyContent: "space-between"
  },
  chartColumn: { alignItems: "center", flex: 1 },
  chartValue: { color: "#53666e", fontSize: 8, fontWeight: "900", height: 15 },
  chartTrack: {
    alignItems: "center",
    backgroundColor: "#f0f4f5",
    borderRadius: 4,
    height: 80,
    justifyContent: "flex-end",
    maxWidth: 38,
    overflow: "hidden",
    width: "74%"
  },
  chartBar: { borderRadius: 3, width: "100%" },
  chartBarBlue: { backgroundColor: "#277d90" },
  chartBarGreen: { backgroundColor: "#3b8b68" },
  chartBarEmpty: { backgroundColor: "#d8e1e4" },
  chartLabel: { color: "#6e7d83", fontSize: 8, fontWeight: "800", marginTop: 4 },
  chartEmpty: {
    alignItems: "center",
    backgroundColor: "#f5f8f9",
    borderRadius: 7,
    height: 120,
    justifyContent: "center"
  },
  patternFacts: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  patternFact: {
    backgroundColor: "#f4f8f9",
    borderRadius: 6,
    flexGrow: 1,
    minWidth: 110,
    padding: 8
  },
  patternFactLabel: { color: "#6c7c82", fontSize: 8, fontWeight: "900" },
  patternFactValue: { color: "#20373f", fontSize: 10, fontWeight: "900", marginTop: 3 },
  careGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  careHighlight: {
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 300,
    padding: 15
  },
  careText: { color: "#2d4149", fontSize: 11, lineHeight: 17, marginTop: 8 },
  careMeta: { color: "#6c7c82", fontSize: 9, fontWeight: "800", marginTop: 10 },
  timelinePanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    padding: 16
  },
  timelineHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  timelineTitle: { color: "#1b2d34", fontSize: 21, fontWeight: "900", marginTop: 3 },
  timelineSubtitle: { color: "#6b7b82", fontSize: 10, marginTop: 4 },
  timelineCount: {
    backgroundColor: "#e8f1f3",
    borderRadius: 999,
    color: "#255666",
    fontSize: 9,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  filterBlock: {
    borderBottomColor: "#e0e7e9",
    borderBottomWidth: 1,
    gap: 7,
    marginTop: 14,
    paddingBottom: 12
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterButton: {
    borderColor: "#cfdbde",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  filterButtonSmall: { minHeight: 29, paddingHorizontal: 9 },
  filterButtonActive: { backgroundColor: "#195d70", borderColor: "#195d70" },
  filterButtonText: { color: "#3c555e", fontSize: 9, fontWeight: "900" },
  filterButtonTextActive: { color: "#ffffff" },
  timelineList: { marginTop: 12 },
  timelineRow: { alignItems: "stretch", flexDirection: "row" },
  timelineMarkerColumn: { alignItems: "center", width: 28 },
  timelineDot: { borderRadius: 999, height: 12, marginTop: 16, width: 12 },
  dotBlue: { backgroundColor: "#277d90" },
  dotGreen: { backgroundColor: "#39845f" },
  dotAmber: { backgroundColor: "#dda529" },
  dotRed: { backgroundColor: "#c94338" },
  dotSlate: { backgroundColor: "#73858c" },
  timelineLine: { backgroundColor: "#d7e1e4", flex: 1, marginVertical: 3, width: 2 },
  timelineContent: {
    borderBottomColor: "#e4eaec",
    borderBottomWidth: 1,
    flex: 1,
    paddingBottom: 13,
    paddingLeft: 5,
    paddingTop: 12
  },
  timelineItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  timelineItemTitleWrap: { flex: 1, paddingRight: 12 },
  timelineItemTitle: { color: "#233940", fontSize: 12, fontWeight: "900" },
  timelineItemMeta: { color: "#6b7b82", fontSize: 8, fontWeight: "800", marginTop: 3 },
  timelineDate: { color: "#596c73", fontSize: 8, fontWeight: "900" },
  timelineDetail: { color: "#455961", fontSize: 10, lineHeight: 15, marginTop: 8 },
  timelineEmpty: { alignItems: "center", padding: 28 },
  emptyPanel: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d7e1e4",
    borderRadius: 10,
    borderWidth: 1,
    padding: 32
  },
  emptyTitle: { color: "#263a42", fontSize: 15, fontWeight: "900" },
  emptyText: { color: "#6d7d83", fontSize: 10, marginTop: 5 }
});
