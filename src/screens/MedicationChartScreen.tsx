import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  MedicationAdministration,
  MedicationAdministrationStatus,
  MedicationPrescription,
  Patient,
  StaffMember
} from "../types/domain";

const routeOptions = ["Oral", "IM", "Depot", "S/L", "Topical"];
const timeOptions = ["08:00", "12:00", "14:00", "18:00", "20:00", "22:00"];

type MedicationChartScreenProps = {
  administrations: MedicationAdministration[];
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

export function MedicationChartScreen({
  administrations,
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
  const [form, setForm] = useState({
    drugName: "",
    dose: "",
    route: "Oral",
    administrationTimes: ["08:00"],
    additionalInstructions: "",
    discontinueReason: ""
  });

  const createPrescription = () => {
    if (!selectedPatient || !selectedStaff || !canPrescribe || !form.drugName.trim() || !form.dose.trim()) {
      return;
    }

    onCreatePrescription({
      id: `med-prescription-${Date.now()}`,
      patientId: selectedPatient.id,
      drugName: form.drugName.trim(),
      dose: form.dose.trim(),
      route: form.route,
      administrationTimes: [...form.administrationTimes].sort(),
      startDate: new Date().toISOString(),
      additionalInstructions: form.additionalInstructions.trim(),
      prescribedBy: selectedStaff.name,
      prescribedAt: new Date().toISOString()
    });

    setForm({
      drugName: "",
      dose: "",
      route: "Oral",
      administrationTimes: ["08:00"],
      additionalInstructions: "",
      discontinueReason: ""
    });
  };

  const recordDose = (
    prescription: MedicationPrescription,
    scheduledAt: string,
    status: MedicationAdministrationStatus
  ) => {
    if (!selectedPatient || !selectedStaff || prescription.discontinuedAt) {
      return;
    }

    onCreateAdministration({
      id: `med-admin-${Date.now()}-${status}`,
      prescriptionId: prescription.id,
      patientId: selectedPatient.id,
      scheduledAt,
      status,
      recordedBy: selectedStaff.name,
      recordedAt: new Date().toISOString(),
      notes: ""
    });
  };

  const discontinuePrescription = (prescription: MedicationPrescription) => {
    if (!selectedStaff || !canPrescribe) {
      return;
    }

    onDiscontinuePrescription({
      ...prescription,
      discontinuedBy: selectedStaff.name,
      discontinuedAt: new Date().toISOString(),
      discontinueReason: form.discontinueReason.trim() || "Discontinued by prescriber"
    });
    setForm((current) => ({ ...current, discontinueReason: "" }));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Medication chart</Text>
          <Text style={styles.meta}>
            {selectedStaff?.name ?? "No staff selected"} |{" "}
            {canPrescribe ? "Prescriber access" : "Administration access"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryStrip}>
        <Text style={styles.summaryText}>{dueCount} doses due soon</Text>
        <Text style={styles.summaryMeta}>
          Prescriptions can only be added or discontinued by a staff NFC login with prescribing access.
        </Text>
      </View>

      <View style={styles.split}>
        <View style={styles.patientList}>
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
                <Text style={styles.meta}>
                  Room {selectedPatient.roomNumber} | {selectedPatient.hospitalNumber}
                </Text>
              </View>
              <View style={styles.allergyBox}>
                <Text style={styles.allergyTitle}>Allergies / ADRs</Text>
                <Text style={styles.allergyText}>Not recorded in prototype</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.prescriberPanel, !canPrescribe && styles.lockedPanel]}>
            <Text style={styles.panelTitle}>Regular dose prescription</Text>
            <Text style={styles.meta}>
              {canPrescribe
                ? "Add a medicine, route, dose, times, and instructions."
                : "Prescription entry locked for non-prescribing staff."}
            </Text>
            <View style={styles.formGrid}>
              <TextInput
                editable={canPrescribe}
                onChangeText={(value) => setForm({ ...form, drugName: value })}
                placeholder="Drug"
                style={styles.input}
                value={form.drugName}
              />
              <TextInput
                editable={canPrescribe}
                onChangeText={(value) => setForm({ ...form, dose: value })}
                placeholder="Dose"
                style={styles.input}
                value={form.dose}
              />
              <OptionRow
                disabled={!canPrescribe}
                options={routeOptions}
                selected={form.route}
                onSelect={(route) => setForm({ ...form, route })}
              />
              <MultiOptionRow
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
                placeholder="Additional instructions"
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

          <View style={styles.discontinueRow}>
            <TextInput
              editable={canPrescribe}
              onChangeText={(value) => setForm({ ...form, discontinueReason: value })}
              placeholder="Reason if medicine is discontinued"
              style={styles.input}
              value={form.discontinueReason}
            />
          </View>

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
                onDiscontinue={() => discontinuePrescription(prescription)}
                onRecordDose={(scheduledAt, status) => recordDose(prescription, scheduledAt, status)}
              />
            ))
          )}
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
  onDiscontinue: () => void;
  onRecordDose: (scheduledAt: string, status: MedicationAdministrationStatus) => void;
};

function PrescriptionCard({
  administrations,
  canPrescribe,
  prescription,
  visibleDates,
  onDiscontinue,
  onRecordDose
}: PrescriptionCardProps) {
  return (
    <View style={[styles.prescriptionCard, prescription.discontinuedAt && styles.discontinuedCard]}>
      <View style={styles.prescriptionHeader}>
        <View>
          <Text style={styles.drugName}>{prescription.drugName}</Text>
          <Text style={styles.meta}>
            {prescription.dose} | {prescription.route} | {prescription.administrationTimes.join(", ")}
          </Text>
          <Text style={styles.meta}>Prescribed by {prescription.prescribedBy}</Text>
        </View>
        {prescription.discontinuedAt ? (
          <View style={styles.stoppedBadge}>
            <Text style={styles.stoppedBadgeText}>Stopped</Text>
          </View>
        ) : canPrescribe ? (
          <TouchableOpacity accessibilityRole="button" onPress={onDiscontinue} style={styles.stopButton}>
            <Text style={styles.stopButtonText}>Discontinue</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {prescription.additionalInstructions ? (
        <Text style={styles.instructionsText}>{prescription.additionalInstructions}</Text>
      ) : null}
      {prescription.discontinueReason ? (
        <Text style={styles.stopReason}>Stopped: {prescription.discontinueReason}</Text>
      ) : null}

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
                    administration.prescriptionId === prescription.id &&
                    administration.scheduledAt === scheduledAt
                );

                return (
                  <View key={`${prescription.id}-${scheduledAt}`} style={styles.gridCell}>
                    {record ? (
                      <View style={[styles.statusBadge, statusStyle(record.status)]}>
                        <Text style={styles.statusText}>{record.status[0]}</Text>
                      </View>
                    ) : prescription.discontinuedAt ? (
                      <Text style={styles.blankCell}>-</Text>
                    ) : (
                      <View style={styles.recordButtons}>
                        <DoseButton label="G" onPress={() => onRecordDose(scheduledAt, "Given")} />
                        <DoseButton label="O" onPress={() => onRecordDose(scheduledAt, "Omitted")} />
                        <DoseButton label="R" onPress={() => onRecordDose(scheduledAt, "Refused")} />
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

function OptionRow({
  disabled,
  options,
  selected,
  onSelect
}: {
  disabled: boolean;
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}) {
  return (
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
  );
}

function MultiOptionRow({
  disabled,
  options,
  selected,
  onToggle
}: {
  disabled: boolean;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
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
  );
}

function DoseButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.doseButton}>
      <Text style={styles.doseButtonText}>{label}</Text>
    </TouchableOpacity>
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

function formatDateHeader(date: Date) {
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
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
  split: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  patientList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.28,
    minWidth: 280,
    padding: 12
  },
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
  discontinueRow: { marginTop: 2 },
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
  drugName: { color: "#18262c", fontSize: 18, fontWeight: "900" },
  instructionsText: { color: "#31454d", fontSize: 13, fontWeight: "800", padding: 10 },
  stopReason: { color: "#8f2e2e", fontSize: 13, fontWeight: "900", paddingHorizontal: 10, paddingBottom: 10 },
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
  stoppedBadge: { backgroundColor: "#f6dede", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  stoppedBadgeText: { color: "#8f2e2e", fontSize: 13, fontWeight: "900" },
  gridRow: { flexDirection: "row" },
  gridCell: {
    alignItems: "center",
    borderColor: "#44545a",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 54,
    width: 116
  },
  timeHeaderCell: { backgroundColor: "#1f5262", width: 76 },
  dateHeaderCell: { backgroundColor: "#1f5262" },
  gridHeaderText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  timeText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  blankCell: { color: "#607078", fontSize: 14, fontWeight: "900" },
  recordButtons: { flexDirection: "row", gap: 4 },
  doseButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 5,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  doseButtonText: { color: "#1f5262", fontSize: 11, fontWeight: "900" },
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
  refusedBadge: { backgroundColor: "#f6dede" }
});
