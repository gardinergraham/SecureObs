import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  SecurityArea,
  SecurityCheckCategory,
  SecurityCheckFrequency,
  StaffMember,
  Ward
} from "../types/domain";
import { hasStaffRole } from "../utils/staffRole";

const frequencyOptions: Array<{ value: SecurityCheckFrequency; label: string; minutes: number }> = [
  { value: "per_shift", label: "Per shift", minutes: 8 * 60 },
  { value: "per_meal", label: "Per meal", minutes: 6 * 60 },
  { value: "daily", label: "Daily", minutes: 24 * 60 },
  { value: "weekly", label: "Weekly", minutes: 7 * 24 * 60 },
  { value: "weekly_ad_hoc", label: "Weekly + ad hoc", minutes: 7 * 24 * 60 },
  { value: "monthly", label: "Monthly", minutes: 30 * 24 * 60 }
];

const categoryOptions: Array<{ value: SecurityCheckCategory; label: string }> = [
  { value: "cutlery", label: "Cutlery checks" },
  { value: "ward_security", label: "Ward security" },
  { value: "level_1_patient_search", label: "Level 1 patient check" },
  { value: "level_1_room_locker_zone", label: "Room / locker / zone" },
  { value: "custom", label: "Custom" }
];

const standardChecks: Array<Pick<SecurityArea, "name" | "category" | "frequencyType" | "frequencyMinutes" | "requiresCount">> = [
  {
    name: "Cutlery checks",
    category: "cutlery",
    frequencyType: "per_meal",
    frequencyMinutes: 6 * 60,
    requiresCount: true
  },
  {
    name: "Ward security checks",
    category: "ward_security",
    frequencyType: "per_shift",
    frequencyMinutes: 8 * 60,
    requiresCount: false
  },
  {
    name: "Level 1 patient checks",
    category: "level_1_patient_search",
    frequencyType: "weekly_ad_hoc",
    frequencyMinutes: 7 * 24 * 60,
    requiresCount: false
  },
  {
    name: "Room / locker / zone checks",
    category: "level_1_room_locker_zone",
    frequencyType: "per_shift",
    frequencyMinutes: 8 * 60,
    requiresCount: false
  }
];

type SecurityCheckSettingsScreenProps = {
  areas: SecurityArea[];
  selectedStaffId: string;
  selectedWardId: string;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onSaveArea: (area: SecurityArea) => Promise<void>;
};

export function SecurityCheckSettingsScreen({
  areas,
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onBack,
  onSaveArea
}: SecurityCheckSettingsScreenProps) {
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit = hasStaffRole(selectedStaff, "manager");
  const wardAreas = useMemo(
    () => areas.filter((area) => area.wardId === selectedWardId).sort((left, right) => left.name.localeCompare(right.name)),
    [areas, selectedWardId]
  );
  const [editingAreaId, setEditingAreaId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SecurityCheckCategory>("custom");
  const [frequencyType, setFrequencyType] = useState<SecurityCheckFrequency>("per_shift");
  const [requiresCount, setRequiresCount] = useState(false);
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectArea = (area: SecurityArea) => {
    setEditingAreaId(area.id);
    setName(area.name);
    setCategory(area.category ?? "custom");
    setFrequencyType(area.frequencyType ?? inferFrequencyType(area.frequencyMinutes));
    setRequiresCount(area.requiresCount);
    setActive(area.active !== false);
  };

  const clearDraft = () => {
    setEditingAreaId("");
    setName("");
    setCategory("custom");
    setFrequencyType("per_shift");
    setRequiresCount(false);
    setActive(true);
  };

  const saveArea = async () => {
    if (!selectedWard || !canEdit) return;
    if (!name.trim()) {
      Alert.alert("Check name needed", "Enter a name for this security check.");
      return;
    }

    const frequency = getFrequencyOption(frequencyType);
    const area: SecurityArea = {
      id: editingAreaId || `security-area-${selectedWard.id}-${Date.now()}`,
      wardId: selectedWard.id,
      name: name.trim(),
      category,
      frequencyType,
      frequencyMinutes: frequency.minutes,
      requiresCount,
      active
    };

    setIsSaving(true);
    try {
      await onSaveArea(area);
      clearDraft();
      Alert.alert("Security check saved", `${area.name} has been saved for ${selectedWard.name}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const addStandardChecks = async () => {
    if (!selectedWard || !canEdit || isSaving) return;
    setIsSaving(true);
    try {
      for (const check of standardChecks) {
        const existing = wardAreas.find((area) => area.category === check.category);
        await onSaveArea({
          id: existing?.id ?? `security-area-${selectedWard.id}-${check.category}`,
          wardId: selectedWard.id,
          name: existing?.name ?? check.name,
          category: check.category,
          frequencyType: check.frequencyType,
          frequencyMinutes: check.frequencyMinutes,
          requiresCount: check.requiresCount,
          active: true
        });
      }
      Alert.alert("Basic checks added", `The standard checks are ready for ${selectedWard.name}.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Security check setup</Text>
          <Text style={styles.meta}>
            {selectedWard?.name ?? "Select a ward"} | {canEdit ? "Manager access" : "Manager locked"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to ward settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Ward checks</Text>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEdit || isSaving}
              onPress={addStandardChecks}
              style={[styles.secondaryButton, (!canEdit || isSaving) && styles.disabledControl]}
            >
              <Text style={styles.secondaryButtonText}>Add basic checks</Text>
            </TouchableOpacity>
          </View>
          {wardAreas.length === 0 ? (
            <Text style={styles.empty}>No security checks configured for this ward.</Text>
          ) : (
            wardAreas.map((area) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit}
                key={area.id}
                onPress={() => selectArea(area)}
                style={[styles.areaRow, editingAreaId === area.id && styles.areaRowActive]}
              >
                <View style={styles.areaText}>
                  <Text style={styles.areaName}>{area.name}</Text>
                  <Text style={styles.areaMeta}>
                    {formatCategory(area.category)} | {formatFrequency(area.frequencyType, area.frequencyMinutes)}
                  </Text>
                  <Text style={styles.areaMeta}>{area.requiresCount ? "Count required" : "Visual/checklist record"}</Text>
                </View>
                <Text style={[styles.statusBadge, area.active === false && styles.statusBadgeInactive]}>
                  {area.active === false ? "Off" : "On"}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{editingAreaId ? "Edit security check" : "Add security check"}</Text>
          <TextInput
            editable={canEdit}
            onChangeText={setName}
            placeholder="Check name"
            placeholderTextColor="#6f7f87"
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Type</Text>
          <View style={styles.optionRow}>
            {categoryOptions.map((option) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit}
                key={option.value}
                onPress={() => setCategory(option.value)}
                style={[styles.optionButton, category === option.value && styles.optionButtonActive, !canEdit && styles.disabledControl]}
              >
                <Text style={[styles.optionText, category === option.value && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Frequency</Text>
          <View style={styles.optionRow}>
            {frequencyOptions.map((option) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit}
                key={option.value}
                onPress={() => setFrequencyType(option.value)}
                style={[
                  styles.optionButton,
                  frequencyType === option.value && styles.optionButtonActive,
                  !canEdit && styles.disabledControl
                ]}
              >
                <Text style={[styles.optionText, frequencyType === option.value && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.optionRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEdit}
              onPress={() => setRequiresCount((value) => !value)}
              style={[styles.statusButton, requiresCount && styles.optionButtonActive, !canEdit && styles.disabledControl]}
            >
              <Text style={[styles.optionText, requiresCount && styles.optionTextActive]}>
                {requiresCount ? "Count required" : "No count"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEdit}
              onPress={() => setActive((value) => !value)}
              style={[styles.statusButton, active && styles.optionButtonActive, !canEdit && styles.disabledControl]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{active ? "Active" : "Inactive"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            disabled={!canEdit || isSaving}
            onPress={saveArea}
            style={[styles.saveButton, (!canEdit || isSaving) && styles.disabledControl]}
          >
            <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : editingAreaId ? "Update check" : "Add check"}</Text>
          </TouchableOpacity>
          {editingAreaId ? (
            <TouchableOpacity accessibilityRole="button" onPress={clearDraft} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear selection</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function inferFrequencyType(frequencyMinutes: number): SecurityCheckFrequency {
  if (frequencyMinutes >= 30 * 24 * 60) return "monthly";
  if (frequencyMinutes >= 7 * 24 * 60) return "weekly";
  if (frequencyMinutes >= 24 * 60) return "daily";
  if (frequencyMinutes >= 6 * 60) return "per_meal";
  return "per_shift";
}

function getFrequencyOption(frequencyType: SecurityCheckFrequency) {
  return frequencyOptions.find((option) => option.value === frequencyType) ?? {
    value: "per_shift" as const,
    label: "Per shift",
    minutes: 8 * 60
  };
}

function formatCategory(category: SecurityCheckCategory | undefined) {
  return categoryOptions.find((option) => option.value === category)?.label ?? "Custom";
}

function formatFrequency(frequencyType: SecurityCheckFrequency | undefined, frequencyMinutes: number) {
  const option = frequencyOptions.find((item) => item.value === frequencyType);
  return option ? option.label : `Every ${frequencyMinutes}m`;
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
  split: { flexDirection: "row", gap: 12 },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 10,
    padding: 12
  },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  panelTitle: { color: "#18262c", fontSize: 16, fontWeight: "900" },
  empty: { color: "#607078", fontSize: 13, fontWeight: "800" },
  areaRow: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10
  },
  areaRowActive: { backgroundColor: "#e8f2f5", borderColor: "#1f5262" },
  areaText: { flex: 1, paddingRight: 8 },
  areaName: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  areaMeta: { color: "#607078", fontSize: 12, fontWeight: "800", marginTop: 3 },
  statusBadge: {
    backgroundColor: "#dcead7",
    borderRadius: 6,
    color: "#253e2c",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  statusBadgeInactive: { backgroundColor: "#eef1f2", color: "#607078" },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 10
  },
  label: { color: "#31454d", fontSize: 13, fontWeight: "900", marginTop: 4 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 11
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#30434a", fontSize: 13, fontWeight: "900" },
  optionTextActive: { color: "#ffffff" },
  statusButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44
  },
  saveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  secondaryButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  clearButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38
  },
  clearButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  disabledControl: { opacity: 0.45 }
});
