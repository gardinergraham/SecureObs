import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type {
  MissedObservation,
  News2Reading,
  Patient,
  PatientCarePlan,
  PatientTask,
  SafetyIncident,
  SecurityArea,
  SecurityCheck,
  ShiftHandover,
  Ward
} from "../types/domain";

type Props = {
  carePlans: PatientCarePlan[];
  incidents: SafetyIncident[];
  missedObservations: MissedObservation[];
  news2Readings: News2Reading[];
  patients: Patient[];
  patientTasks: PatientTask[];
  securityChecks: SecurityCheck[];
  securityAreas: SecurityArea[];
  shiftHandovers: ShiftHandover[];
  ward?: Ward;
  onBack: () => void;
  onOpenAuditLog: () => void;
  onOpenIncidents: () => void;
  onOpenPatientCarePlans: () => void;
  onOpenPatientTasks: () => void;
  onOpenWardSettings: () => void;
};

type EvidenceStatus = "ready" | "review" | "attention";

export function ComplianceGovernanceScreen({
  carePlans,
  incidents,
  missedObservations,
  news2Readings,
  patients,
  patientTasks,
  securityChecks,
  securityAreas,
  shiftHandovers,
  ward,
  onBack,
  onOpenAuditLog,
  onOpenIncidents,
  onOpenPatientCarePlans,
  onOpenPatientTasks,
  onOpenWardSettings
}: Props) {
  const now = Date.now();
  const evidence = useMemo(() => {
    const patientIds = new Set(patients.map((patient) => patient.id));
    const wardIncidents = incidents.filter((incident) => incident.wardId === ward?.id);
    const openIncidents = wardIncidents.filter((incident) => incident.status !== "resolved").length;
    const overdueTasks = patientTasks.filter(
      (task) =>
        task.wardId === ward?.id &&
        task.status !== "completed" &&
        task.status !== "cancelled" &&
        new Date(task.dueAt).getTime() < now
    ).length;
    const coveredCarePlans = new Set(
      carePlans.filter((plan) => plan.wardId === ward?.id && patientIds.has(plan.patientId)).map((plan) => plan.patientId)
    ).size;
    const news2Covered = new Set(news2Readings.filter((reading) => patientIds.has(reading.patientId)).map((reading) => reading.patientId)).size;
    const recentMisses = missedObservations.filter(
      (entry) => entry.wardId === ward?.id && new Date(entry.recordedAt).getTime() >= now - 7 * 24 * 60 * 60 * 1000
    ).length;
    const wardSecurityAreaIds = new Set(securityAreas.filter((area) => area.wardId === ward?.id).map((area) => area.id));
    const recentSecurity = securityChecks.filter(
      (check) => wardSecurityAreaIds.has(check.areaId) && new Date(check.checkedAt).getTime() >= now - 24 * 60 * 60 * 1000
    ).length;
    const handovers = shiftHandovers.filter((handover) => handover.wardId === ward?.id).length;

    return {
      openIncidents,
      overdueTasks,
      coveredCarePlans,
      news2Covered,
      recentMisses,
      recentSecurity,
      handovers,
      incidentTotal: wardIncidents.length
    };
  }, [carePlans, incidents, missedObservations, news2Readings, patientTasks, patients, securityAreas, securityChecks, shiftHandovers, ward?.id]);

  const questions = [
    {
      name: "Safe",
      detail: `${evidence.openIncidents} open incidents · ${evidence.recentMisses} missed checks in 7 days`,
      status: evidence.openIncidents > 0 || evidence.recentMisses > 0 ? "attention" : "ready"
    },
    {
      name: "Effective",
      detail: `${evidence.news2Covered}/${patients.length} patients with NEWS2 · ${evidence.coveredCarePlans}/${patients.length} with care plans`,
      status: evidence.coveredCarePlans < patients.length ? "review" : "ready"
    },
    {
      name: "Caring",
      detail: `${evidence.coveredCarePlans}/${patients.length} care plans provide documented person-centred evidence`,
      status: evidence.coveredCarePlans < patients.length ? "review" : "ready"
    },
    {
      name: "Responsive",
      detail: `${evidence.overdueTasks} overdue patient tasks · ${evidence.incidentTotal} incidents recorded`,
      status: evidence.overdueTasks > 0 ? "attention" : "ready"
    },
    {
      name: "Well-led",
      detail: `${evidence.handovers} shift handovers · ${evidence.recentSecurity} security checks in 24 hours`,
      status: evidence.handovers > 0 ? "ready" : "review"
    }
  ] satisfies Array<{ name: string; detail: string; status: EvidenceStatus }>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MANAGER ENVIRONMENT</Text>
          <Text style={styles.title}>Compliance & governance</Text>
          <Text style={styles.subtitle}>{ward?.name ?? "Select a ward"} · CQC evidence readiness</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Evidence readiness, not a CQC rating</Text>
        <Text style={styles.noticeText}>
          This view organises operational evidence against the five key questions. It highlights gaps for manager review
          and does not predict or replace a CQC assessment.
        </Text>
      </View>

      <View style={styles.questionGrid}>
        {questions.map((question) => (
          <View key={question.name} style={[styles.questionCard, styles[`${question.status}Card`]]}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionName}>{question.name}</Text>
              <Text style={[styles.status, styles[`${question.status}Text`]]}>
                {question.status === "ready" ? "Evidence available" : question.status === "review" ? "Review" : "Needs attention"}
              </Text>
            </View>
            <Text style={styles.questionDetail}>{question.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Governance workspace</Text>
      <View style={styles.moduleGrid}>
        <Module title="Incident management" meta={`${evidence.openIncidents} open · investigate, action and resolve`} onPress={onOpenIncidents} />
        <Module title="Audits" meta="Searchable, time-stamped activity and access evidence" onPress={onOpenAuditLog} />
        <Module title="CQC reporting" meta="Five key questions with live evidence-gap prompts" />
        <Module title="Governance" meta={`${evidence.handovers} handovers recorded for this ward`} />
        <Module title="Role permissions" meta="Review staff roles and ward access controls" onPress={onOpenWardSettings} />
        <Module title="Digital forms" meta={`${evidence.coveredCarePlans}/${patients.length} patients currently have a care plan`} onPress={onOpenPatientCarePlans} />
        <Module title="Policies" meta="Policy register and review acknowledgements will be added next" muted />
        <Module title="Actions" meta={`${evidence.overdueTasks} overdue patient tasks require manager review`} onPress={onOpenPatientTasks} />
      </View>
    </View>
  );
}

function Module({ title, meta, muted, onPress }: { title: string; meta: string; muted?: boolean; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.moduleMeta}>{meta}</Text>
      <Text style={styles.moduleAction}>{onPress ? "Open →" : muted ? "Planned" : "Overview"}</Text>
    </>
  );
  return onPress ? (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.moduleCard}>{content}</TouchableOpacity>
  ) : (
    <View style={[styles.moduleCard, muted && styles.moduleMuted]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: { alignItems: "center", backgroundColor: "#fff", borderColor: "#d7e1e4", borderRadius: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16 },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#00869b", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: "#102f49", fontSize: 26, fontWeight: "900", marginTop: 3 },
  subtitle: { color: "#607078", fontSize: 13, marginTop: 3 },
  backButton: { borderColor: "#165365", borderRadius: 7, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11 },
  backText: { color: "#165365", fontWeight: "900" },
  notice: { backgroundColor: "#eef8fa", borderColor: "#acd7df", borderRadius: 9, borderWidth: 1, padding: 13 },
  noticeTitle: { color: "#124b5c", fontSize: 14, fontWeight: "900" },
  noticeText: { color: "#48666f", fontSize: 12, lineHeight: 18, marginTop: 3 },
  questionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  questionCard: { borderRadius: 9, borderWidth: 1, flexGrow: 1, minWidth: 210, padding: 13 },
  readyCard: { backgroundColor: "#eff8f3", borderColor: "#acd6be" },
  reviewCard: { backgroundColor: "#fff9e8", borderColor: "#ead28a" },
  attentionCard: { backgroundColor: "#fff0ed", borderColor: "#e5b0a7" },
  questionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  questionName: { color: "#183440", fontSize: 17, fontWeight: "900" },
  status: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  readyText: { color: "#26734b" },
  reviewText: { color: "#8a6715" },
  attentionText: { color: "#a33d32" },
  questionDetail: { color: "#536970", fontSize: 12, lineHeight: 17, marginTop: 9 },
  sectionTitle: { color: "#123a50", fontSize: 19, fontWeight: "900", marginTop: 2 },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleCard: { backgroundColor: "#fff", borderColor: "#d4dfe2", borderRadius: 9, borderWidth: 1, flexGrow: 1, minHeight: 112, minWidth: 225, padding: 14 },
  moduleMuted: { backgroundColor: "#f4f6f7" },
  moduleTitle: { color: "#153d50", fontSize: 15, fontWeight: "900" },
  moduleMeta: { color: "#607078", flex: 1, fontSize: 12, lineHeight: 17, marginTop: 6 },
  moduleAction: { color: "#00839a", fontSize: 11, fontWeight: "900", marginTop: 8 }
});
