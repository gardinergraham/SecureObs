import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type {
  FoodFluidEntry,
  News2Reading,
  Observation,
  Patient,
  PatientTask,
  SafetyIncident,
  SecurityArea,
  SecurityCheck,
  StaffMember,
  StaffShiftAssignment,
  Ward
} from "../types/domain";
import { normaliseStaffRole } from "../utils/staffRole";

type WardOverviewScreenProps = {
  foodFluidEntries: FoodFluidEntry[];
  incidents: SafetyIncident[];
  patientTasks: PatientTask[];
  news2Readings: News2Reading[];
  observations: Observation[];
  patients: Patient[];
  securityAreas: SecurityArea[];
  securityChecks: SecurityCheck[];
  selectedStaffId: string;
  staff: StaffMember[];
  staffShiftAssignments: StaffShiftAssignment[];
  syncPendingCount: number;
  ward?: Ward;
  onChangeStaffOrWard: () => void;
  onOpenAnalytics: () => void;
  onOpenEnhanced: () => void;
  onOpenFoodFluidChart: () => void;
  onOpenGeneralObservations: () => void;
  onOpenMedicationChart: () => void;
  onOpenNews2: () => void;
  onOpenPatientManagement: () => void;
  onOpenPatientCarePlans: () => void;
  onOpenPatientNotes: () => void;
  onOpenPatientTasks: () => void;
  onOpenPatientSettings: () => void;
  onOpenPreviousObservations: () => void;
  onOpenSafetyCentre: () => void;
  onOpenShiftHandover: () => void;
  onOpenSecurityChecks: () => void;
  onOpenStaffRota: () => void;
};

type TimingStatus = "ok" | "soon" | "due" | "overdue";

type TimedPatient = {
  patient: Patient;
  label: string;
  minutes: number;
  status: TimingStatus;
};

export function WardOverviewScreen({
  foodFluidEntries,
  incidents,
  patientTasks,
  news2Readings,
  observations,
  patients,
  securityAreas,
  securityChecks,
  selectedStaffId,
  staff,
  staffShiftAssignments,
  syncPendingCount,
  ward,
  onChangeStaffOrWard,
  onOpenAnalytics,
  onOpenEnhanced,
  onOpenFoodFluidChart,
  onOpenGeneralObservations,
  onOpenMedicationChart,
  onOpenNews2,
  onOpenPatientManagement,
  onOpenPatientCarePlans,
  onOpenPatientNotes,
  onOpenPatientTasks,
  onOpenPatientSettings,
  onOpenPreviousObservations,
  onOpenSafetyCentre,
  onOpenShiftHandover,
  onOpenSecurityChecks,
  onOpenStaffRota
}: WardOverviewScreenProps) {
  const [now, setNow] = useState(() => Date.now());
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const currentShift = ward ? getCurrentShift(ward, now) : undefined;
  const shiftAssignments = useMemo(
    () =>
      currentShift
        ? staffShiftAssignments.filter(
            (assignment) =>
              assignment.wardId === ward?.id &&
              assignment.shiftId === currentShift.shiftId &&
              assignment.date === currentShift.dateKey
          )
        : [],
    [currentShift?.dateKey, currentShift?.shiftId, staffShiftAssignments, ward?.id]
  );
  const shiftStaff = useMemo(
    () =>
      shiftAssignments
        .map((assignment) => ({
          assignment,
          member: staff.find((member) => member.id === assignment.staffId)
        }))
        .filter((entry): entry is { assignment: StaffShiftAssignment; member: StaffMember } => Boolean(entry.member)),
    [shiftAssignments, staff]
  );
  const shiftStaffIds = useMemo(
    () => new Set(shiftAssignments.map((assignment) => assignment.staffId)),
    [shiftAssignments]
  );

  const generalPatients = useMemo(
    () =>
      patients
        .filter((patient) => patient.observationLevel === "Intermittent")
        .map((patient) => toTimedPatient(patient, ward?.observationIntervalMinutes ?? 15, now))
        .sort(compareTimedPatients),
    [now, patients, ward?.observationIntervalMinutes]
  );

  const latestEnhancedByPatientId = useMemo(() => {
    const latestByPatientId = new Map<string, Observation>();
    observations
      .filter((observation) => observation.source === "Enhanced/TESO")
      .forEach((observation) => {
        const current = latestByPatientId.get(observation.patientId);
        if (!current || observation.observedAt > current.observedAt) {
          latestByPatientId.set(observation.patientId, observation);
        }
      });
    return latestByPatientId;
  }, [observations]);

  const enhancedPatients = useMemo(
    () =>
      patients
        .filter((patient) => patient.observationLevel !== "Intermittent" || patient.enhancedObservation)
        .map((patient) => {
          const latest = latestEnhancedByPatientId.get(patient.id);
          const interval = patient.enhancedObservation?.reviewFrequencyMinutes;
          const baseline = latest?.observedAt ?? patient.enhancedObservation?.startedAt;
          const timing = interval && baseline
            ? getTimingFromBaseline(baseline, interval, now)
            : undefined;
          const required = requiredStaffCount(patient);
          const assignedStaffIds = patient.enhancedObservation?.assignedStaffIds ?? [];
          const assigned = ward?.staffRotaEnabled
            ? assignedStaffIds.filter((staffId) => shiftStaffIds.has(staffId)).length
            : assignedStaffIds.length;
          return { assigned, patient, required, timing };
        })
        .sort((left, right) => {
          if (left.timing && right.timing) return left.timing.minutes - right.timing.minutes;
          if (left.timing) return -1;
          if (right.timing) return 1;
          return left.patient.roomNumber - right.patient.roomNumber;
        }),
    [latestEnhancedByPatientId, now, patients, shiftStaffIds, ward?.staffRotaEnabled]
  );

  const latestNews2 = useMemo(() => {
    const latestByPatientId = new Map<string, News2Reading>();
    news2Readings.forEach((reading) => {
      const current = latestByPatientId.get(reading.patientId);
      if (!current || reading.recordedAt > current.recordedAt) {
        latestByPatientId.set(reading.patientId, reading);
      }
    });

    return patients
      .map((patient) => ({ patient, reading: latestByPatientId.get(patient.id) }))
      .sort((left, right) => {
        const scoreDifference = (right.reading?.totalScore ?? -1) - (left.reading?.totalScore ?? -1);
        return scoreDifference || left.patient.roomNumber - right.patient.roomNumber;
      });
  }, [news2Readings, patients]);

  const todayFoodFluidEntries = useMemo(() => {
    const patientIds = new Set(patients.map((patient) => patient.id));
    const todayKey = formatDateKey(new Date(now));
    return foodFluidEntries
      .filter(
        (entry) =>
          patientIds.has(entry.patientId) && formatDateKey(new Date(entry.recordedAt)) === todayKey
      )
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  }, [foodFluidEntries, now, patients]);
  const todayFluidTotal = todayFoodFluidEntries.reduce(
    (total, entry) => total + (entry.fluidTakenMl ?? 0),
    0
  );
  const todayLowIntakeCount = todayFoodFluidEntries.filter(
    (entry) => entry.intakeLevel === "Refused" || entry.intakeLevel === "Less than half"
  ).length;

  const activeSecurityAreas = useMemo(
    () => securityAreas.filter((area) => area.wardId === ward?.id && area.active !== false),
    [securityAreas, ward?.id]
  );
  const securitySummary = useMemo(
    () => buildSecuritySummary(activeSecurityAreas, securityChecks, currentShift, now),
    [activeSecurityAreas, currentShift, now, securityChecks]
  );
  const activeIncidents = useMemo(
    () =>
      incidents
        .filter((incident) => incident.wardId === ward?.id && incident.status !== "resolved")
        .sort(compareSafetyIncidents),
    [incidents, ward?.id]
  );
  const activePatientTasks = useMemo(
    () =>
      patientTasks
        .filter(
          (task) =>
            task.wardId === ward?.id && (task.status === "open" || task.status === "accepted")
        )
        .sort(comparePatientTasks),
    [patientTasks, ward?.id]
  );

  const overdueGeneralCount = generalPatients.filter((item) => item.status === "overdue").length;
  const soonGeneralCount = generalPatients.filter((item) => item.status === "soon" || item.status === "due").length;
  const overdueEnhancedCount = enhancedPatients.filter((item) => item.timing?.status === "overdue").length;
  const enhancedCoverGapCount = enhancedPatients.filter((item) => item.assigned < item.required).length;
  const news2AttentionCount = latestNews2.filter((item) => (item.reading?.totalScore ?? 0) >= 5).length;
  const activeEnhancedOverdueCount = ward?.enhancedObservationsEnabled ? overdueEnhancedCount : 0;
  const activeEnhancedCoverGapCount = ward?.enhancedObservationsEnabled ? enhancedCoverGapCount : 0;
  const activeNews2AttentionCount = ward?.news2Enabled ? news2AttentionCount : 0;
  const activeSecurityDueCount = ward?.securityChecksEnabled ? securitySummary.dueCount : 0;
  const redIncidentCount = activeIncidents.filter((incident) => incident.severity === "red").length;
  const amberIncidentCount = activeIncidents.filter((incident) => incident.severity === "amber").length;
  const greenIncidentCount = activeIncidents.filter((incident) => incident.severity === "green").length;
  const incidentAttentionCount = redIncidentCount + amberIncidentCount;
  const overdueTaskCount = activePatientTasks.filter(
    (task) => new Date(task.dueAt).getTime() < now
  ).length;
  const redTaskCount = activePatientTasks.filter((task) => task.priority === "red").length;
  const taskAttentionCount = activePatientTasks.filter(
    (task) => task.priority === "red" || new Date(task.dueAt).getTime() < now
  ).length;
  const nurseInCharge = shiftStaff.filter((entry) => entry.assignment.nurseInCharge).map((entry) => entry.member.name);
  const medicationNurse = shiftStaff.filter((entry) => entry.assignment.medicationNurse).map((entry) => entry.member.name);
  const urgentCount =
    overdueGeneralCount +
    activeEnhancedOverdueCount +
    activeEnhancedCoverGapCount +
    activeNews2AttentionCount +
    activeSecurityDueCount +
    incidentAttentionCount +
    taskAttentionCount;
  const primaryAction = getPrimaryAction(normaliseStaffRole(selectedStaff?.role), {
    enhancedCoverGapCount: activeEnhancedCoverGapCount,
    news2AttentionCount: activeNews2AttentionCount,
    overdueGeneralCount,
    incidentAttentionCount,
    taskAttentionCount,
    securityDueCount: activeSecurityDueCount
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const runPrimaryAction = () => {
    if (primaryAction.target === "safety") onOpenSafetyCentre();
    else if (primaryAction.target === "tasks") onOpenPatientTasks();
    else if (primaryAction.target === "security") onOpenSecurityChecks();
    else if (primaryAction.target === "enhanced") onOpenEnhanced();
    else if (primaryAction.target === "news2") onOpenNews2();
    else if (primaryAction.target === "staff") onOpenStaffRota();
    else onOpenGeneralObservations();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>Ward overview</Text>
          <Text style={styles.title}>{ward?.name ?? "No ward selected"}</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} · {currentShift?.label ?? "No active shift"} ·{" "}
            {formatClock(now)}
          </Text>
        </View>
        <View style={styles.heroActions}>
          <View style={[styles.syncPill, syncPendingCount > 0 && styles.syncPillWarning]}>
            <Text style={[styles.syncPillText, syncPendingCount > 0 && styles.syncPillTextWarning]}>
              {syncPendingCount > 0 ? `${syncPendingCount} waiting to sync` : "All records synced"}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={onChangeStaffOrWard} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>Change staff or ward</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.attentionBar, urgentCount > 0 && styles.attentionBarUrgent]}>
        <View style={styles.attentionCopy}>
          <Text style={[styles.attentionTitle, urgentCount > 0 && styles.attentionTitleUrgent]}>
            {urgentCount > 0 ? `${urgentCount} items need attention` : "Ward checks are currently on track"}
          </Text>
          <Text style={styles.attentionMeta}>
            {overdueGeneralCount} general overdue · {activeEnhancedOverdueCount} enhanced overdue ·{" "}
            {activeSecurityDueCount} security due · {incidentAttentionCount} incident alerts ·{" "}
            {taskAttentionCount} task alerts · {activeEnhancedCoverGapCount} enhanced cover gaps
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={runPrimaryAction} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryGrid}>
        <Metric label="General overdue" tone={overdueGeneralCount > 0 ? "danger" : "neutral"} value={overdueGeneralCount} />
        <Metric label="Due within 5m" tone={soonGeneralCount > 0 ? "warning" : "neutral"} value={soonGeneralCount} />
        {ward?.enhancedObservationsEnabled ? (
          <Metric label="Enhanced patients" tone={activeEnhancedCoverGapCount > 0 ? "warning" : "neutral"} value={enhancedPatients.length} />
        ) : null}
        {ward?.news2Enabled ? (
          <Metric label="NEWS2 score 5+" tone={activeNews2AttentionCount > 0 ? "danger" : "neutral"} value={activeNews2AttentionCount} />
        ) : null}
        {ward?.securityChecksEnabled ? (
          <Metric label="Security due" tone={activeSecurityDueCount > 0 ? "danger" : "neutral"} value={activeSecurityDueCount} />
        ) : null}
        <Metric
          label="Active incidents"
          tone={redIncidentCount > 0 ? "danger" : amberIncidentCount > 0 ? "warning" : "neutral"}
          value={activeIncidents.length}
        />
        <Metric
          label="Patient tasks due"
          tone={overdueTaskCount > 0 || redTaskCount > 0 ? "danger" : activePatientTasks.length > 0 ? "warning" : "neutral"}
          value={activePatientTasks.length}
        />
        <Metric label="Staff this shift" tone={shiftStaff.length === 0 ? "warning" : "neutral"} value={shiftStaff.length} />
      </View>

      <View style={styles.cardGrid}>
        <OverviewCard
          actionLabel="Open Safety Centre"
          eyebrow={`${redIncidentCount} red · ${amberIncidentCount} amber · ${greenIncidentCount} green`}
          title="Safety and escalation"
          onPress={onOpenSafetyCentre}
          wide={activeIncidents.length > 0}
        >
          {activeIncidents.length === 0 ? (
            <Text style={styles.emptyText}>No active incidents or safeguarding concerns.</Text>
          ) : (
            activeIncidents.slice(0, 4).map((incident) => {
              const patient = patients.find((item) => item.id === incident.patientId);
              return (
                <View key={incident.id} style={[styles.miniRow, incidentRowStyle(incident.severity)]}>
                  <View style={styles.incidentRagWrap}>
                    <View style={[styles.incidentRag, incidentRagStyle(incident.severity)]} />
                  </View>
                  <View style={styles.miniRowCopy}>
                    <Text style={styles.miniRowTitle}>{incident.title}</Text>
                    <Text style={styles.miniRowMeta}>
                      {patient
                        ? `Room ${patient.roomNumber} · ${patient.firstName} ${patient.surname}`
                        : "Patient unavailable"}{" "}
                      · {incident.category} · {formatShortDateTime(incident.reportedAt)}
                    </Text>
                  </View>
                  <IncidentStatusPill status={incident.status} />
                </View>
              );
            })
          )}
        </OverviewCard>

        <OverviewCard
          actionLabel="Open patient tasks"
          eyebrow={`${activePatientTasks.length} active · ${overdueTaskCount} overdue · ${redTaskCount} red`}
          title="Patient tasks"
          onPress={onOpenPatientTasks}
        >
          {activePatientTasks.length === 0 ? (
            <Text style={styles.emptyText}>No outstanding patient tasks.</Text>
          ) : (
            activePatientTasks.slice(0, 4).map((task) => {
              const patient = patients.find((item) => item.id === task.patientId);
              const overdue = new Date(task.dueAt).getTime() < now;
              return (
                <View key={task.id} style={[styles.miniRow, taskRowStyle(task.priority, overdue)]}>
                  <View style={styles.incidentRagWrap}>
                    <View style={[styles.incidentRag, incidentRagStyle(task.priority)]} />
                  </View>
                  <View style={styles.miniRowCopy}>
                    <Text style={styles.miniRowTitle}>{task.title}</Text>
                    <Text style={styles.miniRowMeta}>
                      {patient
                        ? `Room ${patient.roomNumber} · ${patient.firstName} ${patient.surname}`
                        : "Patient unavailable"}{" "}
                      · due {formatShortDateTime(task.dueAt)}
                    </Text>
                  </View>
                  <TaskStatusPill overdue={overdue} status={task.status} />
                </View>
              );
            })
          )}
        </OverviewCard>

        <OverviewCard
          actionLabel="Open general observations"
          eyebrow={`${overdueGeneralCount} overdue · ${soonGeneralCount} due soon`}
          title="General observations"
          onPress={onOpenGeneralObservations}
        >
          <MiniPatientList emptyText="No intermittent-observation patients on this ward." items={generalPatients.slice(0, 4)} />
        </OverviewCard>

        {ward?.enhancedObservationsEnabled ? (
          <OverviewCard
            actionLabel="Open enhanced observations"
            eyebrow={`${enhancedPatients.length} patients · ${enhancedCoverGapCount} cover gaps`}
            title="Enhanced / TESO"
            onPress={onOpenEnhanced}
          >
            {enhancedPatients.length === 0 ? (
              <Text style={styles.emptyText}>No enhanced observations active.</Text>
            ) : (
              enhancedPatients.slice(0, 4).map((item) => (
                <View key={item.patient.id} style={styles.miniRow}>
                  <View style={styles.miniRowCopy}>
                    <Text style={styles.miniRowTitle}>Room {item.patient.roomNumber} · {item.patient.firstName} {item.patient.surname}</Text>
                    <Text style={styles.miniRowMeta}>
                      {item.patient.observationLevel} · cover {item.assigned}/{item.required}
                    </Text>
                  </View>
                  <StatusPill
                    label={item.timing?.label ?? "Continuous"}
                    status={
                      item.assigned < item.required
                        ? "overdue"
                        : item.timing?.status ?? "ok"
                    }
                  />
                </View>
              ))
            )}
          </OverviewCard>
        ) : null}

        {ward?.foodFluidChartEnabled ? (
          <OverviewCard
            actionLabel="Open food and fluid chart"
            eyebrow={`${todayFoodFluidEntries.length} entries today · ${todayFluidTotal} ml fluid`}
            title="Food and fluid"
            onPress={onOpenFoodFluidChart}
          >
            {todayFoodFluidEntries.length === 0 ? (
              <Text style={styles.emptyText}>No food or fluid intake recorded today.</Text>
            ) : (
              todayFoodFluidEntries.slice(0, 4).map((entry) => {
                const patient = patients.find((item) => item.id === entry.patientId);
                return (
                  <View key={entry.id} style={styles.miniRow}>
                    <View style={styles.miniRowCopy}>
                      <Text style={styles.miniRowTitle}>
                        Room {patient?.roomNumber ?? "—"} ·{" "}
                        {patient ? `${patient.firstName} ${patient.surname}` : "Patient not found"}
                      </Text>
                      <Text style={styles.miniRowMeta}>
                        {entry.itemDescription} · {entry.mealPeriod} · {formatShortDateTime(entry.recordedAt)}
                        {entry.entryType === "Drink" ? ` · ${entry.fluidTakenMl ?? 0} ml` : ""}
                      </Text>
                    </View>
                    <FoodFluidPill intakeLevel={entry.intakeLevel} />
                  </View>
                );
              })
            )}
            {todayLowIntakeCount > 0 ? (
              <Text style={styles.warningText}>
                {todayLowIntakeCount} entr{todayLowIntakeCount === 1 ? "y" : "ies"} refused or below half today.
              </Text>
            ) : null}
          </OverviewCard>
        ) : null}

        {ward?.news2Enabled ? (
          <OverviewCard
            actionLabel="Open NEWS2"
            eyebrow={`${latestNews2.filter((item) => item.reading).length}/${patients.length} patients scored`}
            title="NEWS2 overview"
            onPress={onOpenNews2}
          >
            {latestNews2.slice(0, 4).map(({ patient, reading }) => (
              <View key={patient.id} style={styles.miniRow}>
                <View style={styles.miniRowCopy}>
                  <Text style={styles.miniRowTitle}>Room {patient.roomNumber} · {patient.firstName} {patient.surname}</Text>
                  <Text style={styles.miniRowMeta}>
                    {reading ? `Recorded ${formatShortDateTime(reading.recordedAt)}` : "No NEWS2 recorded"}
                  </Text>
                </View>
                <News2Pill score={reading?.totalScore} />
              </View>
            ))}
          </OverviewCard>
        ) : null}

        {ward?.securityChecksEnabled ? (
          <OverviewCard
            actionLabel="Open security checks"
            eyebrow={`${securitySummary.completedThisShift}/${activeSecurityAreas.length} recorded this shift`}
            title="Security checks"
            onPress={onOpenSecurityChecks}
          >
            {securitySummary.items.length === 0 ? (
              <Text style={styles.emptyText}>No security checks configured for this ward.</Text>
            ) : (
              securitySummary.items.slice(0, 4).map((item) => (
                <View key={item.area.id} style={styles.miniRow}>
                  <View style={styles.miniRowCopy}>
                    <Text style={styles.miniRowTitle}>{item.area.name}</Text>
                    <Text style={styles.miniRowMeta}>
                      {item.lastCheckedAt ? `Last ${formatShortDateTime(item.lastCheckedAt)}` : "Not yet recorded"}
                    </Text>
                  </View>
                  <StatusPill label={item.label} status={item.due ? "overdue" : "ok"} />
                </View>
              ))
            )}
          </OverviewCard>
        ) : null}

        {ward?.staffRotaEnabled ? (
          <OverviewCard
            actionLabel="Open staff rota"
            eyebrow={`${shiftStaff.length} staff assigned · ${enhancedCoverGapCount} enhanced gaps`}
            title="Staff this shift"
            onPress={onOpenStaffRota}
            wide
          >
            <View style={styles.leadGrid}>
              <LeadDetail label="Nurse in charge" value={formatNames(nurseInCharge)} />
              <LeadDetail label="Medication nurse" value={formatNames(medicationNurse)} />
              <LeadDetail label="Shift" value={currentShift?.label ?? "Not configured"} />
            </View>
            {shiftStaff.length === 0 ? (
              <Text style={styles.warningText}>No staff have been assigned to the current shift.</Text>
            ) : (
              <View style={styles.staffChips}>
                {shiftStaff.map(({ assignment, member }) => (
                  <View key={assignment.id} style={styles.staffChip}>
                    <Text style={styles.staffChipName}>{member.name}</Text>
                    <Text style={styles.staffChipRole}>
                      {member.role}
                      {assignment.nurseInCharge ? " · NIC" : ""}
                      {assignment.medicationNurse ? " · Meds" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </OverviewCard>
        ) : null}
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>Quick actions</Text>
        <View style={styles.quickActionRow}>
          <QuickAction label="Record general check" onPress={onOpenGeneralObservations} />
          <QuickAction label="Analytics dashboard" onPress={onOpenAnalytics} />
          {ward?.enhancedObservationsEnabled ? <QuickAction label="Enhanced / TESO" onPress={onOpenEnhanced} /> : null}
          {ward?.news2Enabled ? <QuickAction label="Record NEWS2" onPress={onOpenNews2} /> : null}
          {ward?.foodFluidChartEnabled ? (
            <QuickAction label="Food & fluid" onPress={onOpenFoodFluidChart} />
          ) : null}
          <QuickAction label="Patient settings / TESO" onPress={onOpenPatientSettings} />
          <QuickAction label="Patient management" onPress={onOpenPatientManagement} />
          <QuickAction label="Patient notes" onPress={onOpenPatientNotes} />
          <QuickAction label="Patient tasks" onPress={onOpenPatientTasks} />
          <QuickAction label="Care plans" onPress={onOpenPatientCarePlans} />
          <QuickAction label="Safety centre / incidents" onPress={onOpenSafetyCentre} />
          <QuickAction label="Shift handover" onPress={onOpenShiftHandover} />
          <QuickAction label="Previous observations" onPress={onOpenPreviousObservations} />
          {ward?.securityChecksEnabled ? <QuickAction label="Security check" onPress={onOpenSecurityChecks} /> : null}
          {ward?.medicationChartEnabled ? <QuickAction label="Medication chart" onPress={onOpenMedicationChart} /> : null}
          {ward?.staffRotaEnabled ? <QuickAction label="Staff rota" onPress={onOpenStaffRota} /> : null}
        </View>
      </View>
    </View>
  );
}

function OverviewCard({
  actionLabel,
  children,
  eyebrow,
  onPress,
  title,
  wide = false
}: {
  actionLabel: string;
  children: React.ReactNode;
  eyebrow: string;
  onPress: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardEyebrow}>{eyebrow}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.cardButton}>
          <Text style={styles.cardButtonText}>{actionLabel} →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function MiniPatientList({ emptyText, items }: { emptyText: string; items: TimedPatient[] }) {
  if (items.length === 0) return <Text style={styles.emptyText}>{emptyText}</Text>;
  return (
    <>
      {items.map((item) => (
        <View key={item.patient.id} style={styles.miniRow}>
          <View style={styles.miniRowCopy}>
            <Text style={styles.miniRowTitle}>Room {item.patient.roomNumber} · {item.patient.firstName} {item.patient.surname}</Text>
            <Text style={styles.miniRowMeta}>
              Last {formatShortTime(item.patient.latestObservationTime)} · {item.patient.latestObservationPlace}
            </Text>
          </View>
          <StatusPill label={item.label} status={item.status} />
        </View>
      ))}
    </>
  );
}

function Metric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "danger" | "neutral" | "warning";
  value: number;
}) {
  return (
    <View style={[styles.metric, tone === "danger" && styles.metricDanger, tone === "warning" && styles.metricWarning]}>
      <Text style={[styles.metricValue, tone === "danger" && styles.metricValueDanger]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, status }: { label: string; status: TimingStatus }) {
  return (
    <View
      style={[
        styles.statusPill,
        status === "soon" && styles.statusPillSoon,
        status === "due" && styles.statusPillDue,
        status === "overdue" && styles.statusPillOverdue
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          (status === "due" || status === "overdue") && styles.statusPillTextOverdue
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function News2Pill({ score }: { score?: number }) {
  const tone = score === undefined ? "none" : score >= 7 ? "red" : score >= 5 ? "amber" : score >= 1 ? "yellow" : "white";
  return (
    <View
      style={[
        styles.news2Pill,
        tone === "red" && styles.news2PillRed,
        tone === "amber" && styles.news2PillAmber,
        tone === "yellow" && styles.news2PillYellow
      ]}
    >
      <Text style={styles.news2PillLabel}>NEWS2</Text>
      <Text style={styles.news2PillScore}>{score ?? "—"}</Text>
    </View>
  );
}

function FoodFluidPill({ intakeLevel }: { intakeLevel: FoodFluidEntry["intakeLevel"] }) {
  const low = intakeLevel === "Refused" || intakeLevel === "Less than half";
  return (
    <View style={[styles.foodFluidPill, low && styles.foodFluidPillLow]}>
      <Text style={[styles.foodFluidPillText, low && styles.foodFluidPillTextLow]}>{intakeLevel}</Text>
    </View>
  );
}

function IncidentStatusPill({ status }: { status: SafetyIncident["status"] }) {
  return (
    <View style={styles.incidentStatusPill}>
      <Text style={styles.incidentStatusText}>
        {status === "open" ? "Open" : status === "acknowledged" ? "Acknowledged" : "Resolved"}
      </Text>
    </View>
  );
}

function TaskStatusPill({
  overdue,
  status
}: {
  overdue: boolean;
  status: PatientTask["status"];
}) {
  return (
    <View style={[styles.incidentStatusPill, overdue && styles.taskStatusOverdue]}>
      <Text style={[styles.incidentStatusText, overdue && styles.taskStatusTextOverdue]}>
        {overdue ? "Overdue" : status === "accepted" ? "Accepted" : "Open"}
      </Text>
    </View>
  );
}

function LeadDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.leadDetail}>
      <Text style={styles.leadLabel}>{label}</Text>
      <Text style={styles.leadValue}>{value}</Text>
    </View>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.quickAction}>
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function toTimedPatient(patient: Patient, intervalMinutes: number, now: number): TimedPatient {
  return { patient, ...getTimingFromBaseline(patient.latestObservationTime, intervalMinutes, now) };
}

function getTimingFromBaseline(baseline: string, intervalMinutes: number, now: number) {
  const baselineTime = new Date(baseline).getTime();
  if (Number.isNaN(baselineTime)) {
    return { label: "Timing unavailable", minutes: Number.NEGATIVE_INFINITY, status: "overdue" as const };
  }

  const minutes = Math.round((baselineTime + intervalMinutes * 60 * 1000 - now) / 60000);
  if (minutes < 0) return { label: `${Math.abs(minutes)}m overdue`, minutes, status: "overdue" as const };
  if (minutes === 0) return { label: "Due now", minutes, status: "due" as const };
  if (minutes <= 5) return { label: `Due in ${minutes}m`, minutes, status: "soon" as const };
  return { label: `Due in ${minutes}m`, minutes, status: "ok" as const };
}

function compareTimedPatients(left: TimedPatient, right: TimedPatient) {
  return left.minutes - right.minutes || left.patient.roomNumber - right.patient.roomNumber;
}

function requiredStaffCount(patient: Patient) {
  const ratio = patient.enhancedObservation?.staffRatio ?? "1:1";
  const parsed = Number.parseInt(ratio.split(":")[0] ?? "1", 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

function buildSecuritySummary(
  areas: SecurityArea[],
  checks: SecurityCheck[],
  shift: ReturnType<typeof getCurrentShift>,
  now: number
) {
  const items = areas
    .map((area) => {
      const latest = checks
        .filter((check) => check.areaId === area.id)
        .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0];
      const lastCheckedAt = latest?.checkedAt;
      const lastCheckedTime = lastCheckedAt ? new Date(lastCheckedAt).getTime() : Number.NaN;
      const minutes = Number.isNaN(lastCheckedTime)
        ? Number.NEGATIVE_INFINITY
        : Math.round((lastCheckedTime + area.frequencyMinutes * 60 * 1000 - now) / 60000);
      const due = minutes <= 0;

      return {
        area,
        due,
        label: due ? "Due" : "Complete",
        lastCheckedAt
      };
    })
    .sort((left, right) => Number(right.due) - Number(left.due) || left.area.name.localeCompare(right.area.name));
  const completedThisShift = shift
    ? new Set(
        checks
          .filter((check) => {
            const checkedAt = new Date(check.checkedAt).getTime();
            return areas.some((area) => area.id === check.areaId) &&
              checkedAt >= shift.startsAt &&
              checkedAt < shift.endsAt;
          })
          .map((check) => check.areaId)
      ).size
    : 0;

  return {
    completedThisShift,
    dueCount: items.filter((item) => item.due).length,
    items
  };
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

    if (!isActive) continue;

    const startDate = new Date(nowDate);
    startDate.setHours(0, 0, 0, 0);
    if (crossesMidnight && nowMinutes < endMinutes) startDate.setDate(startDate.getDate() - 1);
    const startsAt = startDate.getTime() + startMinutes * 60 * 1000;
    const endsAt = startDate.getTime() + (crossesMidnight ? endMinutes + 24 * 60 : endMinutes) * 60 * 1000;

    return {
      dateKey: formatDateKey(startDate),
      endsAt,
      label: `Shift ${index + 1} · ${shift.startsAt}–${shift.endsAt}`,
      shiftId: shift.id,
      startsAt
    };
  }

  return undefined;
}

function getPrimaryAction(
  role: StaffMember["role"],
  counts: {
    enhancedCoverGapCount: number;
    incidentAttentionCount: number;
    taskAttentionCount: number;
    news2AttentionCount: number;
    overdueGeneralCount: number;
    securityDueCount: number;
  }
) {
  if (counts.incidentAttentionCount > 0) {
    return { label: "Open Safety Centre", target: "safety" as const };
  }
  if (counts.taskAttentionCount > 0) {
    return { label: "Review patient tasks", target: "tasks" as const };
  }
  if (role === "security" && counts.securityDueCount > 0) {
    return { label: "Open security checks", target: "security" as const };
  }
  if ((role === "manager" || role === "super_admin") && counts.enhancedCoverGapCount > 0) {
    return { label: "Review staffing gaps", target: "staff" as const };
  }
  if ((role === "nurse" || role === "doctor") && counts.news2AttentionCount > 0) {
    return { label: "Review NEWS2 alerts", target: "news2" as const };
  }
  if (counts.overdueGeneralCount > 0) {
    return { label: "Start next overdue check", target: "general" as const };
  }
  if (counts.enhancedCoverGapCount > 0) {
    return { label: "Review enhanced cover", target: "enhanced" as const };
  }
  return { label: "Open general observations", target: "general" as const };
}

function compareSafetyIncidents(left: SafetyIncident, right: SafetyIncident) {
  const severityOrder = { red: 0, amber: 1, green: 2 };
  return (
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.status.localeCompare(right.status) ||
    right.reportedAt.localeCompare(left.reportedAt)
  );
}

function comparePatientTasks(left: PatientTask, right: PatientTask) {
  const now = Date.now();
  const leftOverdue = new Date(left.dueAt).getTime() < now;
  const rightOverdue = new Date(right.dueAt).getTime() < now;
  const priorityOrder = { red: 0, amber: 1, green: 2 };
  return (
    Number(rightOverdue) - Number(leftOverdue) ||
    priorityOrder[left.priority] - priorityOrder[right.priority] ||
    left.dueAt.localeCompare(right.dueAt)
  );
}

function taskRowStyle(priority: PatientTask["priority"], overdue: boolean) {
  if (overdue || priority === "red") return styles.incidentRowRed;
  if (priority === "amber") return styles.incidentRowAmber;
  return styles.incidentRowGreen;
}

function incidentRowStyle(severity: SafetyIncident["severity"]) {
  if (severity === "red") return styles.incidentRowRed;
  if (severity === "amber") return styles.incidentRowAmber;
  return styles.incidentRowGreen;
}

function incidentRagStyle(severity: SafetyIncident["severity"]) {
  if (severity === "red") return styles.incidentRagRed;
  if (severity === "amber") return styles.incidentRagAmber;
  return styles.incidentRagGreen;
}

function timeToMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatClock(now: number) {
  return new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShortTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatNames(names: string[]) {
  return names.length > 0 ? names.join(", ") : "Not set";
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 1240,
    padding: 16,
    width: "100%"
  },
  hero: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
  },
  eyebrow: { color: "#17677a", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#15252c", fontSize: 28, fontWeight: "900", marginTop: 3 },
  meta: { color: "#607078", fontSize: 13, fontWeight: "700", marginTop: 5 },
  heroActions: { alignItems: "flex-end", gap: 8 },
  syncPill: { backgroundColor: "#e4f3ec", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  syncPillWarning: { backgroundColor: "#fff0c7" },
  syncPillText: { color: "#275f48", fontSize: 11, fontWeight: "900" },
  syncPillTextWarning: { color: "#795518" },
  outlineButton: {
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  outlineButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  attentionBar: {
    alignItems: "center",
    backgroundColor: "#edf7f4",
    borderColor: "#cce3da",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  attentionBarUrgent: { backgroundColor: "#fff3ec", borderColor: "#efc2ad" },
  attentionCopy: { flex: 1, paddingRight: 12 },
  attentionTitle: { color: "#235c48", fontSize: 16, fontWeight: "900" },
  attentionTitleUrgent: { color: "#8d382c" },
  attentionMeta: { color: "#65747a", fontSize: 12, fontWeight: "700", marginTop: 3 },
  primaryButton: {
    backgroundColor: "#174f61",
    borderRadius: 7,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 15
  },
  primaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 145,
    padding: 12
  },
  metricDanger: { backgroundColor: "#fff0ed", borderColor: "#eab0a5" },
  metricWarning: { backgroundColor: "#fff8df", borderColor: "#ead28c" },
  metricValue: { color: "#173a46", fontSize: 24, fontWeight: "900" },
  metricValueDanger: { color: "#a43a2f" },
  metricLabel: { color: "#65747a", fontSize: 11, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 360,
    padding: 14
  },
  cardWide: { flexBasis: "100%" },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { color: "#18262c", fontSize: 18, fontWeight: "900" },
  cardEyebrow: { color: "#6a787e", fontSize: 11, fontWeight: "800", marginTop: 3 },
  cardButton: { paddingLeft: 10, paddingVertical: 4 },
  cardButtonText: { color: "#14677a", fontSize: 11, fontWeight: "900" },
  cardBody: { gap: 7 },
  miniRow: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#e2e8ea",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    padding: 9
  },
  incidentRowRed: { backgroundColor: "#fff1ee", borderColor: "#e6b0a8" },
  incidentRowAmber: { backgroundColor: "#fff8e4", borderColor: "#e3cf91" },
  incidentRowGreen: { backgroundColor: "#eff8f3", borderColor: "#bddac9" },
  incidentRagWrap: { alignItems: "center", justifyContent: "center", paddingRight: 9 },
  incidentRag: { borderRadius: 999, height: 14, width: 14 },
  incidentRagRed: { backgroundColor: "#c83e33" },
  incidentRagAmber: { backgroundColor: "#e1a42c" },
  incidentRagGreen: { backgroundColor: "#37855d" },
  miniRowCopy: { flex: 1, paddingRight: 8 },
  miniRowTitle: { color: "#21363f", fontSize: 12, fontWeight: "900" },
  miniRowMeta: { color: "#6b797f", fontSize: 10, fontWeight: "700", marginTop: 3 },
  emptyText: { color: "#6b797f", fontSize: 12, paddingVertical: 12 },
  warningText: { color: "#944033", fontSize: 12, fontWeight: "900", paddingVertical: 10 },
  statusPill: { backgroundColor: "#e6f3ec", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusPillSoon: { backgroundColor: "#fff2ae" },
  statusPillDue: { backgroundColor: "#ffd1b2" },
  statusPillOverdue: { backgroundColor: "#f6b2a7" },
  statusPillText: { color: "#315a4b", fontSize: 10, fontWeight: "900" },
  statusPillTextOverdue: { color: "#8f3027" },
  news2Pill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#ccd7da",
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 56,
    padding: 5
  },
  news2PillYellow: { backgroundColor: "#fff3a3", borderColor: "#ead47e" },
  news2PillAmber: { backgroundColor: "#ffc785", borderColor: "#dda35f" },
  news2PillRed: { backgroundColor: "#f08f78", borderColor: "#cc6a55" },
  news2PillLabel: { color: "#52636a", fontSize: 8, fontWeight: "900" },
  news2PillScore: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  foodFluidPill: { backgroundColor: "#e6f3ec", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  foodFluidPillLow: { backgroundColor: "#f6bdb1" },
  foodFluidPillText: { color: "#2c604f", fontSize: 9, fontWeight: "900" },
  foodFluidPillTextLow: { color: "#91382e" },
  incidentStatusPill: { backgroundColor: "#e7edef", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  incidentStatusText: { color: "#40555d", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  taskStatusOverdue: { backgroundColor: "#f5b8ae" },
  taskStatusTextOverdue: { color: "#812d25" },
  leadGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  leadDetail: { backgroundColor: "#f5f8f9", borderRadius: 7, flexGrow: 1, minWidth: 210, padding: 10 },
  leadLabel: { color: "#6b797f", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  leadValue: { color: "#21363f", fontSize: 12, fontWeight: "900", marginTop: 3 },
  staffChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 3 },
  staffChip: { backgroundColor: "#eaf2f4", borderRadius: 7, minWidth: 150, padding: 9 },
  staffChipName: { color: "#21363f", fontSize: 11, fontWeight: "900" },
  staffChipRole: { color: "#607078", fontSize: 9, fontWeight: "800", marginTop: 2, textTransform: "capitalize" },
  quickActions: {
    backgroundColor: "#0d3443",
    borderRadius: 10,
    padding: 14
  },
  quickActionsTitle: { color: "#ffffff", fontSize: 14, fontWeight: "900", marginBottom: 9 },
  quickActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAction: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  quickActionText: { color: "#164e60", fontSize: 11, fontWeight: "900" }
});
