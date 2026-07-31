import React, { useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { FeatureAvailabilityNotice } from "../components/FeatureAvailabilityNotice";
import { SecureDateTimeField } from "../components/SecureDateTimeField";
import type {
  FoodFluidEntry,
  MedicationAdministration,
  MedicationPrescription,
  MissedObservation,
  News2Reading,
  Observation,
  Patient,
  PatientCarePlan,
  PatientTask,
  SafetyIncident,
  SecurityArea,
  SecurityCheck,
  ShiftHandover,
  StaffMember,
  StaffShiftAssignment,
  Ward
} from "../types/domain";

type AnalyticsTab = "overview" | "patients" | "safety" | "workforce";
type DatePreset = "today" | "7d" | "30d" | "custom";
type Tone = "neutral" | "green" | "amber" | "red";

type AnalyticsDashboardScreenProps = {
  carePlans: PatientCarePlan[];
  foodFluidEntries: FoodFluidEntry[];
  handovers: ShiftHandover[];
  incidents: SafetyIncident[];
  medicationAdministrations: MedicationAdministration[];
  medicationPrescriptions: MedicationPrescription[];
  missedObservations: MissedObservation[];
  news2Readings: News2Reading[];
  observations: Observation[];
  patientTasks: PatientTask[];
  patients: Patient[];
  securityChecks: SecurityCheck[];
  securityAreas: SecurityArea[];
  staff: StaffMember[];
  staffShiftAssignments: StaffShiftAssignment[];
  ward?: Ward;
  onBack: () => void;
};

export function AnalyticsDashboardScreen({
  carePlans,
  foodFluidEntries,
  handovers,
  incidents,
  medicationAdministrations,
  medicationPrescriptions,
  missedObservations,
  news2Readings,
  observations,
  patientTasks,
  patients,
  securityChecks,
  securityAreas,
  staff,
  staffShiftAssignments,
  ward,
  onBack
}: AnalyticsDashboardScreenProps) {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customStart, setCustomStart] = useState(formatDateInput(new Date(Date.now() - 6 * 86_400_000)));
  const [customEnd, setCustomEnd] = useState(formatDateInput(new Date()));
  const [selectedPatientId, setSelectedPatientId] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const range = useMemo(
    () => getDateRange(preset, customStart, customEnd),
    [customEnd, customStart, preset]
  );
  const analytics = useMemo(
    () =>
      buildAnalytics({
        carePlans,
        end: range.end,
        foodFluidEntries,
        handovers,
        incidents,
        medicationAdministrations,
        medicationPrescriptions,
        missedObservations,
        news2Readings,
        observations,
        patientTasks,
        patients,
        securityChecks,
        securityAreas,
        selectedPatientId,
        staff,
        staffShiftAssignments,
        start: range.start,
        ward
      }),
    [
      carePlans,
      foodFluidEntries,
      handovers,
      incidents,
      medicationAdministrations,
      medicationPrescriptions,
      missedObservations,
      news2Readings,
      observations,
      patientTasks,
      patients,
      range.end,
      range.start,
      securityChecks,
      securityAreas,
      selectedPatientId,
      staff,
      staffShiftAssignments,
      ward
    ]
  );

  const exportPdf = async () => {
    setIsExporting(true);
    try {
      await Print.printAsync({
        html: buildAnalyticsHtml({
          analytics,
          end: range.end,
          patientName:
            selectedPatientId === "all"
              ? "All patients"
              : patientName(patients.find((patient) => patient.id === selectedPatientId)),
          start: range.start,
          wardName: ward?.name ?? "Ward"
        })
      });
    } catch (error) {
      Alert.alert("Unable to create report", error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportCsv = async () => {
    setIsExporting(true);
    try {
      const csv = buildAnalyticsCsv(analytics, patients, medicationPrescriptions);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `SecureObs-analytics-${formatFileDate(new Date())}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (!FileSystem.cacheDirectory) {
        Alert.alert("CSV unavailable", "File storage is not available on this device.");
        return;
      }
      const path = `${FileSystem.cacheDirectory}SecureObs-analytics-${formatFileDate(new Date())}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "This device cannot currently share the CSV file.");
        return;
      }
      await Sharing.shareAsync(path, {
        dialogTitle: "Share SecureObs analytics CSV",
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text"
      });
    } catch (error) {
      Alert.alert("Unable to create CSV", error instanceof Error ? error.message : "The CSV could not be created.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Clinical governance</Text>
          <Text style={styles.title}>Analytics dashboard</Text>
          <Text style={styles.meta}>{ward?.name ?? "Ward"} · Traceable operational and care-quality insight</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isExporting}
            onPress={() => void exportCsv()}
            style={[styles.outlineButton, isExporting && styles.disabled]}
          >
            <Text style={styles.outlineButtonText}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isExporting}
            onPress={() => void exportPdf()}
            style={[styles.primaryButton, isExporting && styles.disabled]}
          >
            <Text style={styles.primaryButtonText}>{isExporting ? "Preparing…" : "Print / PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FeatureAvailabilityNotice ward={ward} />

      <View style={styles.filterPanel}>
        <View>
          <Text style={styles.filterLabel}>Period</Text>
          <View style={styles.chipRow}>
            {([
              ["today", "Today"],
              ["7d", "7 days"],
              ["30d", "30 days"],
              ["custom", "Custom"]
            ] as const).map(([value, label]) => (
              <FilterChip key={value} active={preset === value} label={label} onPress={() => setPreset(value)} />
            ))}
          </View>
        </View>
        {preset === "custom" ? (
          <View style={styles.customDates}>
            <SecureDateTimeField
                label="From"
                mode="date"
                onChange={setCustomStart}
                style={styles.analyticsDateField}
                value={customStart}
              />
            <SecureDateTimeField
                label="To"
                mode="date"
                onChange={setCustomEnd}
                style={styles.analyticsDateField}
                value={customEnd}
              />
          </View>
        ) : null}
        <View style={styles.patientFilter}>
          <Text style={styles.filterLabel}>Patient</Text>
          <View style={styles.chipRow}>
            <FilterChip
              active={selectedPatientId === "all"}
              label="All patients"
              onPress={() => setSelectedPatientId("all")}
            />
            {[...patients]
              .sort((left, right) => left.roomNumber - right.roomNumber)
              .map((patient) => (
                <FilterChip
                  key={patient.id}
                  active={selectedPatientId === patient.id}
                  label={`R${patient.roomNumber} ${patient.firstName}`}
                  onPress={() => setSelectedPatientId(patient.id)}
                />
              ))}
          </View>
        </View>
        <Text style={styles.rangeText}>
          Showing {formatDate(range.start)} to {formatDate(range.end)}
        </Text>
      </View>

      <View style={styles.tabs}>
        {([
          ["overview", "Ward overview"],
          ["patients", "Patient trends"],
          ["safety", "Safety & incidents"],
          ["workforce", "Staffing & tasks"]
        ] as const).map(([value, label]) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: tab === value }}
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <AttentionPanel items={analytics.attentionItems} />

      {tab === "overview" ? <WardOverviewAnalytics analytics={analytics} /> : null}
      {tab === "patients" ? <PatientAnalytics analytics={analytics} patients={patients} /> : null}
      {tab === "safety" ? <SafetyAnalytics analytics={analytics} patients={patients} /> : null}
      {tab === "workforce" ? <WorkforceAnalytics analytics={analytics} patients={patients} /> : null}

      <View style={styles.methodPanel}>
        <Text style={styles.methodTitle}>How these figures are calculated</Text>
        <Text style={styles.methodText}>
          Metrics use signed SecureObs records within the selected dates and ward. Percentages show their
          numerator and denominator in the underlying tables. “Attention” statements use visible rules—not
          unexplained predictions—and should be reviewed alongside the clinical record.
        </Text>
      </View>
    </View>
  );
}

type AnalyticsResult = ReturnType<typeof buildAnalytics>;

function WardOverviewAnalytics({ analytics }: { analytics: AnalyticsResult }) {
  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard
          detail={`${analytics.observations.length} completed / ${analytics.observations.length + analytics.missed.length} expected records`}
          label="Observation completion"
          tone={analytics.observationCompletionRate < 90 ? "red" : analytics.observationCompletionRate < 97 ? "amber" : "green"}
          value={`${analytics.observationCompletionRate}%`}
        />
        <MetricCard
          detail={`${analytics.highNews2.length} scores of 5 or above`}
          label="NEWS2 requiring attention"
          tone={analytics.highNews2.length > 0 ? "red" : "green"}
          value={String(analytics.highNews2.length)}
        />
        <MetricCard
          detail={`${analytics.lowIntake.length} refused or below-half entries`}
          label="Low intake records"
          tone={analytics.lowIntake.length > 0 ? "amber" : "green"}
          value={String(analytics.lowIntake.length)}
        />
        <MetricCard
          detail={`${analytics.medicationExceptions.length} refused or omitted`}
          label="Medication exceptions"
          tone={analytics.medicationExceptions.length > 0 ? "amber" : "green"}
          value={String(analytics.medicationExceptions.length)}
        />
        <MetricCard
          detail={`${analytics.incidents.filter((incident) => incident.status !== "resolved").length} remain active`}
          label="Incidents recorded"
          tone={analytics.redIncidents.length > 0 ? "red" : analytics.incidents.length > 0 ? "amber" : "green"}
          value={String(analytics.incidents.length)}
        />
        <MetricCard
          detail={`${analytics.overdueTasks.length} currently overdue`}
          label="Patient tasks"
          tone={analytics.overdueTasks.length > 0 ? "red" : analytics.tasks.length > 0 ? "amber" : "green"}
          value={String(analytics.tasks.length)}
        />
        <MetricCard
          detail="Recorded ward and patient security activity"
          label="Security checks"
          tone="neutral"
          value={String(analytics.securityChecks.length)}
        />
        <MetricCard
          detail={`${analytics.lowVoiceRatings.length} overall or safety ratings of 2 or below`}
          label="Patient voice check-ins"
          tone={analytics.lowVoiceRatings.length > 0 ? "amber" : "green"}
          value={String(analytics.voiceCheckIns.length)}
        />
      </View>

      <View style={styles.twoColumn}>
        <Panel title="Daily clinical activity" subtitle="Completed observations, missed observations and incidents">
          <DailyActivityChart days={analytics.dailyActivity} />
        </Panel>
        <Panel title="Missed-observation reasons" subtitle="Every bar links back to the records below">
          <HorizontalBars
            color="#d98d32"
            emptyText="No missed observations in this period."
            items={toCountItems(analytics.missed.map((item) => item.reason))}
          />
        </Panel>
      </View>

      <Panel title="Underlying observation exceptions" subtitle="Recent missed observations in the selected period">
        <RecordTable
          emptyText="No missed observations in this period."
          headers={["Patient", "Due", "Reason", "Recorded by"]}
          rows={analytics.missed.slice(0, 20).map((item) => [
            item.patientName,
            formatDateTime(item.dueAt),
            item.reason,
            item.recordedByName
          ])}
        />
      </Panel>
    </>
  );
}

function PatientAnalytics({
  analytics,
  patients
}: {
  analytics: AnalyticsResult;
  patients: Patient[];
}) {
  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard label="General observations" tone="neutral" value={String(analytics.observations.length)} />
        <MetricCard label="Latest NEWS2" tone={analytics.latestNews2Score >= 5 ? "red" : "green"} value={analytics.latestNews2ScoreLabel} />
        <MetricCard label="Food / fluid entries" tone={analytics.lowIntake.length > 0 ? "amber" : "green"} value={String(analytics.foodFluid.length)} />
        <MetricCard label="Active care-plan reviews due" tone={analytics.carePlansDue.length > 0 ? "amber" : "green"} value={String(analytics.carePlansDue.length)} />
        <MetricCard
          detail="Average patient-reported experience rating"
          label="Patient voice"
          tone={analytics.lowVoiceRatings.length > 0 ? "amber" : "green"}
          value={analytics.voiceAverageLabel}
        />
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Recorded locations" subtitle="Counts of observation locations—not continuous time tracking">
          <HorizontalBars color="#1f7184" emptyText="No observation locations recorded." items={toCountItems(analytics.observations.map((item) => item.location))} />
        </Panel>
        <Panel title="Recorded presentation" subtitle="Awake and asleep entries from general observations">
          <HorizontalBars color="#6e5ca5" emptyText="No presentation records." items={toCountItems(analytics.observations.map((item) => item.presentation))} />
        </Panel>
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Food and fluid intake" subtitle="Recorded intake levels">
          <HorizontalBars color="#37855d" emptyText="No food or fluid records." items={toCountItems(analytics.foodFluid.map((item) => item.intakeLevel))} />
        </Panel>
        <Panel title="NEWS2 distribution" subtitle="Scores grouped for clinical review">
          <HorizontalBars
            color="#c85545"
            emptyText="No NEWS2 readings."
            items={[
              { label: "0", value: analytics.news2.filter((item) => item.totalScore === 0).length },
              { label: "1–4", value: analytics.news2.filter((item) => item.totalScore >= 1 && item.totalScore <= 4).length },
              { label: "5–6", value: analytics.news2.filter((item) => item.totalScore >= 5 && item.totalScore <= 6).length },
              { label: "7+", value: analytics.news2.filter((item) => item.totalScore >= 7).length }
            ]}
          />
        </Panel>
      </View>
      <Panel title="Patient evidence table" subtitle="Latest underlying records included by the active filters">
        <RecordTable
          emptyText="No patient evidence in this period."
          headers={["Patient", "Record", "Time", "Detail"]}
          rows={[
            ...analytics.observations.slice(0, 12).map((item) => [
              patientName(patients.find((patient) => patient.id === item.patientId)),
              "Observation",
              formatDateTime(item.observedAt),
              `${item.location} · ${item.presentation}`
            ]),
            ...analytics.news2.slice(0, 8).map((item) => [
              patientName(patients.find((patient) => patient.id === item.patientId)),
              "NEWS2",
              formatDateTime(item.recordedAt),
              `Score ${item.totalScore}`
            ]),
            ...analytics.voiceCheckIns.slice(0, 8).map((item) => [
              patientName(patients.find((patient) => patient.id === item.patientId)),
              "Patient voice",
              formatDateTime(item.submittedAt),
              `Overall ${item.overallRating}/5 · safety ${item.safetyRating}/5`
            ])
          ].slice(0, 20)}
        />
      </Panel>
    </>
  );
}

function SafetyAnalytics({
  analytics,
  patients
}: {
  analytics: AnalyticsResult;
  patients: Patient[];
}) {
  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard label="Red incidents" tone={analytics.redIncidents.length > 0 ? "red" : "green"} value={String(analytics.redIncidents.length)} />
        <MetricCard label="Open / acknowledged" tone={analytics.activeIncidents.length > 0 ? "amber" : "green"} value={String(analytics.activeIncidents.length)} />
        <MetricCard label="Average acknowledgement" tone={analytics.averageAcknowledgementMinutes > 30 ? "amber" : "green"} value={formatMinutes(analytics.averageAcknowledgementMinutes)} />
        <MetricCard label="Average resolution" tone="neutral" value={formatMinutes(analytics.averageResolutionMinutes)} />
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Incident severity" subtitle="RAG rating at the time of reporting">
          <HorizontalBars color="#c85545" emptyText="No incidents recorded." items={toCountItems(analytics.incidents.map((item) => item.severity.toUpperCase()))} />
        </Panel>
        <Panel title="Incident category" subtitle="Types of incidents recorded">
          <HorizontalBars color="#d98d32" emptyText="No incidents recorded." items={toCountItems(analytics.incidents.map((item) => item.category))} />
        </Panel>
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Body areas recorded" subtitle="Selected injury-map areas">
          <HorizontalBars color="#8b5d94" emptyText="No body-map areas recorded." items={toCountItems(analytics.incidents.flatMap((item) => item.bodyAreas))} />
        </Panel>
        <Panel title="Incident status" subtitle="Current workflow position">
          <HorizontalBars color="#287188" emptyText="No incidents recorded." items={toCountItems(analytics.incidents.map((item) => capitalise(item.status)))} />
        </Panel>
      </View>
      <Panel title="Incident records" subtitle="The records behind the safety charts">
        <RecordTable
          emptyText="No incidents in this period."
          headers={["Patient", "Reported", "RAG", "Incident", "Status"]}
          rows={analytics.incidents.slice(0, 30).map((incident) => [
            patientName(patients.find((patient) => patient.id === incident.patientId)),
            formatDateTime(incident.reportedAt),
            incident.severity.toUpperCase(),
            incident.title,
            capitalise(incident.status)
          ])}
        />
      </Panel>
    </>
  );
}

function WorkforceAnalytics({
  analytics,
  patients
}: {
  analytics: AnalyticsResult;
  patients: Patient[];
}) {
  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard label="Staff assigned" tone={analytics.uniqueAssignedStaff === 0 ? "amber" : "neutral"} value={String(analytics.uniqueAssignedStaff)} />
        <MetricCard label="Tasks completed" tone="green" value={String(analytics.completedTasks.length)} />
        <MetricCard label="Tasks overdue" tone={analytics.overdueTasks.length > 0 ? "red" : "green"} value={String(analytics.overdueTasks.length)} />
        <MetricCard label="Average task completion" tone="neutral" value={formatMinutes(analytics.averageTaskCompletionMinutes)} />
        <MetricCard label="Signed handovers" tone={analytics.handovers.length === 0 ? "amber" : "green"} value={String(analytics.handovers.length)} />
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Task status" subtitle="Patient actions within the selected period">
          <HorizontalBars color="#1f7184" emptyText="No patient tasks." items={toCountItems(analytics.tasks.map((item) => capitalise(item.status)))} />
        </Panel>
        <Panel title="Task priority" subtitle="RAG priority assigned to tasks">
          <HorizontalBars color="#d98d32" emptyText="No patient tasks." items={toCountItems(analytics.tasks.map((item) => item.priority.toUpperCase()))} />
        </Panel>
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Task categories" subtitle="Clinical and operational actions">
          <HorizontalBars color="#37855d" emptyText="No patient tasks." items={toCountItems(analytics.tasks.map((item) => item.category))} />
        </Panel>
        <Panel title="Assignment by role" subtitle="Named assignees are grouped under their staff role where available">
          <HorizontalBars color="#785fa4" emptyText="No task assignments." items={analytics.taskAssignmentByRole} />
        </Panel>
      </View>
      <View style={styles.twoColumn}>
        <Panel title="Shift assignments by role" subtitle="Recorded staff assignments during the selected period">
          <HorizontalBars color="#287188" emptyText="No shift assignments." items={analytics.staffingByRole} />
        </Panel>
        <Panel title="Handover completion" subtitle="Signed handover snapshots by shift label">
          <HorizontalBars color="#5f7f55" emptyText="No signed handovers." items={toCountItems(analytics.handovers.map((item) => item.shiftLabel))} />
        </Panel>
      </View>
      <Panel title="Patient task records" subtitle="Open, accepted and completed actions">
        <RecordTable
          emptyText="No patient tasks in this period."
          headers={["Patient", "Due", "Priority", "Task", "Assigned", "Status"]}
          rows={analytics.tasks.slice(0, 30).map((task) => [
            patientName(patients.find((patient) => patient.id === task.patientId)),
            formatDateTime(task.dueAt),
            task.priority.toUpperCase(),
            task.title,
            task.assignedToName ?? task.assignedRole ?? "Ward team",
            capitalise(task.status)
          ])}
        />
      </Panel>
    </>
  );
}

function AttentionPanel({ items }: { items: Array<{ message: string; tone: Tone }> }) {
  return (
    <View style={styles.attentionPanel}>
      <Text style={styles.attentionTitle}>Areas needing attention</Text>
      {items.length === 0 ? (
        <Text style={styles.attentionClear}>No rule-based concerns were triggered for this selection.</Text>
      ) : (
        items.map((item) => (
          <View key={item.message} style={styles.attentionRow}>
            <View style={[styles.attentionDot, toneBackground(item.tone)]} />
            <Text style={styles.attentionText}>{item.message}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function MetricCard({
  detail,
  label,
  tone,
  value
}: {
  detail?: string;
  label: string;
  tone: Tone;
  value: string;
}) {
  return (
    <View style={[styles.metricCard, metricTone(tone)]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function Panel({
  children,
  subtitle,
  title
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSubtitle}>{subtitle}</Text>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function HorizontalBars({
  color,
  emptyText,
  items
}: {
  color: string;
  emptyText: string;
  items: Array<{ label: string; value: number }>;
}) {
  const nonZero = items.filter((item) => item.value > 0).slice(0, 10);
  const max = Math.max(...nonZero.map((item) => item.value), 1);
  if (nonZero.length === 0) return <Text style={styles.emptyText}>{emptyText}</Text>;
  return (
    <View style={styles.barList}>
      {nonZero.map((item) => (
        <View key={item.label} style={styles.barRow}>
          <Text numberOfLines={2} style={styles.barLabel}>{item.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: color, width: `${Math.max(4, (item.value / max) * 100)}%` }]} />
          </View>
          <Text style={styles.barValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function DailyActivityChart({
  days
}: {
  days: Array<{ date: string; incidents: number; missed: number; observations: number }>;
}) {
  const max = Math.max(...days.flatMap((day) => [day.observations, day.missed, day.incidents]), 1);
  if (days.every((day) => day.observations + day.missed + day.incidents === 0)) {
    return <Text style={styles.emptyText}>No activity recorded in this period.</Text>;
  }
  return (
    <View>
      <View style={styles.chartLegend}>
        <Legend color="#236f82" label="Observations" />
        <Legend color="#df9f22" label="Missed" />
        <Legend color="#c54a3f" label="Incidents" />
      </View>
      <View style={styles.dailyChart}>
        {days.map((day) => (
          <View key={day.date} style={styles.dayColumn}>
            <View style={styles.dayBars}>
              <View style={[styles.dayBar, { backgroundColor: "#236f82", height: Math.max(2, (day.observations / max) * 90) }]} />
              <View style={[styles.dayBar, { backgroundColor: "#df9f22", height: Math.max(2, (day.missed / max) * 90) }]} />
              <View style={[styles.dayBar, { backgroundColor: "#c54a3f", height: Math.max(2, (day.incidents / max) * 90) }]} />
            </View>
            <Text style={styles.dayLabel}>{formatDayLabel(day.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function RecordTable({
  emptyText,
  headers,
  rows
}: {
  emptyText: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return <Text style={styles.emptyText}>{emptyText}</Text>;
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        {headers.map((header) => <Text key={header} style={[styles.tableCell, styles.tableHeaderText]}>{header}</Text>)}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={`${row.join("-")}-${rowIndex}`} style={styles.tableRow}>
          {row.map((cell, cellIndex) => (
            <Text key={`${cell}-${cellIndex}`} style={styles.tableCell}>{cell || "—"}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function buildAnalytics({
  carePlans,
  end,
  foodFluidEntries,
  handovers,
  incidents,
  medicationAdministrations,
  medicationPrescriptions,
  missedObservations,
  news2Readings,
  observations,
  patientTasks,
  patients,
  securityChecks,
  securityAreas,
  selectedPatientId,
  staff,
  staffShiftAssignments,
  start,
  ward
}: Omit<AnalyticsDashboardScreenProps, "onBack"> & {
  end: number;
  selectedPatientId: string;
  start: number;
}) {
  const patientIds = new Set(
    patients
      .filter((patient) => selectedPatientId === "all" || patient.id === selectedPatientId)
      .map((patient) => patient.id)
  );
  const inRange = (value: string) => {
    const timestamp = new Date(value).getTime();
    return !Number.isNaN(timestamp) && timestamp >= start && timestamp <= end;
  };
  const wardIncidents = incidents.filter(
    (item) => item.wardId === ward?.id && patientIds.has(item.patientId) && inRange(item.reportedAt)
  );
  const scopedObservations = observations.filter(
    (item) => patientIds.has(item.patientId) && inRange(item.observedAt)
  );
  const scopedMissed = missedObservations.filter(
    (item) => item.wardId === ward?.id && patientIds.has(item.patientId) && inRange(item.recordedAt)
  );
  const scopedNews2 = news2Readings.filter(
    (item) => patientIds.has(item.patientId) && inRange(item.recordedAt)
  );
  const scopedFood = foodFluidEntries.filter(
    (item) => patientIds.has(item.patientId) && inRange(item.recordedAt)
  );
  const scopedAdministrations = medicationAdministrations.filter(
    (item) => patientIds.has(item.patientId) && inRange(item.recordedAt)
  );
  const scopedTasks = patientTasks.filter(
    (item) => item.wardId === ward?.id && patientIds.has(item.patientId) && inRange(item.createdAt)
  );
  const scopedVoiceCheckIns = patients
    .filter((patient) => patientIds.has(patient.id))
    .flatMap((patient) =>
      (patient.patientVoiceCheckIns ?? []).map((checkIn) => ({
        ...checkIn,
        patientId: patient.id
      }))
    )
    .filter((checkIn) => inRange(checkIn.submittedAt))
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  const scopedHandovers = handovers.filter(
    (item) => item.wardId === ward?.id && inRange(item.createdAt)
  );
  const wardSecurityAreaIds = new Set(
    securityAreas.filter((area) => area.wardId === ward?.id).map((area) => area.id)
  );
  const scopedSecurity = securityChecks.filter(
    (item) => wardSecurityAreaIds.has(item.areaId) && inRange(item.checkedAt)
  );
  const scopedShiftAssignments = staffShiftAssignments.filter(
    (item) => item.wardId === ward?.id && inRange(`${item.date}T12:00:00`)
  );
  const previousDuration = Math.max(end - start, 86_400_000);
  const previousMissed = missedObservations.filter(
    (item) => {
      const timestamp = new Date(item.recordedAt).getTime();
      return item.wardId === ward?.id &&
        patientIds.has(item.patientId) &&
        timestamp >= start - previousDuration &&
        timestamp < start;
    }
  );
  const highNews2 = scopedNews2.filter((item) => item.totalScore >= 5);
  const lowIntake = scopedFood.filter(
    (item) => item.intakeLevel === "Refused" || item.intakeLevel === "Less than half"
  );
  const medicationExceptions = scopedAdministrations.filter((item) => item.status !== "Given");
  const lowVoiceRatings = scopedVoiceCheckIns.filter(
    (item) => item.overallRating <= 2 || item.safetyRating <= 2
  );
  const redIncidents = wardIncidents.filter((item) => item.severity === "red");
  const activeIncidents = incidents.filter(
    (item) =>
      item.wardId === ward?.id &&
      patientIds.has(item.patientId) &&
      new Date(item.reportedAt).getTime() <= end &&
      item.status !== "resolved"
  );
  const activeTasks = patientTasks.filter(
    (item) =>
      item.wardId === ward?.id &&
      patientIds.has(item.patientId) &&
      new Date(item.createdAt).getTime() <= end &&
      new Date(item.dueAt).getTime() <= end &&
      (item.status === "open" || item.status === "accepted")
  );
  const overdueTasks = activeTasks.filter(
    (item) => new Date(item.dueAt).getTime() < Math.min(Date.now(), end)
  );
  const completedTasks = scopedTasks.filter((item) => item.status === "completed");
  const observationCompletionRate =
    scopedObservations.length + scopedMissed.length === 0
      ? 100
      : Math.round((scopedObservations.length / (scopedObservations.length + scopedMissed.length)) * 100);
  const acknowledgementTimes = wardIncidents
    .filter((item) => item.acknowledgedAt)
    .map((item) => minutesBetween(item.reportedAt, item.acknowledgedAt ?? ""));
  const resolutionTimes = wardIncidents
    .filter((item) => item.resolvedAt)
    .map((item) => minutesBetween(item.reportedAt, item.resolvedAt ?? ""));
  const completionTimes = completedTasks
    .filter((item) => item.completedAt)
    .map((item) => minutesBetween(item.createdAt, item.completedAt ?? ""));
  const latestNews2 = [...scopedNews2].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  const latestCarePlans = Array.from(
    carePlans
      .filter((plan) => patientIds.has(plan.patientId) && new Date(plan.createdAt).getTime() <= end)
      .reduce<Map<string, PatientCarePlan>>((latestByPatient, plan) => {
        const current = latestByPatient.get(plan.patientId);
        if (!current || plan.createdAt > current.createdAt) latestByPatient.set(plan.patientId, plan);
        return latestByPatient;
      }, new Map())
      .values()
  );
  const carePlansDue = latestCarePlans.filter((plan) => {
    const review = parseReviewDate(plan.reviewDate);
    return review !== undefined && review <= end + 7 * 86_400_000;
  });
  const uniqueAssignedStaff = new Set(scopedShiftAssignments.map((item) => item.staffId)).size;
  const staffById = new Map(staff.map((member) => [member.id, member]));
  const taskAssignmentByRole = toCountItems(
    scopedTasks.map((task) => {
      if (task.assignedRole) return task.assignedRole.toUpperCase();
      if (task.assignedToStaffId) return staffById.get(task.assignedToStaffId)?.role.toUpperCase() ?? "UNKNOWN";
      return "WARD TEAM";
    })
  );
  const staffingByRole = toCountItems(
    scopedShiftAssignments.map(
      (assignment) => staffById.get(assignment.staffId)?.role.toUpperCase() ?? "UNKNOWN"
    )
  );
  const attentionItems: Array<{ message: string; tone: Tone }> = [];
  if (scopedMissed.length > previousMissed.length && scopedMissed.length > 0) {
    const increase = previousMissed.length === 0
      ? "from none in the previous period"
      : `by ${Math.round(((scopedMissed.length - previousMissed.length) / previousMissed.length) * 100)}%`;
    attentionItems.push({ message: `Missed observations increased ${increase}.`, tone: "amber" });
  }
  if (redIncidents.length > 0) {
    attentionItems.push({ message: `${redIncidents.length} red incident${redIncidents.length === 1 ? "" : "s"} recorded in this period.`, tone: "red" });
  }
  if (activeIncidents.length > 0) {
    attentionItems.push({ message: `${activeIncidents.length} incident${activeIncidents.length === 1 ? " remains" : "s remain"} open or acknowledged.`, tone: "amber" });
  }
  if (overdueTasks.length > 0) {
    attentionItems.push({ message: `${overdueTasks.length} patient task${overdueTasks.length === 1 ? " is" : "s are"} overdue.`, tone: "red" });
  }
  if (highNews2.length > 0) {
    attentionItems.push({ message: `${highNews2.length} NEWS2 reading${highNews2.length === 1 ? "" : "s"} scored 5 or above.`, tone: "red" });
  }
  if (lowIntake.length > 0) {
    attentionItems.push({ message: `${lowIntake.length} food or fluid entr${lowIntake.length === 1 ? "y shows" : "ies show"} refusal or less than half taken.`, tone: "amber" });
  }
  if (carePlansDue.length > 0) {
    attentionItems.push({ message: `${carePlansDue.length} care-plan review${carePlansDue.length === 1 ? " is" : "s are"} due within the selected period or next 7 days.`, tone: "amber" });
  }
  if (lowVoiceRatings.length > 0) {
    attentionItems.push({
      message: `${lowVoiceRatings.length} patient voice check-in${
        lowVoiceRatings.length === 1 ? " includes" : "s include"
      } an overall or safety rating of 2 or below.`,
      tone: "amber"
    });
  }

  return {
    activeIncidents,
    activeTasks,
    attentionItems,
    averageAcknowledgementMinutes: average(acknowledgementTimes),
    averageResolutionMinutes: average(resolutionTimes),
    averageTaskCompletionMinutes: average(completionTimes),
    carePlansDue,
    completedTasks,
    dailyActivity: buildDailyActivity(start, end, scopedObservations, scopedMissed, wardIncidents),
    foodFluid: scopedFood,
    handovers: scopedHandovers,
    highNews2,
    incidents: wardIncidents,
    latestNews2Score: latestNews2?.totalScore ?? 0,
    latestNews2ScoreLabel: latestNews2 ? String(latestNews2.totalScore) : "—",
    lowIntake,
    lowVoiceRatings,
    medicationAdministrations: scopedAdministrations,
    medicationExceptions,
    medicationPrescriptions,
    missed: scopedMissed,
    news2: scopedNews2,
    observationCompletionRate,
    observations: scopedObservations,
    overdueTasks,
    previousMissed,
    redIncidents,
    securityChecks: scopedSecurity,
    shiftAssignments: scopedShiftAssignments,
    staffingByRole,
    taskAssignmentByRole,
    tasks: scopedTasks,
    uniqueAssignedStaff,
    voiceAverageLabel:
      scopedVoiceCheckIns.length > 0
        ? `${(
            scopedVoiceCheckIns.reduce((total, item) => total + item.overallRating, 0) /
            scopedVoiceCheckIns.length
          ).toFixed(1)}/5`
        : "—",
    voiceCheckIns: scopedVoiceCheckIns
  };
}

function buildDailyActivity(
  start: number,
  end: number,
  observations: Observation[],
  missed: MissedObservation[],
  incidents: SafetyIncident[]
) {
  const days: Array<{ date: string; incidents: number; missed: number; observations: number }> = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setHours(23, 59, 59, 999);
  while (cursor.getTime() <= limit.getTime() && days.length < 31) {
    const date = formatDateInput(cursor);
    days.push({
      date,
      incidents: incidents.filter((item) => formatDateInput(new Date(item.reportedAt)) === date).length,
      missed: missed.filter((item) => formatDateInput(new Date(item.recordedAt)) === date).length,
      observations: observations.filter((item) => formatDateInput(new Date(item.observedAt)) === date).length
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getDateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "custom") {
    const parsedStart = parseDateInput(customStart);
    const parsedEnd = parseDateInput(customEnd);
    if (parsedStart) start.setTime(parsedStart.getTime());
    if (parsedEnd) {
      end.setTime(parsedEnd.getTime());
      end.setHours(23, 59, 59, 999);
    }
  }
  return { end: end.getTime(), start: Math.min(start.getTime(), end.getTime()) };
}

function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseReviewDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function toCountItems(values: string[]) {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    const label = value || "Not recorded";
    result[label] = (result[label] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function minutesBetween(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Number.isNaN(startTime) || Number.isNaN(endTime)
    ? 0
    : Math.max(0, Math.round((endTime - startTime) / 60_000));
}

function formatMinutes(value: number) {
  if (value === 0) return "—";
  if (value < 60) return `${value}m`;
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatFileDate(date: Date) {
  return formatDateInput(date).replace(/-/g, "");
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function patientName(patient?: Patient) {
  return patient ? `${patient.firstName} ${patient.surname}` : "Patient unavailable";
}

function capitalise(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replace("_", " ")}`;
}

function metricTone(tone: Tone) {
  if (tone === "red") return styles.metricRed;
  if (tone === "amber") return styles.metricAmber;
  if (tone === "green") return styles.metricGreen;
  return undefined;
}

function toneBackground(tone: Tone) {
  if (tone === "red") return styles.dotRed;
  if (tone === "amber") return styles.dotAmber;
  if (tone === "green") return styles.dotGreen;
  return styles.dotNeutral;
}

function buildAnalyticsCsv(
  analytics: AnalyticsResult,
  patients: Patient[],
  prescriptions: MedicationPrescription[]
) {
  const rows: string[][] = [["record_type", "patient", "date_time", "category", "status_or_value", "detail"]];
  analytics.observations.forEach((item) => rows.push([
    "observation",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.observedAt,
    item.source,
    item.presentation,
    `${item.location}; ${item.comments}`
  ]));
  analytics.missed.forEach((item) => rows.push([
    "missed_observation", item.patientName, item.recordedAt, item.source ?? "General observations", item.reason, item.details
  ]));
  analytics.news2.forEach((item) => rows.push([
    "news2",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.recordedAt,
    "NEWS2",
    String(item.totalScore),
    `Recorded by ${item.recordedBy}`
  ]));
  analytics.foodFluid.forEach((item) => rows.push([
    "food_fluid",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.recordedAt,
    item.mealPeriod,
    item.intakeLevel,
    `${item.itemDescription}${item.fluidTakenMl !== undefined ? `; ${item.fluidTakenMl}ml` : ""}`
  ]));
  analytics.medicationAdministrations.forEach((item) => rows.push([
    "medication",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.recordedAt,
    prescriptions.find((prescription) => prescription.id === item.prescriptionId)?.drugName ?? "Medication",
    item.status,
    item.notes
  ]));
  analytics.incidents.forEach((item) => rows.push([
    "incident",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.reportedAt,
    item.category,
    `${item.severity}/${item.status}`,
    item.title
  ]));
  analytics.tasks.forEach((item) => rows.push([
    "patient_task",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.createdAt,
    item.category,
    `${item.priority}/${item.status}`,
    `${item.title}; due ${item.dueAt}`
  ]));
  analytics.voiceCheckIns.forEach((item) => rows.push([
    "patient_voice",
    patientName(patients.find((patient) => patient.id === item.patientId)),
    item.submittedAt,
    item.frequency,
    `overall ${item.overallRating}/5; safety ${item.safetyRating}/5`,
    `Going well: ${item.goingWell}; would change: ${item.wouldChange}; concerns: ${item.concerns}`
  ]));
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildAnalyticsHtml({
  analytics,
  end,
  patientName: selectedPatientName,
  start,
  wardName
}: {
  analytics: AnalyticsResult;
  end: number;
  patientName: string;
  start: number;
  wardName: string;
}) {
  const attention = analytics.attentionItems.length === 0
    ? "<li>No rule-based concerns triggered.</li>"
    : analytics.attentionItems.map((item) => `<li>${escapeHtml(item.message)}</li>`).join("");
  const incidentRows = analytics.incidents.slice(0, 50).map((item) =>
    `<tr><td>${escapeHtml(formatDateTime(item.reportedAt))}</td><td>${escapeHtml(item.severity.toUpperCase())}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(capitalise(item.status))}</td></tr>`
  ).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#20343c;font-size:10pt;line-height:1.4}
    h1{font-size:22pt;margin:0}h2{font-size:14pt;margin:18px 0 8px}.meta{color:#68777d}
    .metrics{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.metric{border:1px solid #cad6d9;padding:9px;min-width:120px}
    .value{font-size:18pt;font-weight:700}.label{font-size:8pt;text-transform:uppercase;color:#65757c}
    .attention{background:#fff7df;border:1px solid #dfc575;padding:10px}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #d6dfe2;padding:6px;text-align:left;font-size:8.5pt}th{background:#174f61;color:white}
    .footer{color:#6a777d;font-size:8pt;margin-top:18px}
  </style></head><body>
    <div class="meta">CONFIDENTIAL CLINICAL GOVERNANCE REPORT</div>
    <h1>${escapeHtml(wardName)} analytics</h1>
    <div class="meta">${escapeHtml(formatDate(start))} to ${escapeHtml(formatDate(end))} · ${escapeHtml(selectedPatientName)}</div>
    <div class="metrics">
      ${htmlMetric("Observation completion", `${analytics.observationCompletionRate}%`)}
      ${htmlMetric("Missed observations", String(analytics.missed.length))}
      ${htmlMetric("NEWS2 5+", String(analytics.highNews2.length))}
      ${htmlMetric("Incidents", String(analytics.incidents.length))}
      ${htmlMetric("Overdue tasks", String(analytics.overdueTasks.length))}
      ${htmlMetric("Medication exceptions", String(analytics.medicationExceptions.length))}
      ${htmlMetric("Patient voice", analytics.voiceAverageLabel)}
    </div>
    <div class="attention"><strong>Areas needing attention</strong><ul>${attention}</ul></div>
    <h2>Incidents</h2>
    <table><thead><tr><th>Reported</th><th>RAG</th><th>Incident</th><th>Status</th></tr></thead><tbody>${incidentRows || '<tr><td colspan="4">No incidents in this period.</td></tr>'}</tbody></table>
    <h2>Activity totals</h2>
    <table><tbody>
      <tr><th>General and enhanced observations</th><td>${analytics.observations.length}</td></tr>
      <tr><th>Food and fluid entries</th><td>${analytics.foodFluid.length}</td></tr>
      <tr><th>NEWS2 readings</th><td>${analytics.news2.length}</td></tr>
      <tr><th>Medication administrations</th><td>${analytics.medicationAdministrations.length}</td></tr>
      <tr><th>Patient tasks</th><td>${analytics.tasks.length}</td></tr>
      <tr><th>Patient voice check-ins</th><td>${analytics.voiceCheckIns.length}</td></tr>
      <tr><th>Signed handovers</th><td>${analytics.handovers.length}</td></tr>
    </tbody></table>
    <div class="footer">Generated ${escapeHtml(new Date().toLocaleString())} from SecureObs signed records. Rule-based attention statements must be reviewed alongside the underlying clinical record.</div>
  </body></html>`;
}

function htmlMetric(label: string, value: string) {
  return `<div class="metric"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(label)}</div></div>`;
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
  screen: { alignSelf: "center", gap: 14, maxWidth: 1380, padding: 16, width: "100%" },
  header: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", padding: 18 },
  eyebrow: { color: "#17677a", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#16282f", fontSize: 28, fontWeight: "900", marginTop: 3 },
  meta: { color: "#64747b", fontSize: 11, fontWeight: "700", marginTop: 4 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  outlineButton: { borderColor: "#1c596a", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 12 },
  outlineButtonText: { color: "#1c596a", fontSize: 10, fontWeight: "900" },
  primaryButton: { backgroundColor: "#18596a", borderRadius: 7, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 },
  primaryButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  filterPanel: { alignItems: "flex-end", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 14, padding: 13 },
  filterLabel: { color: "#617279", fontSize: 8, fontWeight: "900", marginBottom: 5, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { borderColor: "#c9d4d7", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 9 },
  filterChipActive: { backgroundColor: "#1c6173", borderColor: "#1c6173" },
  filterChipText: { color: "#43575f", fontSize: 9, fontWeight: "900" },
  filterChipTextActive: { color: "#ffffff" },
  customDates: { flexDirection: "row", gap: 7 },
  analyticsDateField: { minWidth: 150 },
  dateInput: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#21363e", fontSize: 10, minHeight: 34, paddingHorizontal: 8, width: 104 },
  patientFilter: { flex: 1, minWidth: 280 },
  rangeText: { color: "#5f7178", fontSize: 9, fontWeight: "800", paddingBottom: 8 },
  tabs: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 9, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 7, padding: 7 },
  tab: { alignItems: "center", borderColor: "#cbd6d9", borderRadius: 7, borderWidth: 1, flexGrow: 1, justifyContent: "center", minHeight: 40, minWidth: 150, paddingHorizontal: 10 },
  tabActive: { backgroundColor: "#164f61", borderColor: "#164f61" },
  tabText: { color: "#40575f", fontSize: 10, fontWeight: "900" },
  tabTextActive: { color: "#ffffff" },
  attentionPanel: { backgroundColor: "#fff8df", borderColor: "#e2cb83", borderRadius: 9, borderWidth: 1, gap: 7, padding: 13 },
  attentionTitle: { color: "#614716", fontSize: 14, fontWeight: "900" },
  attentionClear: { color: "#4d705c", fontSize: 10, fontWeight: "800" },
  attentionRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  attentionDot: { borderRadius: 999, height: 11, width: 11 },
  attentionText: { color: "#564a29", flex: 1, fontSize: 10, fontWeight: "800" },
  dotRed: { backgroundColor: "#c74135" },
  dotAmber: { backgroundColor: "#df9f22" },
  dotGreen: { backgroundColor: "#37855d" },
  dotNeutral: { backgroundColor: "#668088" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 9, borderWidth: 1, flexGrow: 1, minWidth: 175, padding: 12 },
  metricRed: { backgroundColor: "#fff0ed", borderColor: "#e6aaa0" },
  metricAmber: { backgroundColor: "#fff8df", borderColor: "#e4cb81" },
  metricGreen: { backgroundColor: "#edf7f1", borderColor: "#bad9c8" },
  metricValue: { color: "#173e4b", fontSize: 23, fontWeight: "900" },
  metricLabel: { color: "#405861", fontSize: 9, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  metricDetail: { color: "#68787f", fontSize: 8, fontWeight: "700", marginTop: 4 },
  twoColumn: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  panel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexBasis: "48%", flexGrow: 1, minWidth: 330, padding: 15 },
  panelTitle: { color: "#1c333c", fontSize: 16, fontWeight: "900" },
  panelSubtitle: { color: "#68787f", fontSize: 9, fontWeight: "700", marginTop: 3 },
  panelBody: { marginTop: 12 },
  emptyText: { color: "#6b7a80", fontSize: 10, paddingVertical: 12 },
  barList: { gap: 8 },
  barRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  barLabel: { color: "#425961", fontSize: 9, fontWeight: "800", width: 112 },
  barTrack: { backgroundColor: "#e9eef0", borderRadius: 999, flex: 1, height: 12, overflow: "hidden" },
  barFill: { borderRadius: 999, height: 12 },
  barValue: { color: "#273e47", fontSize: 9, fontWeight: "900", textAlign: "right", width: 28 },
  chartLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  legendDot: { borderRadius: 999, height: 8, width: 8 },
  legendText: { color: "#5d7077", fontSize: 8, fontWeight: "800" },
  dailyChart: { alignItems: "flex-end", flexDirection: "row", gap: 4, minHeight: 120 },
  dayColumn: { alignItems: "center", flex: 1, minWidth: 18 },
  dayBars: { alignItems: "flex-end", flexDirection: "row", gap: 2, height: 94 },
  dayBar: { borderTopLeftRadius: 2, borderTopRightRadius: 2, width: 5 },
  dayLabel: { color: "#6a797f", fontSize: 7, marginTop: 5, transform: [{ rotate: "-35deg" }] },
  table: { borderColor: "#d7e0e3", borderRadius: 7, borderWidth: 1, overflow: "hidden" },
  tableRow: { borderBottomColor: "#e1e7e9", borderBottomWidth: 1, flexDirection: "row" },
  tableHeader: { backgroundColor: "#174f61" },
  tableCell: { color: "#40545c", flex: 1, fontSize: 8, minWidth: 75, padding: 7 },
  tableHeaderText: { color: "#ffffff", fontWeight: "900", textTransform: "uppercase" },
  methodPanel: { backgroundColor: "#eef4f5", borderRadius: 9, padding: 13 },
  methodTitle: { color: "#304d57", fontSize: 11, fontWeight: "900" },
  methodText: { color: "#597078", fontSize: 9, lineHeight: 14, marginTop: 4 }
});
