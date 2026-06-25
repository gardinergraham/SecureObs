import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Print from "expo-print";

import type {
  EnhancedObservationPlan,
  ObservationLevel,
  Patient,
  PatientFormRecord,
  PatientFormSection,
  PatientFormSectionRisk,
  StaffMember,
  StaffRatio,
  TesoEpisode,
  TesoReason
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

type TesoObservationLevel = Exclude<ObservationLevel, "Intermittent">;

const enhancedObservationLevels: TesoObservationLevel[] = ["General observation", "Eyesight", "Within arms length"];
const ratios: StaffRatio[] = ["1:1", "2:1", "3:1", "4:1", "5:1", "6:1"];
const reviewFrequencyOptions = [15, 30, 60, 120, 240];
const riskOptions: PatientFormSectionRisk[] = ["Low", "Medium", "High", "Not assessed"];
const reasons: TesoReason[] = [
  "Risk to self",
  "Risk to others",
  "Risk from others",
  "Medication intervention",
  "Security",
  "Physical health",
  "Other"
];
const workplaceRiskAssessmentTemplate = {
  id: "workplace-environment-risk-assessment-v1",
  title: "Risk assessment - workplace environment",
  reference: "Form No. 1",
  description: "Service user's property or workplace environment",
  sections: [
    "Moving safely around the property or workplace environment",
    "Security and emergencies",
    "Electricity and electrical appliances",
    "Gas, heating and fire lighting facilities",
    "Cleaning, washing and laundering facilities",
    "Kitchen, food handling and meals",
    "Medication",
    "Garden and exterior features"
  ]
};

type TesoDraft = {
  observationLevel: TesoObservationLevel | "";
  staffRatio: StaffRatio;
  reasons: TesoReason[];
  otherReason: string;
  carePlan: string;
  reviewFrequencyMinutes: number;
};

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
  const canEdit =
    hasStaffRole(selectedStaff, "nurse") ||
    hasStaffRole(selectedStaff, "manager") ||
    hasStaffRole(selectedStaff, "doctor") ||
    hasAdminAccess(selectedStaff);
  const orderedPatients = useMemo(
    () => [...patients].sort((a, b) => a.roomNumber - b.roomNumber),
    [patients]
  );
  const [selectedPatientId, setSelectedPatientId] = useState(orderedPatients[0]?.id ?? "");
  const [tesoDraft, setTesoDraft] = useState<TesoDraft>(() => createDefaultDraft());
  const [activeCarePlanDraft, setActiveCarePlanDraft] = useState("");
  const [endReason, setEndReason] = useState("");
  const [formSections, setFormSections] = useState<PatientFormSection[]>(() => createDefaultFormSections());
  const [formReviewDate, setFormReviewDate] = useState("");
  const [serviceUserSignature, setServiceUserSignature] = useState("");
  const [staffSignature, setStaffSignature] = useState("");
  const detailScrollRef = useRef<ScrollView>(null);
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const hasActiveTeso = Boolean(
    selectedPatient && (selectedPatient.enhancedObservation || selectedPatient.observationLevel !== "Intermittent")
  );
  const canStartTeso =
    Boolean(tesoDraft.observationLevel) &&
    tesoDraft.reasons.length > 0 &&
    (!tesoDraft.reasons.includes("Other") || tesoDraft.otherReason.trim().length > 0);
  const activeTesoMissingCarePlan =
    hasActiveTeso && !selectedPatient?.enhancedObservation?.carePlan.trim();
  const draftTesoMissingCarePlan = !tesoDraft.carePlan.trim();

  useEffect(() => {
    setTesoDraft(createDefaultDraft());
    setEndReason("");
    setFormSections(createDefaultFormSections());
    setFormReviewDate("");
    setServiceUserSignature("");
    setStaffSignature("");
  }, [selectedPatientId]);

  useEffect(() => {
    setActiveCarePlanDraft(selectedPatient?.enhancedObservation?.carePlan ?? "");
  }, [selectedPatient?.enhancedObservation?.carePlan, selectedPatient?.id]);

  const updatePatient = (nextPatient: Patient) => {
    if (!canEdit) {
      return;
    }

    onUpdatePatient(nextPatient);
  };

  const updateActiveTesoPlan = (patient: Patient, planUpdate: Partial<EnhancedObservationPlan>) => {
    const currentPlan = patient.enhancedObservation ?? createDefaultPlan(selectedStaff?.name ?? "");

    updatePatient(
      syncActiveTesoEpisode({
        ...patient,
        enhancedObservation: {
          ...currentPlan,
          ...planUpdate
        }
      })
    );
  };

  const startTeso = () => {
    if (!selectedPatient || !canEdit || hasActiveTeso || !canStartTeso || !tesoDraft.observationLevel) {
      return;
    }

    const plan = createPlanFromDraft(tesoDraft, selectedStaff?.name ?? "");
    const observationLevel = tesoDraft.observationLevel;

    updatePatient({
      ...selectedPatient,
      observationLevel,
      enhancedObservation: plan,
      tesoHistory: [
        createTesoEpisode({
          plan,
          observationLevel,
          episodeId: `teso-${Date.now()}`
        }),
        ...(selectedPatient.tesoHistory ?? [])
      ]
    });
    setTesoDraft(createDefaultDraft());
  };

  const endTeso = () => {
    if (!selectedPatient || !canEdit || !hasActiveTeso) {
      return;
    }

    const endedAt = new Date().toISOString();
    const currentPlan = selectedPatient.enhancedObservation;

    if (!currentPlan) {
      updatePatient({
        ...selectedPatient,
        observationLevel: "Intermittent",
        enhancedObservation: undefined
      });
      return;
    }

    const history = selectedPatient.tesoHistory ?? [];
    const activeEpisodeIndex = history.findIndex((episode) => !episode.endedAt);
    const endedEpisode = createTesoEpisode({
      plan: currentPlan,
      observationLevel: selectedPatient.observationLevel === "Intermittent" ? "Eyesight" : selectedPatient.observationLevel,
      episodeId: `teso-${Date.now()}`,
      endedAt,
      endedReason: endReason.trim() || "Ended by clinical review"
    });

    const tesoHistory =
      activeEpisodeIndex >= 0
        ? history.map((episode, index) =>
            index === activeEpisodeIndex
              ? {
                  ...episode,
                  endedAt,
                  reasons: currentPlan.reasons,
                  otherReason: currentPlan.otherReason,
                  observationLevel:
                    selectedPatient.observationLevel === "Intermittent" ? episode.observationLevel : selectedPatient.observationLevel,
                  staffRatio: currentPlan.staffRatio,
                  authorisedBy: currentPlan.authorisedBy,
                  carePlan: currentPlan.carePlan,
                  reviewFrequencyMinutes: currentPlan.reviewFrequencyMinutes,
                  nextReviewAt: currentPlan.nextReviewAt,
                  endedReason: endReason.trim() || "Ended by clinical review"
                }
              : episode
          )
        : [endedEpisode, ...history];

    updatePatient({
      ...selectedPatient,
      observationLevel: "Intermittent",
      enhancedObservation: undefined,
      tesoHistory
    });
    setEndReason("");
  };

  const updateFormSection = (sectionId: string, updates: Partial<PatientFormSection>) => {
    setFormSections((currentSections) =>
      currentSections.map((section) => (section.id === sectionId ? { ...section, ...updates } : section))
    );
  };

  const savePatientForm = (status: PatientFormRecord["status"]) => {
    if (!selectedPatient || !canEdit) {
      return;
    }

    if (status === "Completed" && (!serviceUserSignature.trim() || !staffSignature.trim())) {
      Alert.alert("Signatures needed", "Add the service user and staff signatures before completing this form.");
      return;
    }

    const formRecord = createPatientFormRecord({
      completedBy: selectedStaff?.name ?? "Unknown staff",
      reviewDate: formReviewDate.trim(),
      sections: formSections,
      serviceUserSignature: serviceUserSignature.trim(),
      staffSignature: staffSignature.trim(),
      status
    });

    updatePatient({
      ...selectedPatient,
      patientForms: [formRecord, ...(selectedPatient.patientForms ?? [])]
    });

    Alert.alert(
      status === "Completed" ? "Form completed" : "Draft saved",
      `${workplaceRiskAssessmentTemplate.title} saved for ${selectedPatient.firstName} ${selectedPatient.surname}.`
    );
  };

  const printRiskAssessment = async (formRecord?: PatientFormRecord) => {
    if (!selectedPatient) {
      return;
    }

    try {
      await Print.printAsync({
        html: buildRiskAssessmentHtml({
          formRecord,
          patient: selectedPatient,
          sections: formRecord?.sections ?? formSections,
          selectedStaffName: selectedStaff?.name ?? "",
          serviceUserSignature: formRecord?.serviceUserSignature ?? serviceUserSignature,
          staffSignature: formRecord?.staffSignature ?? staffSignature,
          reviewDate: formRecord?.reviewDate ?? formReviewDate
        })
      });
    } catch (error) {
      Alert.alert("Unable to print", error instanceof Error ? error.message : "The print dialog could not be opened.");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient settings</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} | {canEdit ? "Clinical edit access" : "HCF locked"}
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

        <ScrollView
          contentContainerStyle={styles.detailContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          ref={detailScrollRef}
          showsVerticalScrollIndicator
          style={styles.detailPane}
        >
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

              {!canEdit ? (
                <View style={styles.warningPanel}>
                  <Text style={styles.warningTitle}>Editing locked</Text>
                  <Text style={styles.warningText}>Select a nurse, manager, or doctor staff profile to update TESO settings.</Text>
                </View>
              ) : null}

              <View style={styles.tesoActionPanel}>
                <View style={styles.actionTextBlock}>
                  <Text style={styles.actionTitle}>
                    {hasActiveTeso ? "TESO currently active" : "TESO not active"}
                  </Text>
                  <Text style={styles.actionMeta}>
                    {hasActiveTeso && selectedPatient.enhancedObservation
                      ? `Started ${formatDateTime(selectedPatient.enhancedObservation.startedAt)}${
                          activeTesoMissingCarePlan ? " | Care plan missing" : ""
                        }`
                      : hasActiveTeso
                        ? `${selectedPatient.observationLevel} observation is active | Care plan missing`
                      : "Patient is on intermittent observation unless a new TESO episode is started."}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEdit || (!hasActiveTeso && !canStartTeso)}
                  onPress={hasActiveTeso ? endTeso : startTeso}
                  style={[
                    styles.tesoActionButton,
                    hasActiveTeso && styles.endTesoButton,
                    (!canEdit || (!hasActiveTeso && !canStartTeso)) && styles.disabledControl
                  ]}
                >
                  <Text style={styles.tesoActionButtonText}>
                    {hasActiveTeso ? "End TESO" : "Start TESO"}
                  </Text>
                </TouchableOpacity>
              </View>

              {hasActiveTeso ? (
                <>
                  <Text style={styles.label}>TESO level</Text>
                  <OptionRow
                    disabled={!canEdit}
                    options={enhancedObservationLevels}
                    selected={selectedPatient.observationLevel}
                    onSelect={(level) => {
                      const observationLevel = level as TesoObservationLevel;
                      updatePatient(syncActiveTesoEpisode({ ...selectedPatient, observationLevel }));
                    }}
                  />
                </>
              ) : null}

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
                  updatePatient({
                    ...selectedPatient,
                    seclusion: value === "Seclusion",
                    longTermSeclusion: value === "Long-term seclusion"
                  })
                }
              />

              {hasActiveTeso ? (
              <View style={styles.tesoPanel}>
                {activeTesoMissingCarePlan ? (
                  <View style={styles.warningPanel}>
                    <Text style={styles.warningTitle}>Care plan needed</Text>
                    <Text style={styles.warningText}>This TESO is active without a plan of care. Add or update it below.</Text>
                  </View>
                ) : null}

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

                    updatePatient(
                      syncActiveTesoEpisode({
                        ...selectedPatient,
                        enhancedObservation: {
                          ...currentPlan,
                          reasons: nextReasons
                        }
                      })
                    );
                  }}
                />

                <Text style={styles.label}>Other reason</Text>
                <TextInput placeholderTextColor="#6f7f87"
                  editable={canEdit}
                  onChangeText={(otherReason) =>
                    updateActiveTesoPlan(selectedPatient, { otherReason })
                  }
                  placeholder="Required when Other is selected"
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.otherReason ?? ""}
                />

                <Text style={styles.label}>TESO staff ratio</Text>
                <OptionRow
                  disabled={!canEdit}
                  options={ratios}
                  selected={selectedPatient.enhancedObservation?.staffRatio ?? "1:1"}
                  onSelect={(staffRatio) =>
                    updateActiveTesoPlan(selectedPatient, { staffRatio: staffRatio as StaffRatio })
                  }
                />

                <Text style={styles.label}>TESO started</Text>
                <TextInput placeholderTextColor="#6f7f87"
                  editable={canEdit}
                  onChangeText={(startedAt) =>
                    updateActiveTesoPlan(selectedPatient, { startedAt })
                  }
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.startedAt ?? ""}
                />

                <Text style={styles.label}>Authorised by</Text>
                <TextInput placeholderTextColor="#6f7f87"
                  editable={canEdit}
                  onChangeText={(authorisedBy) =>
                    updateActiveTesoPlan(selectedPatient, { authorisedBy })
                  }
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.authorisedBy ?? ""}
                />

                <Text style={styles.label}>Review frequency</Text>
                <OptionRow
                  disabled={!canEdit}
                  options={reviewFrequencyOptions.map((minutes) => `${minutes} min`)}
                  selected={`${selectedPatient.enhancedObservation?.reviewFrequencyMinutes ?? 60} min`}
                  onSelect={(value) => {
                    const reviewFrequencyMinutes = Number.parseInt(value, 10);
                    updateActiveTesoPlan(selectedPatient, {
                      reviewFrequencyMinutes,
                      nextReviewAt: buildNextReviewAt(reviewFrequencyMinutes)
                    });
                  }}
                />

                <Text style={styles.label}>Next review due</Text>
                <TextInput placeholderTextColor="#6f7f87"
                  editable={canEdit}
                  onChangeText={(nextReviewAt) =>
                    updateActiveTesoPlan(selectedPatient, { nextReviewAt })
                  }
                  placeholder="Review date/time"
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.nextReviewAt ?? ""}
                />

                <Text style={styles.label}>Update plan of care</Text>
                <TextInput placeholderTextColor="#6f7f87"
                  editable={canEdit}
                  multiline
                  onFocus={() => {
                    setTimeout(() => detailScrollRef.current?.scrollToEnd({ animated: true }), 120);
                    setTimeout(() => detailScrollRef.current?.scrollToEnd({ animated: true }), 420);
                  }}
                  onChangeText={(carePlan) =>
                    setActiveCarePlanDraft(carePlan)
                  }
                  placeholder="Add or update how staff should support the patient during this enhanced observation period"
                  style={[styles.input, styles.carePlanInput, !canEdit && styles.disabledControl]}
                  textAlignVertical="top"
                  value={activeCarePlanDraft}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEdit}
                  onPress={() =>
                    updateActiveTesoPlan(selectedPatient, {
                      carePlan: activeCarePlanDraft.trim(),
                      lastCarePlanUpdatedAt: new Date().toISOString(),
                      lastCarePlanUpdatedBy: selectedStaff?.name ?? "Unknown staff"
                    })
                  }
                  style={[styles.updateCarePlanButton, !canEdit && styles.disabledControl]}
                >
                  <Text style={styles.updateCarePlanButtonText}>Update plan of care</Text>
                </TouchableOpacity>
                {selectedPatient.enhancedObservation?.lastCarePlanUpdatedAt ? (
                  <Text style={styles.infoText}>
                    Last plan update {formatDateTime(selectedPatient.enhancedObservation.lastCarePlanUpdatedAt)} by{" "}
                    {selectedPatient.enhancedObservation.lastCarePlanUpdatedBy ?? "unknown staff"}
                  </Text>
                ) : null}

                <Text style={styles.label}>End reason</Text>
                <TextInput placeholderTextColor="#6f7f87"
                  editable={canEdit}
                  multiline
                  onChangeText={setEndReason}
                  placeholder="Clinical reason for ending the TESO"
                  style={[styles.input, styles.endReasonInput, !canEdit && styles.disabledControl]}
                  textAlignVertical="top"
                  value={endReason}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEdit}
                  onPress={endTeso}
                  style={[styles.endTesoWideButton, !canEdit && styles.disabledControl]}
                >
                  <Text style={styles.tesoActionButtonText}>End active TESO</Text>
                </TouchableOpacity>
              </View>
              ) : (
                <View style={styles.tesoPanel}>
                  <Text style={styles.label}>Observation status for TESO</Text>
                  <OptionRow
                    disabled={!canEdit}
                    options={enhancedObservationLevels}
                    selected={tesoDraft.observationLevel}
                    onSelect={(observationLevel) =>
                      setTesoDraft((currentDraft) => ({
                        ...currentDraft,
                        observationLevel: observationLevel as TesoObservationLevel
                      }))
                    }
                  />

                  <Text style={styles.label}>Reason for enhanced observation</Text>
                  <OptionRow
                    disabled={!canEdit}
                    multi
                    options={reasons}
                    selected={tesoDraft.reasons}
                    onSelect={(reason) =>
                      setTesoDraft((currentDraft) => {
                        const typedReason = reason as TesoReason;
                        const nextReasons = currentDraft.reasons.includes(typedReason)
                          ? currentDraft.reasons.filter((item) => item !== typedReason)
                          : [...currentDraft.reasons, typedReason];

                        return { ...currentDraft, reasons: nextReasons };
                      })
                    }
                  />

                  <Text style={styles.label}>Other reason</Text>
                  <TextInput placeholderTextColor="#6f7f87"
                    editable={canEdit}
                    onChangeText={(otherReason) => setTesoDraft((currentDraft) => ({ ...currentDraft, otherReason }))}
                    placeholder="Required when Other is selected"
                    style={[styles.input, !canEdit && styles.disabledControl]}
                    value={tesoDraft.otherReason}
                  />

                  <Text style={styles.label}>TESO staff ratio</Text>
                  <OptionRow
                    disabled={!canEdit}
                    options={ratios}
                    selected={tesoDraft.staffRatio}
                    onSelect={(staffRatio) =>
                      setTesoDraft((currentDraft) => ({
                        ...currentDraft,
                        staffRatio: staffRatio as StaffRatio
                      }))
                    }
                  />

                  <Text style={styles.label}>Review frequency</Text>
                  <OptionRow
                    disabled={!canEdit}
                    options={reviewFrequencyOptions.map((minutes) => `${minutes} min`)}
                    selected={`${tesoDraft.reviewFrequencyMinutes} min`}
                    onSelect={(value) =>
                      setTesoDraft((currentDraft) => ({
                        ...currentDraft,
                        reviewFrequencyMinutes: Number.parseInt(value, 10)
                      }))
                    }
                  />

                  <Text style={styles.label}>Plan of care</Text>
                  {draftTesoMissingCarePlan ? (
                    <View style={styles.warningPanel}>
                      <Text style={styles.warningTitle}>Care plan can be added after start</Text>
                      <Text style={styles.warningText}>The TESO can start now, but the active record will show a reminder until a plan of care is added.</Text>
                    </View>
                  ) : null}
                  <TextInput placeholderTextColor="#6f7f87"
                    editable={canEdit}
                    multiline
                    onChangeText={(carePlan) => setTesoDraft((currentDraft) => ({ ...currentDraft, carePlan }))}
                    placeholder="Optional at start. Add the plan now or update it after starting."
                    style={[styles.input, styles.carePlanInput, !canEdit && styles.disabledControl]}
                    textAlignVertical="top"
                    value={tesoDraft.carePlan}
                  />

                  <Text style={styles.infoText}>
                    Select the TESO level and reason before starting the TESO episode. Staff can be allocated from Enhanced/TESO observations or the staff rota.
                  </Text>
                </View>
              )}

              <View style={styles.historyPanel}>
                <Text style={styles.panelTitle}>TESO history</Text>
                {(selectedPatient.tesoHistory ?? []).length === 0 ? (
                  <Text style={styles.infoText}>No TESO episodes recorded for this patient.</Text>
                ) : (
                  <View style={styles.historyTable}>
                    <View style={[styles.historyRow, styles.historyHeaderRow]}>
                      <Text style={[styles.historyCell, styles.historyStartCell]}>Start time</Text>
                      <Text style={styles.historyCell}>Reason</Text>
                      <Text style={styles.historyCell}>Level</Text>
                      <Text style={styles.historyCell}>Review</Text>
                      <Text style={styles.historyCell}>End</Text>
                    </View>
                    {(selectedPatient.tesoHistory ?? []).map((episode) => (
                      <View key={episode.id} style={styles.historyRow}>
                        <Text style={[styles.historyCell, styles.historyStartCell]}>
                          {formatDateTime(episode.startedAt)}
                        </Text>
                        <Text style={styles.historyCell}>{formatReasons(episode)}</Text>
                        <Text style={styles.historyCell}>
                          {episode.observationLevel} | {episode.staffRatio}
                        </Text>
                        <Text style={styles.historyCell}>
                          {episode.reviewFrequencyMinutes ? `${episode.reviewFrequencyMinutes} min` : "Not set"}
                        </Text>
                        <Text style={styles.historyCell}>
                          {episode.endedAt ? `${formatDateTime(episode.endedAt)} | ${episode.endedReason ?? "No reason"}` : "Active"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formsPanel}>
                <View style={styles.formHeaderRow}>
                  <View style={styles.formHeaderText}>
                    <Text style={styles.panelTitle}>Forms and risk assessments</Text>
                    <Text style={styles.infoTextCompact}>
                      {workplaceRiskAssessmentTemplate.reference} | {workplaceRiskAssessmentTemplate.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => void printRiskAssessment()}
                    style={styles.printButton}
                  >
                    <Text style={styles.printButtonText}>Print blank/current</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formTemplateCard}>
                  <Text style={styles.actionTitle}>{workplaceRiskAssessmentTemplate.title}</Text>
                  <Text style={styles.actionMeta}>
                    Assess each hazard area as Low, Medium or High. Add notes, actions, review date and signatures.
                  </Text>

                  {formSections.map((section) => (
                    <View key={section.id} style={styles.formSectionCard}>
                      <Text style={styles.formSectionTitle}>{section.title}</Text>
                      <OptionRow
                        disabled={!canEdit}
                        options={riskOptions}
                        selected={section.risk}
                        onSelect={(risk) => updateFormSection(section.id, { risk: risk as PatientFormSectionRisk })}
                      />
                      <TextInput placeholderTextColor="#6f7f87"
                        editable={canEdit}
                        multiline
                        onChangeText={(notes) => updateFormSection(section.id, { notes })}
                        placeholder="Notes / hazards identified"
                        style={[styles.input, styles.formNotesInput, !canEdit && styles.disabledControl]}
                        textAlignVertical="top"
                        value={section.notes}
                      />
                      <TextInput placeholderTextColor="#6f7f87"
                        editable={canEdit}
                        multiline
                        onChangeText={(actions) => updateFormSection(section.id, { actions })}
                        placeholder="Actions required / controls in place"
                        style={[styles.input, styles.formNotesInput, !canEdit && styles.disabledControl]}
                        textAlignVertical="top"
                        value={section.actions}
                      />
                    </View>
                  ))}

                  <Text style={styles.label}>Review date</Text>
                  <TextInput placeholderTextColor="#6f7f87"
                    editable={canEdit}
                    onChangeText={setFormReviewDate}
                    placeholder="e.g. 25/07/2026"
                    style={[styles.input, !canEdit && styles.disabledControl]}
                    value={formReviewDate}
                  />

                  <View style={styles.signatureRow}>
                    <View style={styles.signatureColumn}>
                      <Text style={styles.label}>Service user signature</Text>
                      <TextInput placeholderTextColor="#6f7f87"
                        editable={canEdit}
                        onChangeText={setServiceUserSignature}
                        placeholder="Type name or signature confirmation"
                        style={[styles.input, !canEdit && styles.disabledControl]}
                        value={serviceUserSignature}
                      />
                    </View>
                    <View style={styles.signatureColumn}>
                      <Text style={styles.label}>Staff signature</Text>
                      <TextInput placeholderTextColor="#6f7f87"
                        editable={canEdit}
                        onChangeText={setStaffSignature}
                        placeholder={selectedStaff?.name ?? "Staff name"}
                        style={[styles.input, !canEdit && styles.disabledControl]}
                        value={staffSignature}
                      />
                    </View>
                  </View>

                  <View style={styles.formActionRow}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={!canEdit}
                      onPress={() => savePatientForm("Draft")}
                      style={[styles.secondaryFormButton, !canEdit && styles.disabledControl]}
                    >
                      <Text style={styles.secondaryFormButtonText}>Save draft</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={!canEdit}
                      onPress={() => savePatientForm("Completed")}
                      style={[styles.updateCarePlanButton, styles.formPrimaryButton, !canEdit && styles.disabledControl]}
                    >
                      <Text style={styles.updateCarePlanButtonText}>Sign and complete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.label}>Form history</Text>
                {(selectedPatient.patientForms ?? []).length === 0 ? (
                  <Text style={styles.infoText}>No patient forms have been saved yet.</Text>
                ) : (
                  <View style={styles.formHistoryList}>
                    {(selectedPatient.patientForms ?? []).map((form) => (
                      <View key={form.id} style={styles.formHistoryRow}>
                        <View style={styles.formHistoryText}>
                          <Text style={styles.formHistoryTitle}>{form.title}</Text>
                          <Text style={styles.staffLookupMeta}>
                            {form.status} | {formatDateTime(form.completedAt)} | {form.completedBy}
                          </Text>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => void printRiskAssessment(form)}
                          style={styles.printSmallButton}
                        >
                          <Text style={styles.printSmallButtonText}>Print</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={styles.infoText}>No patient selected.</Text>
          )}
        </ScrollView>
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

function createDefaultPlan(authorisedBy: string): EnhancedObservationPlan {
  const reviewFrequencyMinutes = 60;

  return {
    staffRatio: "1:1",
    reasons: ["Risk to self"] as TesoReason[],
    otherReason: "",
    startedAt: new Date().toISOString(),
    authorisedBy,
    assignedStaffIds: [],
    carePlan: "",
    reviewFrequencyMinutes,
    nextReviewAt: buildNextReviewAt(reviewFrequencyMinutes)
  };
}

function createDefaultDraft(): TesoDraft {
  return {
    observationLevel: "",
    staffRatio: "1:1",
    reasons: [],
    otherReason: "",
    carePlan: "",
    reviewFrequencyMinutes: 60
  };
}

function createDefaultFormSections(): PatientFormSection[] {
  return workplaceRiskAssessmentTemplate.sections.map((title, index) => ({
    id: `section-${index + 1}`,
    title,
    risk: "Not assessed",
    notes: "",
    actions: ""
  }));
}

function createPatientFormRecord({
  completedBy,
  reviewDate,
  sections,
  serviceUserSignature,
  staffSignature,
  status
}: {
  completedBy: string;
  reviewDate: string;
  sections: PatientFormSection[];
  serviceUserSignature: string;
  staffSignature: string;
  status: PatientFormRecord["status"];
}): PatientFormRecord {
  return {
    id: `patient-form-${Date.now()}`,
    templateId: workplaceRiskAssessmentTemplate.id,
    title: workplaceRiskAssessmentTemplate.title,
    status,
    completedAt: new Date().toISOString(),
    completedBy,
    reviewDate,
    serviceUserSignature,
    staffSignature,
    sections
  };
}

function createPlanFromDraft(draft: TesoDraft, authorisedBy: string): EnhancedObservationPlan {
  return {
    staffRatio: draft.staffRatio,
    reasons: draft.reasons,
    otherReason: draft.otherReason,
    startedAt: new Date().toISOString(),
    authorisedBy,
    assignedStaffIds: [],
    carePlan: draft.carePlan.trim(),
    reviewFrequencyMinutes: draft.reviewFrequencyMinutes,
    nextReviewAt: buildNextReviewAt(draft.reviewFrequencyMinutes)
  };
}

function createTesoEpisode({
  plan,
  observationLevel,
  episodeId,
  endedAt,
  endedReason
}: {
  plan: ReturnType<typeof createDefaultPlan>;
  observationLevel: TesoObservationLevel;
  episodeId: string;
  endedAt?: string;
  endedReason?: string;
}): TesoEpisode {
  return {
    id: episodeId,
    startedAt: plan.startedAt,
    endedAt,
    reasons: plan.reasons,
    otherReason: plan.otherReason,
    observationLevel,
    staffRatio: plan.staffRatio,
    authorisedBy: plan.authorisedBy,
    carePlan: plan.carePlan,
    reviewFrequencyMinutes: plan.reviewFrequencyMinutes,
    nextReviewAt: plan.nextReviewAt,
    endedReason
  };
}

function syncActiveTesoEpisode(patient: Patient): Patient {
  if (!patient.enhancedObservation || patient.observationLevel === "Intermittent") {
    return patient;
  }

  const history = patient.tesoHistory ?? [];
  const activeEpisodeIndex = history.findIndex((episode) => !episode.endedAt);
  const activeEpisode = createTesoEpisode({
    plan: patient.enhancedObservation,
    observationLevel: patient.observationLevel,
    episodeId: `teso-${Date.now()}`
  });

  return {
    ...patient,
    tesoHistory:
      activeEpisodeIndex >= 0
        ? history.map((episode, index) => (index === activeEpisodeIndex ? { ...episode, ...activeEpisode, id: episode.id } : episode))
        : [activeEpisode, ...history]
  };
}

function buildNextReviewAt(reviewFrequencyMinutes: number) {
  return new Date(Date.now() + reviewFrequencyMinutes * 60 * 1000).toISOString();
}

function formatReasons(episode: TesoEpisode) {
  const reasonsText = episode.reasons.join(", ");
  return episode.otherReason ? `${reasonsText} - ${episode.otherReason}` : reasonsText || "Not recorded";
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildRiskAssessmentHtml({
  formRecord,
  patient,
  reviewDate,
  sections,
  selectedStaffName,
  serviceUserSignature,
  staffSignature
}: {
  formRecord?: PatientFormRecord;
  patient: Patient;
  reviewDate: string;
  sections: PatientFormSection[];
  selectedStaffName: string;
  serviceUserSignature: string;
  staffSignature: string;
}) {
  const rows = sections
    .map(
      (section, index) => `
        <tr>
          <td>${index + 1}. ${escapeHtml(section.title)}</td>
          <td>${escapeHtml(section.risk)}</td>
          <td>${escapeHtml(section.notes || "")}</td>
          <td>${escapeHtml(section.actions || "")}</td>
        </tr>
      `
    )
    .join("");
  const completedLabel = formRecord ? `${formRecord.status} ${formatDateTime(formRecord.completedAt)}` : "Blank/current draft";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { color: #17252b; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.35; padding: 24px; }
          h1 { font-size: 18px; margin: 0 0 4px; text-align: center; text-transform: uppercase; }
          h2 { font-size: 14px; margin: 20px 0 8px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 18px 0; }
          .box { border: 1px solid #8fa1a8; min-height: 28px; padding: 7px; }
          table { border-collapse: collapse; margin-top: 12px; width: 100%; }
          th, td { border: 1px solid #8fa1a8; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #e7efed; font-weight: 700; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px; }
          .signature-line { border-bottom: 1px solid #17252b; min-height: 28px; padding-top: 12px; }
          .small { color: #53646b; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(workplaceRiskAssessmentTemplate.title)}</h1>
        <p class="small" style="text-align:center">${escapeHtml(workplaceRiskAssessmentTemplate.reference)} | ${escapeHtml(workplaceRiskAssessmentTemplate.description)} | ${escapeHtml(completedLabel)}</p>
        <div class="meta">
          <div><strong>Service user</strong><div class="box">${escapeHtml(`${patient.firstName} ${patient.surname}`)}</div></div>
          <div><strong>Hospital/reference number</strong><div class="box">${escapeHtml(patient.hospitalNumber)}</div></div>
          <div><strong>Room</strong><div class="box">${patient.roomNumber}</div></div>
          <div><strong>Completed by</strong><div class="box">${escapeHtml(formRecord?.completedBy ?? selectedStaffName)}</div></div>
          <div><strong>Date reviewed</strong><div class="box">${escapeHtml(reviewDate)}</div></div>
          <div><strong>Status</strong><div class="box">${escapeHtml(formRecord?.status ?? "Current draft")}</div></div>
        </div>
        <h2>Risk assessment checklist</h2>
        <table>
          <thead>
            <tr>
              <th>Hazard area</th>
              <th>Risk</th>
              <th>Notes / hazards identified</th>
              <th>Actions required / controls</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="signatures">
          <div>
            <strong>Service user signature</strong>
            <div class="signature-line">${escapeHtml(serviceUserSignature)}</div>
          </div>
          <div>
            <strong>Staff signature</strong>
            <div class="signature-line">${escapeHtml(staffSignature)}</div>
          </div>
        </div>
      </body>
    </html>
  `;
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
    maxHeight: 720,
    minWidth: 430,
    padding: 14
  },
  detailContent: {
    paddingBottom: 260
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
  tesoActionPanel: {
    alignItems: "flex-start",
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "column",
    gap: 12,
    marginTop: 14,
    padding: 12
  },
  actionTextBlock: {
    minWidth: 220
  },
  actionTitle: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  actionMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  tesoActionButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 124,
    paddingHorizontal: 14
  },
  endTesoButton: {
    backgroundColor: "#8f2d25"
  },
  endTesoWideButton: {
    alignItems: "center",
    backgroundColor: "#8f2d25",
    borderRadius: 6,
    justifyContent: "center",
    marginBottom: 4,
    minHeight: 44,
    paddingHorizontal: 14
  },
  tesoActionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
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
  carePlanInput: {
    lineHeight: 20,
    minHeight: 150,
    paddingTop: 10
  },
  endReasonInput: {
    lineHeight: 20,
    minHeight: 82,
    paddingTop: 10
  },
  updateCarePlanButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 12
  },
  updateCarePlanButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  staffSlots: {
    gap: 10
  },
  staffSlot: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    padding: 10
  },
  staffSlotLabel: {
    color: "#31454d",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6
  },
  staffLookupInput: {
    minHeight: 38
  },
  selectedStaffRow: {
    alignItems: "center",
    backgroundColor: "#edf7f4",
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  selectedStaffText: {
    color: "#1f5262",
    flex: 1,
    fontSize: 12,
    fontWeight: "900"
  },
  clearStaffButton: {
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  clearStaffText: {
    color: "#1f5262",
    fontSize: 11,
    fontWeight: "900"
  },
  staffLookupResults: {
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden"
  },
  staffLookupOption: {
    borderTopColor: "#edf1f2",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 8
  },
  staffLookupName: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900"
  },
  staffLookupMeta: {
    color: "#607078",
    fontSize: 12,
    marginTop: 2
  },
  warningPanel: {
    backgroundColor: "#fff8e8",
    borderColor: "#e2b85f",
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10
  },
  warningTitle: {
    color: "#67470f",
    fontSize: 13,
    fontWeight: "900"
  },
  warningText: {
    color: "#7a5a1c",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 3
  },
  historyPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    padding: 12
  },
  historyTable: {
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden"
  },
  historyRow: {
    borderTopColor: "#edf1f2",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row"
  },
  historyHeaderRow: {
    backgroundColor: "#edf7f4",
    borderTopWidth: 0
  },
  historyCell: {
    color: "#31454d",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    padding: 8
  },
  historyStartCell: {
    flex: 0.9
  },
  infoText: {
    color: "#607078",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12
  },
  infoTextCompact: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  formsPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    padding: 12
  },
  formHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  formHeaderText: {
    flex: 1
  },
  printButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10
  },
  printButtonText: {
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900"
  },
  formTemplateCard: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    padding: 12
  },
  formSectionCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  formSectionTitle: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8
  },
  formNotesInput: {
    lineHeight: 18,
    marginTop: 8,
    minHeight: 72,
    paddingTop: 9
  },
  signatureRow: {
    flexDirection: "row",
    gap: 10
  },
  signatureColumn: {
    flex: 1
  },
  formActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12
  },
  secondaryFormButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  secondaryFormButtonText: {
    color: "#1f5262",
    fontSize: 13,
    fontWeight: "900"
  },
  formPrimaryButton: {
    marginTop: 0
  },
  formHistoryList: {
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden"
  },
  formHistoryRow: {
    alignItems: "center",
    borderTopColor: "#edf1f2",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    padding: 10
  },
  formHistoryText: {
    flex: 1
  },
  formHistoryTitle: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900"
  },
  printSmallButton: {
    alignItems: "center",
    backgroundColor: "#edf7f4",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10
  },
  printSmallButtonText: {
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900"
  },
  disabledControl: {
    opacity: 0.45
  }
});
