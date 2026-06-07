import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { SecurityArea, SecurityCheck, StaffMember } from "../types/domain";

type SecurityChecksProps = {
  areas: SecurityArea[];
  checks: SecurityCheck[];
  selectedStaffId: string;
  staff: StaffMember[];
  wardName: string;
  onBack: () => void;
  onCreateCheck: (check: SecurityCheck) => void;
};

export function SecurityChecks({
  areas,
  checks,
  selectedStaffId,
  staff,
  wardName,
  onBack,
  onCreateCheck
}: SecurityChecksProps) {
  const [selectedAreaId, setSelectedAreaId] = useState(areas[0]?.id ?? "");
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

  const saveCheck = () => {
    if (!selectedArea) {
      return;
    }

    const parsedCount = Number.parseInt(countedTotal, 10);
    if (selectedArea.requiresCount && (Number.isNaN(parsedCount) || parsedCount < 0)) {
      Alert.alert("Count needed", "Enter the counted total before saving this check.");
      return;
    }

    const checkedBy = selectedStaff?.name ?? "Unknown";
    const checkedAt = new Date().toISOString();
    const check: SecurityCheck = {
      id: `security-${Date.now()}`,
      areaId: selectedArea.id,
      checkName: selectedArea.requiresCount ? `${selectedArea.name} count` : `${selectedArea.name} check`,
      checkedBy,
      checkedAt,
      notes: notes.trim() || "Complete",
      countedTotal: selectedArea.requiresCount ? parsedCount : undefined
    };

    onCreateCheck(check);
    setNotes("");
    setCountedTotal("");
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
                      Every {area.frequencyMinutes}m | {area.requiresCount ? "Count required" : "Visual check"}
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
                {selectedArea.requiresCount ? "This area needs a counted total." : "Record the check outcome."}
              </Text>

              {selectedArea.requiresCount ? (
                <>
                  <Text style={styles.label}>Counted total</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setCountedTotal}
                    placeholder="Enter total"
                    style={styles.input}
                    value={countedTotal}
                  />
                </>
              ) : null}

              <Text style={styles.label}>Notes</Text>
              <TextInput
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
    </View>
  );
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
  empty: {
    color: "#607078",
    fontSize: 14,
    fontWeight: "700"
  }
});
