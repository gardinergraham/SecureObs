import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  MedicationAdministration,
  MedicationAdministrationStatus,
  MedicationOmissionCode,
  MedicationPrescription,
  Patient,
  StaffMember
} from "../types/domain";
import { hasStaffRole } from "../utils/staffRole";

const routeOptions = ["Oral", "IM", "Depot", "S/L", "Topical"];
const timeOptions = ["06:00", "08:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
const prescriptionTypeOptions = [
  { id: "regular", label: "Regular" },
  { id: "prn", label: "PRN" },
  { id: "depot", label: "Depot" },
  { id: "rapid", label: "Rapid tranquilisation" }
] as const;
const depotIntervalOptions = [
  { label: "Weekly", days: 7 },
  { label: "Fortnightly", days: 14 },
  { label: "Monthly", days: 28 }
];
const omissionOptions: Array<{ code: MedicationOmissionCode; label: string }> = [
  { code: "N", label: "Route not available" },
  { code: "X", label: "Prescriber request" },
  { code: "F", label: "Fasting" },
  { code: "S", label: "Self administered" },
  { code: "O", label: "Other reason" },
  { code: "U", label: "Product not available" }
];

type MedicationChartScreenProps = {
  administrations: MedicationAdministration[];
  initialViewMode: MedicationChartViewMode;
  patients: Patient[];
  prescriptions: MedicationPrescription[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  onBack: () => void;
  onCreateAdministration: (administration: MedicationAdministration) => void;
  onCreatePrescription: (prescription: MedicationPrescription) => void;
  onDiscontinuePrescription: (prescription: MedicationPrescription) => void;
  onSelectPatient: (patientId: string) => void;
  onUpdatePatient: (patient: Patient) => void;
};

type MedicationChartViewMode = "admin" | "chart" | "history";
type PendingMedicationAction = {
  prescription: MedicationPrescription;
  scheduledAt: string;
  status: MedicationAdministrationStatus;
  omissionCode?: MedicationOmissionCode;
  notes?: string;
};

export function MedicationChartScreen({
  administrations,
  initialViewMode,
  patients,
  prescriptions,
  selectedPatientId,
  selectedStaffId,
  staff,
  onBack,
  onCreateAdministration,
  onCreatePrescription,
  onDiscontinuePrescription,
  onSelectPatient,
  onUpdatePatient
}: MedicationChartScreenProps) {
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canPrescribe = Boolean(selectedStaff?.canPrescribe || hasStaffRole(selectedStaff, "doctor"));
  const visibleDates = useMemo(() => buildVisibleDates(), []);
  const today = visibleDates.find(isToday) ?? new Date();
  const patientPrescriptions = prescriptions.filter((prescription) => prescription.patientId === selectedPatient?.id);
  const activePrescriptions = patientPrescriptions.filter((prescription) => !prescription.discontinuedAt);
  const dueCount = activePrescriptions.reduce(
    (total, prescription) =>
      total +
      (prescription.prescriptionType === "prn" || prescription.prescriptionType === "rapid"
        ? 0
        : prescription.administrationTimes.filter((time) =>
            isDoseDueSoon(prescription, administrations, today, time)
          ).length),
    0
  );
  const [viewMode, setViewMode] = useState<MedicationChartViewMode>(initialViewMode);
  const [allergyText, setAllergyText] = useState(selectedPatient?.allergies ?? "");
  const [adrText, setAdrText] = useState(selectedPatient?.adverseDrugReactions ?? "");
  const [allergySaveMessage, setAllergySaveMessage] = useState("");
  const [pendingMedicationAction, setPendingMedicationAction] = useState<PendingMedicationAction | null>(null);
  const [editingDoseKey, setEditingDoseKey] = useState("");
  const [form, setForm] = useState(() => ({
    drugName: "",
    dose: "",
    route: "Oral",
    prescriptionType: "regular" as MedicationPrescription["prescriptionType"],
    prnIndication: "",
    depotIntervalDays: 14,
    administrationTimes: ["08:00"],
    startDate: formatInputDate(new Date()),
    timePrescribed: formatInputTime(new Date()),
    additionalInstructions: "",
    stopDate: formatInputDate(new Date()),
    stopTime: formatInputTime(new Date()),
    discontinueReason: ""
  }));

  useEffect(() => {
    setAllergyText(selectedPatient?.allergies ?? "");
    setAdrText(selectedPatient?.adverseDrugReactions ?? "");
    setAllergySaveMessage("");
  }, [selectedPatient?.adverseDrugReactions, selectedPatient?.allergies, selectedPatient?.id]);

  const createPrescription = () => {
    if (!selectedPatient || !selectedStaff || !canPrescribe || !form.drugName.trim() || !form.dose.trim()) {
      return;
    }

    const prescribedAt = buildIsoFromDateAndTime(form.startDate, form.timePrescribed) ?? new Date().toISOString();

    onCreatePrescription({
      id: `med-prescription-${Date.now()}`,
      patientId: selectedPatient.id,
      drugName: form.drugName.trim(),
      dose: form.dose.trim(),
      route: form.route,
      prescriptionType: form.prescriptionType,
      prnIndication: form.prescriptionType === "prn" || form.prescriptionType === "rapid" ? form.prnIndication.trim() : undefined,
      depotIntervalDays: form.prescriptionType === "depot" ? form.depotIntervalDays : undefined,
      administrationTimes:
        form.prescriptionType === "prn" || form.prescriptionType === "rapid"
          ? []
          : form.prescriptionType === "depot"
            ? [form.timePrescribed]
            : [...form.administrationTimes].sort(),
      startDate: prescribedAt,
      additionalInstructions: form.additionalInstructions.trim(),
      prescribedBy: selectedStaff.name,
      prescribedAt
    });

    setForm((current) => ({
      ...current,
      drugName: "",
      dose: "",
      route: "Oral",
      prescriptionType: "regular",
      prnIndication: "",
      depotIntervalDays: 14,
      administrationTimes: ["08:00"],
      startDate: formatInputDate(new Date()),
      timePrescribed: formatInputTime(new Date()),
      additionalInstructions: ""
    }));
  };

  const recordDose = (
    prescription: MedicationPrescription,
    scheduledAt: string,
    status: MedicationAdministrationStatus,
    omissionCode?: MedicationOmissionCode,
    notes?: string
  ) => {
    if (!selectedPatient || !selectedStaff || prescription.discontinuedAt) {
      return;
    }

    if (new Date(scheduledAt).getTime() > Date.now()) {
      return;
    }

    const defaultNote = omissionCode ? omissionLabel(omissionCode) : "";
    const governanceNote = buildAdministrationNote(scheduledAt, notes ?? defaultNote);

    onCreateAdministration({
      id: createAdministrationId(prescription, scheduledAt),
      prescriptionId: prescription.id,
      patientId: selectedPatient.id,
      scheduledAt,
      status,
      omissionCode,
      recordedBy: selectedStaff.name,
      recordedAt: new Date().toISOString(),
      notes: governanceNote
    });
  };

  const requestDoseRecord = (
    prescription: MedicationPrescription,
    scheduledAt: string,
    status: MedicationAdministrationStatus,
    omissionCode?: MedicationOmissionCode,
    notes?: string
  ) => {
    setPendingMedicationAction({ prescription, scheduledAt, status, omissionCode, notes });
  };

  const confirmDoseRecord = () => {
    if (!pendingMedicationAction) {
      return;
    }

    recordDose(
      pendingMedicationAction.prescription,
      pendingMedicationAction.scheduledAt,
      pendingMedicationAction.status,
      pendingMedicationAction.omissionCode,
      pendingMedicationAction.notes
    );
    setPendingMedicationAction(null);
    setEditingDoseKey("");
  };

  const discontinuePrescription = (prescription: MedicationPrescription) => {
    if (!selectedStaff || !canPrescribe) {
      return;
    }

    const stoppedAt = buildIsoFromDateAndTime(form.stopDate, form.stopTime) ?? new Date().toISOString();

    onDiscontinuePrescription({
      ...prescription,
      stopDate: stoppedAt,
      discontinuedBy: selectedStaff.name,
      discontinuedAt: stoppedAt,
      discontinueReason: form.discontinueReason.trim() || "Discontinued by prescriber"
    });
    setForm((current) => ({
      ...current,
      stopDate: formatInputDate(new Date()),
      stopTime: formatInputTime(new Date()),
      discontinueReason: ""
    }));
  };

  const saveAllergies = () => {
    if (!selectedPatient) return;
    onUpdatePatient({
      ...selectedPatient,
      allergies: allergyText.trim(),
      adverseDrugReactions: adrText.trim()
    });
    setAllergySaveMessage("Saved on this tablet. The sync status confirms when it reaches the backend.");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Medication chart</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} | {canPrescribe ? "Prescriber access" : "Administration access"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryStrip}>
        <Text style={styles.summaryText}>{dueCount} doses due soon</Text>
        <Text style={styles.summaryMeta}>Yesterday and today remain open so late doses, refusals and omissions can be recorded.</Text>
      </View>

      <View style={styles.viewToggleRow}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setViewMode("admin")}
          style={[styles.viewToggleButton, viewMode === "admin" && styles.viewToggleButtonActive]}
        >
          <Text style={[styles.viewToggleText, viewMode === "admin" && styles.viewToggleTextActive]}>
            Admin / prescribing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setViewMode("chart")}
          style={[styles.viewToggleButton, viewMode === "chart" && styles.viewToggleButtonActive]}
        >
          <Text style={[styles.viewToggleText, viewMode === "chart" && styles.viewToggleTextActive]}>Full chart</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setViewMode("history")}
          style={[styles.viewToggleButton, viewMode === "history" && styles.viewToggleButtonActive]}
        >
          <Text style={[styles.viewToggleText, viewMode === "history" && styles.viewToggleTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={viewMode === "chart" ? styles.chartOnlySplit : styles.split}>
        <View style={[styles.patientList, viewMode === "chart" && styles.chartOnlyPatientList]}>
          <Text style={styles.panelTitle}>Patients</Text>
          {patients.map((patient) => (
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

        <View style={styles.chartPane}>
          {selectedPatient ? (
            <View style={styles.patientHeader}>
              <View>
                <Text style={styles.patientTitle}>
                  {selectedPatient.firstName} {selectedPatient.surname}
                </Text>
                <Text style={styles.meta}>Room {selectedPatient.roomNumber} | {selectedPatient.hospitalNumber}</Text>
              </View>
              <View style={styles.allergyBox}>
                <Text style={styles.allergyTitle}>Allergies / ADRs</Text>
                <TextInput
                  onChangeText={setAllergyText}
                  placeholder="Allergies"
                  style={styles.allergyInput}
                  value={allergyText}
                />
                <TextInput
                  onChangeText={setAdrText}
                  placeholder="Adverse drug reactions"
                  style={styles.allergyInput}
                  value={adrText}
                />
                <TouchableOpacity accessibilityRole="button" onPress={saveAllergies} style={styles.allergySaveButton}>
                  <Text style={styles.allergySaveText}>Save allergies / ADRs</Text>
                </TouchableOpacity>
                {allergySaveMessage ? <Text style={styles.allergySavedText}>{allergySaveMessage}</Text> : null}
              </View>
            </View>
          ) : null}

          {pendingMedicationAction ? (
            <View style={styles.confirmPanel}>
              <View>
                <Text style={styles.confirmTitle}>Confirm medication record</Text>
                <Text style={styles.confirmMeta}>
                  {pendingMedicationAction.prescription.drugName} | {pendingMedicationAction.status}
                  {pendingMedicationAction.omissionCode ? ` ${pendingMedicationAction.omissionCode}` : ""} |{" "}
                  {formatDateTime(pendingMedicationAction.scheduledAt)}
                </Text>
                {getLateMinutes(pendingMedicationAction.scheduledAt) > 0 ? (
                  <Text style={styles.confirmWarning}>
                    Late record: {formatLateMinutes(getLateMinutes(pendingMedicationAction.scheduledAt))} after due time
                  </Text>
                ) : null}
              </View>
              <View style={styles.confirmActions}>
                <TouchableOpacity accessibilityRole="button" onPress={() => setPendingMedicationAction(null)} style={styles.cancelConfirmButton}>
                  <Text style={styles.cancelConfirmText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={confirmDoseRecord} style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.chartContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.chartScroll}
          >

          {viewMode === "admin" ? (
            <>
              <View style={[styles.prescriberPanel, !canPrescribe && styles.lockedPanel]}>
                <Text style={styles.panelTitle}>Medication prescription</Text>
                <Text style={styles.meta}>
                  {canPrescribe
                    ? "Add medicine details, start date, time prescribed, route and administration times."
                    : "Prescription entry locked for non-prescribing staff."}
                </Text>
                <View style={styles.formGrid}>
                  <TextInput
                    editable={canPrescribe}
                    onChangeText={(value) => setForm({ ...form, drugName: value })}
                    placeholder="Drug approved name"
                    style={styles.input}
                    value={form.drugName}
                  />
                  <View style={styles.twoColumnRow}>
                    <TextInput
                      editable={canPrescribe}
                      onChangeText={(value) => setForm({ ...form, dose: value })}
                      placeholder="Dose"
                      style={[styles.input, styles.flexInput]}
                      value={form.dose}
                    />
                    <TextInput
                      editable={canPrescribe}
                      onChangeText={(value) => setForm({ ...form, startDate: value })}
                      placeholder="Start date dd/mm/yyyy"
                      style={[styles.input, styles.flexInput]}
                      value={form.startDate}
                    />
                    <TextInput
                      editable={canPrescribe}
                      onChangeText={(value) => setForm({ ...form, timePrescribed: value })}
                      placeholder="Time prescribed hh:mm"
                      style={[styles.input, styles.flexInput]}
                      value={form.timePrescribed}
                    />
                  </View>
                  <OptionGroup title="Route" disabled={!canPrescribe} options={routeOptions} selected={form.route} onSelect={(route) => setForm({ ...form, route })} />
                  <OptionGroup
                    title="Type"
                    disabled={!canPrescribe}
                    options={prescriptionTypeOptions.map((option) => option.id)}
                    labels={Object.fromEntries(prescriptionTypeOptions.map((option) => [option.id, option.label]))}
                    selected={form.prescriptionType ?? "regular"}
                    onSelect={(prescriptionType) =>
                      setForm({
                        ...form,
                        prescriptionType: prescriptionType as MedicationPrescription["prescriptionType"]
                      })
                    }
                  />
                  {form.prescriptionType === "prn" || form.prescriptionType === "rapid" ? (
                    <TextInput
                      editable={canPrescribe}
                      multiline
                      onChangeText={(value) => setForm({ ...form, prnIndication: value })}
                      placeholder={
                        form.prescriptionType === "rapid"
                          ? "Rapid tranquillisation indication and protocol notes"
                          : "PRN indication, e.g. anxiety, agitation, pain"
                      }
                      style={[styles.input, styles.instructionsInput]}
                      value={form.prnIndication}
                    />
                  ) : form.prescriptionType === "depot" ? (
                    <>
                      <OptionGroup
                        title="Depot interval"
                        disabled={!canPrescribe}
                        options={depotIntervalOptions.map((option) => String(option.days))}
                        labels={Object.fromEntries(depotIntervalOptions.map((option) => [String(option.days), option.label]))}
                        selected={String(form.depotIntervalDays)}
                        onSelect={(days) => setForm({ ...form, depotIntervalDays: Number(days) })}
                      />
                      <Text style={styles.meta}>Start date and time is the first due administration.</Text>
                    </>
                  ) : (
                    <MultiOptionGroup
                      title="Administration times"
                      disabled={!canPrescribe}
                      options={timeOptions}
                      selected={form.administrationTimes}
                      onToggle={(time) =>
                        setForm((current) => ({
                          ...current,
                          administrationTimes: current.administrationTimes.includes(time)
                            ? current.administrationTimes.filter((item) => item !== time)
                            : [...current.administrationTimes, time]
                        }))
                      }
                    />
                  )}
                  <TextInput
                    editable={canPrescribe}
                    multiline
                    onChangeText={(value) => setForm({ ...form, additionalInstructions: value })}
                    placeholder="Additional instructions / pharmacist advice"
                    style={[styles.input, styles.instructionsInput]}
                    value={form.additionalInstructions}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={!canPrescribe || !form.drugName.trim() || !form.dose.trim()}
                    onPress={createPrescription}
                    style={[
                      styles.primaryButton,
                      (!canPrescribe || !form.drugName.trim() || !form.dose.trim()) && styles.disabledButton
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Add prescription</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stopPanel}>
                <Text style={styles.panelTitle}>Stopped medication details</Text>
                <View style={styles.twoColumnRow}>
                  <TextInput
                    editable={canPrescribe}
                    onChangeText={(value) => setForm({ ...form, stopDate: value })}
                    placeholder="Stopped date dd/mm/yyyy"
                    style={[styles.input, styles.flexInput]}
                    value={form.stopDate}
                  />
                  <TextInput
                    editable={canPrescribe}
                    onChangeText={(value) => setForm({ ...form, stopTime: value })}
                    placeholder="Stopped time hh:mm"
                    style={[styles.input, styles.flexInput]}
                    value={form.stopTime}
                  />
                </View>
                <TextInput
                  editable={canPrescribe}
                  onChangeText={(value) => setForm({ ...form, discontinueReason: value })}
                  placeholder="Reason medicine is stopped"
                  style={styles.input}
                  value={form.discontinueReason}
                />
              </View>
            </>
          ) : null}

          {viewMode === "history" ? (
            <MedicationHistory prescriptions={patientPrescriptions} administrations={administrations} />
          ) : patientPrescriptions.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyText}>No medication prescriptions recorded for this patient.</Text>
            </View>
          ) : (
            patientPrescriptions.map((prescription) => (
              <PrescriptionCard
                administrations={administrations}
                canPrescribe={canPrescribe}
                key={prescription.id}
                prescription={prescription}
                visibleDates={visibleDates}
                viewMode={viewMode}
                editingDoseKey={editingDoseKey}
                onChangeDose={setEditingDoseKey}
                onDiscontinue={() => discontinuePrescription(prescription)}
                onRecordDose={(scheduledAt, status, omissionCode, notes) =>
                  requestDoseRecord(prescription, scheduledAt, status, omissionCode, notes)
                }
              />
            ))
          )}

          <OmissionLegend />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

type PrescriptionCardProps = {
  administrations: MedicationAdministration[];
  canPrescribe: boolean;
  editingDoseKey: string;
  prescription: MedicationPrescription;
  visibleDates: Date[];
  viewMode: MedicationChartViewMode;
  onChangeDose: (doseKey: string) => void;
  onDiscontinue: () => void;
  onRecordDose: (
    scheduledAt: string,
    status: MedicationAdministrationStatus,
    omissionCode?: MedicationOmissionCode,
    notes?: string
  ) => void;
};

function PrescriptionCard({
  administrations,
  canPrescribe,
  editingDoseKey,
  prescription,
  visibleDates,
  viewMode,
  onChangeDose,
  onDiscontinue,
  onRecordDose
}: PrescriptionCardProps) {
  const [prnReason, setPrnReason] = useState(prescription.prnIndication ?? "");
  const isPrn = (prescription.prescriptionType ?? "regular") === "prn";
  const isRapid = prescription.prescriptionType === "rapid";
  const isDepot = prescription.prescriptionType === "depot";
  const latestAdministration = administrations
    .filter((administration) => administration.prescriptionId === prescription.id)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  const depotDueAt = isDepot ? getDepotDueAt(prescription, latestAdministration) : undefined;
  const depotOverdue = depotDueAt ? new Date(depotDueAt).getTime() <= Date.now() : false;
  const prnAdministrations = administrations
    .filter((administration) => administration.prescriptionId === prescription.id)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .slice(0, 4);

  return (
    <View style={[styles.prescriptionCard, prescription.discontinuedAt && styles.discontinuedCard]}>
      <View style={styles.prescriptionHeader}>
        <View style={styles.prescriptionInfo}>
          <Text style={styles.drugName}>{prescription.drugName}</Text>
          <Text style={styles.meta}>
            {prescription.dose} | {prescription.route} | {formatPrescriptionType(prescription)}
          </Text>
          <Text style={styles.meta}>Start {formatDateTime(prescription.startDate)} | Prescribed {formatTime(prescription.prescribedAt)}</Text>
          <Text style={styles.meta}>By {prescription.prescribedBy}</Text>
        </View>
        {prescription.discontinuedAt ? (
          <View style={styles.stoppedBox}>
            <Text style={styles.stoppedBadgeText}>Stopped</Text>
            <Text style={styles.stopDateText}>{formatDateTime(prescription.discontinuedAt)}</Text>
            <Text style={styles.stopDateText}>{prescription.discontinueReason ?? "No reason recorded"}</Text>
          </View>
        ) : canPrescribe && viewMode === "admin" ? (
          <TouchableOpacity accessibilityRole="button" onPress={onDiscontinue} style={styles.stopButton}>
            <Text style={styles.stopButtonText}>Stop medicine</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {prescription.additionalInstructions ? <Text style={styles.instructionsText}>{prescription.additionalInstructions}</Text> : null}

      {isPrn || isRapid ? (
        <View style={[styles.prnPanel, isRapid && styles.rapidPanel]}>
          <Text style={styles.prnTitle}>{isRapid ? "Rapid tranquillisation" : "PRN / as required"}</Text>
          <Text style={styles.meta}>
            Indication/protocol: {prescription.prnIndication || prescription.additionalInstructions || "Not specified"}
          </Text>
          {!prescription.discontinuedAt ? (
            <>
              <TextInput
                multiline
                onChangeText={setPrnReason}
                placeholder={isRapid ? "Reason, authorisation and monitoring notes" : "Reason for giving now, e.g. anxious, pain, agitation"}
                style={[styles.input, styles.prnReasonInput]}
                value={prnReason}
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!prnReason.trim()}
                onPress={() => {
                  onRecordDose(
                    new Date().toISOString(),
                    "Given",
                    undefined,
                    `${isRapid ? "Rapid tranquillisation" : "PRN"}: ${prnReason.trim()}`
                  );
                  setPrnReason(prescription.prnIndication ?? "");
                }}
                style={[styles.primaryButton, !prnReason.trim() && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{isRapid ? "Record rapid tranquillisation" : "Give PRN now"}</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {prnAdministrations.length > 0 ? (
            <View style={styles.prnHistory}>
              <Text style={styles.groupLabel}>Recent PRN administrations</Text>
              {prnAdministrations.map((administration) => (
                <Text key={administration.id} style={styles.prnHistoryText}>
                  {formatDateTime(administration.recordedAt)} | {administration.recordedBy} |{" "}
                  {administration.notes || "No reason recorded"}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : isDepot ? (
        <View style={styles.depotPanel}>
          <Text style={styles.prnTitle}>Depot administration</Text>
          <Text style={styles.meta}>
            Interval {prescription.depotIntervalDays ?? 14} days | Next due{" "}
            {depotDueAt ? formatDateTime(depotDueAt) : "not calculated"}
          </Text>
          {latestAdministration ? (
            <Text style={styles.meta}>
              Last {latestAdministration.status.toLowerCase()} {formatDateTime(latestAdministration.recordedAt)} by{" "}
              {latestAdministration.recordedBy}
            </Text>
          ) : null}
          {!prescription.discontinuedAt ? (
            <View style={styles.depotActionRow}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!depotOverdue}
                onPress={() => onRecordDose(depotDueAt ?? new Date().toISOString(), "Given", undefined, "Depot administered")}
                style={[styles.primaryButton, styles.depotActionButton, !depotOverdue && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>Record depot given</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!depotOverdue}
                onPress={() => onRecordDose(depotDueAt ?? new Date().toISOString(), "Refused", undefined, "Depot refused")}
                style={[styles.refusedButton, !depotOverdue && styles.disabledButton]}
              >
                <Text style={styles.refusedButtonText}>Record refused</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.timeHeaderCell]}>
              <Text style={styles.gridHeaderText}>Time</Text>
            </View>
            {visibleDates.map((date) => (
              <View key={date.toISOString()} style={[styles.gridCell, styles.dateHeaderCell]}>
                <Text style={styles.gridHeaderText}>{formatDateHeader(date)}</Text>
              </View>
            ))}
          </View>
          {prescription.administrationTimes.map((time) => (
            <View key={time} style={styles.gridRow}>
              <View style={[styles.gridCell, styles.timeHeaderCell]}>
                <Text style={styles.timeText}>{time}</Text>
              </View>
              {visibleDates.map((date) => {
                const scheduledAt = buildScheduledAt(date, time);
                const record = administrations.find(
                  (administration) =>
                    administration.prescriptionId === prescription.id && administration.scheduledAt === scheduledAt
                );
                const isFutureDose = new Date(scheduledAt).getTime() > Date.now();
                const doseKey = `${prescription.id}-${scheduledAt}`;
                const isEditingDose = editingDoseKey === doseKey;

                return (
                  <View key={`${prescription.id}-${scheduledAt}`} style={styles.gridCell}>
                    {record ? (
                      <View style={styles.recordedDoseCell}>
                        <View style={[styles.statusBadge, statusStyle(record.status)]}>
                          <Text style={styles.statusText}>{statusCodeLabel(record)}</Text>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => onChangeDose(isEditingDose ? "" : doseKey)}
                          style={styles.changeDoseButton}
                        >
                          <Text style={styles.changeDoseLabel}>{isEditingDose ? "Hide" : "Change"}</Text>
                        </TouchableOpacity>
                        {isEditingDose ? (
                          <View style={styles.recordButtons}>
                            <DoseButton label="G" onPress={() => onRecordDose(scheduledAt, "Given")} />
                            <DoseButton label="Ref" onPress={() => onRecordDose(scheduledAt, "Refused", undefined, "Patient refused")} />
                            {omissionOptions.map((option) => (
                              <DoseButton
                                key={option.code}
                                label={option.code}
                                onPress={() => onRecordDose(scheduledAt, "Omitted", option.code)}
                              />
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : prescription.discontinuedAt ? (
                      <Text style={styles.blankCell}>-</Text>
                    ) : isFutureDose ? (
                      <Text style={styles.futureCell}>Future</Text>
                    ) : (
                      <View style={styles.recordButtons}>
                          <DoseButton label="G" onPress={() => onRecordDose(scheduledAt, "Given")} />
                          <DoseButton label="Ref" onPress={() => onRecordDose(scheduledAt, "Refused", undefined, "Patient refused")} />
                        {omissionOptions.map((option) => (
                          <DoseButton
                            key={option.code}
                            label={option.code}
                            onPress={() => onRecordDose(scheduledAt, "Omitted", option.code)}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        </ScrollView>
      )}
    </View>
  );
}

function MedicationHistory({
  administrations,
  prescriptions
}: {
  administrations: MedicationAdministration[];
  prescriptions: MedicationPrescription[];
}) {
  const prescriptionById = new Map(prescriptions.map((prescription) => [prescription.id, prescription]));
  const patientAdministrations = administrations
    .filter((administration) => prescriptionById.has(administration.prescriptionId))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));

  if (patientAdministrations.length === 0) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyText}>No medication administration history recorded for this patient.</Text>
      </View>
    );
  }

  return (
    <View style={styles.historyPanel}>
      <Text style={styles.panelTitle}>Medication history</Text>
      {patientAdministrations.map((administration) => {
        const prescription = prescriptionById.get(administration.prescriptionId);
        return (
          <View key={administration.id} style={styles.historyRow}>
            <View style={[styles.historyStatusDot, statusStyle(administration.status)]}>
              <Text style={styles.statusText}>
                {administration.status === "Omitted" ? administration.omissionCode ?? "O" : administration.status === "Refused" ? "Ref" : "G"}
              </Text>
            </View>
            <View style={styles.historyTextBlock}>
              <Text style={styles.historyTitle}>
                {prescription?.drugName ?? "Unknown medicine"} | {administration.status}
              </Text>
              <Text style={styles.historyMeta}>
                {formatDateTime(administration.recordedAt)} | {administration.recordedBy}
              </Text>
              <Text style={styles.historyMeta}>
                {formatPrescriptionType(prescription)} {administration.notes ? `| ${administration.notes}` : ""}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function OptionGroup({
  disabled,
  options,
  labels,
  selected,
  title,
  onSelect
}: {
  disabled: boolean;
  options: string[];
  labels?: Record<string, string>;
  selected: string;
  title: string;
  onSelect: (option: string) => void;
}) {
  return (
    <View>
      <Text style={styles.groupLabel}>{title}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={disabled}
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.optionButton, selected === option && styles.optionButtonActive, disabled && styles.disabledButton]}
          >
            <Text style={[styles.optionText, selected === option && styles.optionTextActive]}>
              {labels?.[option] ?? option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MultiOptionGroup({
  disabled,
  options,
  selected,
  title,
  onToggle
}: {
  disabled: boolean;
  options: string[];
  selected: string[];
  title: string;
  onToggle: (option: string) => void;
}) {
  return (
    <View>
      <Text style={styles.groupLabel}>{title}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={disabled}
              key={option}
              onPress={() => onToggle(option)}
              style={[styles.optionButton, active && styles.optionButtonActive, disabled && styles.disabledButton]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DoseButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.doseButton}>
      <Text style={styles.doseButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function OmissionLegend() {
  return (
    <View style={styles.omissionLegend}>
      <Text style={styles.omissionTitle}>Administration and omission codes</Text>
      <Text style={styles.omissionText}>
        {["G = Given", "Ref = Refused", ...omissionOptions.map((option) => `${option.code} = ${option.label}`)].join("   ")}
      </Text>
    </View>
  );
}

function buildVisibleDates() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);

  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function isToday(value: Date) {
  const today = new Date();
  return (
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth() &&
    value.getDate() === today.getDate()
  );
}

function buildScheduledAt(date: Date, time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  const scheduled = new Date(date);
  scheduled.setHours(Number(hours), Number(minutes), 0, 0);
  return scheduled.toISOString();
}

function createAdministrationId(prescription: MedicationPrescription, scheduledAt: string) {
  const suffix = scheduledAt.replace(/[^0-9a-z]/gi, "");
  return `med-admin-${prescription.id}-${suffix}`;
}

function buildIsoFromDateAndTime(dateText: string, timeText: string) {
  const dateParts = dateText.split(/[\/\-]/).map((part) => Number(part));
  const [hours = 0, minutes = 0] = timeText.split(":").map((part) => Number(part));
  const [day, month, year] = dateParts;

  if (!day || !month || !year || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return undefined;
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isDoseDueSoon(
  prescription: MedicationPrescription,
  administrations: MedicationAdministration[],
  date: Date,
  time: string
) {
  const scheduledAt = buildScheduledAt(date, time);
  const scheduledTime = new Date(scheduledAt).getTime();
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  const hasRecord = administrations.some(
    (administration) =>
      administration.prescriptionId === prescription.id && administration.scheduledAt === scheduledAt
  );

  return !hasRecord && scheduledTime >= now - twoHours && scheduledTime <= now + twoHours;
}

function statusStyle(status: MedicationAdministrationStatus) {
  if (status === "Given") return styles.givenBadge;
  if (status === "Omitted") return styles.omittedBadge;
  return styles.refusedBadge;
}

function statusCodeLabel(administration: MedicationAdministration) {
  if (administration.status === "Given") return "G";
  if (administration.status === "Refused") return "Ref";
  return administration.omissionCode ?? "O";
}

function omissionLabel(code: MedicationOmissionCode) {
  return omissionOptions.find((option) => option.code === code)?.label ?? "Omitted";
}

function buildAdministrationNote(scheduledAt: string, note: string) {
  const lateMinutes = getLateMinutes(scheduledAt);
  const parts = [note.trim()].filter(Boolean);

  if (lateMinutes > 0) {
    parts.push(`Recorded ${formatLateMinutes(lateMinutes)} after due time`);
  }

  return parts.join(" | ");
}

function getLateMinutes(scheduledAt: string) {
  const scheduledTime = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduledTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - scheduledTime) / 60000));
}

function formatLateMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hour${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

function formatPrescriptionType(prescription?: MedicationPrescription) {
  if (!prescription) return "";
  if (prescription.prescriptionType === "prn") return "PRN";
  if (prescription.prescriptionType === "depot") return "Depot";
  if (prescription.prescriptionType === "rapid") return "Rapid tranquillisation";
  return "Regular";
}

function getDepotDueAt(prescription: MedicationPrescription, latestAdministration?: MedicationAdministration) {
  const baseDate = latestAdministration?.recordedAt ?? prescription.startDate;
  const baseTime = new Date(baseDate).getTime();
  if (Number.isNaN(baseTime)) return undefined;
  if (!latestAdministration) return prescription.startDate;
  const intervalDays = prescription.depotIntervalDays ?? 14;
  return new Date(baseTime + intervalDays * 24 * 60 * 60 * 1000).toISOString();
}

function formatDateHeader(date: Date) {
  if (isToday(date)) {
    return "Today";
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return `${date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })} ${formatTime(value)}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatInputDate(value: Date) {
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
}

function formatInputTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
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
  meta: { color: "#607078", fontSize: 13, fontWeight: "800", marginTop: 3 },
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
  summaryStrip: {
    alignItems: "center",
    backgroundColor: "#fff8e6",
    borderColor: "#e8c766",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12
  },
  summaryText: { color: "#785800", fontSize: 16, fontWeight: "900" },
  summaryMeta: { color: "#785800", flex: 1, fontSize: 12, fontWeight: "800", textAlign: "right" },
  viewToggleRow: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    padding: 8
  },
  viewToggleButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42
  },
  viewToggleButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  viewToggleText: { color: "#30434a", fontSize: 13, fontWeight: "900" },
  viewToggleTextActive: { color: "#ffffff" },
  split: { alignItems: "stretch", flexDirection: "row", gap: 12, height: 680 },
  chartOnlySplit: { alignItems: "stretch", flexDirection: "row", gap: 12, height: 680 },
  patientList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.28,
    minWidth: 280,
    padding: 12
  },
  chartOnlyPatientList: { flex: 0.2, minWidth: 220 },
  panelTitle: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  patientRow: {
    borderColor: "#e1e7e9",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  patientRowActive: { backgroundColor: "#eaf4f1", borderColor: "#1f5262" },
  patientName: { color: "#18262c", fontSize: 15, fontWeight: "900" },
  patientMeta: { color: "#607078", fontSize: 13, fontWeight: "800", marginTop: 4 },
  chartPane: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden"
  },
  chartScroll: { flex: 1 },
  chartContent: { gap: 12, padding: 12, paddingBottom: 80 },
  patientHeader: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  patientTitle: { color: "#18262c", fontSize: 22, fontWeight: "900" },
  allergyBox: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    width: 250
  },
  allergyTitle: { color: "#31454d", fontSize: 12, fontWeight: "900" },
  allergyText: { color: "#607078", fontSize: 12, fontWeight: "800", marginTop: 4 },
  allergyInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
    minHeight: 34,
    paddingHorizontal: 8
  },
  allergySaveButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 6,
    minHeight: 32
  },
  allergySaveText: { color: "#1f5262", fontSize: 11, fontWeight: "900" },
  allergySavedText: { color: "#315748", fontSize: 11, fontWeight: "900", marginTop: 5 },
  confirmPanel: {
    alignItems: "center",
    backgroundColor: "#fff8e8",
    borderBottomColor: "#e4b75f",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 10
  },
  confirmTitle: { color: "#62430f", fontSize: 14, fontWeight: "900" },
  confirmMeta: { color: "#7b5a1a", fontSize: 12, fontWeight: "800", marginTop: 3 },
  confirmWarning: { color: "#8a3f00", fontSize: 12, fontWeight: "900", marginTop: 4 },
  confirmActions: { flexDirection: "row", gap: 8 },
  cancelConfirmButton: {
    alignItems: "center",
    borderColor: "#9a5c00",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12
  },
  cancelConfirmText: { color: "#9a5c00", fontSize: 12, fontWeight: "900" },
  confirmButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12
  },
  confirmButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  prescriberPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  lockedPanel: { opacity: 0.78 },
  formGrid: { gap: 8, marginTop: 10 },
  twoColumnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flexInput: { flex: 1, minWidth: 180 },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    fontWeight: "800",
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  instructionsInput: { minHeight: 70, textAlignVertical: "top" },
  groupLabel: { color: "#31454d", fontSize: 12, fontWeight: "900", marginBottom: 6 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#30434a", fontSize: 13, fontWeight: "900" },
  optionTextActive: { color: "#ffffff" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 46
  },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  stopPanel: {
    backgroundColor: "#fff8f8",
    borderColor: "#ebc4c4",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  emptyPanel: {
    alignItems: "center",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18
  },
  emptyText: { color: "#607078", fontSize: 14, fontWeight: "800" },
  prescriptionCard: {
    borderColor: "#1f5262",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  discontinuedCard: { borderColor: "#b8c0c4", opacity: 0.78 },
  prescriptionHeader: {
    alignItems: "center",
    backgroundColor: "#eef6f4",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10
  },
  prescriptionInfo: { flex: 1, paddingRight: 8 },
  drugName: { color: "#18262c", fontSize: 18, fontWeight: "900" },
  instructionsText: { color: "#31454d", fontSize: 13, fontWeight: "800", padding: 10 },
  prnPanel: {
    backgroundColor: "#f8fafb",
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 10
  },
  prnTitle: { color: "#1f5262", fontSize: 14, fontWeight: "900" },
  prnReasonInput: { minHeight: 68, textAlignVertical: "top" },
  prnHistory: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    padding: 8
  },
  prnHistoryText: { color: "#52656e", fontSize: 12, fontWeight: "800" },
  rapidPanel: {
    backgroundColor: "#fff4ee",
    borderTopColor: "#d8905c"
  },
  depotPanel: {
    backgroundColor: "#eef6f4",
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 10
  },
  depotActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  depotActionButton: { minWidth: 170, paddingHorizontal: 12 },
  refusedButton: {
    alignItems: "center",
    borderColor: "#a33b3b",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 150,
    paddingHorizontal: 12
  },
  refusedButtonText: { color: "#a33b3b", fontSize: 14, fontWeight: "900" },
  historyPanel: {
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12
  },
  historyRow: {
    alignItems: "center",
    borderColor: "#e1e7e9",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  historyStatusDot: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  historyTextBlock: { flex: 1 },
  historyTitle: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  historyMeta: { color: "#52656e", fontSize: 12, fontWeight: "800", marginTop: 3 },
  stopButton: {
    alignItems: "center",
    borderColor: "#a33b3b",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  stopButtonText: { color: "#a33b3b", fontSize: 13, fontWeight: "900" },
  stoppedBox: { backgroundColor: "#f6dede", borderRadius: 6, maxWidth: 260, padding: 8 },
  stoppedBadgeText: { color: "#8f2e2e", fontSize: 13, fontWeight: "900" },
  stopDateText: { color: "#8f2e2e", fontSize: 11, fontWeight: "800", marginTop: 3 },
  gridRow: { flexDirection: "row" },
  gridCell: {
    alignItems: "center",
    borderColor: "#44545a",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 62,
    width: 128
  },
  timeHeaderCell: { backgroundColor: "#1f5262", width: 76 },
  dateHeaderCell: { backgroundColor: "#1f5262" },
  gridHeaderText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  timeText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  blankCell: { color: "#607078", fontSize: 14, fontWeight: "900" },
  futureCell: { color: "#607078", fontSize: 12, fontWeight: "900" },
  recordButtons: { flexDirection: "row", flexWrap: "wrap", gap: 3, justifyContent: "center", paddingHorizontal: 3 },
  recordedDoseCell: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 3
  },
  changeDoseButton: {
    borderColor: "#c7d2d6",
    borderRadius: 5,
    borderWidth: 1,
    minHeight: 22,
    paddingHorizontal: 6,
    justifyContent: "center"
  },
  changeDoseLabel: {
    color: "#607078",
    fontSize: 9,
    fontWeight: "900"
  },
  doseButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 5,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  doseButtonText: { color: "#1f5262", fontSize: 10, fontWeight: "900" },
  statusBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  statusText: { color: "#18262c", fontSize: 13, fontWeight: "900" },
  givenBadge: { backgroundColor: "#dff0e6" },
  omittedBadge: { backgroundColor: "#fff0c7" },
  refusedBadge: { backgroundColor: "#f6dede" },
  omissionLegend: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  },
  omissionTitle: { color: "#18262c", fontSize: 13, fontWeight: "900" },
  omissionText: { color: "#31454d", fontSize: 12, fontWeight: "800", marginTop: 4 }
});
