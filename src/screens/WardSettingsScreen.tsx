import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { OrganisationFeatureKey, OrganisationSettings, StaffMember, Ward } from "../types/domain";
import { buildStaffCardPayload } from "../utils/nfcStaffCard";
import { writeNfcTextPayload } from "../utils/nfcWriter";
import { hasAdminAccess, hasStaffRole, normaliseStaffRole } from "../utils/staffRole";

const shiftCountOptions = [1, 2, 3, 4];
const breakDurationOptions = [15, 30, 60];
const sessionTimeoutOptions = [15, 30, 60, 120, 240];
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
  organisationSettings: OrganisationSettings;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onUpdateWardInterval: (wardId: string, observationIntervalMinutes: number) => void;
  onUpdateWardRotaEnabled: (wardId: string, staffRotaEnabled: boolean) => void;
  onUpdateWardRotaSettings: (ward: Ward) => Promise<void>;
  onOpenSecurityCheckSettings: () => void;
  onCreateStaff: (staff: StaffMember) => Promise<void>;
  onResetStaffPin: (staffId: string) => Promise<void>;
};

export function WardSettingsScreen({
  selectedStaffId,
  selectedWardId,
  organisationSettings,
  staff,
  wards,
  onBack,
  onUpdateWardInterval,
  onUpdateWardRotaEnabled,
  onUpdateWardRotaSettings,
  onOpenSecurityCheckSettings,
  onCreateStaff,
  onResetStaffPin
}: WardSettingsScreenProps) {
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEditWardSettings = hasStaffRole(selectedStaff, "manager") || hasAdminAccess(selectedStaff);
  const medicationEntitled = isPackageFeatureEnabled(organisationSettings, "medication");
  const securityChecksEntitled = isPackageFeatureEnabled(organisationSettings, "securityChecks");
  const rosteringEntitled = isPackageFeatureEnabled(organisationSettings, "rostering");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<StaffMember["role"]>("nurse");
  const [newStaffDesignation, setNewStaffDesignation] = useState("");
  const [newStaffCanPrescribe, setNewStaffCanPrescribe] = useState(false);
  const [newStaffLoginPin, setNewStaffLoginPin] = useState("");
  const [newStaffActive, setNewStaffActive] = useState(true);
  const [newStaffWardIds, setNewStaffWardIds] = useState<string[]>(selectedWardId ? [selectedWardId] : []);
  const [editingStaffId, setEditingStaffId] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [isSavingWard, setIsSavingWard] = useState(false);
  const [wardSaveMessage, setWardSaveMessage] = useState("");
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [isWritingStaffTag, setIsWritingStaffTag] = useState(false);
  const [lastSavedStaff, setLastSavedStaff] = useState<StaffMember | null>(null);
  const selectedSiteId = selectedWard?.siteId;
  const siteWardIds = wards.filter((ward) => ward.siteId === selectedSiteId).map((ward) => ward.id);
  const siteStaff = staff
    .filter((member) => isStaffAssignedToSite(member, selectedSiteId, siteWardIds))
    .sort((left, right) => left.name.localeCompare(right.name));
  const staffSearchResults = siteStaff
    .filter((member) => {
      const query = staffSearch.trim().toLowerCase();
      if (!query) return false;
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
    setWardSaveMessage("");
    void onUpdateWardRotaSettings({ ...selectedWard, ...updates });
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

    setWardSaveMessage("");
    void onUpdateWardRotaSettings({ ...selectedWard, rotaShiftCount: shiftCount, rotaShifts });
  };

  const updateShiftTime = (shiftId: string, field: "startsAt" | "endsAt", value: string) => {
    if (!selectedWard || !canEditWardSettings) return;

    setWardSaveMessage("");
    void onUpdateWardRotaSettings({
      ...selectedWard,
      rotaShifts: selectedWard.rotaShifts.map((shift) =>
        shift.id === shiftId ? { ...shift, [field]: value } : shift
      )
    });
  };

  const updateBreakDuration = (breakDurationMinutes: number) => {
    if (!selectedWard || !canEditWardSettings) return;
    setWardSaveMessage("");
    void onUpdateWardRotaSettings({ ...selectedWard, breakDurationMinutes });
  };

  const updateSessionTimeout = (sessionTimeoutMinutes: number) => {
    if (!selectedWard || !canEditWardSettings) return;
    setWardSaveMessage("");
    void onUpdateWardRotaSettings({ ...selectedWard, sessionTimeoutMinutes });
  };

  const saveWardSettings = async () => {
    if (!selectedWard || !canEditWardSettings || isSavingWard) return;
    setIsSavingWard(true);
    setWardSaveMessage("");
    try {
      await onUpdateWardRotaSettings(selectedWard);
      setWardSaveMessage("Ward settings saved.");
    } catch (error) {
      setWardSaveMessage(error instanceof Error ? error.message : "Ward settings could not be saved.");
    } finally {
      setIsSavingWard(false);
    }
  };

  const selectStaffForEditing = (member: StaffMember) => {
    const wardIds = member.allowedWardIds.length > 0 ? member.allowedWardIds : [member.wardId];
    setEditingStaffId(member.id);
    setNewStaffName(member.name);
    setNewStaffCode(member.staffCode);
    setNewStaffRole(normaliseStaffRole(member.role));
    setNewStaffDesignation(member.designation ?? "");
    setNewStaffCanPrescribe(Boolean(member.canPrescribe));
    setNewStaffLoginPin("");
    setNewStaffActive(member.active !== false);
    setNewStaffWardIds(wardIds.includes(selectedWardId) ? wardIds : [...wardIds, selectedWardId]);
    setStaffSearch("");
  };

  const clearStaffDraft = () => {
    setEditingStaffId("");
    setNewStaffName("");
    setNewStaffCode("");
    setNewStaffRole("nurse");
    setNewStaffDesignation("");
    setNewStaffCanPrescribe(false);
    setNewStaffLoginPin("");
    setNewStaffActive(true);
    setNewStaffWardIds(selectedWardId ? [selectedWardId] : []);
  };

  const writeStaffNfcTag = async (staffMember: StaffMember) => {
    if (!canEditWardSettings) return;
    if (staffMember.employmentType !== "permanent") {
      Alert.alert("Permanent staff only", "NFC staff tags can only be written for permanent staff records.");
      return;
    }

    const payload = buildStaffCardPayload(staffMember.staffCode, organisationSettings.nfcStaffCodeFormat);

    setIsWritingStaffTag(true);
    try {
      await writeNfcTextPayload(payload);
      Alert.alert(
        "NFC staff tag written",
        `${staffMember.name}'s tag now contains STAFFCODE ${staffMember.staffCode}.`
      );
      setLastSavedStaff(staffMember);
    } catch (error) {
      Alert.alert("NFC tag not written", error instanceof Error ? error.message : "Unable to write that NFC tag.");
    } finally {
      setIsWritingStaffTag(false);
    }
  };

  const writeDraftStaffNfcTag = () => {
    const staffMember = editingStaffId
      ? staff.find((member) => member.id === editingStaffId)
      : newStaffCode.trim()
        ? lastSavedStaff?.staffCode.toLowerCase() === newStaffCode.trim().toLowerCase()
          ? lastSavedStaff
          : null
        : lastSavedStaff;

    if (staffMember) {
      void writeStaffNfcTag(staffMember);
      return;
    }

    if (!newStaffCode.trim() || !newStaffName.trim()) {
      Alert.alert("Save staff first", "Enter and save the permanent staff member before writing their NFC tag.");
      return;
    }

    Alert.alert("Save staff first", "Save this staff member, then write the NFC tag from the confirmation prompt.");
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
    if (newStaffLoginPin.trim() && !/^\d{4,6}$/.test(newStaffLoginPin.trim())) {
      Alert.alert("PIN invalid", "Enter a 4 to 6 digit PIN, or leave the PIN box blank to keep the current PIN.");
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
      role: normaliseStaffRole(newStaffRole),
      designation: newStaffDesignation.trim() || defaultDesignation(newStaffRole),
      canPrescribe: newStaffRole === "doctor" && newStaffCanPrescribe,
      employmentType: "permanent",
      accessStartsAt: undefined,
      accessExpiresAt: undefined,
      loginPin: newStaffLoginPin.trim() || undefined,
      wardId: primaryWard.id,
      allowedSiteIds,
      allowedWardIds: newStaffWardIds,
      active: newStaffActive
    };

    setIsSavingStaff(true);
    try {
      await onCreateStaff(staffMember);
      setLastSavedStaff(staffMember);
      clearStaffDraft();
      Alert.alert("Staff saved", `${staffMember.name} can use STAFFCODE ${staffMember.staffCode}.`, [
        { text: "Later", style: "cancel" },
        {
          text: "Write NFC tag",
          onPress: () => {
            void writeStaffNfcTag(staffMember);
          }
        }
      ]);
    } finally {
      setIsSavingStaff(false);
    }
  };

  const resetSelectedStaffPin = () => {
    const staffMember = staff.find((member) => member.id === editingStaffId);
    if (!staffMember || !canEditWardSettings) return;

    Alert.alert(
      "Reset staff PIN?",
      `${staffMember.name} will use temporary PIN 1111 next time they sign in, then they must choose a new PIN.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset PIN",
          style: "destructive",
          onPress: async () => {
            setIsResettingPin(true);
            try {
              await onResetStaffPin(staffMember.id);
              Alert.alert("PIN reset", `${staffMember.name} can sign in with temporary PIN 1111.`);
            } finally {
              setIsResettingPin(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ward settings</Text>
          <Text style={styles.meta}>
            {selectedWard?.name ?? "Select a ward"} | {canEditWardSettings ? "Manager/admin access" : "Manager locked"}
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
            Search staff assigned to this site, then add or update ward access for {selectedWard?.name ?? "this ward"}.
          </Text>
          <View style={styles.staffPickerHeader}>
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              editable={canEditWardSettings}
              onChangeText={setStaffSearch}
              placeholder="Search site staff by name, STAFFCODE or role"
              style={[styles.input, styles.staffSearchInput]}
              value={staffSearch}
            />
            <TouchableOpacity accessibilityRole="button" onPress={clearStaffDraft} style={styles.addNewButton}>
              <Text style={styles.addNewButtonText}>Add new</Text>
            </TouchableOpacity>
          </View>
          {staffSearch.trim() ? (
          <View style={styles.staffSearchResults}>
            {staffSearchResults.map((member) => (
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
                    {member.staffCode} | {member.role} | {member.active === false ? "inactive" : "active"}
                  </Text>
                </View>
                {member.canPrescribe ? <Text style={styles.prescriberBadge}>Rx</Text> : null}
              </TouchableOpacity>
            ))}
            {staffSearchResults.length === 0 ? (
              <Text style={styles.staffMeta}>No staff found on this site. Use Add new to create a permanent staff record.</Text>
            ) : staffSearchResults.length >= 20 ? (
              <Text style={styles.staffMeta}>Showing first {staffSearchResults.length} matches. Refine the search to narrow the list.</Text>
            ) : null}
          </View>
          ) : null}
          <TextInput placeholderTextColor="#6f7f87"
            editable={canEditWardSettings}
            onChangeText={setNewStaffName}
            placeholder="Staff name"
            style={styles.input}
            value={newStaffName}
          />
          <TextInput placeholderTextColor="#6f7f87"
            autoCapitalize="none"
            editable={canEditWardSettings}
            onChangeText={setNewStaffCode}
            placeholder="STAFFCODE"
            style={styles.input}
            value={newStaffCode}
          />
          <TextInput placeholderTextColor="#6f7f87"
            editable={canEditWardSettings}
            onChangeText={setNewStaffDesignation}
            placeholder="Designation"
            style={styles.input}
            value={newStaffDesignation}
          />
          <TextInput placeholderTextColor="#6f7f87"
            editable={canEditWardSettings}
            keyboardType="number-pad"
            onChangeText={setNewStaffLoginPin}
            placeholder={editingStaffId ? "Set new PIN (optional)" : "Initial PIN optional - default 1111"}
            secureTextEntry
            style={styles.input}
            value={newStaffLoginPin}
          />
          <View style={styles.optionRow}>
            {(["nurse", "hcf", "ot", "security", "doctor"] as StaffMember["role"][]).map((role) => (
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
          <View style={styles.nfcWriterPanel}>
            <View style={styles.nfcWriterCopy}>
              <Text style={styles.nfcWriterTitle}>NFC staff tag</Text>
              <Text style={styles.nfcWriterMeta}>
                Writes {buildStaffCardPayload(newStaffCode || lastSavedStaff?.staffCode || "STAFFCODE", organisationSettings.nfcStaffCodeFormat)} to a blank or reusable staff tag.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canEditWardSettings || isWritingStaffTag}
              onPress={writeDraftStaffNfcTag}
              style={[styles.writeTagButton, (!canEditWardSettings || isWritingStaffTag) && styles.disabledControl]}
            >
              <Text style={styles.writeTagButtonText}>{isWritingStaffTag ? "Hold tag..." : "Write NFC tag"}</Text>
            </TouchableOpacity>
          </View>
          {editingStaffId ? (
            <View style={styles.staffActionRow}>
              {staff.find((member) => member.id === editingStaffId)?.employmentType !== "bank" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEditWardSettings || isResettingPin}
                  onPress={resetSelectedStaffPin}
                  style={[styles.resetPinButton, (!canEditWardSettings || isResettingPin) && styles.disabledControl]}
                >
                  <Text style={styles.resetPinButtonText}>{isResettingPin ? "Resetting..." : "Reset PIN to 1111"}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity accessibilityRole="button" onPress={clearStaffDraft} style={styles.clearStaffButton}>
                <Text style={styles.clearStaffButtonText}>Clear selection</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.serviceSummary}>
          <Text style={styles.settingLabel}>Service type</Text>
          <Text style={styles.serviceSummaryText}>{selectedWard?.serviceType ?? "Not set"}</Text>
        </View>

        <Text style={styles.settingLabel}>Landing page after login</Text>
        <Text style={styles.meta}>
          Choose the first ward screen staff see after selecting this ward.
        </Text>
        <View style={styles.optionRow}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={() => updateWardSettings({ landingPage: "overview" })}
            style={[
              styles.optionButton,
              (selectedWard?.landingPage ?? "overview") === "overview" && styles.optionButtonActive,
              !canEditWardSettings && styles.disabledControl
            ]}
          >
            <Text
              style={[
                styles.optionText,
                (selectedWard?.landingPage ?? "overview") === "overview" && styles.optionTextActive
              ]}
            >
              Ward overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={() => updateWardSettings({ landingPage: "observations" })}
            style={[
              styles.optionButton,
              selectedWard?.landingPage === "observations" && styles.optionButtonActive,
              !canEditWardSettings && styles.disabledControl
            ]}
          >
            <Text
              style={[
                styles.optionText,
                selectedWard?.landingPage === "observations" && styles.optionTextActive
              ]}
            >
              Patient checks
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.meta}>
          Ward overview shows the quick-view dashboard. Patient checks opens the original general-observation
          screen and top menu.
        </Text>

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
          locked={!securityChecksEntitled}
          meta={securityChecksEntitled ? "Ward checkpoint recording" : "Not included in this package · Contact SecureObs to upgrade"}
          onToggle={() => updateWardSettings({ securityChecksEnabled: !selectedWard?.securityChecksEnabled })}
        />
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!selectedWard || !canEditWardSettings}
          onPress={() => securityChecksEntitled ? onOpenSecurityCheckSettings() : showUpgradeMessage("Security checks")}
          style={[styles.configureButton, (!selectedWard || !canEditWardSettings || !securityChecksEntitled) && styles.disabledControl]}
        >
          <Text style={styles.configureButtonText}>Configure security checks</Text>
        </TouchableOpacity>
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.medicationChartEnabled)}
          label="Medication chart"
          locked={!medicationEntitled}
          meta={medicationEntitled ? "Due medication prompts and recording" : "Not included in this package · Contact SecureObs to upgrade"}
          onToggle={() => updateWardSettings({ medicationChartEnabled: !selectedWard?.medicationChartEnabled })}
        />
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.assessmentFormsEnabled)}
          label="Assessment forms"
          meta="Care home forms, signatures and printable assessments"
          onToggle={() => updateWardSettings({ assessmentFormsEnabled: !selectedWard?.assessmentFormsEnabled })}
        />
        <FeatureToggle
          disabled={!selectedWard || !canEditWardSettings}
          enabled={Boolean(selectedWard?.foodFluidChartEnabled)}
          label="Food and fluid chart"
          meta="Three-day meal, snack and drink intake monitoring"
          onToggle={() => updateWardSettings({ foodFluidChartEnabled: !selectedWard?.foodFluidChartEnabled })}
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

        <Text style={styles.settingLabel}>Staff session timeout</Text>
        <Text style={styles.meta}>
          The lock countdown starts after 2 minutes without touch or typing. Any activity cancels it and starts again.
        </Text>
        <View style={styles.optionRow}>
          {sessionTimeoutOptions.map((minutes) => (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!selectedWard || !canEditWardSettings}
              key={minutes}
              onPress={() => updateSessionTimeout(minutes)}
              style={[
                styles.optionButton,
                selectedWard?.sessionTimeoutMinutes === minutes && styles.optionButtonActive,
                !canEditWardSettings && styles.disabledControl
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedWard?.sessionTimeoutMinutes === minutes && styles.optionTextActive
                ]}
              >
                {formatSessionTimeout(minutes)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          disabled={!selectedWard || !canEditWardSettings || isSavingWard}
          onPress={() => void saveWardSettings()}
          style={[
            styles.saveStaffButton,
            (!selectedWard || !canEditWardSettings || isSavingWard) && styles.disabledControl
          ]}
        >
          {isSavingWard ? <ActivityIndicator color="#ffffff" size="small" /> : null}
          <Text style={styles.saveStaffButtonText}>{isSavingWard ? "Saving ward settings…" : "Update ward settings"}</Text>
        </TouchableOpacity>
        {wardSaveMessage ? <Text style={styles.cardMessage}>{wardSaveMessage}</Text> : null}

        <View style={styles.settingBlock}>
          <View>
            <Text style={styles.settingLabel}>Staff rota</Text>
            <Text style={styles.meta}>
              {!rosteringEntitled
                ? "Not included in this package · Contact SecureObs to upgrade"
                : selectedWard?.staffRotaEnabled ? "Rota page available for this ward" : "Rota hidden for this ward"}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={() => rosteringEntitled ? toggleRota() : showUpgradeMessage("Staff rostering")}
            style={[
              styles.toggleButton,
              selectedWard?.staffRotaEnabled && styles.toggleButtonActive,
              (!canEditWardSettings || !rosteringEntitled) && styles.disabledControl
            ]}
          >
            <Text style={[styles.toggleText, selectedWard?.staffRotaEnabled && styles.optionTextActive]}>
              {selectedWard?.staffRotaEnabled ? "On" : "Off"}
            </Text>
          </TouchableOpacity>
        </View>

        {selectedWard?.staffRotaEnabled && rosteringEntitled ? (
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
  locked?: boolean;
  meta: string;
  onToggle: () => void;
};

function FeatureToggle({ disabled, enabled, label, locked = false, meta, onToggle }: FeatureToggleProps) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureText}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureMeta}>{meta}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => locked ? showUpgradeMessage(label) : onToggle()}
        style={[styles.toggleButton, enabled && styles.toggleButtonActive, (disabled || locked) && styles.disabledControl]}
      >
        <Text style={[styles.toggleText, enabled && styles.optionTextActive]}>{enabled ? "On" : "Off"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function isPackageFeatureEnabled(settings: OrganisationSettings, feature: OrganisationFeatureKey) {
  const packageDefault = settings.subscriptionPlan !== "essential";
  return settings.featureOverrides[feature] ?? packageDefault;
}

function showUpgradeMessage(feature: string) {
  Alert.alert(
    `${feature} is not included`,
    "This feature is not included in your organisation's current SecureObs package. Please contact SecureObs to add it or upgrade the package."
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

function isStaffAssignedToSite(member: StaffMember, siteId: string | undefined, siteWardIds: string[]) {
  if (!siteId) {
    return false;
  }

  return (
    member.allowedSiteIds.includes(siteId) ||
    siteWardIds.includes(member.wardId) ||
    member.allowedWardIds.some((wardId) => siteWardIds.includes(wardId))
  );
}

function defaultDesignation(role: StaffMember["role"]) {
  if (role === "hcf") return "HCF";
  if (role === "ot") return "OT";
  if (role === "nurse") return "Nurse";
  if (role === "doctor") return "Doctor";
  if (role === "security") return "Security";
  return "Manager";
}

function formatSessionTimeout(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
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
  staffSearchResults: { gap: 7 },
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
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44
  },
  saveStaffButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  cardMessage: { color: "#315748", fontSize: 12, fontWeight: "800", marginTop: 8 },
  nfcWriterPanel: {
    alignItems: "center",
    backgroundColor: "#eef6f7",
    borderColor: "#c5dde2",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    padding: 10
  },
  nfcWriterCopy: { flex: 1, minWidth: 220 },
  nfcWriterTitle: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  nfcWriterMeta: { color: "#4f626a", fontSize: 11, fontWeight: "800", marginTop: 3 },
  writeTagButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  writeTagButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  staffActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  resetPinButton: {
    alignItems: "center",
    borderColor: "#9f2d28",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  resetPinButtonText: { color: "#9f2d28", fontSize: 13, fontWeight: "900" },
  clearStaffButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
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
  configureButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 42
  },
  configureButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
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
