import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  SecurityArea,
  SecurityCheckCategory,
  SecurityCheckFrequency,
  SecurityCheckTargetType,
  SecurityExpectedItems,
  StaffMember,
  Ward
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

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
  { value: "level_1_room_locker_zone", label: "Patient room / locker / zone" },
  { value: "custom", label: "Custom" }
];
const targetTypeOptions: Array<{ value: SecurityCheckTargetType; label: string }> = [
  { value: "ward", label: "Ward check" },
  { value: "patient", label: "Patient specific" },
  { value: "items", label: "Item checklist" }
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
    name: "Patient room / locker / zone checks",
    category: "level_1_room_locker_zone",
    frequencyType: "per_shift",
    frequencyMinutes: 8 * 60,
    requiresCount: false
  }
];
const defaultChecklistItems = ["Radios", "Cameras", "Razors", "Toothbrushes"];

type SecurityCheckSettingsScreenProps = {
  areas: SecurityArea[];
  selectedStaffId: string;
  selectedWardId: string;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onDeleteArea: (areaId: string) => Promise<boolean>;
  onSaveArea: (area: SecurityArea) => Promise<boolean>;
};

export function SecurityCheckSettingsScreen({
  areas,
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onBack,
  onDeleteArea,
  onSaveArea
}: SecurityCheckSettingsScreenProps) {
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit = hasStaffRole(selectedStaff, "manager") || hasAdminAccess(selectedStaff);
  const wardAreas = useMemo(
    () => areas.filter((area) => area.wardId === selectedWardId).sort((left, right) => left.name.localeCompare(right.name)),
    [areas, selectedWardId]
  );
  const [editingAreaId, setEditingAreaId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SecurityCheckCategory>("custom");
  const [targetType, setTargetType] = useState<SecurityCheckTargetType>("ward");
  const [frequencyType, setFrequencyType] = useState<SecurityCheckFrequency>("per_shift");
  const [requiresCount, setRequiresCount] = useState(false);
  const [cutleryKnives, setCutleryKnives] = useState("");
  const [cutleryForks, setCutleryForks] = useState("");
  const [cutlerySpoons, setCutlerySpoons] = useState("");
  const [checklistDraft, setChecklistDraft] = useState(defaultChecklistItems.map((name) => ({ name, expectedCount: "" })));
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectArea = (area: SecurityArea) => {
    setEditingAreaId(area.id);
    setName(area.name);
    setCategory(area.category ?? "custom");
    setTargetType(inferTargetType(area));
    setFrequencyType(area.frequencyType ?? inferFrequencyType(area.frequencyMinutes));
    setRequiresCount(area.requiresCount);
    setCutleryKnives(String(area.expectedItems?.cutlery?.knives ?? ""));
    setCutleryForks(String(area.expectedItems?.cutlery?.forks ?? ""));
    setCutlerySpoons(String(area.expectedItems?.cutlery?.spoons ?? ""));
    setChecklistDraft(
      area.expectedItems?.checklist?.length
        ? area.expectedItems.checklist.map((item) => ({ name: item.name, expectedCount: String(item.expectedCount) }))
        : defaultChecklistItems.map((itemName) => ({ name: itemName, expectedCount: "" }))
    );
    setActive(area.active !== false);
  };

  const clearDraft = () => {
    setEditingAreaId("");
    setName("");
    setCategory("custom");
    setTargetType("ward");
    setFrequencyType("per_shift");
    setRequiresCount(false);
    setCutleryKnives("");
    setCutleryForks("");
    setCutlerySpoons("");
    setChecklistDraft(defaultChecklistItems.map((name) => ({ name, expectedCount: "" })));
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
      expectedItems: buildExpectedItems(category, targetType, cutleryKnives, cutleryForks, cutlerySpoons, checklistDraft),
      active
    };

    setIsSaving(true);
    try {
      const savedToServer = await onSaveArea(area);
      clearDraft();
      Alert.alert(
        savedToServer ? "Security check saved" : "Security check queued",
        savedToServer
          ? `${area.name} has been saved for ${selectedWard.name}.`
          : `${area.name} is saved on this device and will upload when the connection is restored.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addStandardChecks = async () => {
    if (!selectedWard || !canEdit || isSaving) return;
    setIsSaving(true);
    try {
      let allSavedToServer = true;
      for (const check of standardChecks) {
        const existing = wardAreas.find((area) => area.category === check.category);
        const savedToServer = await onSaveArea({
          id: existing?.id ?? `security-area-${selectedWard.id}-${check.category}`,
          wardId: selectedWard.id,
          name: existing?.name ?? check.name,
          category: check.category,
          frequencyType: check.frequencyType,
          frequencyMinutes: check.frequencyMinutes,
          requiresCount: check.requiresCount,
          expectedItems: defaultExpectedItemsForCategory(check.category),
          active: true
        });
        allSavedToServer = allSavedToServer && savedToServer;
      }
      Alert.alert(
        allSavedToServer ? "Basic checks added" : "Basic checks queued",
        allSavedToServer
          ? `The standard checks are ready for ${selectedWard.name}.`
          : "The standard checks are saved on this device and will upload when the connection is restored."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteArea = () => {
    if (!editingAreaId || !canEdit || isSaving) return;
    const areaName = name.trim() || "this security check";
    Alert.alert(
      "Remove security check?",
      `${areaName} will be removed from this ward. Existing completed-check history will be retained.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void deleteArea(editingAreaId, areaName);
          }
        }
      ]
    );
  };

  const deleteArea = async (areaId: string, areaName: string) => {
    setIsSaving(true);
    try {
      const removedFromServer = await onDeleteArea(areaId);
      clearDraft();
      Alert.alert(
        removedFromServer ? "Security check removed" : "Removal queued",
        removedFromServer
          ? `${areaName} has been removed.`
          : `${areaName} is removed on this device and will be deleted from the server when the connection is restored.`
      );
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
                  {area.category === "cutlery" ? (
                    <Text style={styles.expectedSummary}>
                      Expected: {area.expectedItems?.cutlery?.knives ?? 0} knives ·{" "}
                      {area.expectedItems?.cutlery?.forks ?? 0} forks ·{" "}
                      {area.expectedItems?.cutlery?.spoons ?? 0} spoons
                    </Text>
                  ) : null}
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
                onPress={() => {
                  setCategory(option.value);
                  setTargetType(defaultTargetTypeForCategory(option.value));
                }}
                style={[styles.optionButton, category === option.value && styles.optionButtonActive, !canEdit && styles.disabledControl]}
              >
                <Text style={[styles.optionText, category === option.value && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Check applies to</Text>
          <View style={styles.optionRow}>
            {targetTypeOptions.map((option) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit || category === "cutlery"}
                key={option.value}
                onPress={() => setTargetType(option.value)}
                style={[
                  styles.optionButton,
                  targetType === option.value && styles.optionButtonActive,
                  (!canEdit || category === "cutlery") && styles.disabledControl
                ]}
              >
                <Text style={[styles.optionText, targetType === option.value && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {category === "cutlery" ? (
            <View style={styles.configPanel}>
              <Text style={styles.label}>Expected cutlery</Text>
              <View style={styles.threeColumnRow}>
                <View style={styles.expectedCountField}>
                  <Text style={styles.expectedCountLabel}>Knives expected</Text>
                  <TextInput
                    accessibilityLabel="Expected knives"
                    blurOnSubmit={false}
                    editable={canEdit}
                    keyboardType="number-pad"
                    onChangeText={setCutleryKnives}
                    placeholder="0"
                    placeholderTextColor="#6f7f87"
                    style={[styles.input, styles.smallInput]}
                    value={cutleryKnives}
                  />
                </View>
                <View style={styles.expectedCountField}>
                  <Text style={styles.expectedCountLabel}>Forks expected</Text>
                  <TextInput
                    accessibilityLabel="Expected forks"
                    blurOnSubmit={false}
                    editable={canEdit}
                    keyboardType="number-pad"
                    onChangeText={setCutleryForks}
                    placeholder="0"
                    placeholderTextColor="#6f7f87"
                    style={[styles.input, styles.smallInput]}
                    value={cutleryForks}
                  />
                </View>
                <View style={styles.expectedCountField}>
                  <Text style={styles.expectedCountLabel}>Spoons expected</Text>
                  <TextInput
                    accessibilityLabel="Expected spoons"
                    blurOnSubmit={false}
                    editable={canEdit}
                    keyboardType="number-pad"
                    onChangeText={setCutlerySpoons}
                    placeholder="0"
                    placeholderTextColor="#6f7f87"
                    style={[styles.input, styles.smallInput]}
                    value={cutlerySpoons}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {targetType === "items" ? (
            <View style={styles.configPanel}>
              <Text style={styles.label}>Checklist items</Text>
              {checklistDraft.map((item, index) => (
                <View key={`checklist-draft-${index}`} style={styles.checklistConfigRow}>
                  <TextInput
                    editable={canEdit}
                    onChangeText={(name) => updateChecklistDraft(index, { name })}
                    placeholder="Item name"
                    placeholderTextColor="#6f7f87"
                    style={[styles.input, styles.itemNameInput]}
                    value={item.name}
                  />
                  <TextInput
                    blurOnSubmit={false}
                    editable={canEdit}
                    keyboardType="number-pad"
                    onChangeText={(expectedCount) => updateChecklistDraft(index, { expectedCount })}
                    placeholder="No."
                    placeholderTextColor="#6f7f87"
                    style={[styles.input, styles.countInput]}
                    value={item.expectedCount}
                  />
                </View>
              ))}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit}
                onPress={() => setChecklistDraft((current) => [...current, { name: "", expectedCount: "" }])}
                style={[styles.secondaryButton, !canEdit && styles.disabledControl]}
              >
                <Text style={styles.secondaryButtonText}>Add checklist item</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
            <>
              <TouchableOpacity accessibilityRole="button" onPress={clearDraft} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear selection</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit || isSaving}
                onPress={confirmDeleteArea}
                style={[styles.deleteButton, (!canEdit || isSaving) && styles.disabledControl]}
              >
                <Text style={styles.deleteButtonText}>Remove saved check</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );

  function updateChecklistDraft(index: number, update: Partial<{ name: string; expectedCount: string }>) {
    setChecklistDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...update } : item)));
  }
}

function inferFrequencyType(frequencyMinutes: number): SecurityCheckFrequency {
  if (frequencyMinutes >= 30 * 24 * 60) return "monthly";
  if (frequencyMinutes >= 7 * 24 * 60) return "weekly";
  if (frequencyMinutes >= 24 * 60) return "daily";
  if (frequencyMinutes >= 6 * 60) return "per_meal";
  return "per_shift";
}

function inferTargetType(area: SecurityArea): SecurityCheckTargetType {
  if (area.expectedItems?.targetType) return area.expectedItems.targetType;
  return defaultTargetTypeForCategory(area.category);
}

function defaultTargetTypeForCategory(category: SecurityCheckCategory | undefined): SecurityCheckTargetType {
  if (category === "cutlery" || category === "ward_security") return "items";
  if (category === "level_1_patient_search" || category === "level_1_room_locker_zone") return "patient";
  return "ward";
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

function buildExpectedItems(
  category: SecurityCheckCategory,
  targetType: SecurityCheckTargetType,
  knives: string,
  forks: string,
  spoons: string,
  checklistDraft: Array<{ name: string; expectedCount: string }>
): SecurityExpectedItems {
  if (category === "cutlery") {
    return {
      targetType: "items",
      cutlery: {
        knives: parseCount(knives),
        forks: parseCount(forks),
        spoons: parseCount(spoons)
      }
    };
  }

  if (targetType === "items") {
    return {
      targetType,
      checklist: checklistDraft
        .filter((item) => item.name.trim())
        .map((item) => ({
          id: createItemId(item.name),
          name: item.name.trim(),
          expectedCount: parseCount(item.expectedCount)
        }))
    };
  }

  return { targetType };
}

function defaultExpectedItemsForCategory(category: SecurityCheckCategory | undefined): SecurityExpectedItems {
  if (category === "cutlery") {
    return { targetType: "items", cutlery: { knives: 12, forks: 12, spoons: 8 } };
  }

  if (category === "ward_security") {
    return {
      targetType: "items",
      checklist: defaultChecklistItems.map((name) => ({ id: createItemId(name), name, expectedCount: 1 }))
    };
  }

  if (category === "level_1_patient_search" || category === "level_1_room_locker_zone") {
    return { targetType: "patient" };
  }

  return { targetType: "ward" };
}

function parseCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function createItemId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
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
  expectedSummary: { color: "#315c50", fontSize: 11, fontWeight: "900", marginTop: 5 },
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
  configPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    gap: 8,
    padding: 10
  },
  threeColumnRow: { flexDirection: "row", gap: 8 },
  expectedCountField: { flex: 1, gap: 5, minWidth: 92 },
  expectedCountLabel: { color: "#31454d", fontSize: 11, fontWeight: "900" },
  smallInput: { minWidth: 80, width: "100%" },
  checklistConfigRow: {
    flexDirection: "row",
    gap: 8
  },
  itemNameInput: { flex: 1 },
  countInput: { width: 72 },
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
  deleteButton: {
    alignItems: "center",
    borderColor: "#a7362d",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38
  },
  deleteButtonText: { color: "#a7362d", fontSize: 13, fontWeight: "900" },
  disabledControl: { opacity: 0.45 }
});
