import React, { useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";

import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  Patient,
  SafetyIncident,
  StaffMember,
  Ward
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

const categories: IncidentCategory[] = [
  "Injury or physical concern",
  "Violence or aggression",
  "Self-harm",
  "Fall",
  "Medication",
  "Safeguarding",
  "Security",
  "Other"
];

const severityOptions: Array<{ label: string; value: IncidentSeverity; description: string }> = [
  { label: "Red", value: "red", description: "Immediate or serious risk" },
  { label: "Amber", value: "amber", description: "Prompt review required" },
  { label: "Green", value: "green", description: "Low harm / monitor" }
];

const bodyAreas = [
  "Front · Head / face",
  "Front · Neck",
  "Front · Chest",
  "Front · Abdomen",
  "Front · Left arm",
  "Front · Right arm",
  "Front · Left hand",
  "Front · Right hand",
  "Front · Pelvis / groin",
  "Front · Left hip",
  "Front · Right hip",
  "Front · Left leg",
  "Front · Right leg",
  "Front · Left foot",
  "Front · Right foot",
  "Back · Head",
  "Back · Neck",
  "Back · Upper back",
  "Back · Lower back",
  "Back · Left arm",
  "Back · Right arm",
  "Back · Buttocks",
  "Back · Left hip",
  "Back · Right hip",
  "Back · Left leg",
  "Back · Right leg"
];

type IncidentDraft = {
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  details: string;
  immediateAction: string;
  bodyAreas: string[];
  patientAccount: string;
  ownerStaffId: string;
};

type SafetyEscalationScreenProps = {
  incidents: SafetyIncident[];
  patients: Patient[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  ward?: Ward;
  onBack: () => void;
  onSaveIncident: (incident: SafetyIncident) => Promise<void>;
  onSelectPatient: (patientId: string) => void;
};

export function SafetyEscalationScreen({
  incidents,
  patients,
  selectedPatientId,
  selectedStaffId,
  staff,
  ward,
  onBack,
  onSaveIncident,
  onSelectPatient
}: SafetyEscalationScreenProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const compactLayout = viewportWidth < 680;
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient =
    orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const wardStaff = useMemo(
    () => {
      const members = staff
        .filter((member) => member.active !== false && (member.wardId === ward?.id || member.allowedWardIds.includes(ward?.id ?? "")))
        .sort((left, right) => left.name.localeCompare(right.name));
      return Array.from(
        new Map(members.map((member) => [member.staffCode.toLowerCase(), member])).values()
      );
    },
    [staff, ward?.id]
  );
  const [draft, setDraft] = useState<IncidentDraft>(() => emptyDraft());
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "active" | "all">("active");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "all">("all");
  const [isSaving, setIsSaving] = useState(false);
  const [updatingIncidentId, setUpdatingIncidentId] = useState("");
  const [resolvingIncidentId, setResolvingIncidentId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const closeResolutionModal = () => {
    Keyboard.dismiss();
    setResolvingIncidentId("");
    setResolutionNotes("");
  };

  const wardIncidents = useMemo(
    () =>
      incidents
        .filter((incident) => incident.wardId === ward?.id)
        .sort(compareIncidents),
    [incidents, ward?.id]
  );
  const filteredIncidents = useMemo(
    () =>
      wardIncidents.filter((incident) => {
        const statusMatches =
          statusFilter === "all" ||
          (statusFilter === "active" ? incident.status !== "resolved" : incident.status === statusFilter);
        return statusMatches && (severityFilter === "all" || incident.severity === severityFilter);
      }),
    [severityFilter, statusFilter, wardIncidents]
  );
  const activeIncidents = wardIncidents.filter((incident) => incident.status !== "resolved");
  const redCount = activeIncidents.filter((incident) => incident.severity === "red").length;
  const amberCount = activeIncidents.filter((incident) => incident.severity === "amber").length;
  const greenCount = activeIncidents.filter((incident) => incident.severity === "green").length;
  const canResolve = Boolean(
    hasStaffRole(selectedStaff, "nurse") ||
      hasStaffRole(selectedStaff, "manager") ||
      hasStaffRole(selectedStaff, "doctor") ||
      hasAdminAccess(selectedStaff)
  );
  const formComplete = Boolean(selectedPatient && selectedStaff && ward && draft.title.trim() && draft.details.trim());

  const toggleBodyArea = (area: string) => {
    setDraft((current) => ({
      ...current,
      bodyAreas: current.bodyAreas.includes(area)
        ? current.bodyAreas.filter((item) => item !== area)
        : [...current.bodyAreas, area]
    }));
  };

  const saveNewIncident = async () => {
    if (!formComplete || !selectedPatient || !selectedStaff || !ward) {
      Alert.alert("Incident details needed", "Select a patient and complete the incident title and description.");
      return;
    }
    const owner = wardStaff.find((member) => member.id === draft.ownerStaffId);
    const incident: SafetyIncident = {
      id: `safety-incident-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: selectedPatient.id,
      wardId: ward.id,
      category: draft.category,
      severity: draft.severity,
      status: "open",
      title: draft.title.trim(),
      details: draft.details.trim(),
      immediateAction: draft.immediateAction.trim(),
      bodyAreas: draft.bodyAreas,
      patientAccount: draft.patientAccount.trim(),
      ownerStaffId: owner?.id,
      ownerName: owner?.name,
      reportedByStaffId: selectedStaff.id,
      reportedByName: selectedStaff.name,
      reportedByStaffCode: selectedStaff.staffCode,
      reportedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSaveIncident(incident);
      setDraft(emptyDraft());
      Alert.alert(
        "Incident added to the Safety Centre",
        `${severityLabel(incident.severity)} incident recorded for ${selectedPatient.firstName} ${selectedPatient.surname}.`
      );
    } catch (error) {
      Alert.alert("Incident not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const acknowledgeIncident = async (incident: SafetyIncident) => {
    if (!selectedStaff || incident.status !== "open") return;
    setUpdatingIncidentId(incident.id);
    try {
      await onSaveIncident({
        ...incident,
        status: "acknowledged",
        acknowledgedByStaffId: selectedStaff.id,
        acknowledgedByName: selectedStaff.name,
        acknowledgedAt: new Date().toISOString()
      });
    } catch (error) {
      Alert.alert("Unable to acknowledge", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingIncidentId("");
    }
  };

  const resolveIncident = async (incident: SafetyIncident) => {
    if (!selectedStaff || !canResolve || !resolutionNotes.trim()) {
      Alert.alert("Resolution notes needed", "Record the outcome and any follow-up required before resolving.");
      return;
    }
    setUpdatingIncidentId(incident.id);
    try {
      await onSaveIncident({
        ...incident,
        status: "resolved",
        acknowledgedByStaffId: incident.acknowledgedByStaffId ?? selectedStaff.id,
        acknowledgedByName: incident.acknowledgedByName ?? selectedStaff.name,
        acknowledgedAt: incident.acknowledgedAt ?? new Date().toISOString(),
        resolutionNotes: resolutionNotes.trim(),
        resolvedByStaffId: selectedStaff.id,
        resolvedByName: selectedStaff.name,
        resolvedAt: new Date().toISOString()
      });
      setResolvingIncidentId("");
      setResolutionNotes("");
      Keyboard.dismiss();
    } catch (error) {
      Alert.alert("Unable to resolve", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingIncidentId("");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Clinical safety</Text>
          <Text style={styles.title}>Safety and escalation centre</Text>
          <Text style={styles.meta}>{ward?.name ?? "Ward"} · Incidents, injuries and safeguarding review</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ragGrid}>
        <RagSummary count={redCount} label="Red · Immediate" severity="red" />
        <RagSummary count={amberCount} label="Amber · Review" severity="amber" />
        <RagSummary count={greenCount} label="Green · Monitor" severity="green" />
        <View style={styles.totalCard}>
          <Text style={styles.totalValue}>{activeIncidents.length}</Text>
          <Text style={styles.totalLabel}>Active incidents</Text>
        </View>
      </View>

      <View style={[styles.workspace, compactLayout && styles.workspaceCompact]}>
        <View style={[styles.patientPanel, compactLayout && styles.patientPanelCompact]}>
          <Text style={styles.panelTitle}>Patients</Text>
          <Text style={styles.panelMeta}>Select the patient involved.</Text>
          {orderedPatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => onSelectPatient(patient.id)}
              style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
            >
              <Text style={[styles.patientName, patient.id === selectedPatient?.id && styles.patientNameActive]}>
                Room {patient.roomNumber} · {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainPanel}>
          <View style={styles.formPanel}>
            <View style={styles.formHeading}>
              <View>
                <Text style={styles.sectionTitle}>Record a safety incident</Text>
                {selectedPatient ? (
                  <View style={styles.selectedPatientIdentity}>
                    <Text style={styles.selectedPatientName}>
                      {selectedPatient.firstName} {selectedPatient.surname}
                    </Text>
                    <Text style={styles.selectedPatientRoom}>
                      Room {selectedPatient.roomNumber} · {selectedPatient.hospitalNumber}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.panelMeta}>Select a patient</Text>
                )}
              </View>
              <View style={[styles.severityBadge, severityStyle(draft.severity)]}>
                <Text style={styles.severityBadgeText}>{severityLabel(draft.severity)}</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>RAG severity *</Text>
            <View style={styles.optionRow}>
              {severityOptions.map((option) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => setDraft((current) => ({ ...current, severity: option.value }))}
                  style={[
                    styles.severityOption,
                    option.value === "red" && styles.redOption,
                    option.value === "amber" && styles.amberOption,
                    option.value === "green" && styles.greenOption,
                    draft.severity === option.value && styles.optionSelected
                  ]}
                >
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.chipRow}>
              {categories.map((category) => (
                <ChoiceChip
                  key={category}
                  active={draft.category === category}
                  label={category}
                  onPress={() => setDraft((current) => ({ ...current, category }))}
                />
              ))}
            </View>

            <IncidentField
              label="Incident title *"
              maxLength={200}
              onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
              placeholder="Short description visible on the ward dashboard"
              value={draft.title}
            />
            <IncidentField
              label="What happened? *"
              multiline
              onChangeText={(details) => setDraft((current) => ({ ...current, details }))}
              placeholder="Record the facts, context, time and people present."
              value={draft.details}
            />
            <IncidentField
              label="Immediate action taken"
              multiline
              onChangeText={(immediateAction) => setDraft((current) => ({ ...current, immediateAction }))}
              placeholder="First aid, medical review, increased observations, area made safe or other action."
              value={draft.immediateAction}
            />

            <View style={styles.bodyMapPanel}>
              <Text style={styles.fieldLabel}>Body map</Text>
              <Text style={styles.panelMeta}>Select every affected area. Leave blank when no injury is involved.</Text>
              <View style={styles.bodyMapColumns}>
                <BodyMapColumn
                  areas={bodyAreas.filter((area) => area.startsWith("Front"))}
                  selectedAreas={draft.bodyAreas}
                  side="Front"
                  onToggle={toggleBodyArea}
                />
                <BodyMapColumn
                  areas={bodyAreas.filter((area) => area.startsWith("Back"))}
                  selectedAreas={draft.bodyAreas}
                  side="Back"
                  onToggle={toggleBodyArea}
                />
              </View>
            </View>

            <IncidentField
              label="Patient's account and views"
              multiline
              onChangeText={(patientAccount) => setDraft((current) => ({ ...current, patientAccount }))}
              placeholder="Record the patient's own words where possible, or why their account could not be obtained."
              value={draft.patientAccount}
            />

            <Text style={styles.fieldLabel}>Assign an owner</Text>
            <View style={styles.chipRow}>
              <ChoiceChip
                active={!draft.ownerStaffId}
                label="Unassigned"
                onPress={() => setDraft((current) => ({ ...current, ownerStaffId: "" }))}
              />
              {wardStaff.map((member) => (
                <ChoiceChip
                  key={member.id}
                  active={draft.ownerStaffId === member.id}
                  label={member.name}
                  onPress={() => setDraft((current) => ({ ...current, ownerStaffId: member.id }))}
                />
              ))}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              disabled={!formComplete || isSaving}
              onPress={() => void saveNewIncident()}
              style={[styles.saveButton, (!formComplete || isSaving) && styles.disabledButton]}
            >
              <Text style={styles.saveButtonText}>{isSaving ? "Saving…" : "Save and add to Safety Centre"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listPanel}>
            <View style={styles.listHeading}>
              <View>
                <Text style={styles.sectionTitle}>Incident review queue</Text>
                <Text style={styles.panelMeta}>Red first, then amber and green. Resolved incidents remain in the record.</Text>
              </View>
            </View>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.chipRow}>
              {(["active", "open", "acknowledged", "resolved", "all"] as const).map((status) => (
                <ChoiceChip
                  key={status}
                  active={statusFilter === status}
                  label={status === "active" ? "Active" : capitalise(status)}
                  onPress={() => setStatusFilter(status)}
                />
              ))}
            </View>
            <Text style={styles.filterLabel}>Severity</Text>
            <View style={styles.chipRow}>
              {(["all", "red", "amber", "green"] as const).map((severity) => (
                <ChoiceChip
                  key={severity}
                  active={severityFilter === severity}
                  label={capitalise(severity)}
                  onPress={() => setSeverityFilter(severity)}
                />
              ))}
            </View>

            {filteredIncidents.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>No incidents in this view</Text>
                <Text style={styles.panelMeta}>Change the filters or record a new incident above.</Text>
              </View>
            ) : (
              filteredIncidents.map((incident) => {
                const patient = patients.find((item) => item.id === incident.patientId);
                const isUpdating = updatingIncidentId === incident.id;
                return (
                  <View
                    key={incident.id}
                    style={[styles.incidentCard, incidentBorderStyle(incident.severity)]}
                  >
                    <View style={styles.incidentHeader}>
                      <View style={styles.incidentHeading}>
                        <View style={styles.incidentBadgeRow}>
                          <View style={[styles.ragDot, severityStyle(incident.severity)]} />
                          <Text style={styles.incidentTitle}>{incident.title}</Text>
                        </View>
                        <Text style={styles.incidentMeta}>
                          {patient
                            ? `Room ${patient.roomNumber} · ${patient.firstName} ${patient.surname}`
                            : "Patient unavailable"}{" "}
                          · {incident.category} · {formatDateTime(incident.reportedAt)}
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{capitalise(incident.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.incidentDetails}>{incident.details}</Text>
                    {incident.immediateAction ? (
                      <DetailBlock label="Immediate action" value={incident.immediateAction} />
                    ) : null}
                    {incident.bodyAreas.length > 0 ? (
                      <DetailBlock label="Body map" value={incident.bodyAreas.join(" · ")} />
                    ) : null}
                    {incident.patientAccount ? (
                      <DetailBlock label="Patient account" value={incident.patientAccount} />
                    ) : null}
                    <View style={styles.incidentAudit}>
                      <Text style={styles.auditText}>
                        Reported by {incident.reportedByName}
                        {incident.ownerName ? ` · Owner ${incident.ownerName}` : " · Unassigned"}
                      </Text>
                      {incident.acknowledgedAt ? (
                        <Text style={styles.auditText}>
                          Acknowledged {formatDateTime(incident.acknowledgedAt)} by {incident.acknowledgedByName}
                        </Text>
                      ) : null}
                      {incident.resolvedAt ? (
                        <Text style={styles.auditText}>
                          Resolved {formatDateTime(incident.resolvedAt)} by {incident.resolvedByName}
                        </Text>
                      ) : null}
                    </View>
                    {incident.resolutionNotes ? (
                      <DetailBlock label="Resolution and follow-up" value={incident.resolutionNotes} />
                    ) : null}

                    {incident.status !== "resolved" ? (
                      <View style={styles.actionRow}>
                        {incident.status === "open" ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={isUpdating}
                            onPress={() => void acknowledgeIncident(incident)}
                            style={[styles.secondaryButton, isUpdating && styles.disabledButton]}
                          >
                            <Text style={styles.secondaryButtonText}>Review / acknowledge</Text>
                          </TouchableOpacity>
                        ) : null}
                        {canResolve ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={isUpdating}
                            onPress={() => {
                              setResolvingIncidentId(
                                resolvingIncidentId === incident.id ? "" : incident.id
                              );
                              setResolutionNotes("");
                            }}
                            style={[styles.resolveButton, isUpdating && styles.disabledButton]}
                          >
                            <Text style={styles.resolveButtonText}>Resolve incident</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>

      <Modal
        accessibilityViewIsModal
        animationType="fade"
        onRequestClose={closeResolutionModal}
        transparent
        visible={Boolean(resolvingIncidentId)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.resolveModal}>
            <View style={styles.resolveModalHeader}>
              <Text style={styles.sectionTitle}>Resolve incident</Text>
              <View style={styles.keyboardActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={Keyboard.dismiss}
                  style={styles.keyboardButton}
                >
                  <Text style={styles.keyboardButtonText}>Hide keyboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={closeResolutionModal}
                  style={styles.closeModalButton}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.panelMeta}>
              {wardIncidents.find((incident) => incident.id === resolvingIncidentId)?.title ??
                "Record the outcome before closing this incident."}
            </Text>
            <IncidentField
              label="Resolution, outcome and follow-up *"
              multiline
              onChangeText={setResolutionNotes}
              placeholder="Record the review outcome, treatment, referrals and outstanding follow-up."
              value={resolutionNotes}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={Boolean(updatingIncidentId)}
                onPress={closeResolutionModal}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!resolutionNotes.trim() || Boolean(updatingIncidentId)}
                onPress={() => {
                  const incident = wardIncidents.find((item) => item.id === resolvingIncidentId);
                  if (incident) void resolveIncident(incident);
                }}
                style={[
                  styles.saveButton,
                  (!resolutionNotes.trim() || Boolean(updatingIncidentId)) && styles.disabledButton
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {updatingIncidentId ? "Saving…" : "Confirm resolution"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function RagSummary({
  count,
  label,
  severity
}: {
  count: number;
  label: string;
  severity: IncidentSeverity;
}) {
  return (
    <View style={[styles.ragCard, ragCardStyle(severity)]}>
      <View style={[styles.ragDot, severityStyle(severity)]} />
      <View>
        <Text style={styles.ragValue}>{count}</Text>
        <Text style={styles.ragLabel}>{label}</Text>
      </View>
    </View>
  );
}

function BodyMapColumn({
  areas,
  onToggle,
  selectedAreas,
  side
}: {
  areas: string[];
  onToggle: (area: string) => void;
  selectedAreas: string[];
  side: "Front" | "Back";
}) {
  const selectedFor = (terms: string[]) =>
    selectedAreas.some(
      (area) =>
        area.startsWith(side) &&
        terms.some((term) => area.toLowerCase().includes(term.toLowerCase()))
    );
  return (
    <View style={styles.bodyColumn}>
      <View style={[styles.bodyHead, selectedFor(["head", "face"]) && styles.bodyPartSelected]} />
      <View style={styles.bodyShoulders}>
        <View style={[styles.bodyHand, selectedFor(["left hand"]) && styles.bodyPartSelected]} />
        <View style={[styles.bodyArm, selectedFor(["left arm"]) && styles.bodyPartSelected]} />
        <View style={[styles.bodyTorso, selectedFor(["neck", "chest", "abdomen", "upper back", "lower back"]) && styles.bodyPartSelected]}>
          <Text style={styles.bodySideLabel}>{side}</Text>
        </View>
        <View style={[styles.bodyArm, selectedFor(["right arm"]) && styles.bodyPartSelected]} />
        <View style={[styles.bodyHand, selectedFor(["right hand"]) && styles.bodyPartSelected]} />
      </View>
      <View style={styles.bodyHips}>
        <View style={[styles.bodyHip, selectedFor(["left hip", "pelvis", "buttocks"]) && styles.bodyPartSelected]} />
        <View style={[styles.bodyHip, selectedFor(["right hip", "pelvis", "buttocks"]) && styles.bodyPartSelected]} />
      </View>
      <View style={styles.bodyLegs}>
        <View style={[styles.bodyLeg, selectedFor(["left leg", "left foot"]) && styles.bodyPartSelected]} />
        <View style={[styles.bodyLeg, selectedFor(["right leg", "right foot"]) && styles.bodyPartSelected]} />
      </View>
      <View style={styles.bodyAreaChoices}>
        {areas.map((area) => {
          const label = area.replace(`${side} · `, "");
          const selected = selectedAreas.includes(area);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={area}
              onPress={() => onToggle(area)}
              style={[styles.bodyAreaButton, selected && styles.bodyAreaButtonSelected]}
            >
              <Text style={[styles.bodyAreaText, selected && styles.bodyAreaTextSelected]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ChoiceChip({
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
      style={[styles.choiceChip, active && styles.choiceChipActive]}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function IncidentField({
  label,
  maxLength = 20_000,
  multiline = false,
  onChangeText,
  placeholder,
  value
}: {
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#78868c"
        style={[styles.input, multiline && styles.multilineInput]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function emptyDraft(): IncidentDraft {
  return {
    category: "Injury or physical concern",
    severity: "amber",
    title: "",
    details: "",
    immediateAction: "",
    bodyAreas: [],
    patientAccount: "",
    ownerStaffId: ""
  };
}

function compareIncidents(left: SafetyIncident, right: SafetyIncident) {
  const statusOrder = { open: 0, acknowledged: 1, resolved: 2 };
  const severityOrder = { red: 0, amber: 1, green: 2 };
  return (
    statusOrder[left.status] - statusOrder[right.status] ||
    severityOrder[left.severity] - severityOrder[right.severity] ||
    right.reportedAt.localeCompare(left.reportedAt)
  );
}

function capitalise(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function severityLabel(severity: IncidentSeverity) {
  if (severity === "red") return "Red · Immediate";
  if (severity === "amber") return "Amber · Review";
  return "Green · Monitor";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function severityStyle(severity: IncidentSeverity) {
  if (severity === "red") return styles.redBackground;
  if (severity === "amber") return styles.amberBackground;
  return styles.greenBackground;
}

function ragCardStyle(severity: IncidentSeverity) {
  if (severity === "red") return styles.redCard;
  if (severity === "amber") return styles.amberCard;
  return styles.greenCard;
}

function incidentBorderStyle(severity: IncidentSeverity) {
  if (severity === "red") return styles.redIncident;
  if (severity === "amber") return styles.amberIncident;
  return styles.greenIncident;
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
  title: { color: "#16282f", fontSize: 27, fontWeight: "900", marginTop: 3 },
  meta: { color: "#64747b", fontSize: 12, fontWeight: "700", marginTop: 5 },
  backButton: {
    borderColor: "#205566",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16
  },
  backButtonText: { color: "#205566", fontSize: 12, fontWeight: "900" },
  ragGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ragCard: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    flexGrow: 1,
    gap: 11,
    minWidth: 190,
    padding: 13
  },
  redCard: { backgroundColor: "#fff0ed", borderColor: "#e6aaa0" },
  amberCard: { backgroundColor: "#fff7df", borderColor: "#e4cb81" },
  greenCard: { backgroundColor: "#edf7f1", borderColor: "#b9dac8" },
  totalCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 9,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 170,
    padding: 13
  },
  ragDot: { borderRadius: 999, height: 18, width: 18 },
  redBackground: { backgroundColor: "#c73c32" },
  amberBackground: { backgroundColor: "#e5a72b" },
  greenBackground: { backgroundColor: "#38865d" },
  ragValue: { color: "#16282f", fontSize: 24, fontWeight: "900" },
  ragLabel: { color: "#596a71", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  totalValue: { color: "#173f4d", fontSize: 24, fontWeight: "900" },
  totalLabel: { color: "#65747a", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  workspace: { alignItems: "flex-start", flexDirection: "row", flexWrap: "nowrap", gap: 14 },
  workspaceCompact: { flexDirection: "column" },
  patientPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: 220,
    flexGrow: 0,
    flexShrink: 0,
    gap: 9,
    minWidth: 200,
    padding: 14
  },
  patientPanelCompact: { flexBasis: "auto", width: "100%" },
  panelTitle: { color: "#1c3038", fontSize: 18, fontWeight: "900" },
  panelMeta: { color: "#68787f", fontSize: 11, fontWeight: "700", marginTop: 3 },
  patientRow: { borderColor: "#dce3e5", borderRadius: 7, borderWidth: 1, padding: 11 },
  patientRowActive: { backgroundColor: "#e8f2f4", borderColor: "#236879" },
  patientName: { color: "#21353d", fontSize: 12, fontWeight: "900" },
  patientNameActive: { color: "#173f4d", fontSize: 14 },
  patientMeta: { color: "#6c7a80", fontSize: 10, fontWeight: "800", marginTop: 4 },
  mainPanel: { flexBasis: 0, flexGrow: 1, flexShrink: 1, gap: 14, minWidth: 0 },
  formPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  formHeading: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: "#172b33", fontSize: 20, fontWeight: "900" },
  selectedPatientIdentity: { marginTop: 7 },
  selectedPatientName: { color: "#173f4d", fontSize: 19, fontWeight: "900" },
  selectedPatientRoom: { color: "#607078", fontSize: 12, fontWeight: "800", marginTop: 2 },
  severityBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  severityBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  field: { gap: 6 },
  fieldLabel: { color: "#30464f", fontSize: 11, fontWeight: "900" },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#bdcbd0",
    borderRadius: 7,
    borderWidth: 1,
    color: "#1f3139",
    fontSize: 13,
    minHeight: 44,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  multilineInput: { minHeight: 92 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  severityOption: { borderRadius: 8, borderWidth: 1, flexGrow: 1, minWidth: 170, padding: 11 },
  redOption: { backgroundColor: "#fff1ef", borderColor: "#e2aaa2" },
  amberOption: { backgroundColor: "#fff8e5", borderColor: "#e4ce8c" },
  greenOption: { backgroundColor: "#eff8f3", borderColor: "#bdd9c8" },
  optionSelected: { borderColor: "#173f4d", borderWidth: 2 },
  optionTitle: { color: "#243940", fontSize: 12, fontWeight: "900" },
  optionDescription: { color: "#66767d", fontSize: 9, fontWeight: "700", marginTop: 3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choiceChip: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd6d9",
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  choiceChipActive: { backgroundColor: "#1b6173", borderColor: "#1b6173" },
  choiceChipText: { color: "#3f535b", fontSize: 10, fontWeight: "900" },
  choiceChipTextActive: { color: "#ffffff" },
  bodyMapPanel: {
    backgroundColor: "#f5f8f9",
    borderColor: "#d9e2e5",
    borderRadius: 9,
    borderWidth: 1,
    gap: 8,
    padding: 13
  },
  bodyMapColumns: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  bodyColumn: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d7e0e3",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 210,
    padding: 11
  },
  bodyHead: { backgroundColor: "#d5e3e7", borderRadius: 999, height: 36, width: 36 },
  bodyShoulders: { alignItems: "flex-start", flexDirection: "row", marginTop: 4 },
  bodyArm: { backgroundColor: "#d5e3e7", borderRadius: 10, height: 18, marginTop: 8, width: 48 },
  bodyHand: { backgroundColor: "#d5e3e7", borderRadius: 999, height: 20, marginTop: 7, width: 20 },
  bodyTorso: {
    alignItems: "center",
    backgroundColor: "#d5e3e7",
    borderRadius: 16,
    height: 80,
    justifyContent: "center",
    width: 76
  },
  bodyHips: { flexDirection: "row", gap: 2 },
  bodyHip: { backgroundColor: "#d5e3e7", height: 24, width: 37 },
  bodySideLabel: { color: "#41606b", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  bodyLegs: { flexDirection: "row", gap: 8 },
  bodyLeg: { backgroundColor: "#d5e3e7", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, height: 70, width: 27 },
  bodyPartSelected: { backgroundColor: "#d86757" },
  bodyAreaChoices: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 11, width: "100%" },
  bodyAreaButton: {
    backgroundColor: "#f8fafb",
    borderColor: "#d6e0e3",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 6
  },
  bodyAreaButtonSelected: { backgroundColor: "#f4c2b9", borderColor: "#b84c3e" },
  bodyAreaText: { color: "#52666e", fontSize: 8, fontWeight: "800" },
  bodyAreaTextSelected: { color: "#7e2d25" },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#16596b",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14
  },
  saveButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  listPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  listHeading: { flexDirection: "row", justifyContent: "space-between" },
  filterLabel: { color: "#68787f", fontSize: 9, fontWeight: "900", marginTop: 3, textTransform: "uppercase" },
  emptyPanel: { backgroundColor: "#f6f9fa", borderRadius: 8, padding: 16 },
  emptyTitle: { color: "#29414a", fontSize: 14, fontWeight: "900" },
  incidentCard: {
    borderColor: "#d8e0e3",
    borderLeftWidth: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 13
  },
  redIncident: { backgroundColor: "#fff7f5", borderLeftColor: "#c73c32" },
  amberIncident: { backgroundColor: "#fffbef", borderLeftColor: "#e5a72b" },
  greenIncident: { backgroundColor: "#f5fbf7", borderLeftColor: "#38865d" },
  incidentHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  incidentHeading: { flex: 1, paddingRight: 10 },
  incidentBadgeRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  incidentTitle: { color: "#1e323a", flex: 1, fontSize: 15, fontWeight: "900" },
  incidentMeta: { color: "#65757b", fontSize: 9, fontWeight: "800", marginTop: 5 },
  statusBadge: { backgroundColor: "#e8eef0", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusBadgeText: { color: "#40565f", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  incidentDetails: { color: "#2d4149", fontSize: 11, lineHeight: 17 },
  detailBlock: { backgroundColor: "#ffffff", borderRadius: 6, padding: 9 },
  detailLabel: { color: "#68787f", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  detailValue: { color: "#2d4149", fontSize: 10, lineHeight: 15, marginTop: 3 },
  incidentAudit: { gap: 3 },
  auditText: { color: "#607078", fontSize: 9, fontWeight: "800" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#1d5d6e",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  secondaryButtonText: { color: "#1d5d6e", fontSize: 10, fontWeight: "900" },
  resolveButton: {
    backgroundColor: "#1d5d6e",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  resolveButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  resolvePanel: { backgroundColor: "#eef4f5", borderRadius: 8, gap: 9, padding: 11 },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(11, 31, 38, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  resolveModal: {
    backgroundColor: "#ffffff",
    borderRadius: 11,
    elevation: 8,
    gap: 12,
    maxWidth: 620,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: "100%"
  },
  resolveModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between"
  },
  keyboardActions: { flexDirection: "row", gap: 7 },
  keyboardButton: {
    backgroundColor: "#eef4f5",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10
  },
  keyboardButtonText: { color: "#315663", fontSize: 10, fontWeight: "900" },
  closeModalButton: {
    borderColor: "#315663",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 11
  },
  closeModalButtonText: { color: "#315663", fontSize: 10, fontWeight: "900" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 }
});
