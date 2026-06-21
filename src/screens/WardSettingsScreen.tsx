import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { StaffMember, Ward } from "../types/domain";

const shiftCountOptions = [1, 2, 3, 4];
const breakDurationOptions = [15, 30, 60];
const defaultRotaShifts = [
  { id: "shift-1", startsAt: "07:00", endsAt: "15:00" },
  { id: "shift-2", startsAt: "13:30", endsAt: "23:00" },
  { id: "shift-3", startsAt: "21:30", endsAt: "07:00" },
  { id: "shift-4", startsAt: "07:00", endsAt: "13:00" }
];
const fallbackRotaShift = { id: "shift-fallback", startsAt: "07:00", endsAt: "15:00" };

type WardSettingsScreenProps = {
  selectedStaffId: string;
  selectedWardId: string;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onUpdateWardInterval: (wardId: string, observationIntervalMinutes: number) => void;
  onUpdateWardRotaEnabled: (wardId: string, staffRotaEnabled: boolean) => void;
  onUpdateWardRotaSettings: (ward: Ward) => void;
  onCreateStaff: (staff: StaffMember) => Promise<void>;
};

export function WardSettingsScreen({
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onBack,
  onUpdateWardInterval,
  onUpdateWardRotaEnabled,
  onUpdateWardRotaSettings,
  onCreateStaff
}: WardSettingsScreenProps) {
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEditWardSettings = selectedStaff?.role === "manager";
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<StaffMember["role"]>("nurse");
  const [newStaffDesignation, setNewStaffDesignation] = useState("");
  const [newStaffCanPrescribe, setNewStaffCanPrescribe] = useState(false);
  const [newStaffActive, setNewStaffActive] = useState(true);
  const [newStaffEmploymentType, setNewStaffEmploymentType] = useState<StaffMember["employmentType"]>("permanent");
  const [newStaffAccessStartDate, setNewStaffAccessStartDate] = useState(() => formatInputDate(new Date()));
  const [newStaffAccessStartTime, setNewStaffAccessStartTime] = useState(() => formatInputTime(new Date()));
  const [newStaffAccessEndDate, setNewStaffAccessEndDate] = useState(() => formatInputDate(addHours(new Date(), 12)));
  const [newStaffAccessEndTime, setNewStaffAccessEndTime] = useState(() => formatInputTime(addHours(new Date(), 12)));
  const [newStaffLoginPin, setNewStaffLoginPin] = useState("");
  const [newStaffWardIds, setNewStaffWardIds] = useState<string[]>(selectedWardId ? [selectedWardId] : []);
  const [editingStaffId, setEditingStaffId] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const wardStaff = staff
    .filter((member) => member.allowedWardIds.includes(selectedWardId) || member.wardId === selectedWardId)
    .sort((left, right) => left.name.localeCompare(right.name));
  const filteredWardStaff = wardStaff
    .filter((member) => {
      const query = staffSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        member.name.toLowerCase().includes(query) ||
        member.staffCode.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      );
    })
    .slice(0, 20);

  const updateInterval = (minutes: number) => {
    if (!selectedWard || !canEditWardSettings) return;
    onUpdateWardInterval(selectedWard.id, Math.max(5, minutes));
  };

  const updateWardSettings = (updates: Partial<Ward>) => {
    if (!selectedWard || !canEditWardSettings) return;
    onUpdateWardRotaSettings({ ...selectedWard, ...updates });
  };

  const toggleRota = () => {
    if (!selectedWard || !canEditWardSettings) return;
    onUpdateWardRotaEnabled(selectedWard.id, !selectedWard.staffRotaEnabled);
  };

  const updateShiftCount = (shiftCount: number) => {
    if (!selectedWard || !canEditWardSettings) return;

    const rotaShifts = Array.from({ length: shiftCount }, (_, index) => {
      const existingShift = selectedWard.rotaShifts[index];
      const defaultShift = defaultRotaShifts[index] ?? fallbackRotaShift;

      return {
        id: existingShift?.id ?? `${selectedWard.id}-shift-${index + 1}`,
        startsAt: existingShift?.startsAt ?? defaultShift.startsAt,
        endsAt: existingShift?.endsAt ?? defaultShift.endsAt
      };
    });

    onUpdateWardRotaSettings({ ...selectedWard, rotaShiftCount: shiftCount, rotaShifts });
  };

  const updateShiftTime = (shiftId: string, field: "startsAt" | "endsAt", value: string) => {
    if (!selectedWard || !canEditWardSettings) return;

    onUpdateWardRotaSettings({
      ...selectedWard,
      rotaShifts: selectedWard.rotaShifts.map((shift) =>
        shift.id === shiftId ? { ...shift, [field]: value } : shift
      )
    });
  };

  const updateBreakDuration = (breakDurationMinutes: number) => {
    if (!selectedWard || !canEditWardSettings) return;
    onUpdateWardRotaSettings({ ...selectedWard, breakDurationMinutes });
  };

  const selectStaffForEditing = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setNewStaffName(member.name);
    setNewStaffCode(member.staffCode);
    setNewStaffRole(member.role);
    setNewStaffDesignation(member.designation ?? "");
    setNewStaffCanPrescribe(Boolean(member.canPrescribe));
    setNewStaffActive(member.active !== false);
    setNewStaffEmploymentType(member.employmentType ?? "permanent");
    setNewStaffLoginPin(member.loginPin ?? "");
    const startDate = member.accessStartsAt ? new Date(member.accessStartsAt) : new Date();
    const endDate = member.accessExpiresAt ? new Date(member.accessExpiresAt) : addHours(new Date(), 12);
    setNewStaffAccessStartDate(formatInputDate(startDate));
    setNewStaffAccessStartTime(formatInputTime(startDate));
    setNewStaffAccessEndDate(formatInputDate(endDate));
    setNewStaffAccessEndTime(formatInputTime(endDate));
    setNewStaffWardIds(member.allowedWardIds.length > 0 ? member.allowedWardIds : [member.wardId]);
  };

  const clearStaffDraft = () => {
    setEditingStaffId("");
    setNewStaffName("");
    setNewStaffCode("");
    setNewStaffRole("nurse");
    setNewStaffDesignation("");
    setNewStaffCanPrescribe(false);
    setNewStaffActive(true);
    setNewStaffEmploymentType("permanent");
    setNewStaffAccessStartDate(formatInputDate(new Date()));
    setNewStaffAccessStartTime(formatInputTime(new Date()));
    setNewStaffAccessEndDate(formatInputDate(addHours(new Date(), 12)));
    setNewStaffAccessEndTime(formatInputTime(addHours(new Date(), 12)));
    setNewStaffLoginPin("");
    setNewStaffWardIds(selectedWardId ? [selectedWardId] : []);
  };

  const toggleStaffWard = (wardId: string) => {
    setNewStaffWardIds((currentWardIds) => {
      if (currentWardIds.includes(wardId)) {
        const nextWardIds = currentWardIds.filter((currentWardId) => currentWardId !== wardId);
        return nextWardIds.length > 0 ? nextWardIds : currentWardIds;
      }

      return [...currentWardIds, wardId];
    });
  };

  const saveWardStaff = async () => {
    if (!selectedWard || !selectedStaff || !canEditWardSettings) return;
    if (!newStaffName.trim() || !newStaffCode.trim()) {
      Alert.alert("Staff details needed", "Enter the staff name and STAFFCODE before saving.");
      return;
    }
    if (newStaffWardIds.length === 0) {
      Alert.alert("Ward access needed", "Select at least one ward for this staff member.");
      return;
    }
    if (newStaffEmploymentType === "bank" && !newStaffLoginPin.trim()) {
      Alert.alert("PIN needed", "Enter a temporary login PIN for bank staff.");
      return;
    }
    const accessStartsAt =
      newStaffEmploymentType === "bank"
        ? buildIsoFromDateAndTime(newStaffAccessStartDate, newStaffAccessStartTime)
        : undefined;
    const accessExpiresAt =
      newStaffEmploymentType === "bank"
        ? buildIsoFromDateAndTime(newStaffAccessEndDate, newStaffAccessEndTime)
        : undefined;
    if (newStaffEmploymentType === "bank" && (!accessStartsAt || !accessExpiresAt)) {
      Alert.alert("Access dates needed", "Enter valid start and end date/time for bank staff access.");
      return;
    }
    if (accessStartsAt && accessExpiresAt && new Date(accessExpiresAt).getTime() <= new Date(accessStartsAt).getTime()) {
      Alert.alert("Access dates invalid", "The end date/time must be after the start date/time.");
      return;
    }

    const primaryWard = wards.find((ward) => ward.id === newStaffWardIds[0]) ?? selectedWard;
    const allowedSiteIds = Array.from(
      new Set(
        newStaffWardIds
          .map((wardId) => wards.find((ward) => ward.id === wardId)?.siteId)
          .filter((siteId): siteId is string => Boolean(siteId))
      )
    );

    const staffMember: StaffMember = {
      id: editingStaffId || `staff-${newStaffCode.trim().toLowerCase()}`,
      organisationId: selectedStaff.organisationId,
      keyNumber: Date.now() % 100000,
      staffCode: newStaffCode.trim(),
      name: newStaffName.trim(),
      role: newStaffRole,
      designation: newStaffDesignation.trim() || defaultDesignation(newStaffRole),
      canPrescribe: newStaffRole === "doctor" && newStaffCanPrescribe,
      employmentType: newStaffEmploymentType,
      accessStartsAt,
      accessExpiresAt,
      loginPin: newStaffEmploymentType === "bank" ? newStaffLoginPin.trim() : undefined,
      wardId: primaryWard.id,
      allowedSiteIds,
      allowedWardIds: newStaffWardIds,
      active: newStaffActive
    };

    setIsSavingStaff(true);
    try {
      await onCreateStaff(staffMember);
      clearStaffDraft();
      Alert.alert("Staff saved", `${staffMember.name} can use STAFFCODE ${staffMember.staffCode}.`);
    } finally {
      setIsSavingStaff(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ward settings</Text>
          <Text style={styles.meta}>
            {selectedWard?.name ?? "Select a ward"} | {canEditWardSettings ? "Manager access" : "Manager locked"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to start</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <View style={styles.staffSetupPanel}>
          <Text style={styles.settingLabel}>Ward staff setup</Text>
          <Text style={styles.meta}>
            Add, edit or deactivate staff for {selectedWard?.name ?? "this ward"}.
          </Text>
          <View style={styles.staffPickerHeader}>
            <TextInput
              autoCapitalize="none"
              editable={canEditWardSettings}
              onChangeText={setStaffSearch}
              placeholder="Search staff by name, STAFFCODE or role"
              style={[styles.input, styles.staffSearchInput]}
              value={staffSearch}
            />
            <TouchableOpacity accessibilityRole="button" onPress={clearStaffDraft} style={styles.addNewButton}>
              <Text style={styles.addNewButtonText}>Add new</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.staffList}>
            {filteredWardStaff.map((member) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEditWardSettings}
                key={member.id}
                onPress={() => selectStaffForEditing(member)}
                style={[styles.staffRow, editingStaffId === member.id && styles.staffRowActive]}
              >
                <View style={styles.staffRowText}>
                  <Text style={styles.staffName}>{member.name}</Text>
                  <Text style={styles.staffMeta}>
                    {member.staffCode} | {member.role} | {member.employmentType === "bank" ? "bank" : "permanent"} |{" "}
                    {member.active === false ? "inactive" : accessStatus(member)}
                  </Text>
                </View>
                {member.canPrescribe ? <Text style={styles.prescriberBadge}>Rx</Text> : null}
              </TouchableOpacity>
            ))}
            {wardStaff.length > filteredWardStaff.length ? (
              <Text style={styles.staffMeta}>Showing first {filteredWardStaff.length} matches. Refine the search to narrow the list.</Text>
            ) : null}
          </View>
          <TextInput
            editable={canEditWardSettings}
            onChangeText={setNewStaffName}
            placeholder="Staff name"
            style={styles.input}
            value={newStaffName}
          />
          <TextInput
            autoCapitalize="none"
            editable={canEditWardSettings}
            onChangeText={setNewStaffCode}
            placeholder="STAFFCODE"
            style={styles.input}
            value={newStaffCode}
          />
          <TextInput
            editable={canEditWardSettings}
            onChangeText={setNewStaffDesignation}
            placeholder="Designation"
            style={styles.input}
            value={newStaffDesignation}
          />
          <View style={styles.optionRow}>
            {(["nurse", "hcf", "security", "doctor"] as StaffMember["role"][]).map((role) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEditWardSettings}
                key={role}
                onPress={() => {
                  setNewStaffRole(role);
                  if (role !== "doctor") {
                    setNewStaffCanPrescribe(false);
                  }
                }}
                style={[
                  styles.optionButton,
                  newStaffRole === role && styles.optionButtonActive,
                  !canEditWardSettings && styles.disabledControl
                ]}
              >
                <Text style={[styles.optionText, newStaffRole === role && styles.optionTextActive]}>{role}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.subLabel}>Ward access</Text>
          <View style={styles.optionRow}>
            {wards.map((ward) => {
              const active = newStaffWardIds.includes(ward.id);
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEditWardSettings}
                  key={ward.id}
                  onPress={() => toggleStaffWard(ward.id)}
                  style={[styles.optionButton, active && styles.optionButtonActive, !canEditWardSettings && styles.disabledControl]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{ward.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.optionRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEditWardSettings}
              onPress={() => setNewStaffEmploymentType("permanent")}
              style={[
                styles.statusButton,
                newStaffEmploymentType !== "bank" && styles.statusButtonActive,
                !canEditWardSettings && styles.disabledControl
              ]}
            >
              <Text style={[styles.statusButtonText, newStaffEmploymentType !== "bank" && styles.optionTextActive]}>
                Permanent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEditWardSettings}
              onPress={() => setNewStaffEmploymentType("bank")}
              style={[
                styles.statusButton,
                newStaffEmploymentType === "bank" && styles.statusButtonActive,
                !canEditWardSettings && styles.disabledControl
              ]}
            >
              <Text style={[styles.statusButtonText, newStaffEmploymentType === "bank" && styles.optionTextActive]}>
                Bank/temp
              </Text>
            </TouchableOpacity>
          </View>
          {newStaffEmploymentType === "bank" ? (
            <>
              <TextInput
                autoCapitalize="none"
                editable={canEditWardSettings}
                keyboardType="number-pad"
                onChangeText={setNewStaffLoginPin}
                placeholder="Temporary login PIN"
                style={styles.input}
                value={newStaffLoginPin}
              />
              <Text style={styles.subLabel}>Temporary access window</Text>
              <View style={styles.dateTimeGrid}>
                <TextInput
                  editable={canEditWardSettings}
                  onChangeText={setNewStaffAccessStartDate}
                  placeholder="Start date dd/mm/yyyy"
                  style={[styles.input, styles.dateTimeInput]}
                  value={newStaffAccessStartDate}
                />
                <TextInput
                  editable={canEditWardSettings}
                  onChangeText={setNewStaffAccessStartTime}
                  placeholder="Start time hh:mm"
                  style={[styles.input, styles.dateTimeInput]}
                  value={newStaffAccessStartTime}
                />
                <TextInput
                  editable={canEditWardSettings}
                  onChangeText={setNewStaffAccessEndDate}
                  placeholder="End date dd/mm/yyyy"
                  style={[styles.input, styles.dateTimeInput]}
                  value={newStaffAccessEndDate}
                />
                <TextInput
                  editable={canEditWardSettings}
                  onChangeText={setNewStaffAccessEndTime}
                  placeholder="End time hh:mm"
                  style={[styles.input, styles.dateTimeInput]}
                  value={newStaffAccessEndTime}
                />
              </View>
            </>
          ) : null}
          <View style={styles.optionRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEditWardSettings}
              onPress={() => setNewStaffActive((active) => !active)}
              style={[styles.statusButton, newStaffActive && styles.statusButtonActive, !canEditWardSettings && styles.disabledControl]}
            >
              <Text style={[styles.statusButtonText, newStaffActive && styles.optionTextActive]}>
                {newStaffActive ? "Active" : "Inactive"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEditWardSettings || newStaffRole !== "doctor"}
              onPress={() => setNewStaffCanPrescribe((canPrescribe) => !canPrescribe)}
              style={[
                styles.statusButton,
                newStaffCanPrescribe && styles.statusButtonActive,
                (!canEditWardSettings || newStaffRole !== "doctor") && styles.disabledControl
              ]}
            >
              <Text style={[styles.statusButtonText, newStaffCanPrescribe && styles.optionTextActive]}>
                {newStaffCanPrescribe ? "Can prescribe" : "No prescribing"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!canEditWardSettings || isSavingStaff}
            onPress={saveWardStaff}
            style={[styles.saveStaffButton, (!canEditWardSettings || isSavingStaff) && styles.disabledControl]}
          >
            <Text style={styles.saveStaffButtonText}>
              {isSavingStaff ? "Saving..." : editingStaffId ? "Update staff member" : "Add staff member"}
            </Text>
          </TouchableOpacity>
          {editingStaffId ? (
            <TouchableOpacity accessibilityRole="button" onPress={clearStaffDraft} style={styles.clearStaffButton}>
              <Text style={styles.clearStaffButtonText}>Clear selection</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.serviceSummary}>
          <Text style={styles.settingLabel}>Service type</Text>
          <Text style={styles.serviceSummaryText}>{selectedWard?.serviceType ?? "Not set"}</Text>
        </View>

        <Text style={styles.settingLabel}>Ward modules</Text>
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.news2Enabled)}
          label="NEWS2"
          meta="NEWS2 charting and score history"
          onToggle={() => updateWardSettings({ news2Enabled: !selectedWard?.news2Enabled })}
        />
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.enhancedObservationsEnabled)}
          label="Enhanced observations"
          meta="TESO start, care plan, and enhanced observation entries"
          onToggle={() =>
            updateWardSettings({ enhancedObservationsEnabled: !selectedWard?.enhancedObservationsEnabled })
          }
        />
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.securityChecksEnabled)}
          label="Security checks"
          meta="Ward checkpoint recording"
          onToggle={() => updateWardSettings({ securityChecksEnabled: !selectedWard?.securityChecksEnabled })}
        />
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.medicationChartEnabled)}
          label="Medication chart"
          meta="Due medication prompts and recording"
          onToggle={() => updateWardSettings({ medicationChartEnabled: !selectedWard?.medicationChartEnabled })}
        />

        <Text style={styles.settingLabel}>Intermittent observation interval</Text>
        <View style={styles.optionRow}>
          {[15, 30, 60].map((minutes) => (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!selectedWard || !canEditWardSettings}
              key={minutes}
              onPress={() => updateInterval(minutes)}
              style={[
                styles.optionButton,
                selectedWard?.observationIntervalMinutes === minutes && styles.optionButtonActive,
                !canEditWardSettings && styles.disabledControl
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedWard?.observationIntervalMinutes === minutes && styles.optionTextActive
                ]}
              >
                {minutes} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.stepperRow}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={() => updateInterval((selectedWard?.observationIntervalMinutes ?? 15) - 5)}
            style={[styles.stepperButton, !canEditWardSettings && styles.disabledControl]}
          >
            <Text style={styles.stepperText}>-5</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{selectedWard?.observationIntervalMinutes ?? 0} minutes</Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={() => updateInterval((selectedWard?.observationIntervalMinutes ?? 15) + 5)}
            style={[styles.stepperButton, !canEditWardSettings && styles.disabledControl]}
          >
            <Text style={styles.stepperText}>+5</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingBlock}>
          <View>
            <Text style={styles.settingLabel}>Staff rota</Text>
            <Text style={styles.meta}>
              {selectedWard?.staffRotaEnabled ? "Rota page available for this ward" : "Rota hidden for this ward"}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={toggleRota}
            style={[
              styles.toggleButton,
              selectedWard?.staffRotaEnabled && styles.toggleButtonActive,
              !canEditWardSettings && styles.disabledControl
            ]}
          >
            <Text style={[styles.toggleText, selectedWard?.staffRotaEnabled && styles.optionTextActive]}>
              {selectedWard?.staffRotaEnabled ? "On" : "Off"}
            </Text>
          </TouchableOpacity>
        </View>

        {selectedWard?.staffRotaEnabled ? (
          <>
            <Text style={styles.settingLabel}>Shifts per day</Text>
            <View style={styles.optionRow}>
              {shiftCountOptions.map((shiftCount) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEditWardSettings}
                  key={shiftCount}
                  onPress={() => updateShiftCount(shiftCount)}
                  style={[
                    styles.optionButton,
                    styles.compactButton,
                    selectedWard.rotaShiftCount === shiftCount && styles.optionButtonActive,
                    !canEditWardSettings && styles.disabledControl
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedWard.rotaShiftCount === shiftCount && styles.optionTextActive
                    ]}
                  >
                    {shiftCount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedWard.rotaShifts.map((shift, index) => (
              <View key={shift.id} style={styles.shiftBlock}>
                <Text style={styles.shiftTitle}>Shift {index + 1}</Text>
                <TimeSettingRow
                  disabled={!canEditWardSettings}
                  label="Start"
                  selected={shift.startsAt}
                  onSelect={(value) => updateShiftTime(shift.id, "startsAt", value)}
                />
                <TimeSettingRow
                  disabled={!canEditWardSettings}
                  label="End"
                  selected={shift.endsAt}
                  onSelect={(value) => updateShiftTime(shift.id, "endsAt", value)}
                />
              </View>
            ))}

            <Text style={styles.settingLabel}>Break duration</Text>
            <View style={styles.optionRow}>
              {breakDurationOptions.map((minutes) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEditWardSettings}
                  key={minutes}
                  onPress={() => updateBreakDuration(minutes)}
                  style={[
                    styles.optionButton,
                    selectedWard.breakDurationMinutes === minutes && styles.optionButtonActive,
                    !canEditWardSettings && styles.disabledControl
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedWard.breakDurationMinutes === minutes && styles.optionTextActive
                    ]}
                  >
                    {minutes === 60 ? "1 hour" : `${minutes} min`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

type FeatureToggleProps = {
  disabled: boolean;
  enabled: boolean;
  label: string;
  meta: string;
  onToggle: () => void;
};

function FeatureToggle({ disabled, enabled, label, meta, onToggle }: FeatureToggleProps) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureText}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureMeta}>{meta}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={disabled}
        onPress={onToggle}
        style={[styles.toggleButton, enabled && styles.toggleButtonActive, disabled && styles.disabledControl]}
      >
        <Text style={[styles.toggleText, enabled && styles.optionTextActive]}>{enabled ? "On" : "Off"}</Text>
      </TouchableOpacity>
    </View>
  );
}

type TimeSettingRowProps = {
  disabled: boolean;
  label: string;
  selected: string;
  onSelect: (value: string) => void;
};

function TimeSettingRow({ disabled, label, selected, onSelect }: TimeSettingRowProps) {
  return (
    <View style={styles.timeSettingRow}>
      <Text style={styles.timeSettingLabel}>{label}</Text>
      <View style={styles.timeStepper}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelect(shiftTimeByMinutes(selected, -30))}
          style={[styles.timeStepButton, disabled && styles.disabledControl]}
        >
          <Text style={styles.timeStepButtonText}>-</Text>
        </TouchableOpacity>
        <View style={styles.timeValueBox}>
          <Text style={styles.timeValueText}>{selected}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelect(shiftTimeByMinutes(selected, 30))}
          style={[styles.timeStepButton, disabled && styles.disabledControl]}
        >
          <Text style={styles.timeStepButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function shiftTimeByMinutes(time: string, deltaMinutes: number) {
  const [hourText = "0", minuteText = "0"] = time.split(":");
  const totalMinutes = Number(hourText) * 60 + Number(minuteText);
  const minutesInDay = 24 * 60;
  const nextTotalMinutes = (totalMinutes + deltaMinutes + minutesInDay) % minutesInDay;
  const nextHours = Math.floor(nextTotalMinutes / 60);
  const nextMinutes = nextTotalMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function defaultDesignation(role: StaffMember["role"]) {
  if (role === "hcf") return "HCF";
  if (role === "nurse") return "Nurse";
  if (role === "doctor") return "Doctor";
  if (role === "security") return "Security";
  return "Manager";
}

function accessStatus(member: StaffMember) {
  if (member.employmentType !== "bank") {
    return "active";
  }

  const startsAt = member.accessStartsAt ? new Date(member.accessStartsAt).getTime() : undefined;
  if (startsAt && !Number.isNaN(startsAt) && startsAt > Date.now()) {
    return `starts ${new Date(startsAt).toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }

  if (!member.accessExpiresAt) {
    return "bank active";
  }

  const expiresAt = new Date(member.accessExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return "bank active";
  }

  if (expiresAt <= Date.now()) {
    return "expired";
  }

  return `expires ${new Date(member.accessExpiresAt).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function formatInputDate(value: Date) {
  if (Number.isNaN(value.getTime())) return "";
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
}

function formatInputTime(value: Date) {
  if (Number.isNaN(value.getTime())) return "";
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function buildIsoFromDateAndTime(dateText: string, timeText: string) {
  const [dayText, monthText, yearText] = dateText.trim().split(/[/-]/);
  const [hourText, minuteText = "0"] = timeText.trim().split(":");
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return undefined;
  }

  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    return undefined;
  }

  return value.toISOString();
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
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14
  },
  staffSetupPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
    padding: 12
  },
  staffPickerHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  staffSearchInput: { flex: 1 },
  addNewButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  addNewButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  staffList: { gap: 7 },
  staffRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 9
  },
  staffRowActive: { backgroundColor: "#e8f2f5", borderColor: "#1f5262" },
  staffRowText: { flex: 1, paddingRight: 8 },
  staffName: { color: "#18262c", fontSize: 13, fontWeight: "900" },
  staffMeta: { color: "#607078", fontSize: 11, fontWeight: "800", marginTop: 2 },
  prescriberBadge: {
    backgroundColor: "#dcead7",
    borderRadius: 6,
    color: "#253e2c",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
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
  dateTimeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateTimeInput: { flexBasis: "48%", flexGrow: 1 },
  subLabel: { color: "#31454d", fontSize: 12, fontWeight: "900", marginTop: 2 },
  statusButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12
  },
  statusButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  statusButtonText: { color: "#30434a", fontSize: 13, fontWeight: "900" },
  saveStaffButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44
  },
  saveStaffButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  clearStaffButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38
  },
  clearStaffButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  serviceSummary: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    padding: 10
  },
  serviceSummaryText: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  settingLabel: { color: "#31454d", fontSize: 13, fontWeight: "900", marginBottom: 8, marginTop: 12 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 86,
    paddingHorizontal: 12
  },
  compactButton: { minWidth: 46 },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#30434a", fontSize: 14, fontWeight: "900" },
  optionTextActive: { color: "#ffffff" },
  disabledControl: { opacity: 0.45 },
  featureRow: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: 10
  },
  featureText: { flex: 1, paddingRight: 10 },
  featureLabel: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  featureMeta: { color: "#607078", fontSize: 12, fontWeight: "800", marginTop: 3 },
  stepperRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 10 },
  stepperButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 58
  },
  stepperText: { color: "#1f5262", fontSize: 15, fontWeight: "900" },
  stepperValue: { color: "#30434a", fontSize: 14, fontWeight: "900", minWidth: 92, textAlign: "center" },
  settingBlock: {
    alignItems: "center",
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12
  },
  toggleButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 70
  },
  toggleButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  toggleText: { color: "#30434a", fontSize: 14, fontWeight: "900" },
  shiftBlock: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  shiftTitle: { color: "#18262c", fontSize: 13, fontWeight: "900", marginBottom: 8 },
  timeSettingRow: { marginBottom: 8 },
  timeSettingLabel: { color: "#607078", fontSize: 12, fontWeight: "900", marginBottom: 6 },
  timeStepper: { alignItems: "center", flexDirection: "row", gap: 8 },
  timeStepButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 42
  },
  timeStepButtonText: { color: "#1f5262", fontSize: 18, fontWeight: "900", lineHeight: 20 },
  timeValueBox: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 76,
    paddingHorizontal: 10
  },
  timeValueText: { color: "#ffffff", fontSize: 13, fontWeight: "900" }
});
