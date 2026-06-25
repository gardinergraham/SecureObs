import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { Patient, SecurityArea, SecurityCheck, StaffMember } from "../types/domain";

const levelOneTriggers = ["Weekly check", "Leaving ward", "Returning to ward", "Ad hoc / clinical reason"];

type SecurityChecksProps = {
  areas: SecurityArea[];
  checks: SecurityCheck[];
  patients: Patient[];
  selectedStaffId: string;
  staff: StaffMember[];
  wardName: string;
  onBack: () => void;
  onCreateCheck: (check: SecurityCheck) => void;
};

export function SecurityChecks({
  areas,
  checks,
  patients,
  selectedStaffId,
  staff,
  wardName,
  onBack,
  onCreateCheck
}: SecurityChecksProps) {
  const [selectedAreaId, setSelectedAreaId] = useState(areas[0]?.id ?? "");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [levelOneTrigger, setLevelOneTrigger] = useState(levelOneTriggers[0] ?? "Weekly check");
  const [cutleryCounts, setCutleryCounts] = useState({ knives: "", forks: "", spoons: "" });
  const [checklistResults, setChecklistResults] = useState<Array<{ id: string; checked: boolean; actualCount: string }>>([]);
  const [notes, setNotes] = useState("");
  const [countedTotal, setCountedTotal] = useState("");
  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? areas[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const orderedAreas = useMemo(
    () =>
      areas.map((area) => ({
        area,
        latestCheck: getLatestCheck(area.id, checks)
      })),
    [areas, checks]
  );
  const historyByCategory = useMemo(() => buildHistoryByCategory(areas, checks), [areas, checks]);
  const levelOneCompliance = useMemo(
    () => buildLevelOneCompliance(patients, areas, checks),
    [areas, checks, patients]
  );

  useEffect(() => {
    setChecklistResults(
      (selectedArea?.expectedItems?.checklist ?? []).map((item) => ({
        id: item.id,
        checked: false,
        actualCount: String(item.expectedCount)
      }))
    );
    setCutleryCounts({
      knives: String(selectedArea?.expectedItems?.cutlery?.knives ?? ""),
      forks: String(selectedArea?.expectedItems?.cutlery?.forks ?? ""),
      spoons: String(selectedArea?.expectedItems?.cutlery?.spoons ?? "")
    });
  }, [selectedArea?.id, selectedArea?.expectedItems]);

  const saveCheck = () => {
    if (!selectedArea) {
      return;
    }

    const parsedCount = Number.parseInt(countedTotal, 10);
    if (selectedArea.requiresCount && selectedArea.category !== "cutlery" && (Number.isNaN(parsedCount) || parsedCount < 0)) {
      Alert.alert("Count needed", "Enter the counted total before saving this check.");
      return;
    }
    if (isLevelOnePatientCheck(selectedArea) && !selectedPatientId) {
      Alert.alert("Patient needed", "Select the patient who had the Level 1 check.");
      return;
    }

    const checkedBy = selectedStaff?.name ?? "Unknown";
    const checkedAt = new Date().toISOString();
    const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
    const resultDetails = buildResultDetails({
      area: selectedArea,
      cutleryCounts,
      checklistResults,
      selectedPatient,
      trigger: levelOneTrigger
    });
    const outcomeNotes = buildCheckNotes({
      notes: notes.trim(),
      selectedArea,
      selectedPatient,
      trigger: levelOneTrigger,
      resultDetails
    });
    const check: SecurityCheck = {
      id: `security-${Date.now()}`,
      areaId: selectedArea.id,
      checkName: isLevelOnePatientCheck(selectedArea)
        ? `${selectedArea.name} - ${levelOneTrigger}`
        : selectedArea.requiresCount ? `${selectedArea.name} count` : `${selectedArea.name} check`,
      checkedBy,
      checkedAt,
      notes: outcomeNotes,
      countedTotal: selectedArea.category === "cutlery"
        ? totalCutlery(resultDetails.cutlery)
        : selectedArea.requiresCount ? parsedCount : undefined,
      resultDetails
    };

    onCreateCheck(check);
    setNotes("");
    setCountedTotal("");
    setSelectedPatientId("");
    setLevelOneTrigger(levelOneTriggers[0] ?? "Weekly check");
    Alert.alert("Security check saved", `${selectedArea.name} recorded by ${checkedBy}.`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Security checks</Text>
          <Text style={styles.meta}>
            {wardName} | {selectedStaff?.name ?? "No staff selected"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to observations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.areaList}>
          <Text style={styles.panelTitle}>Checkpoint status</Text>
          {orderedAreas.length === 0 ? (
            <Text style={styles.empty}>No security areas configured for this ward.</Text>
          ) : (
            orderedAreas.map(({ area, latestCheck }) => {
              const status = getSecurityTiming(area, latestCheck);

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={area.id}
                  onPress={() => setSelectedAreaId(area.id)}
                  style={[
                    styles.areaRow,
                    area.id === selectedArea?.id && styles.areaRowSelected,
                    status.state === "due" && styles.areaRowDue
                  ]}
                >
                  <View style={styles.areaInfo}>
                    <Text style={styles.areaName}>{area.name}</Text>
                    <Text style={styles.areaMeta}>
                      {formatFrequency(area)} | {area.requiresCount ? "Count required" : "Visual check"}
                    </Text>
                    <Text style={styles.areaMeta}>
                      {latestCheck
                        ? `${latestCheck.notes} by ${latestCheck.checkedBy} at ${formatTime(latestCheck.checkedAt)}`
                        : "No check recorded"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, status.state === "due" && styles.statusBadgeDue]}>
                    <Text style={[styles.statusText, status.state === "due" && styles.statusTextDue]}>
                      {status.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.editor}>
          <Text style={styles.panelTitle}>Record check</Text>
          {selectedArea ? (
            <>
              <Text style={styles.selectedTitle}>{selectedArea.name}</Text>
              <Text style={styles.selectedMeta}>
                {isLevelOnePatientCheck(selectedArea)
                  ? "Record the patient, reason, and outcome for this Level 1 check."
                  : selectedArea.requiresCount ? "This area needs a counted total." : "Record the check outcome."}
              </Text>

              {isLevelOnePatientCheck(selectedArea) ? (
                <>
                  <Text style={styles.label}>Patient</Text>
                  <View style={styles.optionRow}>
                    {patients.map((patient) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={patient.id}
                        onPress={() => setSelectedPatientId(patient.id)}
                        style={[styles.optionButton, patient.id === selectedPatientId && styles.optionButtonActive]}
                      >
                        <Text style={[styles.optionText, patient.id === selectedPatientId && styles.optionTextActive]}>
                          Room {patient.roomNumber} | {patient.firstName} {patient.surname}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Reason</Text>
                  <View style={styles.optionRow}>
                    {levelOneTriggers.map((trigger) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={trigger}
                        onPress={() => setLevelOneTrigger(trigger)}
                        style={[styles.optionButton, trigger === levelOneTrigger && styles.optionButtonActive]}
                      >
                        <Text style={[styles.optionText, trigger === levelOneTrigger && styles.optionTextActive]}>
                          {trigger}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              {selectedArea.requiresCount ? (
                selectedArea.category === "cutlery" ? (
                <>
                  <Text style={styles.label}>Cutlery count</Text>
                  <View style={styles.cutleryGrid}>
                    {(["knives", "forks", "spoons"] as const).map((item) => (
                      <View key={item} style={styles.cutleryBox}>
                        <Text style={styles.cutleryLabel}>
                          {item} expected {selectedArea.expectedItems?.cutlery?.[item] ?? 0}
                        </Text>
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={(value) => setCutleryCounts((current) => ({ ...current, [item]: value }))}
                          placeholder={String(selectedArea.expectedItems?.cutlery?.[item] ?? 0)}
                          placeholderTextColor="#6f7f87"
                          style={styles.input}
                          value={cutleryCounts[item]}
                        />
                      </View>
                    ))}
                  </View>
                </>
                ) : (
                <>
                  <Text style={styles.label}>Counted total</Text>
                  <TextInput placeholderTextColor="#6f7f87"
                    keyboardType="number-pad"
                    onChangeText={setCountedTotal}
                    placeholder="Enter total"
                    style={styles.input}
                    value={countedTotal}
                  />
                </>
                )
              ) : null}

              {selectedArea.expectedItems?.checklist?.length ? (
                <>
                  <Text style={styles.label}>Checklist</Text>
                  <View style={styles.checklistPanel}>
                    {selectedArea.expectedItems.checklist.map((item) => {
                      const result = checklistResults.find((entry) => entry.id === item.id);
                      return (
                        <View key={item.id} style={styles.checklistRow}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => toggleChecklistItem(item.id)}
                            style={[styles.checkBox, result?.checked && styles.checkBoxActive]}
                          >
                            <Text style={[styles.checkBoxText, result?.checked && styles.optionTextActive]}>
                              {result?.checked ? "Done" : "Todo"}
                            </Text>
                          </TouchableOpacity>
                          <Text style={styles.checklistName}>{item.name}</Text>
                          <Text style={styles.checklistExpected}>Expected {item.expectedCount}</Text>
                          <TextInput
                            keyboardType="number-pad"
                            onChangeText={(actualCount) => updateChecklistCount(item.id, actualCount)}
                            placeholder={String(item.expectedCount)}
                            placeholderTextColor="#6f7f87"
                            style={[styles.input, styles.checklistCountInput]}
                            value={result?.actualCount ?? ""}
                          />
                        </View>
                      );
                    })}
                    <Text style={styles.completionText}>Completion {calculateChecklistCompletion(checklistResults)}%</Text>
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>Notes</Text>
              <TextInput placeholderTextColor="#6f7f87"
                multiline
                numberOfLines={5}
                onChangeText={setNotes}
                placeholder="Complete, issue found, action taken..."
                style={[styles.input, styles.notes]}
                value={notes}
              />

              <TouchableOpacity accessibilityRole="button" onPress={saveCheck} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save security check</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.empty}>Select an area to record a check.</Text>
          )}
        </View>
      </View>

      <View style={styles.historyPanel}>
        <Text style={styles.panelTitle}>Security check history</Text>
        {Object.entries(historyByCategory).map(([category, categoryChecks]) => (
          <View key={category} style={styles.historyCategory}>
            <Text style={styles.historyCategoryTitle}>{category}</Text>
            {categoryChecks.slice(0, 5).map((check) => (
              <Text key={check.id} style={styles.historyText}>
                {formatDateTime(check.checkedAt)} | {check.checkName} | {formatHistorySummary(check)}
              </Text>
            ))}
          </View>
        ))}
        <View style={styles.historyCategory}>
          <Text style={styles.historyCategoryTitle}>Level 1 monthly patient check</Text>
          {levelOneCompliance.map((item) => (
            <Text key={item.patientId} style={[styles.historyText, !item.completed && styles.historyWarningText]}>
              {item.patientName}: {item.completed ? `done ${formatDateTime(item.lastCheckedAt)}` : "not recorded in last month"}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );

  function toggleChecklistItem(itemId: string) {
    setChecklistResults((current) =>
      current.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item))
    );
  }

  function updateChecklistCount(itemId: string, actualCount: string) {
    setChecklistResults((current) =>
      current.map((item) => (item.id === itemId ? { ...item, actualCount } : item))
    );
  }
}

function getLatestCheck(areaId: string, checks: SecurityCheck[]) {
  return checks
    .filter((check) => check.areaId === areaId)
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];
}

function getSecurityTiming(area: SecurityArea, latestCheck: SecurityCheck | undefined) {
  if (!latestCheck) {
    return { label: "Due", state: "due" as const };
  }

  const checkedAt = new Date(latestCheck.checkedAt).getTime();
  const dueAt = checkedAt + area.frequencyMinutes * 60 * 1000;
  const minutes = Math.round((dueAt - Date.now()) / 60000);

  if (minutes <= 0) {
    return { label: "Due", state: "due" as const };
  }

  return { label: `${minutes}m`, state: "ok" as const };
}

function isLevelOnePatientCheck(area: SecurityArea) {
  return area.category === "level_1_patient_search";
}

function buildCheckNotes({
  notes,
  selectedArea,
  selectedPatient,
  trigger,
  resultDetails
}: {
  notes: string;
  selectedArea: SecurityArea;
  selectedPatient?: Patient;
  trigger: string;
  resultDetails: NonNullable<SecurityCheck["resultDetails"]>;
}) {
  if (selectedArea.category === "cutlery" && resultDetails.cutlery) {
    const expected = selectedArea.expectedItems?.cutlery;
    return `Cutlery: knives ${resultDetails.cutlery.knives}/${expected?.knives ?? 0}, forks ${resultDetails.cutlery.forks}/${expected?.forks ?? 0}, spoons ${resultDetails.cutlery.spoons}/${expected?.spoons ?? 0} | ${notes || "Complete"}`;
  }

  if (resultDetails.checklist?.length) {
    return `Checklist ${resultDetails.completionPercent ?? 0}% complete | ${notes || "Complete"}`;
  }

  if (!isLevelOnePatientCheck(selectedArea)) {
    return notes || "Complete";
  }

  const patientText = selectedPatient
    ? `Patient: Room ${selectedPatient.roomNumber} ${selectedPatient.firstName} ${selectedPatient.surname} (${selectedPatient.hospitalNumber})`
    : "Patient: not recorded";
  const noteText = notes || "Complete";
  return `${patientText} | Reason: ${trigger} | ${noteText}`;
}

function buildResultDetails({
  area,
  cutleryCounts,
  checklistResults,
  selectedPatient,
  trigger
}: {
  area: SecurityArea;
  cutleryCounts: { knives: string; forks: string; spoons: string };
  checklistResults: Array<{ id: string; checked: boolean; actualCount: string }>;
  selectedPatient?: Patient;
  trigger: string;
}): NonNullable<SecurityCheck["resultDetails"]> {
  if (area.category === "cutlery") {
    return {
      cutlery: {
        knives: parseCount(cutleryCounts.knives),
        forks: parseCount(cutleryCounts.forks),
        spoons: parseCount(cutleryCounts.spoons)
      }
    };
  }

  if (area.expectedItems?.checklist?.length) {
    const checklist = area.expectedItems.checklist.map((item) => {
      const result = checklistResults.find((entry) => entry.id === item.id);
      return {
        id: item.id,
        name: item.name,
        expectedCount: item.expectedCount,
        checked: Boolean(result?.checked),
        actualCount: parseCount(result?.actualCount ?? String(item.expectedCount))
      };
    });

    return {
      checklist,
      completionPercent: calculateChecklistCompletion(checklist.map((item) => ({
        id: item.id,
        checked: item.checked,
        actualCount: String(item.actualCount)
      })))
    };
  }

  if (isLevelOnePatientCheck(area)) {
    return {
      patientId: selectedPatient?.id,
      patientName: selectedPatient
        ? `Room ${selectedPatient.roomNumber} ${selectedPatient.firstName} ${selectedPatient.surname}`
        : undefined,
      trigger
    };
  }

  return {};
}

function parseCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function totalCutlery(cutlery: NonNullable<SecurityCheck["resultDetails"]>["cutlery"]) {
  if (!cutlery) return undefined;
  return cutlery.knives + cutlery.forks + cutlery.spoons;
}

function calculateChecklistCompletion(results: Array<{ checked: boolean }>) {
  if (results.length === 0) return 0;
  return Math.round((results.filter((item) => item.checked).length / results.length) * 100);
}

function buildHistoryByCategory(areas: SecurityArea[], checks: SecurityCheck[]) {
  return checks.reduce<Record<string, SecurityCheck[]>>((groups, check) => {
    const area = areas.find((item) => item.id === check.areaId);
    const category = formatCategory(area);
    groups[category] = [...(groups[category] ?? []), check];
    return groups;
  }, {});
}

function buildLevelOneCompliance(patients: Patient[], areas: SecurityArea[], checks: SecurityCheck[]) {
  const levelOneAreaIds = new Set(areas.filter(isLevelOnePatientCheck).map((area) => area.id));
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return patients.map((patient) => {
    const lastCheck = checks
      .filter(
        (check) =>
          levelOneAreaIds.has(check.areaId) &&
          check.resultDetails?.patientId === patient.id &&
          new Date(check.checkedAt).getTime() >= monthAgo
      )
      .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0];

    return {
      patientId: patient.id,
      patientName: `Room ${patient.roomNumber} ${patient.firstName} ${patient.surname}`,
      completed: Boolean(lastCheck),
      lastCheckedAt: lastCheck?.checkedAt
    };
  });
}

function formatCategory(area: SecurityArea | undefined) {
  if (area?.category === "cutlery") return "Cutlery";
  if (area?.category === "ward_security") return "Ward security";
  if (area?.category === "level_1_patient_search") return "Level 1 patient checks";
  if (area?.category === "level_1_room_locker_zone") return "Room / locker / zone";
  return "Other";
}

function formatHistorySummary(check: SecurityCheck) {
  if (check.resultDetails?.patientName) {
    return `${check.resultDetails.patientName} | ${check.resultDetails.trigger ?? "Level 1"}`;
  }
  if (check.resultDetails?.completionPercent !== undefined) {
    return `${check.resultDetails.completionPercent}% complete`;
  }
  if (check.resultDetails?.cutlery) {
    return `K ${check.resultDetails.cutlery.knives}, F ${check.resultDetails.cutlery.forks}, S ${check.resultDetails.cutlery.spoons}`;
  }
  return check.notes;
}

function formatDateTime(value: string | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFrequency(area: SecurityArea) {
  if (area.frequencyType === "per_shift") return "Per shift";
  if (area.frequencyType === "per_meal") return "Per meal";
  if (area.frequencyType === "daily") return "Daily";
  if (area.frequencyType === "weekly") return "Weekly";
  if (area.frequencyType === "weekly_ad_hoc") return "Weekly + ad hoc";
  if (area.frequencyType === "monthly") return "Monthly";
  return `Every ${area.frequencyMinutes}m`;
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
  areaList: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.58,
    minWidth: 440,
    padding: 12
  },
  editor: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.42,
    minWidth: 320,
    padding: 12
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10
  },
  areaRow: {
    alignItems: "center",
    borderColor: "#edf1f2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 8,
    minHeight: 86,
    padding: 10
  },
  areaRowSelected: {
    backgroundColor: "#edf7f4",
    borderColor: "#1f5262"
  },
  areaRowDue: {
    backgroundColor: "#fff4d7"
  },
  areaInfo: {
    flex: 1
  },
  areaName: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900"
  },
  areaMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  statusBadge: {
    alignItems: "center",
    backgroundColor: "#ddebd6",
    borderRadius: 6,
    justifyContent: "center",
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  statusBadgeDue: {
    backgroundColor: "#ffe6bf"
  },
  statusText: {
    color: "#276149",
    fontSize: 12,
    fontWeight: "900"
  },
  statusTextDue: {
    color: "#8a4f00"
  },
  selectedTitle: {
    color: "#18262c",
    fontSize: 18,
    fontWeight: "900"
  },
  selectedMeta: {
    color: "#607078",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4
  },
  label: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
    marginTop: 14
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6
  },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  optionButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  optionText: {
    color: "#30434a",
    fontSize: 12,
    fontWeight: "900"
  },
  optionTextActive: {
    color: "#ffffff"
  },
  cutleryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6
  },
  cutleryBox: {
    flex: 1,
    gap: 5
  },
  cutleryLabel: {
    color: "#31454d",
    fontSize: 11,
    fontWeight: "900"
  },
  checklistPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10
  },
  checklistRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  checkBox: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    width: 58
  },
  checkBoxActive: {
    backgroundColor: "#1f5262"
  },
  checkBoxText: {
    color: "#1f5262",
    fontSize: 11,
    fontWeight: "900"
  },
  checklistName: {
    color: "#18262c",
    flex: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  checklistExpected: {
    color: "#607078",
    fontSize: 11,
    fontWeight: "800"
  },
  checklistCountInput: {
    minHeight: 36,
    width: 68
  },
  completionText: {
    color: "#315748",
    fontSize: 12,
    fontWeight: "900"
  },
  input: {
    backgroundColor: "#f8fafb",
    borderColor: "#c9d4d8",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  notes: {
    minHeight: 116,
    textAlignVertical: "top"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  historyPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 12
  },
  historyCategory: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    gap: 5,
    padding: 10
  },
  historyCategoryTitle: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900"
  },
  historyText: {
    color: "#52656e",
    fontSize: 12,
    fontWeight: "800"
  },
  historyWarningText: {
    color: "#9a3f00"
  },
  empty: {
    color: "#607078",
    fontSize: 14,
    fontWeight: "700"
  }
});
