import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  FoodFluidEntry,
  FoodFluidEntryType,
  FoodFluidIntakeLevel,
  FoodFluidMealPeriod,
  Patient,
  StaffMember
} from "../types/domain";

const mealPeriods: FoodFluidMealPeriod[] = [
  "Breakfast",
  "Mid-morning",
  "Lunch",
  "Mid-afternoon",
  "Evening meal",
  "Bedtime"
];
const entryTypes: FoodFluidEntryType[] = ["Food", "Drink", "Supplement"];
const intakeLevels: FoodFluidIntakeLevel[] = [
  "Refused",
  "Less than half",
  "Half",
  "More than half",
  "All"
];

type FoodFluidChartScreenProps = {
  entries: FoodFluidEntry[];
  patients: Patient[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  onBack: () => void;
  onCreateEntry: (entry: FoodFluidEntry) => void;
  onSelectPatient: (patientId: string) => void;
};

export function FoodFluidChartScreen({
  entries,
  patients,
  selectedPatientId,
  selectedStaffId,
  staff,
  onBack,
  onCreateEntry,
  onSelectPatient
}: FoodFluidChartScreenProps) {
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const [mealPeriod, setMealPeriod] = useState<FoodFluidMealPeriod>(() => suggestedMealPeriod(new Date()));
  const [entryType, setEntryType] = useState<FoodFluidEntryType>("Food");
  const [itemDescription, setItemDescription] = useState("");
  const [portionOffered, setPortionOffered] = useState("");
  const [intakeLevel, setIntakeLevel] = useState<FoodFluidIntakeLevel>("All");
  const [fluidOfferedMl, setFluidOfferedMl] = useState("");
  const [fluidTakenMl, setFluidTakenMl] = useState("");
  const [assistanceNotes, setAssistanceNotes] = useState("");
  const [comments, setComments] = useState("");

  const patientEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.patientId === selectedPatientId)
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
    [entries, selectedPatientId]
  );
  const threeDayEntries = useMemo(() => {
    const earliest = startOfDayOffset(new Date(), -2).getTime();
    return patientEntries.filter((entry) => new Date(entry.recordedAt).getTime() >= earliest);
  }, [patientEntries]);
  const dailySummaries = useMemo(() => buildDailySummaries(threeDayEntries), [threeDayEntries]);
  const threeDayFoodEntries = threeDayEntries.filter((entry) => entry.entryType !== "Drink");
  const averageFoodIntake =
    threeDayFoodEntries.length > 0
      ? threeDayFoodEntries.reduce((total, entry) => total + intakeFraction(entry.intakeLevel), 0) /
        threeDayFoodEntries.length
      : undefined;
  const requiresReview =
    new Set(threeDayEntries.map((entry) => localDateKey(new Date(entry.recordedAt)))).size >= 3 &&
    averageFoodIntake !== undefined &&
    averageFoodIntake < 0.5;

  const saveEntry = () => {
    if (!selectedPatient || !selectedStaff) {
      Alert.alert("Patient and staff required", "Select a patient and sign in before recording intake.");
      return;
    }
    if (!itemDescription.trim() || !portionOffered.trim()) {
      Alert.alert("Entry details required", "Enter the item and the portion or quantity offered.");
      return;
    }

    const offeredMl = parseOptionalWholeNumber(fluidOfferedMl);
    const takenMl = parseOptionalWholeNumber(fluidTakenMl);
    if (entryType === "Drink" && (offeredMl === undefined || takenMl === undefined)) {
      Alert.alert("Fluid amounts required", "Enter the millilitres offered and the millilitres taken.");
      return;
    }
    if (offeredMl !== undefined && takenMl !== undefined && takenMl > offeredMl) {
      Alert.alert("Check fluid amounts", "The amount taken cannot be greater than the amount offered.");
      return;
    }

    const entry: FoodFluidEntry = {
      id: `food-fluid-${Date.now()}`,
      patientId: selectedPatient.id,
      recordedAt: new Date().toISOString(),
      recordedBy: selectedStaff.name,
      mealPeriod,
      entryType,
      itemDescription: itemDescription.trim(),
      portionOffered: portionOffered.trim(),
      intakeLevel,
      fluidOfferedMl: entryType === "Drink" ? offeredMl : undefined,
      fluidTakenMl: entryType === "Drink" ? takenMl : undefined,
      assistanceNotes: assistanceNotes.trim(),
      comments: comments.trim()
    };

    onCreateEntry(entry);
    setItemDescription("");
    setPortionOffered("");
    setFluidOfferedMl("");
    setFluidTakenMl("");
    setAssistanceNotes("");
    setComments("");
    Alert.alert("Food and fluid entry saved", `${entry.itemDescription} was added for ${selectedPatient.firstName}.`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Three-day monitoring</Text>
          <Text style={styles.title}>Food and fluid chart</Text>
          <Text style={styles.headerMeta}>
            Record every item offered, the amount taken, assistance given and reasons for poor intake.
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.patientStrip}>
        {patients.map((patient) => {
          const selected = patient.id === selectedPatientId;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={patient.id}
              onPress={() => onSelectPatient(patient.id)}
              style={[styles.patientButton, selected && styles.patientButtonActive]}
            >
              <Text style={[styles.patientName, selected && styles.patientNameActive]}>
                Room {patient.roomNumber} · {patient.firstName} {patient.surname}
              </Text>
              <Text style={[styles.patientNumber, selected && styles.patientNumberActive]}>
                {patient.hospitalNumber}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedPatient ? (
        <>
          <View style={styles.summaryGrid}>
            {dailySummaries.map((summary) => (
              <View key={summary.dateKey} style={styles.summaryCard}>
                <Text style={styles.summaryDate}>{summary.label}</Text>
                <Text style={styles.summaryValue}>{summary.fluidTakenMl} ml</Text>
                <Text style={styles.summaryMeta}>fluid taken · {summary.entryCount} entries</Text>
                <Text style={[styles.summaryMeta, summary.lowIntakeCount > 0 && styles.lowText]}>
                  {summary.lowIntakeCount} refused or below half
                </Text>
              </View>
            ))}
            <View style={[styles.summaryCard, requiresReview && styles.reviewCardWarning]}>
              <Text style={styles.summaryDate}>Three-day review</Text>
              <Text style={[styles.reviewStatus, requiresReview && styles.reviewStatusWarning]}>
                {requiresReview ? "Review required" : "Continue monitoring"}
              </Text>
              <Text style={styles.summaryMeta}>
                {averageFoodIntake === undefined
                  ? "No food intake recorded yet"
                  : `Average recorded intake ${Math.round(averageFoodIntake * 100)}%`}
              </Text>
            </View>
          </View>

          <View style={styles.contentGrid}>
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Add intake entry</Text>
              <Text style={styles.fieldLabel}>Meal or snack period</Text>
              <ChoiceRow options={mealPeriods} selected={mealPeriod} onSelect={setMealPeriod} />

              <Text style={styles.fieldLabel}>Entry type</Text>
              <ChoiceRow options={entryTypes} selected={entryType} onSelect={setEntryType} />

              <Text style={styles.fieldLabel}>Food, drink or supplement</Text>
              <TextInput
                accessibilityLabel="Food, drink or supplement"
                onChangeText={setItemDescription}
                placeholder="For example porridge, tea or nutritional supplement"
                style={styles.input}
                value={itemDescription}
              />

              <Text style={styles.fieldLabel}>Portion or quantity offered</Text>
              <TextInput
                accessibilityLabel="Portion or quantity offered"
                onChangeText={setPortionOffered}
                placeholder="For example small bowl, 1 slice or 1 mug"
                style={styles.input}
                value={portionOffered}
              />

              {entryType === "Drink" ? (
                <View style={styles.fluidRow}>
                  <View style={styles.fluidField}>
                    <Text style={styles.fieldLabel}>Offered (ml)</Text>
                    <TextInput
                      accessibilityLabel="Fluid offered in millilitres"
                      keyboardType="number-pad"
                      onChangeText={setFluidOfferedMl}
                      placeholder="250"
                      style={styles.input}
                      value={fluidOfferedMl}
                    />
                  </View>
                  <View style={styles.fluidField}>
                    <Text style={styles.fieldLabel}>Taken (ml)</Text>
                    <TextInput
                      accessibilityLabel="Fluid taken in millilitres"
                      keyboardType="number-pad"
                      onChangeText={setFluidTakenMl}
                      placeholder="200"
                      style={styles.input}
                      value={fluidTakenMl}
                    />
                  </View>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Amount consumed</Text>
              <ChoiceRow options={intakeLevels} selected={intakeLevel} onSelect={setIntakeLevel} />

              <Text style={styles.fieldLabel}>Assistance or prompting</Text>
              <TextInput
                accessibilityLabel="Assistance or prompting"
                multiline
                onChangeText={setAssistanceNotes}
                placeholder="Record support provided, positioning or adapted equipment"
                style={[styles.input, styles.multilineInput]}
                value={assistanceNotes}
              />

              <Text style={styles.fieldLabel}>Comments or reason for refusal</Text>
              <TextInput
                accessibilityLabel="Comments or reason for refusal"
                multiline
                onChangeText={setComments}
                placeholder="For example felt sick, tired after therapy or declined available options"
                style={[styles.input, styles.multilineInput]}
                value={comments}
              />

              <TouchableOpacity accessibilityRole="button" onPress={saveEntry} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save food and fluid entry</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.historyCard}>
              <Text style={styles.cardTitle}>Latest three days</Text>
              <Text style={styles.cardMeta}>
                {patientEntries.length} total entries for {selectedPatient.firstName} {selectedPatient.surname}
              </Text>
              {threeDayEntries.length === 0 ? (
                <Text style={styles.emptyText}>No food or fluid entries have been recorded in the last three days.</Text>
              ) : (
                threeDayEntries.map((entry) => <HistoryRow entry={entry} key={entry.id} />)
              )}
            </View>
          </View>

          <View style={styles.guidanceCard}>
            <Text style={styles.cardTitle}>Completion guidance</Text>
            <Text style={styles.guidanceText}>
              Record each item separately using a practical portion description. Choose Refused, Less than half,
              Half, More than half or All. For drinks, enter the exact millilitres offered and taken. Document
              assistance and explain missed meals, refusals or poor intake in the comments.
            </Text>
            <Text style={styles.guidanceText}>
              Review the chart after three days. If meals and snacks remain below half, escalate according to the
              resident's care plan and local MUST or dietitian policy.
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyText}>Select a patient to open their food and fluid chart.</Text>
        </View>
      )}
    </View>
  );
}

function ChoiceRow<T extends string>({
  options,
  selected,
  onSelect
}: {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.choiceButton, active && styles.choiceButtonActive]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function HistoryRow({ entry }: { entry: FoodFluidEntry }) {
  const lowIntake = entry.intakeLevel === "Refused" || entry.intakeLevel === "Less than half";
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyMain}>
        <Text style={styles.historyTitle}>
          {formatDateTime(entry.recordedAt)} · {entry.mealPeriod}
        </Text>
        <Text style={styles.historyItem}>
          {entry.entryType}: {entry.itemDescription}
        </Text>
        <Text style={styles.historyMeta}>
          Offered {entry.portionOffered}
          {entry.entryType === "Drink"
            ? ` · ${entry.fluidTakenMl ?? 0}/${entry.fluidOfferedMl ?? 0} ml taken`
            : ""}
          {" · "}Recorded by {entry.recordedBy}
        </Text>
        {entry.assistanceNotes ? <Text style={styles.historyNote}>Support: {entry.assistanceNotes}</Text> : null}
        {entry.comments ? <Text style={styles.historyNote}>Comment: {entry.comments}</Text> : null}
      </View>
      <View style={[styles.intakePill, lowIntake && styles.intakePillLow]}>
        <Text style={[styles.intakePillText, lowIntake && styles.intakePillTextLow]}>{entry.intakeLevel}</Text>
      </View>
    </View>
  );
}

function buildDailySummaries(entries: FoodFluidEntry[]) {
  return [0, -1, -2].map((offset) => {
    const date = startOfDayOffset(new Date(), offset);
    const dateKey = localDateKey(date);
    const dayEntries = entries.filter((entry) => localDateKey(new Date(entry.recordedAt)) === dateKey);
    return {
      dateKey,
      label: offset === 0 ? "Today" : offset === -1 ? "Yesterday" : formatShortDate(date),
      entryCount: dayEntries.length,
      fluidTakenMl: dayEntries.reduce((total, entry) => total + (entry.fluidTakenMl ?? 0), 0),
      lowIntakeCount: dayEntries.filter(
        (entry) => entry.intakeLevel === "Refused" || entry.intakeLevel === "Less than half"
      ).length
    };
  });
}

function intakeFraction(level: FoodFluidIntakeLevel) {
  if (level === "Refused") return 0;
  if (level === "Less than half") return 0.25;
  if (level === "Half") return 0.5;
  if (level === "More than half") return 0.75;
  return 1;
}

function suggestedMealPeriod(date: Date): FoodFluidMealPeriod {
  const hour = date.getHours();
  if (hour < 10) return "Breakfast";
  if (hour < 12) return "Mid-morning";
  if (hour < 15) return "Lunch";
  if (hour < 17) return "Mid-afternoon";
  if (hour < 21) return "Evening meal";
  return "Bedtime";
}

function parseOptionalWholeNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function startOfDayOffset(date: Date, offset: number) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + offset);
  return result;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: {
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16
  },
  eyebrow: { color: "#147267", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#18262c", fontSize: 25, fontWeight: "900", marginTop: 2 },
  headerMeta: { color: "#607078", fontSize: 12, marginTop: 4, maxWidth: 720 },
  backButton: {
    borderColor: "#165e70",
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  backButtonText: { color: "#165e70", fontSize: 12, fontWeight: "900" },
  patientStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  patientButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d6dfe2",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 190,
    padding: 10
  },
  patientButtonActive: { backgroundColor: "#e5f3ef", borderColor: "#23766c" },
  patientName: { color: "#25383f", fontSize: 12, fontWeight: "900" },
  patientNameActive: { color: "#145c53" },
  patientNumber: { color: "#718087", fontSize: 10, marginTop: 2 },
  patientNumberActive: { color: "#3f6f68" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 180,
    padding: 12
  },
  reviewCardWarning: { backgroundColor: "#fff1ec", borderColor: "#e4a898" },
  summaryDate: { color: "#607078", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  summaryValue: { color: "#164f60", fontSize: 22, fontWeight: "900", marginTop: 4 },
  summaryMeta: { color: "#68777d", fontSize: 10, fontWeight: "700", marginTop: 3 },
  lowText: { color: "#a24234" },
  reviewStatus: { color: "#23705e", fontSize: 17, fontWeight: "900", marginTop: 6 },
  reviewStatusWarning: { color: "#a33e31" },
  contentGrid: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  formCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: 500,
    flexGrow: 1,
    minWidth: 340,
    padding: 15
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: 500,
    flexGrow: 1,
    minWidth: 340,
    padding: 15
  },
  cardTitle: { color: "#1e333c", fontSize: 17, fontWeight: "900" },
  cardMeta: { color: "#6b797f", fontSize: 11, marginBottom: 10, marginTop: 3 },
  fieldLabel: { color: "#30464f", fontSize: 11, fontWeight: "900", marginBottom: 5, marginTop: 13 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  choiceButton: {
    backgroundColor: "#f4f7f8",
    borderColor: "#d4dde0",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  choiceButtonActive: { backgroundColor: "#176879", borderColor: "#176879" },
  choiceText: { color: "#52636a", fontSize: 10, fontWeight: "900" },
  choiceTextActive: { color: "#ffffff" },
  input: {
    backgroundColor: "#fbfcfc",
    borderColor: "#ced8db",
    borderRadius: 7,
    borderWidth: 1,
    color: "#1f333b",
    fontSize: 12,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  multilineInput: { minHeight: 68, textAlignVertical: "top" },
  fluidRow: { flexDirection: "row", gap: 10 },
  fluidField: { flex: 1 },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#156778",
    borderRadius: 7,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 14
  },
  saveButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  historyRow: {
    alignItems: "flex-start",
    borderBottomColor: "#e1e7e9",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10
  },
  historyMain: { flex: 1 },
  historyTitle: { color: "#607078", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  historyItem: { color: "#21363f", fontSize: 12, fontWeight: "900", marginTop: 3 },
  historyMeta: { color: "#68777d", fontSize: 10, marginTop: 3 },
  historyNote: { color: "#4f6169", fontSize: 10, marginTop: 3 },
  intakePill: { backgroundColor: "#e6f3ec", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  intakePillLow: { backgroundColor: "#f7c3b8" },
  intakePillText: { color: "#286251", fontSize: 9, fontWeight: "900" },
  intakePillTextLow: { color: "#91392e" },
  guidanceCard: {
    backgroundColor: "#eef6f4",
    borderColor: "#bdd9d2",
    borderRadius: 10,
    borderWidth: 1,
    padding: 15
  },
  guidanceText: { color: "#3f5b56", fontSize: 11, lineHeight: 17, marginTop: 7 },
  emptyPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    padding: 20
  },
  emptyText: { color: "#6b797f", fontSize: 12, paddingVertical: 14 }
});
