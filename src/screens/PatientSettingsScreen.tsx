import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { SecureDateTimeField } from "../components/SecureDateTimeField";
import type {
  EnhancedObservationPlan,
  ObservationLevel,
  Patient,
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
const reasons: TesoReason[] = [
  "Risk to self",
  "Risk to others",
  "Risk from others",
  "Medication intervention",
  "Security",
  "Physical health",
  "Other"
];

type TesoDraft = {
  observationLevel: TesoObservationLevel | "";
  staffRatio: StaffRatio;
  reasons: TesoReason[];
  otherReason: string;
  carePlan: string;
  reviewFrequencyMinutes: number;
};

type PatientSettingsScreenProps = {
  assessmentFormsEnabled: boolean;
  patients: Patient[];
  staff: StaffMember[];
  selectedStaffId: string;
  onBack: () => void;
  onOpenAssessmentForms: () => void;
  onUpdatePatient: (patient: Patient) => void;
};

export function PatientSettingsScreen({
  assessmentFormsEnabled,
  patients,
  staff,
  selectedStaffId,
  onBack,
  onOpenAssessmentForms,
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient settings</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} | {canEdit ? "Clinical edit access" : "HCF locked"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !assessmentFormsEnabled }}
            disabled={!assessmentFormsEnabled}
            onPress={onOpenAssessmentForms}
            style={[styles.assessmentButton, !assessmentFormsEnabled && styles.assessmentButtonDisabled]}
          >
            <Text
              style={[
                styles.assessmentButtonText,
                !assessmentFormsEnabled && styles.assessmentButtonTextDisabled
              ]}
            >
              Assessment forms
            </Text>
            {!assessmentFormsEnabled ? <Text style={styles.assessmentButtonReason}>Not enabled</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to observations</Text>
          </TouchableOpacity>
        </View>
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

                <SecureDateTimeField
                  disabled={!canEdit}
                  label="Next review due"
                  minimumDate={new Date()}
                  mode="datetime"
                  onChange={(nextReviewAt) =>
                    updateActiveTesoPlan(selectedPatient, { nextReviewAt })
                  }
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
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end"
  },
  assessmentButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  assessmentButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  assessmentButtonDisabled: { backgroundColor: "#e3e8ea" },
  assessmentButtonTextDisabled: { color: "#687980" },
  assessmentButtonReason: { color: "#805c2e", fontSize: 8, fontWeight: "900", marginTop: 2 },
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
  disabledControl: {
    opacity: 0.45
  }
});
