import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Print from "expo-print";

import type {
  Patient,
  PatientFormRecord,
  PatientFormSection,
  PatientFormSectionRisk,
  StaffMember
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

const patientFormTemplates = [
  {
    id: "workplace-environment-risk-assessment-v1",
    title: "Risk assessment - workplace environment",
    reference: "Form No. 1",
    description: "Service user's property or workplace environment",
    assessmentLabel: "Risk",
    optionLabel: "Assess each hazard area as Low, Medium or High.",
    options: ["Low", "Medium", "High", "Not assessed"] as PatientFormSectionRisk[],
    notesPlaceholder: "Notes / hazards identified",
    actionsPlaceholder: "Actions required / controls in place",
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
  },
  {
    id: "daily-living-needs-baseline-v1",
    title: "Baseline assessment of needs for daily living",
    reference: "Form No. 2",
    description: "Service user daily living needs",
    assessmentLabel: "Support level",
    optionLabel: "Record the level of support needed for each daily living area.",
    options: ["Independent", "Prompting", "Assistance", "Full support", "Not assessed"] as PatientFormSectionRisk[],
    notesPlaceholder: "Current ability / needs / preferences",
    actionsPlaceholder: "Support required / care plan actions",
    sections: [
      "Waking and dressing",
      "Undressing, retiring and sleeping",
      "Food, drink and diet",
      "Medication",
      "Mobility",
      "Health and medical care",
      "Personal hygiene",
      "Daily life style and activities",
      "Social needs and relationships",
      "Psychiatric and mental history",
      "Communication needs",
      "Religion, culture and beliefs",
      "Awareness and reality orientation",
      "Behaviour and risks",
      "Money and finance"
    ]
  },
  {
    id: "bathing-showering-risk-assessment-v1",
    title: "Risk assessment - bathing and showering",
    reference: "Form No. 3",
    description: "Service user's bathing and showering safety",
    assessmentLabel: "Response",
    optionLabel: "Record each bathing and showering safety item as Yes, No, or Not assessed.",
    options: ["Yes", "No", "Not assessed"] as PatientFormSectionRisk[],
    notesPlaceholder: "Comments / observed risk",
    actionsPlaceholder: "Action required / equipment / supervision",
    sections: [
      "Service user is able to run a bath or add cold water unattended",
      "Service user is able to enter/exit a bath/shower safely and unaided",
      "Service user is able to stand unaided in a shower or there is shower stool available",
      "Where required, grab handles are within easy reach and are securely fixed",
      "Textured bath/shower mats are available to assist grip and reduce risk of slipping",
      "Service user can differentiate between hot and cold taps or safely operate mixer/thermostatic valve taps",
      "Service user does not have an impaired sensitivity to temperature",
      "Service user's mental capacity allows them to recognise a bath or shower that is too hot",
      "Showers - risk of excessive or restricted cold water arising from water diversions around gravity-fed shower systems",
      "Service user is able to summon assistance when required",
      "Bath hoists or other lifting aids required"
    ]
  },
  {
    id: "lifting-handling-risk-assessment-v1",
    title: "Risk assessment - lifting and handling",
    reference: "Form No. 4",
    description: "Service user's lifting and handling risks",
    assessmentLabel: "Risk",
    optionLabel: "Rate each lifting and handling activity as Low, Medium, High, or Not assessed.",
    options: ["Low", "Medium", "High", "Not assessed"] as PatientFormSectionRisk[],
    notesPlaceholder: "Comments / risk factors",
    actionsPlaceholder: "Controls / equipment / handling plan",
    sections: [
      "B1: The service user - documented history of falls",
      "B1: The service user - very large build in excess of 18 stones",
      "B1: The service user - unpredictable mobility or behaviour patterns",
      "B1: The service user - uses mobility or transfer aids",
      "B1: The service user - medical conditions affect mobility or behaviour",
      "B1: The service user - fitted with drains, drips, or catheters",
      "B2: Staff capability - fitness or health issues may create risk",
      "B2: Staff capability - risk to new or expectant mothers",
      "B2: Staff capability - special manual handling training required",
      "B2: Staff capability - unusual capability or strength required",
      "B2: Staff capability - concerns regarding training or information",
      "B3: Working environment - constraints on posture",
      "B3: Working environment - poor floor surfaces"
    ]
  },
  {
    id: "falls-risk-assessment-v1",
    title: "Risk assessment - falls",
    reference: "Form No. 5",
    description: "Service user falls risk factors and contributing factors",
    assessmentLabel: "Applicable",
    optionLabel: "Mark each falls risk factor as Yes, No, or Not assessed, then add considerations and actions.",
    options: ["Yes", "No", "Not assessed"] as PatientFormSectionRisk[],
    notesPlaceholder: "Considerations / evidence",
    actionsPlaceholder: "Controls / prevention plan",
    sections: [
      "B: Falls risk factor - visual or sight problems",
      "B: Falls risk factor - hearing problems",
      "B: Falls risk factor - speech impediment",
      "B: Falls risk factor - cognitive impediment",
      "B: Falls risk factor - limited or impaired mobility",
      "B: Falls risk factor - history of falls",
      "B: Falls risk factor - fear of falls",
      "B: Falls risk factor - urinary incontinence",
      "B: Falls risk factor - faecal incontinence",
      "B: Falls risk factor - history of smoking",
      "B: Falls risk factor - history of alcohol abuse",
      "B: Falls risk factor - history of fits and seizures",
      "B: Falls risk factor - confusion or disorientation",
      "B: Falls risk factor - address of NICE hip guidance/risk noted",
      "B: Falls risk factor - cardiac disease",
      "B: Falls risk factor - arterial disease",
      "B: Falls risk factor - Parkinson's disease",
      "B: Falls risk factor - postural hypertension",
      "B: Falls risk factor - use of antidepressants",
      "B: Falls risk factor - use of sedative",
      "B: Falls risk factor - peripheral neuropathy",
      "B: Falls risk factor - controlled drugs prescribed",
      "C: Contributing factor - previous history of falls",
      "C: Contributing factor - inability or unwillingness to call for assistance",
      "C: Contributing factor - limited mobility, movement or unsteady gait",
      "C: Contributing factor - confusion, disorientation, medication effects or altered mental state",
      "C: Contributing factor - impaired vision, hearing or other sensory defect",
      "C: Contributing factor - frequency of micturition, defecation or incontinence",
      "C: Contributing factor - recent cardiovascular accident or neurological impairment",
      "D: Ease of mobility"
    ]
  }
];
const defaultPatientFormTemplate = patientFormTemplates[0]!;

type PatientFormTemplate = (typeof patientFormTemplates)[number];

type PatientAssessmentFormsScreenProps = {
  patients: Patient[];
  selectedStaffId: string;
  staff: StaffMember[];
  onBack: () => void;
  onUpdatePatient: (patient: Patient) => void;
};

export function PatientAssessmentFormsScreen({
  patients,
  selectedStaffId,
  staff,
  onBack,
  onUpdatePatient
}: PatientAssessmentFormsScreenProps) {
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit =
    hasStaffRole(selectedStaff, "nurse") ||
    hasStaffRole(selectedStaff, "manager") ||
    hasStaffRole(selectedStaff, "doctor") ||
    hasStaffRole(selectedStaff, "hcf") ||
    hasAdminAccess(selectedStaff);
  const orderedPatients = useMemo(() => [...patients].sort((a, b) => a.roomNumber - b.roomNumber), [patients]);
  const [selectedPatientId, setSelectedPatientId] = useState(orderedPatients[0]?.id ?? "");
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState(defaultPatientFormTemplate.id);
  const selectedFormTemplate =
    patientFormTemplates.find((template) => template.id === selectedFormTemplateId) ?? defaultPatientFormTemplate;
  const [formSections, setFormSections] = useState<PatientFormSection[]>(() =>
    createDefaultFormSections(defaultPatientFormTemplate)
  );
  const [formReviewDate, setFormReviewDate] = useState("");
  const [serviceUserSignature, setServiceUserSignature] = useState("");
  const [staffSignature, setStaffSignature] = useState("");
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];

  useEffect(() => {
    setFormSections(createDefaultFormSections(selectedFormTemplate));
    setFormReviewDate("");
    setServiceUserSignature("");
    setStaffSignature("");
  }, [selectedFormTemplateId]);

  useEffect(() => {
    setSelectedFormTemplateId(defaultPatientFormTemplate.id);
    setFormSections(createDefaultFormSections(defaultPatientFormTemplate));
    setFormReviewDate("");
    setServiceUserSignature("");
    setStaffSignature("");
  }, [selectedPatientId]);

  const updateFormSection = (sectionId: string, updates: Partial<PatientFormSection>) => {
    setFormSections((currentSections) =>
      currentSections.map((section) => (section.id === sectionId ? { ...section, ...updates } : section))
    );
  };

  const savePatientForm = (status: PatientFormRecord["status"]) => {
    if (!selectedPatient || !canEdit) return;

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
      status,
      template: selectedFormTemplate
    });

    onUpdatePatient({
      ...selectedPatient,
      patientForms: [formRecord, ...(selectedPatient.patientForms ?? [])]
    });

    Alert.alert(
      status === "Completed" ? "Form completed" : "Draft saved",
      `${selectedFormTemplate.title} saved for ${selectedPatient.firstName} ${selectedPatient.surname}.`
    );
  };

  const printAssessment = async (formRecord?: PatientFormRecord) => {
    if (!selectedPatient) return;

    try {
      await Print.printAsync({
        html: buildAssessmentHtml({
          formRecord,
          patient: selectedPatient,
          reviewDate: formRecord?.reviewDate ?? formReviewDate,
          sections: formRecord?.sections ?? formSections,
          selectedStaffName: selectedStaff?.name ?? "",
          serviceUserSignature: formRecord?.serviceUserSignature ?? serviceUserSignature,
          staffSignature: formRecord?.staffSignature ?? staffSignature,
          template: formRecord ? getTemplateForForm(formRecord) : selectedFormTemplate
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
          <Text style={styles.title}>Assessment forms</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} | {canEdit ? "Form edit access" : "Read only"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to patient settings</Text>
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
              <Text style={styles.patientName}>
                Room {patient.roomNumber} | {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
              <Text style={styles.formCount}>{patient.patientForms?.length ?? 0} forms</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" style={styles.detailPane}>
          {selectedPatient ? (
            <>
              <View style={styles.patientHeader}>
                <View>
                  <Text style={styles.detailTitle}>
                    Room {selectedPatient.roomNumber} | {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.patientMeta}>{selectedPatient.hospitalNumber}</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" onPress={() => void printAssessment()} style={styles.printButton}>
                  <Text style={styles.printButtonText}>Print blank/current</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Form template</Text>
              <OptionRow
                disabled={!canEdit}
                options={patientFormTemplates.map((template) => template.reference)}
                selected={selectedFormTemplate.reference}
                onSelect={(reference) => {
                  const template = patientFormTemplates.find((item) => item.reference === reference);
                  if (template) setSelectedFormTemplateId(template.id);
                }}
              />

              <View style={styles.formTemplateCard}>
                <Text style={styles.actionTitle}>{selectedFormTemplate.title}</Text>
                <Text style={styles.actionMeta}>
                  {selectedFormTemplate.reference} | {selectedFormTemplate.description}
                </Text>
                <Text style={styles.actionMeta}>{selectedFormTemplate.optionLabel}</Text>

                {formSections.map((section) => (
                  <View key={section.id} style={styles.formSectionCard}>
                    <Text style={styles.formSectionTitle}>{section.title}</Text>
                    <OptionRow
                      disabled={!canEdit}
                      options={selectedFormTemplate.options}
                      selected={section.risk}
                      onSelect={(risk) => updateFormSection(section.id, { risk: risk as PatientFormSectionRisk })}
                    />
                    <TextInput
                      editable={canEdit}
                      multiline
                      onChangeText={(notes) => updateFormSection(section.id, { notes })}
                      placeholder={selectedFormTemplate.notesPlaceholder}
                      placeholderTextColor="#6f7f87"
                      style={[styles.input, styles.formNotesInput, !canEdit && styles.disabledControl]}
                      textAlignVertical="top"
                      value={section.notes}
                    />
                    <TextInput
                      editable={canEdit}
                      multiline
                      onChangeText={(actions) => updateFormSection(section.id, { actions })}
                      placeholder={selectedFormTemplate.actionsPlaceholder}
                      placeholderTextColor="#6f7f87"
                      style={[styles.input, styles.formNotesInput, !canEdit && styles.disabledControl]}
                      textAlignVertical="top"
                      value={section.actions}
                    />
                  </View>
                ))}

                <Text style={styles.label}>Review date</Text>
                <TextInput
                  editable={canEdit}
                  onChangeText={setFormReviewDate}
                  placeholder="e.g. 25/07/2026"
                  placeholderTextColor="#6f7f87"
                  style={[styles.input, !canEdit && styles.disabledControl]}
                  value={formReviewDate}
                />

                <View style={styles.signatureRow}>
                  <View style={styles.signatureColumn}>
                    <Text style={styles.label}>Service user signature</Text>
                    <TextInput
                      editable={canEdit}
                      onChangeText={setServiceUserSignature}
                      placeholder="Type name or signature confirmation"
                      placeholderTextColor="#6f7f87"
                      style={[styles.input, !canEdit && styles.disabledControl]}
                      value={serviceUserSignature}
                    />
                  </View>
                  <View style={styles.signatureColumn}>
                    <Text style={styles.label}>Staff signature</Text>
                    <TextInput
                      editable={canEdit}
                      onChangeText={setStaffSignature}
                      placeholder={selectedStaff?.name ?? "Staff name"}
                      placeholderTextColor="#6f7f87"
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
                    style={[styles.secondaryButton, !canEdit && styles.disabledControl]}
                  >
                    <Text style={styles.secondaryButtonText}>Save draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={!canEdit}
                    onPress={() => savePatientForm("Completed")}
                    style={[styles.primaryButton, !canEdit && styles.disabledControl]}
                  >
                    <Text style={styles.primaryButtonText}>Sign and complete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.historyPanel}>
                <Text style={styles.panelTitle}>Form history</Text>
                {(selectedPatient.patientForms ?? []).length === 0 ? (
                  <Text style={styles.infoText}>No assessment forms have been saved yet.</Text>
                ) : (
                  <View style={styles.formHistoryList}>
                    {(selectedPatient.patientForms ?? []).map((form) => (
                      <View key={form.id} style={styles.formHistoryRow}>
                        <View style={styles.formHistoryText}>
                          <Text style={styles.formHistoryTitle}>{form.title}</Text>
                          <Text style={styles.patientMeta}>
                            {form.status} | {formatDateTime(form.completedAt)} | {form.completedBy}
                          </Text>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => void printAssessment(form)}
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

function OptionRow({
  disabled,
  onSelect,
  options,
  selected
}: {
  disabled: boolean;
  onSelect: (value: string) => void;
  options: string[];
  selected: string;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = selected === option;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={disabled}
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.optionButton, active && styles.optionButtonActive, disabled && styles.disabledControl]}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createDefaultFormSections(template: PatientFormTemplate): PatientFormSection[] {
  return template.sections.map((title, index) => ({
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
  status,
  template
}: {
  completedBy: string;
  reviewDate: string;
  sections: PatientFormSection[];
  serviceUserSignature: string;
  staffSignature: string;
  status: PatientFormRecord["status"];
  template: PatientFormTemplate;
}): PatientFormRecord {
  return {
    id: `patient-form-${Date.now()}`,
    templateId: template.id,
    title: template.title,
    status,
    completedAt: new Date().toISOString(),
    completedBy,
    reviewDate,
    serviceUserSignature,
    staffSignature,
    sections
  };
}

function getTemplateForForm(formRecord: PatientFormRecord) {
  return patientFormTemplates.find((template) => template.id === formRecord.templateId) ?? defaultPatientFormTemplate;
}

function buildAssessmentHtml({
  formRecord,
  patient,
  reviewDate,
  sections,
  selectedStaffName,
  serviceUserSignature,
  staffSignature,
  template
}: {
  formRecord?: PatientFormRecord;
  patient: Patient;
  reviewDate: string;
  sections: PatientFormSection[];
  selectedStaffName: string;
  serviceUserSignature: string;
  staffSignature: string;
  template: PatientFormTemplate;
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
        <h1>${escapeHtml(template.title)}</h1>
        <p class="small" style="text-align:center">${escapeHtml(template.reference)} | ${escapeHtml(template.description)} | ${escapeHtml(completedLabel)}</p>
        <div class="meta">
          <div><strong>Service user</strong><div class="box">${escapeHtml(`${patient.firstName} ${patient.surname}`)}</div></div>
          <div><strong>Hospital/reference number</strong><div class="box">${escapeHtml(patient.hospitalNumber)}</div></div>
          <div><strong>Room</strong><div class="box">${patient.roomNumber}</div></div>
          <div><strong>Completed by</strong><div class="box">${escapeHtml(formRecord?.completedBy ?? selectedStaffName)}</div></div>
          <div><strong>Date reviewed</strong><div class="box">${escapeHtml(reviewDate)}</div></div>
          <div><strong>Status</strong><div class="box">${escapeHtml(formRecord?.status ?? "Current draft")}</div></div>
        </div>
        <h2>Assessment checklist</h2>
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>${escapeHtml(template.assessmentLabel)}</th>
              <th>${escapeHtml(template.notesPlaceholder)}</th>
              <th>${escapeHtml(template.actionsPlaceholder)}</th>
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

function formatDateTime(value: string | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
    padding: 12
  },
  title: { color: "#18262c", fontSize: 20, fontWeight: "900" },
  meta: { color: "#607078", fontSize: 13, marginTop: 3 },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  backButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  split: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  patientList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.34,
    minWidth: 300,
    padding: 12
  },
  detailPane: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.66,
    maxHeight: 720,
    minWidth: 480,
    padding: 14
  },
  detailContent: { paddingBottom: 220 },
  panelTitle: { color: "#18262c", fontSize: 17, fontWeight: "900", marginBottom: 10 },
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
    gap: 5,
    marginBottom: 8,
    minHeight: 82,
    padding: 10
  },
  patientRowActive: { backgroundColor: "#edf7f4", borderColor: "#1f5262" },
  patientName: { color: "#18262c", fontSize: 16, fontWeight: "900" },
  detailTitle: { color: "#18262c", fontSize: 22, fontWeight: "900" },
  patientMeta: { color: "#607078", fontSize: 12, marginTop: 2 },
  formCount: {
    backgroundColor: "#ddebd6",
    borderRadius: 6,
    color: "#243f2b",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  label: { color: "#31454d", fontSize: 13, fontWeight: "800", marginBottom: 7, marginTop: 10 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#30434a", fontSize: 13, fontWeight: "800" },
  optionTextActive: { color: "#ffffff" },
  formTemplateCard: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    padding: 12
  },
  actionTitle: { color: "#18262c", fontSize: 15, fontWeight: "900" },
  actionMeta: { color: "#607078", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  formSectionCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  formSectionTitle: { color: "#18262c", fontSize: 13, fontWeight: "900", marginBottom: 8 },
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
  formNotesInput: { lineHeight: 18, marginTop: 8, minHeight: 72, paddingTop: 9 },
  signatureRow: { flexDirection: "row", gap: 10 },
  signatureColumn: { flex: 1 },
  formActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  primaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  secondaryButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  printButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10
  },
  printButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  historyPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    padding: 12
  },
  formHistoryList: { borderColor: "#d8e0e3", borderRadius: 6, borderWidth: 1, overflow: "hidden" },
  formHistoryRow: {
    alignItems: "center",
    borderTopColor: "#edf1f2",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    padding: 10
  },
  formHistoryText: { flex: 1 },
  formHistoryTitle: { color: "#18262c", fontSize: 13, fontWeight: "900" },
  printSmallButton: {
    alignItems: "center",
    backgroundColor: "#edf7f4",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10
  },
  printSmallButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  infoText: { color: "#607078", fontSize: 14, lineHeight: 22, marginTop: 12 },
  disabledControl: { opacity: 0.45 }
});
