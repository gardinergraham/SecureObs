import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  MedicationAdministration,
  MedicationAdministrationStatus,
  MedicationOmissionCode,
  MedicationPrescription,
  Patient,
  StaffMember
} from "../types/domain";

const routeOptions = ["Oral", "IM", "Depot", "S/L", "Topical"];
const timeOptions = ["06:00", "08:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
const omissionOptions: Array<{ code: MedicationOmissionCode; label: string }> = [
  { code: "R", label: "Patient refused" },
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
};

type MedicationChartViewMode = "admin" | "chart";

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
  onSelectPatient
}: MedicationChartScreenProps) {
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canPrescribe = Boolean(selectedStaff?.canPrescribe || selectedStaff?.role === "doctor");
  const visibleDates = useMemo(() => buildVisibleDates(), []);
  const today = visibleDates[0] ?? new Date();
  const patientPrescriptions = prescriptions.filter((prescription) => prescription.patientId === selectedPatient?.id);
  const activePrescriptions = patientPrescriptions.filter((prescription) => !prescription.discontinuedAt);
  const dueCount = activePrescriptions.reduce(
    (total, prescription) =>
      total +
      prescription.administrationTimes.filter((time) =>
        isDoseDueSoon(prescription, administrations, today, time)
      ).length,
    0
  );
  const [viewMode, setViewMode] = useState<MedicationChartViewMode>(initialViewMode);
  const [form, setForm] = useState(() => ({
    drugName: "",
    dose: "",
    route: "Oral",
    administrationTimes: ["08:00"],
    startDate: formatInputDate(new Date()),
    timePrescribed: formatInputTime(new Date()),
    additionalInstructions: "",
    stopDate: formatInputDate(new Date()),
    stopTime: formatInputTime(new Date()),
    discontinueReason: ""
  }));

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
      administrationTimes: [...form.administrationTimes].sort(),
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
    omissionCode?: MedicationOmissionCode
  ) => {
    if (!selectedPatient || !selectedStaff || prescription.discontinuedAt) {
      return;
    }

    if (new Date(scheduledAt).getTime() > Date.now()) {
      return;
    }

    onCreateAdministration({
      id: `med-admin-${Date.now()}-${status}-${omissionCode ?? ""}`,
      prescriptionId: prescription.id,
      patientId: selectedPatient.id,
      scheduledAt,
      status,
      omissionCode,
      recordedBy: selectedStaff.name,
      recordedAt: new Date().toISOString(),
      notes: omissionCode ? omissionLabel(omissionCode) : ""
    });
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
        <Text style={styles.summaryMeta}>Future doses are locked until their scheduled time.</Text>
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

        <ScrollView contentContainerStyle={styles.chartContent} style={styles.chartPane}>
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
                <Text style={styles.allergyText}>Not recorded in prototype</Text>
              </View>
            </View>
          ) : null}

          {viewMode === "admin" ? (
            <>
              <View style={[styles.prescriberPanel, !canPrescribe && styles.lockedPanel]}>
                <Text style={styles.panelTitle}>Regular dose prescription</Text>
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

          {patientPrescriptions.length === 0 ? (
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
                onDiscontinue={() => discontinuePrescription(prescription)}
                onRecordDose={(scheduledAt, status, omissionCode) => recordDose(prescription, scheduledAt, status, omissionCode)}
              />
            ))
          )}

          <OmissionLegend />
        </ScrollView>
      </View>
    </View>
  );
}

type PrescriptionCardProps = {
  administrations: MedicationAdministration[];
  canPrescribe: boolean;
  prescription: MedicationPrescription;
  visibleDates: Date[];
  viewMode: "admin" | "chart";
  onDiscontinue: () => void;
  onRecordDose: (
    scheduledAt: string,
    status: MedicationAdministrationStatus,
    omissionCode?: MedicationOmissionCode
  ) => void;
};

function PrescriptionCard({
  administrations,
  canPrescribe,
  prescription,
  visibleDates,
  viewMode,
  onDiscontinue,
  onRecordDose
}: PrescriptionCardProps) {
  return (
    <View style={[styles.prescriptionCard, prescription.discontinuedAt && styles.discontinuedCard]}>
      <View style={styles.prescriptionHeader}>
        <View style={styles.prescriptionInfo}>
          <Text style={styles.drugName}>{prescription.drugName}</Text>
          <Text style={styles.meta}>{prescription.dose} | {prescription.route}</Text>
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

                return (
                  <View key={`${prescription.id}-${scheduledAt}`} style={styles.gridCell}>
                    {record ? (
                      <View style={[styles.statusBadge, statusStyle(record.status)]}>
                        <Text style={styles.statusText}>{record.status === "Omitted" ? record.omissionCode ?? "O" : "G"}</Text>
                      </View>
                    ) : prescription.discontinuedAt ? (
                      <Text style={styles.blankCell}>-</Text>
                    ) : isFutureDose ? (
                      <Text style={styles.futureCell}>Due</Text>
                    ) : (
                      <View style={styles.recordButtons}>
                        <DoseButton label="G" onPress={() => onRecordDose(scheduledAt, "Given")} />
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
    </View>
  );
}

function OptionGroup({
  disabled,
  options,
  selected,
  title,
  onSelect
}: {
  disabled: boolean;
  options: string[];
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
            <Text style={[styles.optionText, selected === option && styles.optionTextActive]}>{option}</Text>
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
      <Text style={styles.omissionTitle}>Omission codes</Text>
      <Text style={styles.omissionText}>{omissionOptions.map((option) => `${option.code} = ${option.label}`).join("   ")}</Text>
    </View>
  );
}

function buildVisibleDates() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function buildScheduledAt(date: Date, time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  const scheduled = new Date(date);
  scheduled.setHours(Number(hours), Number(minutes), 0, 0);
  return scheduled.toISOString();
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

function omissionLabel(code: MedicationOmissionCode) {
  return omissionOptions.find((option) => option.code === code)?.label ?? "Omitted";
}

function formatDateHeader(date: Date) {
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
  split: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  chartOnlySplit: { alignItems: "stretch", flexDirection: "row", gap: 12 },
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
    flex: 1
  },
  chartContent: { gap: 12, padding: 12, paddingBottom: 80 },
  patientHeader: {
    alignItems: "center",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12
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
