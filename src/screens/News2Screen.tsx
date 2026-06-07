import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { News2Consciousness, News2Reading, Patient, Spo2Scale, StaffMember } from "../types/domain";

const respiratoryBands = ["≥25", "21-24", "18-20", "15-17", "12-14", "9-11", "≤8"];
const spo2Scale1Bands = ["≥96", "94-95", "92-93", "≤91"];
const spo2Scale2Bands = ["≥97 on O₂", "95-96 on O₂", "93-94 on O₂", "≥93 air", "88-92", "86-87", "84-85", "≤83"];
const oxygenBands = ["Air", "Oxygen"];
const bpBands = ["≥220", "201-219", "181-200", "161-180", "141-160", "121-140", "111-120", "101-110", "91-100", "81-90", "71-80", "61-70", "51-60", "≤50"];
const pulseBands = ["≥131", "121-130", "111-120", "101-110", "91-100", "81-90", "71-80", "61-70", "51-60", "41-50", "31-40", "≤30"];
const consciousnessBands = ["Alert", "New confusion", "Voice", "Pain", "Unresponsive"];
const temperatureBands = ["≥39.1", "38.1-39.0", "37.1-38.0", "36.1-37.0", "35.1-36.0", "≤35.0"];

type News2ScreenProps = {
  patients: Patient[];
  readings: News2Reading[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  onBack: () => void;
  onCreateReading: (reading: News2Reading) => void;
  onSelectPatient: (patientId: string) => void;
};

export function News2Screen({
  patients,
  readings,
  selectedPatientId,
  selectedStaffId,
  staff,
  onBack,
  onCreateReading,
  onSelectPatient
}: News2ScreenProps) {
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const patientReadings = useMemo(
    () => readings.filter((reading) => reading.patientId === selectedPatient?.id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    [readings, selectedPatient?.id]
  );
  const [windowStart, setWindowStart] = useState(Math.max(0, patientReadings.length - 12));
  const visibleReadings = patientReadings.slice(windowStart, windowStart + 12);
  const [form, setForm] = useState({
    respirationRate: "18",
    spo2: "96",
    spo2Scale: "Scale 1" as Spo2Scale,
    onOxygen: false,
    systolicBp: "128",
    pulse: "82",
    consciousness: "Alert" as News2Consciousness,
    temperature: "36.8"
  });

  const saveReading = () => {
    if (!selectedPatient) {
      return;
    }

    const reading = buildReading(selectedPatient.id, selectedStaff?.name ?? "Unknown", form);
    onCreateReading(reading);
    setWindowStart(Math.max(0, patientReadings.length + 1 - 12));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>NEWS2 Chart</Text>
          <Text style={styles.meta}>{selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.surname}` : "No patient selected"}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.patientList}>
          <Text style={styles.panelTitle}>Patients</Text>
          {patients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => {
                onSelectPatient(patient.id);
                setWindowStart(0);
              }}
              style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
            >
              <Text style={styles.patientName}>Room {patient.roomNumber} | {patient.firstName} {patient.surname}</Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainPane}>
          <View style={styles.formPanel}>
            <NumberField label="Respirations" value={form.respirationRate} onChange={(value) => setForm({ ...form, respirationRate: value })} />
            <NumberField label="SpO₂" value={form.spo2} onChange={(value) => setForm({ ...form, spo2: value })} />
            <ToggleRow
              label="SpO₂ scale"
              options={["Scale 1", "Scale 2"]}
              selected={form.spo2Scale}
              onSelect={(value) => setForm({ ...form, spo2Scale: value as Spo2Scale })}
            />
            <ToggleRow
              label="Air or oxygen"
              options={["Air", "Oxygen"]}
              selected={form.onOxygen ? "Oxygen" : "Air"}
              onSelect={(value) => setForm({ ...form, onOxygen: value === "Oxygen" })}
            />
            <NumberField label="Systolic BP" value={form.systolicBp} onChange={(value) => setForm({ ...form, systolicBp: value })} />
            <NumberField label="Pulse" value={form.pulse} onChange={(value) => setForm({ ...form, pulse: value })} />
            <ToggleRow
              label="Consciousness"
              options={consciousnessBands}
              selected={form.consciousness}
              onSelect={(value) => setForm({ ...form, consciousness: value as News2Consciousness })}
            />
            <NumberField label="Temperature" value={form.temperature} onChange={(value) => setForm({ ...form, temperature: value })} />
            <TouchableOpacity accessibilityRole="button" onPress={saveReading} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save NEWS2 reading</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chartPanel}>
            <View style={styles.chartNav}>
              <TouchableOpacity accessibilityRole="button" onPress={() => setWindowStart(Math.max(0, windowStart - 12))} style={styles.navButton}>
                <Text style={styles.navButtonText}>Previous 12</Text>
              </TouchableOpacity>
              <Text style={styles.windowText}>Showing {visibleReadings.length} of {patientReadings.length}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setWindowStart(Math.min(Math.max(0, patientReadings.length - 12), windowStart + 12))}
                style={styles.navButton}
              >
                <Text style={styles.navButtonText}>Next 12</Text>
              </TouchableOpacity>
            </View>
            <News2Chart readings={visibleReadings} />
          </View>
        </View>
      </View>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function NumberField({ label, value, onChange }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput keyboardType="numeric" onChangeText={onChange} style={styles.input} value={value} />
    </View>
  );
}

type ToggleRowProps = {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
};

function ToggleRow({ label, options, selected, onSelect }: ToggleRowProps) {
  return (
    <View style={styles.fieldWide}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.optionButton, selected === option && styles.optionButtonActive]}
          >
            <Text style={[styles.optionText, selected === option && styles.optionTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function News2Chart({ readings }: { readings: News2Reading[] }) {
  return (
    <View style={styles.chart}>
      <View style={styles.dateRow}>
        <View style={styles.sectionLabelSmall}><Text style={styles.sectionText}>DATE / TIME</Text></View>
        {readings.map((reading) => (
          <View key={reading.id} style={styles.dateCell}>
            <Text style={styles.dateText}>{formatDate(reading.recordedAt)}</Text>
            <Text style={styles.dateText}>{formatTime(reading.recordedAt)}</Text>
          </View>
        ))}
      </View>
      <ChartSection title="A+B Respirations" bands={respiratoryBands} readings={readings} getBand={(reading) => respirationBand(reading.respirationRate)} getValue={(reading) => String(reading.respirationRate)} />
      <ChartSection
        title="SpO₂ Scale 1"
        bands={spo2Scale1Bands}
        readings={readings}
        getBand={(reading) => (reading.spo2Scale === "Scale 1" ? spo2Scale1Band(reading.spo2) : "")}
        getValue={(reading) => String(reading.spo2)}
      />
      <ChartSection
        title="SpO₂ Scale 2"
        bands={spo2Scale2Bands}
        readings={readings}
        getBand={(reading) =>
          reading.spo2Scale === "Scale 2" ? spo2Scale2Band(reading.spo2, reading.onOxygen) : ""
        }
        getValue={(reading) => String(reading.spo2)}
      />
      <ChartSection title="Air or oxygen?" bands={oxygenBands} readings={readings} getBand={(reading) => (reading.onOxygen ? "Oxygen" : "Air")} getValue={(reading) => (reading.onOxygen ? "O₂" : "A")} />
      <ChartSection title="C Blood pressure" bands={bpBands} readings={readings} getBand={(reading) => bpBand(reading.systolicBp)} getValue={(reading) => String(reading.systolicBp)} />
      <ChartSection title="C Pulse" bands={pulseBands} readings={readings} getBand={(reading) => pulseBand(reading.pulse)} getValue={(reading) => String(reading.pulse)} />
      <ChartSection title="D Consciousness" bands={consciousnessBands} readings={readings} getBand={(reading) => reading.consciousness} getValue={(reading) => consciousnessLabel(reading.consciousness)} />
      <ChartSection title="E Temperature" bands={temperatureBands} readings={readings} getBand={(reading) => temperatureBand(reading.temperature)} getValue={(reading) => reading.temperature.toFixed(1)} />
      <ScoreRow readings={readings} />
    </View>
  );
}

type ChartSectionProps = {
  title: string;
  bands: string[];
  readings: News2Reading[];
  getBand: (reading: News2Reading) => string;
  getValue: (reading: News2Reading) => string;
};

function ChartSection({ title, bands, readings, getBand, getValue }: ChartSectionProps) {
  return (
    <View style={styles.chartSection}>
      <View style={styles.sectionLabel}><Text style={styles.sectionText}>{title}</Text></View>
      <View>
        {bands.map((band, bandIndex) => (
          <View key={band} style={styles.bandRow}>
            <View style={[styles.bandLabel, bandColourStyle(bandIndex, bands.length)]}><Text style={styles.bandText}>{band}</Text></View>
            {readings.map((reading) => (
              <View key={`${reading.id}-${band}`} style={[styles.readingCell, bandColourStyle(bandIndex, bands.length)]}>
                {getBand(reading) === band ? <Text style={styles.pointText}>{getValue(reading)}</Text> : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function ScoreRow({ readings }: { readings: News2Reading[] }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreLabel}><Text style={styles.scoreLabelText}>NEWS TOTAL</Text></View>
      {readings.map((reading) => (
        <View key={reading.id} style={[styles.scoreCell, scoreColourStyle(reading.totalScore)]}>
          <Text style={styles.scoreText}>{reading.totalScore}</Text>
        </View>
      ))}
    </View>
  );
}

function buildReading(patientId: string, recordedBy: string, form: {
  respirationRate: string;
  spo2: string;
  spo2Scale: Spo2Scale;
  onOxygen: boolean;
  systolicBp: string;
  pulse: string;
  consciousness: News2Consciousness;
  temperature: string;
}): News2Reading {
  const reading = {
    id: `news2-${Date.now()}`,
    patientId,
    recordedAt: new Date().toISOString(),
    recordedBy,
    respirationRate: Number(form.respirationRate),
    spo2: Number(form.spo2),
    spo2Scale: form.spo2Scale,
    onOxygen: form.onOxygen,
    systolicBp: Number(form.systolicBp),
    pulse: Number(form.pulse),
    consciousness: form.consciousness,
    temperature: Number(form.temperature),
    totalScore: 0
  };

  return {
    ...reading,
    totalScore: calculateNews2Score(reading)
  };
}

function calculateNews2Score(reading: Omit<News2Reading, "totalScore">) {
  return (
    respirationScore(reading.respirationRate) +
    spo2Score(reading.spo2, reading.spo2Scale, reading.onOxygen) +
    (reading.onOxygen ? 2 : 0) +
    bpScore(reading.systolicBp) +
    pulseScore(reading.pulse) +
    consciousnessScore(reading.consciousness) +
    temperatureScore(reading.temperature)
  );
}

function respirationScore(value: number) {
  if (value <= 8 || value >= 25) return 3;
  if (value >= 21) return 2;
  if (value >= 9 && value <= 11) return 1;
  return 0;
}

function spo2Score(value: number, scale: Spo2Scale, onOxygen: boolean) {
  if (scale === "Scale 1") {
    if (value <= 91) return 3;
    if (value <= 93) return 2;
    if (value <= 95) return 1;
    return 0;
  }

  if (value <= 83 || (onOxygen && value >= 97)) return 3;
  if (value <= 85 || (onOxygen && value >= 95)) return 2;
  if (value <= 87 || (onOxygen && value >= 93)) return 1;
  return 0;
}

function bpScore(value: number) {
  if (value <= 90 || value >= 220) return 3;
  if (value <= 100) return 2;
  if (value <= 110) return 1;
  return 0;
}

function pulseScore(value: number) {
  if (value <= 40 || value >= 131) return 3;
  if (value >= 111) return 2;
  if ((value >= 41 && value <= 50) || (value >= 91 && value <= 110)) return 1;
  return 0;
}

function consciousnessScore(value: News2Consciousness) {
  return value === "Alert" ? 0 : 3;
}

function temperatureScore(value: number) {
  if (value <= 35 || value >= 39.1) return 3;
  if (value >= 38.1) return 1;
  if (value >= 36.1) return 0;
  return 1;
}

function respirationBand(value: number) {
  if (value >= 25) return "≥25";
  if (value >= 21) return "21-24";
  if (value >= 18) return "18-20";
  if (value >= 15) return "15-17";
  if (value >= 12) return "12-14";
  if (value >= 9) return "9-11";
  return "≤8";
}

function spo2Scale1Band(value: number) {
  if (value >= 96) return "≥96";
  if (value >= 94) return "94-95";
  if (value >= 92) return "92-93";
  return "≤91";
}

function spo2Scale2Band(value: number, onOxygen: boolean) {
  if (onOxygen && value >= 97) return "≥97 on O₂";
  if (onOxygen && value >= 95) return "95-96 on O₂";
  if (onOxygen && value >= 93) return "93-94 on O₂";
  if (!onOxygen && value >= 93) return "≥93 air";
  if (value >= 88) return "88-92";
  if (value >= 86) return "86-87";
  if (value >= 84) return "84-85";
  return "≤83";
}

function bpBand(value: number) {
  if (value >= 220) return "≥220";
  if (value >= 201) return "201-219";
  if (value >= 181) return "181-200";
  if (value >= 161) return "161-180";
  if (value >= 141) return "141-160";
  if (value >= 121) return "121-140";
  if (value >= 111) return "111-120";
  if (value >= 101) return "101-110";
  if (value >= 91) return "91-100";
  if (value >= 81) return "81-90";
  if (value >= 71) return "71-80";
  if (value >= 61) return "61-70";
  if (value >= 51) return "51-60";
  return "≤50";
}

function pulseBand(value: number) {
  if (value >= 131) return "≥131";
  if (value >= 121) return "121-130";
  if (value >= 111) return "111-120";
  if (value >= 101) return "101-110";
  if (value >= 91) return "91-100";
  if (value >= 81) return "81-90";
  if (value >= 71) return "71-80";
  if (value >= 61) return "61-70";
  if (value >= 51) return "51-60";
  if (value >= 41) return "41-50";
  if (value >= 31) return "31-40";
  return "≤30";
}

function temperatureBand(value: number) {
  if (value >= 39.1) return "≥39.1";
  if (value >= 38.1) return "38.1-39.0";
  if (value >= 37.1) return "37.1-38.0";
  if (value >= 36.1) return "36.1-37.0";
  if (value >= 35.1) return "35.1-36.0";
  return "≤35.0";
}

function consciousnessLabel(value: News2Consciousness) {
  if (value === "New confusion") return "C";
  return value.charAt(0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { day: "2-digit", month: "short" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function bandColourStyle(index: number, total: number) {
  if (index === 0 || index === total - 1) return styles.redBand;
  if (index === 1 || index === total - 2) return styles.orangeBand;
  if (index === 2 || index === total - 3) return styles.yellowBand;
  return styles.whiteBand;
}

function scoreColourStyle(score: number) {
  if (score >= 7) return styles.redBand;
  if (score >= 5) return styles.orangeBand;
  if (score >= 1) return styles.yellowBand;
  return styles.whiteBand;
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
  title: { color: "#18262c", fontSize: 22, fontWeight: "900" },
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
  split: { flexDirection: "row", gap: 12 },
  patientList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.22,
    minWidth: 240,
    padding: 12
  },
  patientRow: { borderColor: "#edf1f2", borderRadius: 6, borderWidth: 1, marginBottom: 8, padding: 10 },
  patientRowActive: { backgroundColor: "#edf7f4", borderColor: "#1f5262" },
  patientName: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  patientMeta: { color: "#607078", fontSize: 12, marginTop: 3 },
  mainPane: { flex: 0.78, gap: 12, minWidth: 760 },
  formPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 12
  },
  field: { width: 112 },
  fieldWide: { minWidth: 240 },
  label: { color: "#31454d", fontSize: 12, fontWeight: "900", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 8
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 9
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#30434a", fontSize: 12, fontWeight: "800" },
  optionTextActive: { color: "#ffffff" },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14
  },
  saveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  chartPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10
  },
  chartNav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  navButton: { borderColor: "#1f5262", borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  navButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  windowText: { color: "#607078", fontSize: 12, fontWeight: "800" },
  panelTitle: { color: "#18262c", fontSize: 17, fontWeight: "900", marginBottom: 10 },
  chart: { borderColor: "#222", borderWidth: 1 },
  dateRow: { flexDirection: "row" },
  sectionLabelSmall: { backgroundColor: "#0e6fbd", borderColor: "#222", borderWidth: 1, width: 220, justifyContent: "center", padding: 6 },
  sectionLabel: { backgroundColor: "#0e6fbd", borderColor: "#222", borderWidth: 1, width: 150, justifyContent: "center", padding: 6 },
  sectionText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  dateCell: { borderColor: "#222", borderWidth: 1, minHeight: 42, width: 58, alignItems: "center", justifyContent: "center" },
  dateText: { color: "#18262c", fontSize: 10, fontWeight: "800" },
  chartSection: { flexDirection: "row" },
  bandRow: { flexDirection: "row" },
  bandLabel: { borderColor: "#222", borderWidth: 1, width: 70, minHeight: 24, justifyContent: "center", paddingRight: 4 },
  bandText: { color: "#18262c", fontSize: 10, fontWeight: "900", textAlign: "right" },
  readingCell: { alignItems: "center", borderColor: "#222", borderWidth: 1, justifyContent: "center", minHeight: 24, width: 58 },
  pointText: { color: "#18262c", fontSize: 11, fontWeight: "900" },
  scoreRow: { flexDirection: "row" },
  scoreLabel: { backgroundColor: "#0b4b99", borderColor: "#222", borderWidth: 1, justifyContent: "center", padding: 6, width: 220 },
  scoreLabelText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  scoreCell: { alignItems: "center", borderColor: "#222", borderWidth: 1, justifyContent: "center", minHeight: 34, width: 58 },
  scoreText: { color: "#18262c", fontSize: 16, fontWeight: "900" },
  whiteBand: { backgroundColor: "#ffffff" },
  yellowBand: { backgroundColor: "#fff3a3" },
  orangeBand: { backgroundColor: "#ffc785" },
  redBand: { backgroundColor: "#f08f78" }
});
