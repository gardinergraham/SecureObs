import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { SecureDateTimeField } from "../components/SecureDateTimeField";
import type { Patient, PatientCarePlan, StaffMember, Ward } from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

type CarePlanDraft = {
  title: string;
  identifiedNeeds: string;
  risksAndTriggers: string;
  goals: string;
  interventions: string;
  patientViews: string;
  reviewDate: string;
  additionalNotes: string;
};

type PatientCarePlansScreenProps = {
  carePlans: PatientCarePlan[];
  patients: Patient[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  ward?: Ward;
  onBack: () => void;
  onCreateCarePlan: (carePlan: PatientCarePlan) => Promise<void>;
  onSelectPatient: (patientId: string) => void;
};

export function PatientCarePlansScreen({
  carePlans,
  patients,
  selectedPatientId,
  selectedStaffId,
  staff,
  ward,
  onBack,
  onCreateCarePlan,
  onSelectPatient
}: PatientCarePlansScreenProps) {
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canCreate = Boolean(
    hasStaffRole(selectedStaff, "nurse") ||
      hasStaffRole(selectedStaff, "manager") ||
      hasStaffRole(selectedStaff, "doctor") ||
      hasAdminAccess(selectedStaff)
  );
  const patientCarePlans = useMemo(
    () =>
      carePlans
        .filter((carePlan) => carePlan.patientId === selectedPatient?.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [carePlans, selectedPatient?.id]
  );
  const [draft, setDraft] = useState<CarePlanDraft>(() => createEmptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [pdfPlanId, setPdfPlanId] = useState("");

  useEffect(() => {
    setDraft(createEmptyDraft());
  }, [selectedPatient?.id]);

  const incompleteFields = getIncompleteCarePlanFields(draft);
  const requiredFieldsComplete = incompleteFields.length === 0;

  const saveCarePlan = async () => {
    if (!selectedPatient || !selectedStaff || !ward || !canCreate || !requiredFieldsComplete) {
      const missingDetails = incompleteFields.length > 0
        ? `Please check: ${incompleteFields.join(", ")}.`
        : !selectedStaff
          ? "No authenticated staff member is selected."
          : !ward
            ? "No ward is selected."
            : !selectedPatient
              ? "No patient is selected."
              : "Your staff role does not have permission to create care plans.";
      Alert.alert(
        "Care plan cannot be saved yet",
        missingDetails
      );
      return;
    }

    const carePlan: PatientCarePlan = {
      id: `patient-care-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: selectedPatient.id,
      wardId: ward.id,
      title: draft.title.trim(),
      identifiedNeeds: draft.identifiedNeeds.trim(),
      risksAndTriggers: draft.risksAndTriggers.trim(),
      goals: draft.goals.trim(),
      interventions: draft.interventions.trim(),
      patientViews: draft.patientViews.trim(),
      reviewDate: draft.reviewDate.trim(),
      additionalNotes: draft.additionalNotes.trim(),
      createdByStaffId: selectedStaff.id,
      createdByName: selectedStaff.name,
      createdByStaffCode: selectedStaff.staffCode,
      createdAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onCreateCarePlan(carePlan);
      setDraft(createEmptyDraft());
      Alert.alert("Care plan saved", `${carePlan.title} has been added to ${selectedPatient.firstName}'s record.`);
    } catch (error) {
      Alert.alert("Care plan not saved", error instanceof Error ? error.message : "Please sign in and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentDraftAsPlan = (): PatientCarePlan | undefined => {
    if (!selectedPatient || !selectedStaff || !ward || !requiredFieldsComplete) return undefined;
    return {
      id: "current-draft",
      patientId: selectedPatient.id,
      wardId: ward.id,
      title: draft.title.trim(),
      identifiedNeeds: draft.identifiedNeeds.trim(),
      risksAndTriggers: draft.risksAndTriggers.trim(),
      goals: draft.goals.trim(),
      interventions: draft.interventions.trim(),
      patientViews: draft.patientViews.trim(),
      reviewDate: draft.reviewDate.trim(),
      additionalNotes: draft.additionalNotes.trim(),
      createdByStaffId: selectedStaff.id,
      createdByName: selectedStaff.name,
      createdByStaffCode: selectedStaff.staffCode,
      createdAt: new Date().toISOString()
    };
  };

  const printCarePlan = async (carePlan?: PatientCarePlan) => {
    const plan = carePlan ?? currentDraftAsPlan();
    if (!plan || !selectedPatient) {
      Alert.alert("Complete required fields", "Complete the required care-plan fields before printing this draft.");
      return;
    }

    setPdfPlanId(plan.id);
    try {
      await Print.printAsync({
        html: buildCarePlanHtml({ carePlan: plan, patient: selectedPatient, wardName: ward?.name ?? "Ward" })
      });
    } catch (error) {
      Alert.alert("Unable to print", error instanceof Error ? error.message : "The print dialog could not be opened.");
    } finally {
      setPdfPlanId("");
    }
  };

  const shareCarePlan = async (carePlan: PatientCarePlan) => {
    if (!selectedPatient) return;

    setPdfPlanId(carePlan.id);
    try {
      const pdf = await Print.printToFileAsync({
        html: buildCarePlanHtml({ carePlan, patient: selectedPatient, wardName: ward?.name ?? "Ward" })
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Use Print PDF and choose Save as PDF on this device.");
        return;
      }
      await Sharing.shareAsync(pdf.uri, {
        dialogTitle: `Share ${carePlan.title}`,
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf"
      });
    } catch (error) {
      Alert.alert("Unable to create PDF", error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setPdfPlanId("");
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient care plans</Text>
          <Text style={styles.meta}>
            {ward?.name ?? "Ward"} | Structured nursing care planning
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.patientPanel}>
          <Text style={styles.panelTitle}>Patients</Text>
          <Text style={styles.panelMeta}>Select a patient to create or review their care plans.</Text>
          {orderedPatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => onSelectPatient(patient.id)}
              style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
            >
              <Text style={styles.patientName}>
                Room {patient.roomNumber} | {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.planPanel}>
          {selectedPatient ? (
            <>
              <View style={styles.patientHeader}>
                <View>
                  <Text style={styles.patientTitle}>
                    {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.meta}>
                    Room {selectedPatient.roomNumber} | {selectedPatient.hospitalNumber}
                  </Text>
                </View>
                <View style={styles.headerBadges}>
                  <Text style={styles.planCount}>{patientCarePlans.length} saved</Text>
                  <Text style={[styles.accessBadge, !canCreate && styles.readOnlyBadge]}>
                    {canCreate ? "Create access" : "Read only"}
                  </Text>
                </View>
              </View>

              <View style={styles.templatePanel}>
                <View style={styles.templateHeader}>
                  <View style={styles.templateHeading}>
                    <Text style={styles.sectionTitle}>New care-plan template</Text>
                    <Text style={styles.panelMeta}>
                      Required fields are marked *. The saved plan is signed with your staff identity.
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={!requiredFieldsComplete || Boolean(pdfPlanId)}
                    onPress={() => void printCarePlan()}
                    style={[styles.secondaryButton, (!requiredFieldsComplete || Boolean(pdfPlanId)) && styles.disabledButton]}
                  >
                    <Text style={styles.secondaryButtonText}>Print current draft</Text>
                  </TouchableOpacity>
                </View>

                <CarePlanField
                  editable={canCreate}
                  label="Care plan title *"
                  maxLength={200}
                  onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
                  placeholder="For example: Emotional wellbeing and anxiety management"
                  value={draft.title}
                />
                <CarePlanField
                  editable={canCreate}
                  label="Identified needs / current concern *"
                  multiline
                  onChangeText={(identifiedNeeds) => setDraft((current) => ({ ...current, identifiedNeeds }))}
                  placeholder="Describe the patient's assessed needs, current presentation and relevant context."
                  value={draft.identifiedNeeds}
                />
                <CarePlanField
                  editable={canCreate}
                  label="Risks, triggers and early warning signs"
                  multiline
                  onChangeText={(risksAndTriggers) => setDraft((current) => ({ ...current, risksAndTriggers }))}
                  placeholder="Record known risks, triggers, protective factors and signs that support may need to increase."
                  value={draft.risksAndTriggers}
                />
                <CarePlanField
                  editable={canCreate}
                  label="Goals and desired outcomes *"
                  multiline
                  onChangeText={(goals) => setDraft((current) => ({ ...current, goals }))}
                  placeholder="What outcomes are being worked towards? Make them clear and meaningful to the patient."
                  value={draft.goals}
                />
                <CarePlanField
                  editable={canCreate}
                  label="Planned interventions and staff support *"
                  large
                  maxLength={20_000}
                  multiline
                  onChangeText={(interventions) => setDraft((current) => ({ ...current, interventions }))}
                  placeholder="Describe what staff will do, frequency, responsibilities, escalation and how progress will be reviewed."
                  value={draft.interventions}
                />
                <CarePlanField
                  editable={canCreate}
                  label="Patient views, preferences and involvement"
                  multiline
                  onChangeText={(patientViews) => setDraft((current) => ({ ...current, patientViews }))}
                  placeholder="Record the patient's own views, choices, communication needs and agreed preferences."
                  value={draft.patientViews}
                />
                <View style={styles.reviewRow}>
                  <View style={styles.reviewDateField}>
                    <SecureDateTimeField
                      dateFormat="uk"
                      disabled={!canCreate}
                      label="Review date *"
                      minimumDate={new Date()}
                      mode="date"
                      onChange={(reviewDate) => setDraft((current) => ({ ...current, reviewDate }))}
                      value={draft.reviewDate}
                    />
                  </View>
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewMetaLabel}>Prepared by</Text>
                    <Text style={styles.reviewMetaValue}>
                      {selectedStaff?.name ?? "No staff selected"}
                      {selectedStaff?.staffCode ? ` (${selectedStaff.staffCode})` : ""}
                    </Text>
                  </View>
                </View>
                <CarePlanField
                  editable={canCreate}
                  label="Additional notes"
                  multiline
                  onChangeText={(additionalNotes) => setDraft((current) => ({ ...current, additionalNotes }))}
                  placeholder="Optional multidisciplinary, family/carer or follow-up information."
                  value={draft.additionalNotes}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canCreate || isSaving}
                  onPress={() => void saveCarePlan()}
                  style={[
                    styles.saveButton,
                    (!canCreate || isSaving) && styles.disabledButton
                  ]}
                >
                  <Text style={styles.saveButtonText}>{isSaving ? "Saving…" : "Save signed care plan"}</Text>
                </TouchableOpacity>
                {canCreate && incompleteFields.length > 0 ? (
                  <Text style={styles.validationHint}>
                    To save, complete: {incompleteFields.join(", ")}.
                  </Text>
                ) : null}
              </View>

              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Saved care plans</Text>
                <Text style={styles.panelMeta}>Newest plans appear first. Plans are retained as signed records.</Text>
              </View>
              <ScrollView nestedScrollEnabled style={styles.planHistory}>
                {patientCarePlans.length === 0 ? (
                  <View style={styles.emptyPanel}>
                    <Text style={styles.emptyTitle}>No general care plans saved</Text>
                    <Text style={styles.panelMeta}>Use the template above to create this patient's first plan.</Text>
                  </View>
                ) : (
                  patientCarePlans.map((carePlan) => (
                    <View key={carePlan.id} style={styles.savedPlanCard}>
                      <View style={styles.savedPlanHeader}>
                        <View style={styles.savedPlanHeading}>
                          <Text style={styles.savedPlanTitle}>{carePlan.title}</Text>
                          <Text style={styles.savedPlanMeta}>
                            Created {formatDateTime(carePlan.createdAt)} by {carePlan.createdByName}
                          </Text>
                          <Text style={styles.reviewDate}>Review date: {carePlan.reviewDate}</Text>
                        </View>
                        <View style={styles.pdfActions}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={Boolean(pdfPlanId)}
                            onPress={() => void printCarePlan(carePlan)}
                            style={[styles.secondaryButton, Boolean(pdfPlanId) && styles.disabledButton]}
                          >
                            <Text style={styles.secondaryButtonText}>Print PDF</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={Boolean(pdfPlanId)}
                            onPress={() => void shareCarePlan(carePlan)}
                            style={[styles.pdfButton, Boolean(pdfPlanId) && styles.disabledButton]}
                          >
                            <Text style={styles.pdfButtonText}>Share / save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <PlanSection label="Identified needs" value={carePlan.identifiedNeeds} />
                      <PlanSection label="Risks, triggers and warning signs" value={carePlan.risksAndTriggers} />
                      <PlanSection label="Goals and desired outcomes" value={carePlan.goals} />
                      <PlanSection label="Interventions and staff support" value={carePlan.interventions} />
                      <PlanSection label="Patient views and preferences" value={carePlan.patientViews} />
                      <PlanSection label="Additional notes" value={carePlan.additionalNotes} />
                    </View>
                  ))
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No patient selected</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function CarePlanField({
  editable,
  label,
  large = false,
  maxLength = 10_000,
  multiline = false,
  onChangeText,
  placeholder,
  value
}: {
  editable: boolean;
  label: string;
  large?: boolean;
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
        accessibilityLabel={label}
        editable={editable}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#718087"
        style={[
          styles.input,
          multiline && styles.multilineInput,
          large && styles.largeInput,
          !editable && styles.readOnlyInput
        ]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function PlanSection({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.savedSection}>
      <Text style={styles.savedSectionLabel}>{label}</Text>
      <Text selectable style={styles.savedSectionText}>{value}</Text>
    </View>
  );
}

export function buildCarePlanHtml({
  carePlan,
  patient,
  wardName
}: {
  carePlan: PatientCarePlan;
  patient: Patient;
  wardName: string;
}) {
  const sectionEntries: Array<[string, string]> = [
    ["Identified needs / current concern", carePlan.identifiedNeeds],
    ["Risks, triggers and early warning signs", carePlan.risksAndTriggers],
    ["Goals and desired outcomes", carePlan.goals],
    ["Planned interventions and staff support", carePlan.interventions],
    ["Patient views, preferences and involvement", carePlan.patientViews],
    ["Additional notes", carePlan.additionalNotes]
  ];
  const sections = sectionEntries
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `
        <section>
          <h2>${escapeHtml(label)}</h2>
          <div class="section-body">${escapeHtml(value)}</div>
        </section>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 16mm 17mm 18mm; }
          body { color: #17252b; font-family: Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; }
          .confidential { color: #8a2d2d; font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
          h1 { color: #153f4d; font-size: 20pt; margin: 3px 0 2px; }
          .plan-title { color: #42565e; font-size: 13pt; font-weight: 700; margin-bottom: 14px; }
          .meta { background: #edf4f3; border: 1px solid #aebfc3; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; padding: 10px 12px; }
          section { border: 1px solid #b7c4c8; margin-top: 12px; }
          h2 { background: #1f5262; color: #fff; font-size: 11pt; margin: 0; padding: 7px 9px; break-after: avoid; }
          .section-body { overflow-wrap: anywhere; padding: 10px; white-space: pre-wrap; }
          .signoff { border-top: 2px solid #1f5262; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-top: 18px; padding-top: 10px; }
          .label { color: #5b6c73; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; }
          .value { margin-top: 2px; }
          .footer { color: #66777e; font-size: 8.5pt; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="confidential">Confidential clinical care plan</div>
        <h1>Patient care plan</h1>
        <div class="plan-title">${escapeHtml(carePlan.title)}</div>
        <div class="meta">
          <div><span class="label">Patient</span><div class="value">${escapeHtml(`${patient.firstName} ${patient.surname}`)}</div></div>
          <div><span class="label">Hospital number</span><div class="value">${escapeHtml(patient.hospitalNumber)}</div></div>
          <div><span class="label">Ward</span><div class="value">${escapeHtml(wardName)}</div></div>
          <div><span class="label">Room</span><div class="value">${patient.roomNumber}</div></div>
          <div><span class="label">Created</span><div class="value">${escapeHtml(formatDateTime(carePlan.createdAt))}</div></div>
          <div><span class="label">Review date</span><div class="value">${escapeHtml(carePlan.reviewDate)}</div></div>
        </div>
        ${sections}
        <div class="signoff">
          <div><span class="label">Prepared by</span><div class="value">${escapeHtml(carePlan.createdByName)}</div></div>
          <div><span class="label">Staff code</span><div class="value">${escapeHtml(carePlan.createdByStaffCode)}</div></div>
        </div>
        <div class="footer">Generated from SecureObs. Review the current electronic record before relying on a printed copy.</div>
      </body>
    </html>
  `;
}

function createEmptyDraft(): CarePlanDraft {
  return {
    title: "",
    identifiedNeeds: "",
    risksAndTriggers: "",
    goals: "",
    interventions: "",
    patientViews: "",
    reviewDate: formatDate(addDays(new Date(), 7)),
    additionalNotes: ""
  };
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: Date) {
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
}

function isValidReviewDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getIncompleteCarePlanFields(draft: CarePlanDraft) {
  const fields: string[] = [];
  if (!draft.title.trim()) fields.push("care plan title");
  if (!draft.identifiedNeeds.trim()) fields.push("identified needs");
  if (!draft.goals.trim()) fields.push("goals and desired outcomes");
  if (!draft.interventions.trim()) fields.push("planned interventions");
  if (!isValidReviewDate(draft.reviewDate)) fields.push("a valid review date in DD/MM/YYYY format");
  return fields;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  screen: { gap: 12 },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  title: { color: "#18262c", fontSize: 24, fontWeight: "900" },
  meta: { color: "#617078", fontSize: 13, fontWeight: "700", marginTop: 3 },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14
  },
  backButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  split: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  patientPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 270,
    padding: 14,
    width: "30%"
  },
  planPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden"
  },
  panelTitle: { color: "#18262c", fontSize: 18, fontWeight: "900" },
  panelMeta: { color: "#617078", fontSize: 12, fontWeight: "700", marginTop: 3 },
  patientRow: {
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 10,
    padding: 11
  },
  patientRowActive: { backgroundColor: "#e8f2f5", borderColor: "#1f5262" },
  patientName: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  patientMeta: { color: "#617078", fontSize: 12, fontWeight: "700", marginTop: 3 },
  patientHeader: {
    alignItems: "center",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  patientTitle: { color: "#18262c", fontSize: 22, fontWeight: "900" },
  headerBadges: { alignItems: "center", flexDirection: "row", gap: 8 },
  planCount: {
    backgroundColor: "#e9f3ef",
    borderRadius: 6,
    color: "#276149",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  accessBadge: {
    backgroundColor: "#dceef3",
    borderRadius: 6,
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  readOnlyBadge: { backgroundColor: "#eef0f1", color: "#65737a" },
  templatePanel: { backgroundColor: "#f8fafb", gap: 10, padding: 14 },
  templateHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  templateHeading: { flex: 1, paddingRight: 12 },
  sectionTitle: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  field: { gap: 5 },
  fieldLabel: { color: "#31454d", fontSize: 12, fontWeight: "900" },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#b9c7cb",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 10
  },
  multilineInput: { lineHeight: 20, minHeight: 92, paddingTop: 10 },
  largeInput: { minHeight: 130 },
  readOnlyInput: { backgroundColor: "#eef1f2", color: "#66767d" },
  reviewRow: { alignItems: "flex-end", flexDirection: "row", gap: 12 },
  reviewDateField: { flex: 1 },
  reviewMeta: {
    backgroundColor: "#edf4f3",
    borderRadius: 6,
    flex: 2,
    minHeight: 67,
    justifyContent: "center",
    padding: 10
  },
  reviewMetaLabel: { color: "#5e7077", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  reviewMetaValue: { color: "#24363e", fontSize: 13, fontWeight: "800", marginTop: 4 },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 46
  },
  saveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  disabledButton: { opacity: 0.42 },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 11
  },
  secondaryButtonText: { color: "#1f5262", fontSize: 11, fontWeight: "900" },
  historyHeader: {
    borderBottomColor: "#d8e0e3",
    borderTopColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14
  },
  planHistory: { maxHeight: 720, padding: 12 },
  savedPlanCard: {
    borderColor: "#b9c7cb",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden"
  },
  savedPlanHeader: {
    alignItems: "flex-start",
    backgroundColor: "#edf4f3",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  savedPlanHeading: { flex: 1, paddingRight: 10 },
  savedPlanTitle: { color: "#18262c", fontSize: 16, fontWeight: "900" },
  savedPlanMeta: { color: "#5b6c73", fontSize: 11, fontWeight: "700", marginTop: 4 },
  reviewDate: { color: "#1f5262", fontSize: 11, fontWeight: "900", marginTop: 4 },
  validationHint: { color: "#8a4b16", fontSize: 12, fontWeight: "800", marginTop: 8 },
  pdfActions: { flexDirection: "row", gap: 7 },
  pdfButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 11
  },
  pdfButtonText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  savedSection: { borderTopColor: "#d8e0e3", borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  savedSectionLabel: { color: "#31454d", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  savedSectionText: { color: "#263940", fontSize: 13, lineHeight: 20, marginTop: 5 },
  emptyPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16
  },
  emptyTitle: { color: "#18262c", fontSize: 15, fontWeight: "900" }
});
