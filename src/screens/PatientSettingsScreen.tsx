import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  EnhancedObservationPlan,
  ObservationLevel,
  Patient,
  StaffMember,
  StaffShiftAssignment,
  StaffRatio,
  TesoEpisode,
  TesoReason
} from "../types/domain";
import { hasStaffRole } from "../utils/staffRole";

const observationLevels: ObservationLevel[] = ["Intermittent", "Eyesight", "Within arms length"];
const enhancedObservationLevels: Array<Exclude<ObservationLevel, "Intermittent">> = ["Eyesight", "Within arms length"];
const ratios: StaffRatio[] = ["1:1", "2:1", "3:1", "4:1", "5:1", "6:1"];
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
  observationLevel: Exclude<ObservationLevel, "Intermittent"> | "";
  staffRatio: StaffRatio;
  reasons: TesoReason[];
  otherReason: string;
  assignedStaffIds: string[];
  carePlan: string;
};

type PatientSettingsScreenProps = {
  patients: Patient[];
  staff: StaffMember[];
  staffShiftAssignments: StaffShiftAssignment[];
  selectedStaffId: string;
  onBack: () => void;
  onUpdatePatient: (patient: Patient) => void;
};

export function PatientSettingsScreen({
  patients,
  staff,
  staffShiftAssignments,
  selectedStaffId,
  onBack,
  onUpdatePatient
}: PatientSettingsScreenProps) {
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit =
    hasStaffRole(selectedStaff, "nurse") ||
    hasStaffRole(selectedStaff, "manager") ||
    hasStaffRole(selectedStaff, "doctor");
  const orderedPatients = useMemo(
    () => [...patients].sort((a, b) => a.roomNumber - b.roomNumber),
    [patients]
  );
  const [selectedPatientId, setSelectedPatientId] = useState(orderedPatients[0]?.id ?? "");
  const [tesoDraft, setTesoDraft] = useState<TesoDraft>(() => createDefaultDraft());
  const [activeCarePlanDraft, setActiveCarePlanDraft] = useState("");
  const [staffSearches, setStaffSearches] = useState<Record<string, string>>({});
  const detailScrollRef = useRef<ScrollView>(null);
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const todayKey = formatDateKey(new Date());
  const eligibleTesoStaff = useMemo(
    () => getEligibleTesoStaff(staff, staffShiftAssignments, selectedPatient?.wardId, todayKey),
    [selectedPatient?.wardId, staff, staffShiftAssignments, todayKey]
  );
  const draftRequiredStaffCount = ratioStaffCount(tesoDraft.staffRatio);
  const hasActiveTeso = Boolean(
    selectedPatient && (selectedPatient.enhancedObservation || selectedPatient.observationLevel !== "Intermittent")
  );
  const canStartTeso =
    Boolean(tesoDraft.observationLevel) &&
    tesoDraft.reasons.length > 0 &&
    (!tesoDraft.reasons.includes("Other") || tesoDraft.otherReason.trim().length > 0) &&
    normaliseAssignedStaffIds(tesoDraft.assignedStaffIds, draftRequiredStaffCount).every(Boolean);
  const activeTesoMissingCarePlan =
    hasActiveTeso && !selectedPatient?.enhancedObservation?.carePlan.trim();
  const draftTesoMissingCarePlan = !tesoDraft.carePlan.trim();

  useEffect(() => {
    setTesoDraft(createDefaultDraft());
    setStaffSearches({});
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
      endedAt
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
                  carePlan: currentPlan.carePlan
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
                      const observationLevel = level as Exclude<ObservationLevel, "Intermittent">;
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

                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEdit}
                  onPress={endTeso}
                  style={[styles.endTesoWideButton, !canEdit && styles.disabledControl]}
                >
                  <Text style={styles.tesoActionButtonText}>End active TESO</Text>
                </TouchableOpacity>

                <Text style={styles.label}>TESO staff ratio</Text>
                <OptionRow
                  disabled={!canEdit}
                  options={ratios}
                  selected={selectedPatient.enhancedObservation?.staffRatio ?? "1:1"}
                  onSelect={(staffRatio) =>
                    updateActiveTesoPlan(selectedPatient, {
                      staffRatio: staffRatio as StaffRatio,
                      assignedStaffIds: normaliseAssignedStaffIds(
                        selectedPatient.enhancedObservation?.assignedStaffIds ?? [],
                        ratioStaffCount(staffRatio as StaffRatio)
                      )
                    })
                  }
                />

                <Text style={styles.label}>Assigned staff for this TESO</Text>
                <StaffAssignmentSlots
                  disabled={!canEdit}
                  searchPrefix={`active-${selectedPatient.id}`}
                  searches={staffSearches}
                  selectedStaffIds={normaliseAssignedStaffIds(
                    selectedPatient.enhancedObservation?.assignedStaffIds ?? [],
                    ratioStaffCount(selectedPatient.enhancedObservation?.staffRatio ?? "1:1")
                  )}
                  staff={eligibleTesoStaff}
                  onSearchChange={(slotKey, value) => setStaffSearches((current) => ({ ...current, [slotKey]: value }))}
                  onSelect={(slotIndex, staffId) =>
                    updateActiveTesoPlan(selectedPatient, {
                      assignedStaffIds: setAssignedStaffAt(
                        selectedPatient.enhancedObservation?.assignedStaffIds ?? [],
                        slotIndex,
                        staffId,
                        ratioStaffCount(selectedPatient.enhancedObservation?.staffRatio ?? "1:1")
                      )
                    })
                  }
                />

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
                <TextInput
                  editable={canEdit}
                  onChangeText={(otherReason) =>
                    updateActiveTesoPlan(selectedPatient, { otherReason })
                  }
                  placeholder="Required when Other is selected"
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.otherReason ?? ""}
                />

                <Text style={styles.label}>TESO started</Text>
                <TextInput
                  editable={canEdit}
                  onChangeText={(startedAt) =>
                    updateActiveTesoPlan(selectedPatient, { startedAt })
                  }
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.startedAt ?? ""}
                />

                <Text style={styles.label}>Authorised by</Text>
                <TextInput
                  editable={canEdit}
                  onChangeText={(authorisedBy) =>
                    updateActiveTesoPlan(selectedPatient, { authorisedBy })
                  }
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={selectedPatient.enhancedObservation?.authorisedBy ?? ""}
                />

                <Text style={styles.label}>Update plan of care</Text>
                <TextInput
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
                  onPress={() => updateActiveTesoPlan(selectedPatient, { carePlan: activeCarePlanDraft.trim() })}
                  style={[styles.updateCarePlanButton, !canEdit && styles.disabledControl]}
                >
                  <Text style={styles.updateCarePlanButtonText}>Update plan of care</Text>
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
                        observationLevel: observationLevel as Exclude<ObservationLevel, "Intermittent">
                      }))
                    }
                  />

                  <Text style={styles.label}>TESO staff ratio</Text>
                  <OptionRow
                    disabled={!canEdit}
                    options={ratios}
                    selected={tesoDraft.staffRatio}
                    onSelect={(staffRatio) =>
                      setTesoDraft((currentDraft) => ({
                        ...currentDraft,
                        staffRatio: staffRatio as StaffRatio,
                        assignedStaffIds: normaliseAssignedStaffIds(
                          currentDraft.assignedStaffIds,
                          ratioStaffCount(staffRatio as StaffRatio)
                        )
                      }))
                    }
                  />

                  <Text style={styles.label}>Assigned staff for this TESO</Text>
                  <StaffAssignmentSlots
                    disabled={!canEdit}
                    searchPrefix={`draft-${selectedPatient.id}`}
                    searches={staffSearches}
                    selectedStaffIds={normaliseAssignedStaffIds(tesoDraft.assignedStaffIds, draftRequiredStaffCount)}
                    staff={eligibleTesoStaff}
                    onSearchChange={(slotKey, value) => setStaffSearches((current) => ({ ...current, [slotKey]: value }))}
                    onSelect={(slotIndex, staffId) =>
                      setTesoDraft((currentDraft) => ({
                        ...currentDraft,
                        assignedStaffIds: setAssignedStaffAt(
                          currentDraft.assignedStaffIds,
                          slotIndex,
                          staffId,
                          ratioStaffCount(currentDraft.staffRatio)
                        )
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
                  <TextInput
                    editable={canEdit}
                    onChangeText={(otherReason) => setTesoDraft((currentDraft) => ({ ...currentDraft, otherReason }))}
                    placeholder="Required when Other is selected"
                    style={[styles.input, !canEdit && styles.disabledControl]}
                    value={tesoDraft.otherReason}
                  />

                  <Text style={styles.label}>Plan of care</Text>
                  {draftTesoMissingCarePlan ? (
                    <View style={styles.warningPanel}>
                      <Text style={styles.warningTitle}>Care plan can be added after start</Text>
                      <Text style={styles.warningText}>The TESO can start now, but the active record will show a reminder until a plan of care is added.</Text>
                    </View>
                  ) : null}
                  <TextInput
                    editable={canEdit}
                    multiline
                    onChangeText={(carePlan) => setTesoDraft((currentDraft) => ({ ...currentDraft, carePlan }))}
                    placeholder="Optional at start. Add the plan now or update it after starting."
                    style={[styles.input, styles.carePlanInput, !canEdit && styles.disabledControl]}
                    textAlignVertical="top"
                    value={tesoDraft.carePlan}
                  />

                  <Text style={styles.infoText}>
                    Select the TESO level, staff ratio, assigned staff, and reason before starting the TESO episode.
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
                          {episode.endedAt ? formatDateTime(episode.endedAt) : "Active"}
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

type StaffAssignmentSlotsProps = {
  disabled: boolean;
  searchPrefix: string;
  searches: Record<string, string>;
  selectedStaffIds: string[];
  staff: StaffMember[];
  onSearchChange: (slotKey: string, value: string) => void;
  onSelect: (slotIndex: number, staffId: string) => void;
};

function StaffAssignmentSlots({
  disabled,
  searchPrefix,
  searches,
  selectedStaffIds,
  staff,
  onSearchChange,
  onSelect
}: StaffAssignmentSlotsProps) {
  return (
    <View style={styles.staffSlots}>
      {selectedStaffIds.map((selectedStaffId, slotIndex) => {
        const slotKey = `${searchPrefix}-${slotIndex}`;
        const searchValue = searches[slotKey] ?? "";
        const selectedStaff = staff.find((member) => member.id === selectedStaffId);
        const options = getStaffLookupOptions(staff, searchValue, selectedStaffIds, selectedStaffId);

        return (
          <View key={slotKey} style={styles.staffSlot}>
            <Text style={styles.staffSlotLabel}>Staff {slotIndex + 1}</Text>
            <TextInput
              editable={!disabled}
              onChangeText={(value) => onSearchChange(slotKey, value)}
              placeholder={selectedStaff ? selectedStaff.name : "Search staff name or code"}
              style={[styles.input, styles.staffLookupInput, disabled && styles.disabledControl]}
              value={searchValue}
            />
            {selectedStaff ? (
              <View style={styles.selectedStaffRow}>
                <Text style={styles.selectedStaffText}>
                  {selectedStaff.name} | {selectedStaff.staffCode}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => onSelect(slotIndex, "")}
                  style={[styles.clearStaffButton, disabled && styles.disabledControl]}
                >
                  <Text style={styles.clearStaffText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {searchValue.trim().length > 0 && options.length > 0 ? (
              <View style={styles.staffLookupResults}>
                {options.map((member) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={disabled}
                    key={member.id}
                    onPress={() => {
                      onSelect(slotIndex, member.id);
                      onSearchChange(slotKey, "");
                    }}
                    style={[styles.staffLookupOption, disabled && styles.disabledControl]}
                  >
                    <Text style={styles.staffLookupName}>{member.name}</Text>
                    <Text style={styles.staffLookupMeta}>
                      {member.staffCode} | {member.role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function createDefaultPlan(authorisedBy: string): EnhancedObservationPlan {
  return {
    staffRatio: "1:1" as StaffRatio,
    reasons: ["Risk to self"] as TesoReason[],
    otherReason: "",
    startedAt: new Date().toISOString(),
    authorisedBy,
    assignedStaffIds: [],
    carePlan: ""
  };
}

function createDefaultDraft(): TesoDraft {
  return {
    observationLevel: "",
    staffRatio: "1:1",
    reasons: [],
    otherReason: "",
    assignedStaffIds: [""],
    carePlan: ""
  };
}

function createPlanFromDraft(draft: TesoDraft, authorisedBy: string): EnhancedObservationPlan {
  const staffCount = ratioStaffCount(draft.staffRatio);

  return {
    staffRatio: draft.staffRatio,
    reasons: draft.reasons,
    otherReason: draft.otherReason,
    startedAt: new Date().toISOString(),
    authorisedBy,
    assignedStaffIds: normaliseAssignedStaffIds(draft.assignedStaffIds, staffCount).filter(Boolean),
    carePlan: draft.carePlan.trim()
  };
}

function createTesoEpisode({
  plan,
  observationLevel,
  episodeId,
  endedAt
}: {
  plan: ReturnType<typeof createDefaultPlan>;
  observationLevel: Exclude<ObservationLevel, "Intermittent">;
  episodeId: string;
  endedAt?: string;
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
    carePlan: plan.carePlan
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

function ratioStaffCount(ratio: StaffRatio) {
  const count = Number.parseInt(ratio.split(":")[0] ?? "1", 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function normaliseAssignedStaffIds(staffIds: string[], requiredCount: number) {
  return Array.from({ length: requiredCount }, (_, index) => staffIds[index] ?? "");
}

function setAssignedStaffAt(staffIds: string[], slotIndex: number, staffId: string, requiredCount: number) {
  const nextStaffIds = normaliseAssignedStaffIds(staffIds, requiredCount);
  nextStaffIds[slotIndex] = staffId;
  return nextStaffIds;
}

function getStaffLookupOptions(
  staff: StaffMember[],
  searchValue: string,
  selectedStaffIds: string[],
  currentStaffId: string
) {
  const query = searchValue.trim().toLowerCase();

  if (!query) {
    return [];
  }

  const selected = new Set(selectedStaffIds.filter((staffId) => staffId && staffId !== currentStaffId));

  return staff
    .filter((member) => member.active !== false)
    .filter((member) => !selected.has(member.id))
    .filter((member) => `${member.name} ${member.staffCode} ${member.role}`.toLowerCase().includes(query))
    .slice(0, 8);
}

function getEligibleTesoStaff(
  staff: StaffMember[],
  staffShiftAssignments: StaffShiftAssignment[],
  wardId: string | undefined,
  dateKey: string
) {
  if (!wardId) {
    return staff.filter(isStaffCurrentlyActive);
  }

  const shiftStaffIds = new Set(
    staffShiftAssignments
      .filter((assignment) => assignment.wardId === wardId && assignment.date === dateKey)
      .map((assignment) => assignment.staffId)
  );

  return staff
    .filter(isStaffCurrentlyActive)
    .filter(
      (member) =>
        member.wardId === wardId ||
        member.allowedWardIds.includes(wardId) ||
        shiftStaffIds.has(member.id)
    )
    .sort((left, right) => {
      const leftOnShift = shiftStaffIds.has(left.id) ? 0 : 1;
      const rightOnShift = shiftStaffIds.has(right.id) ? 0 : 1;

      if (leftOnShift !== rightOnShift) {
        return leftOnShift - rightOnShift;
      }

      return left.name.localeCompare(right.name);
    });
}

function isStaffCurrentlyActive(member: StaffMember) {
  if (member.active === false) {
    return false;
  }

  const now = Date.now();
  const startsAt = member.accessStartsAt ? new Date(member.accessStartsAt).getTime() : undefined;
  const expiresAt = member.accessExpiresAt ? new Date(member.accessExpiresAt).getTime() : undefined;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (expiresAt && expiresAt < now) {
    return false;
  }

  return true;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
