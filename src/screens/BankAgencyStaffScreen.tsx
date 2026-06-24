import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { StaffMember, Ward } from "../types/domain";
import { hasStaffRole, normaliseStaffRole } from "../utils/staffRole";

type BankAgencyStaffScreenProps = {
  selectedStaffId: string;
  selectedWardId: string;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onCreateStaff: (staff: StaffMember) => Promise<void>;
};

const roleOptions: StaffMember["role"][] = ["nurse", "hcf", "security", "doctor"];

export function BankAgencyStaffScreen({
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onBack,
  onCreateStaff
}: BankAgencyStaffScreenProps) {
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit = hasStaffRole(selectedStaff, "manager") || hasStaffRole(selectedStaff, "nurse");
  const [editingStaffId, setEditingStaffId] = useState("");
  const [name, setName] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [role, setRole] = useState<StaffMember["role"]>("nurse");
  const [designation, setDesignation] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [startDate, setStartDate] = useState(() => formatInputDate(new Date()));
  const [startTime, setStartTime] = useState(() => formatInputTime(new Date()));
  const [endDate, setEndDate] = useState(() => formatInputDate(addHours(new Date(), 12)));
  const [endTime, setEndTime] = useState(() => formatInputTime(addHours(new Date(), 12)));
  const [allowedWardIds, setAllowedWardIds] = useState<string[]>(selectedWardId ? [selectedWardId] : []);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const bankStaff = useMemo(
    () =>
      staff
        .filter((member) => member.employmentType === "bank")
        .filter((member) => member.wardId === selectedWardId || member.allowedWardIds.includes(selectedWardId))
        .filter((member) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return `${member.name} ${member.staffCode} ${member.role}`.toLowerCase().includes(query);
        })
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 40),
    [search, selectedWardId, staff]
  );

  const clearDraft = () => {
    setEditingStaffId("");
    setName("");
    setStaffCode("");
    setRole("nurse");
    setDesignation("");
    setLoginPin("");
    setStartDate(formatInputDate(new Date()));
    setStartTime(formatInputTime(new Date()));
    setEndDate(formatInputDate(addHours(new Date(), 12)));
    setEndTime(formatInputTime(addHours(new Date(), 12)));
    setAllowedWardIds(selectedWardId ? [selectedWardId] : []);
  };

  const selectStaff = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setName(member.name);
    setStaffCode(member.staffCode);
    setRole(member.role);
    setDesignation(member.designation ?? "");
    setLoginPin(member.loginPin ?? "");
    setStartDate(formatInputDate(member.accessStartsAt ? new Date(member.accessStartsAt) : new Date()));
    setStartTime(formatInputTime(member.accessStartsAt ? new Date(member.accessStartsAt) : new Date()));
    const defaultEnd = addHours(new Date(), 12);
    setEndDate(formatInputDate(member.accessExpiresAt ? new Date(member.accessExpiresAt) : defaultEnd));
    setEndTime(formatInputTime(member.accessExpiresAt ? new Date(member.accessExpiresAt) : defaultEnd));
    setAllowedWardIds(member.allowedWardIds.length > 0 ? member.allowedWardIds : selectedWardId ? [selectedWardId] : []);
  };

  const toggleWard = (wardId: string) => {
    setAllowedWardIds((current) => {
      if (current.includes(wardId)) {
        const next = current.filter((item) => item !== wardId);
        return next.length > 0 ? next : current;
      }

      return [...current, wardId];
    });
  };

  const saveStaff = async () => {
    if (!selectedWard || !selectedStaff || !canEdit) return;
    if (!name.trim() || !staffCode.trim()) {
      Alert.alert("Staff details needed", "Enter the bank or agency staff name and STAFFCODE.");
      return;
    }
    if (!loginPin.trim()) {
      Alert.alert("PIN needed", "Enter a temporary login PIN.");
      return;
    }
    if (allowedWardIds.length === 0) {
      Alert.alert("Ward access needed", "Select at least one ward.");
      return;
    }

    const accessStartsAt = buildIsoFromDateAndTime(startDate, startTime);
    const accessExpiresAt = buildIsoFromDateAndTime(endDate, endTime);
    if (!accessStartsAt || !accessExpiresAt) {
      Alert.alert("Access dates needed", "Enter valid start and end date/time.");
      return;
    }
    if (new Date(accessExpiresAt).getTime() <= new Date(accessStartsAt).getTime()) {
      Alert.alert("Access dates invalid", "The end date/time must be after the start date/time.");
      return;
    }

    const primaryWard = wards.find((ward) => ward.id === allowedWardIds[0]) ?? selectedWard;
    const allowedSiteIds = Array.from(
      new Set(
        allowedWardIds
          .map((wardId) => wards.find((ward) => ward.id === wardId)?.siteId)
          .filter((siteId): siteId is string => Boolean(siteId))
      )
    );
    const nextStaff: StaffMember = {
      id: editingStaffId || `staff-${staffCode.trim().toLowerCase()}`,
      organisationId: selectedStaff.organisationId,
      keyNumber: Date.now() % 100000,
      staffCode: staffCode.trim(),
      name: name.trim(),
      role: normaliseStaffRole(role),
      designation: designation.trim() || defaultDesignation(role),
      canPrescribe: role === "doctor",
      employmentType: "bank",
      accessStartsAt,
      accessExpiresAt,
      loginPin: loginPin.trim(),
      wardId: primaryWard.id,
      allowedSiteIds,
      allowedWardIds,
      active: true
    };

    setIsSaving(true);
    try {
      await onCreateStaff(nextStaff);
      clearDraft();
      Alert.alert("Bank/agency staff saved", `${nextStaff.name} can sign in with STAFFCODE ${nextStaff.staffCode}.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Bank / Agency staff</Text>
          <Text style={styles.meta}>{selectedWard?.name ?? "Ward"} | Temporary ward access</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to staff rota</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current temporary staff</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setSearch}
            placeholder="Search name, STAFFCODE or role"
            style={styles.input}
            value={search}
          />
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={styles.listScroller}>
            {bankStaff.length === 0 ? <Text style={styles.emptyText}>No bank or agency staff found for this ward.</Text> : null}
            {bankStaff.map((member) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit}
                key={member.id}
                onPress={() => selectStaff(member)}
                style={[styles.staffRow, editingStaffId === member.id && styles.staffRowActive]}
              >
                <Text style={styles.staffName}>{member.name}</Text>
                <Text style={styles.staffMeta}>
                  {member.staffCode} | {member.role} | {accessStatus(member)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.formContent} nestedScrollEnabled style={styles.panel}>
          <View style={styles.formHeader}>
            <Text style={styles.panelTitle}>{editingStaffId ? "Update temporary access" : "Add temporary staff"}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={clearDraft} style={styles.addNewButton}>
              <Text style={styles.addNewButtonText}>Add new</Text>
            </TouchableOpacity>
          </View>
          {!canEdit ? <Text style={styles.warningText}>Select a nurse or manager to add bank/agency staff.</Text> : null}
          <TextInput editable={canEdit} onChangeText={setName} placeholder="Real name" style={styles.input} value={name} />
          <TextInput
            autoCapitalize="none"
            editable={canEdit}
            onChangeText={setStaffCode}
            placeholder="STAFFCODE"
            style={styles.input}
            value={staffCode}
          />
          <TextInput
            editable={canEdit}
            onChangeText={setDesignation}
            placeholder="Designation"
            style={styles.input}
            value={designation}
          />
          <Text style={styles.label}>Role</Text>
          <View style={styles.optionRow}>
            {roleOptions.map((option) => (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canEdit}
                key={option}
                onPress={() => setRole(option)}
                style={[styles.optionButton, role === option && styles.optionButtonActive, !canEdit && styles.disabledControl]}
              >
                <Text style={[styles.optionText, role === option && styles.optionTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Ward access</Text>
          <View style={styles.optionRow}>
            {wards.map((ward) => {
              const active = allowedWardIds.includes(ward.id);
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!canEdit}
                  key={ward.id}
                  onPress={() => toggleWard(ward.id)}
                  style={[styles.optionButton, active && styles.optionButtonActive, !canEdit && styles.disabledControl]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{ward.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            autoCapitalize="none"
            editable={canEdit}
            keyboardType="number-pad"
            onChangeText={setLoginPin}
            placeholder="Temporary login PIN"
            style={styles.input}
            value={loginPin}
          />
          <Text style={styles.label}>Access window</Text>
          <View style={styles.dateGrid}>
            <TextInput editable={canEdit} onChangeText={setStartDate} placeholder="Start date dd/mm/yyyy" style={styles.dateInput} value={startDate} />
            <TextInput editable={canEdit} onChangeText={setStartTime} placeholder="Start time hh:mm" style={styles.dateInput} value={startTime} />
            <TextInput editable={canEdit} onChangeText={setEndDate} placeholder="End date dd/mm/yyyy" style={styles.dateInput} value={endDate} />
            <TextInput editable={canEdit} onChangeText={setEndTime} placeholder="End time hh:mm" style={styles.dateInput} value={endTime} />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!canEdit || isSaving}
            onPress={saveStaff}
            style={[styles.saveButton, (!canEdit || isSaving) && styles.disabledControl]}
          >
            <Text style={styles.saveButtonText}>{isSaving ? "Saving" : "Save bank/agency staff"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

function defaultDesignation(role: StaffMember["role"]) {
  if (role === "hcf") return "HCF";
  if (role === "nurse") return "Nurse";
  if (role === "doctor") return "Doctor";
  if (role === "security") return "Security";
  return "Bank staff";
}

function accessStatus(member: StaffMember) {
  const startsAt = member.accessStartsAt ? new Date(member.accessStartsAt).getTime() : undefined;
  if (startsAt && !Number.isNaN(startsAt) && startsAt > Date.now()) {
    return `starts ${formatShortDateTime(member.accessStartsAt ?? "")}`;
  }

  const expiresAt = member.accessExpiresAt ? new Date(member.accessExpiresAt).getTime() : undefined;
  if (!expiresAt || Number.isNaN(expiresAt)) {
    return "active";
  }

  if (expiresAt <= Date.now()) {
    return "expired";
  }

  return `expires ${formatShortDateTime(member.accessExpiresAt ?? "")}`;
}

function formatShortDateTime(value: string) {
  if (!value) return "not recorded";
  return new Date(value).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  split: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    maxHeight: 720,
    padding: 12
  },
  panelTitle: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  listScroller: { marginTop: 10 },
  emptyText: { color: "#607078", fontSize: 13, fontWeight: "800", marginTop: 12 },
  staffRow: {
    borderColor: "#e1e7e9",
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
    padding: 10
  },
  staffRowActive: { backgroundColor: "#eaf4f1", borderColor: "#1f5262" },
  staffName: { color: "#18262c", fontSize: 15, fontWeight: "900" },
  staffMeta: { color: "#607078", fontSize: 12, fontWeight: "800", marginTop: 4 },
  formContent: { gap: 10, paddingBottom: 120 },
  formHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  addNewButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10
  },
  addNewButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 10
  },
  label: { color: "#31454d", fontSize: 13, fontWeight: "900", marginTop: 4 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#31454d", fontSize: 12, fontWeight: "900" },
  optionTextActive: { color: "#ffffff" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    flexBasis: "48%",
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 10
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12
  },
  saveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  warningText: { color: "#9a5c00", fontSize: 13, fontWeight: "900" },
  disabledControl: { opacity: 0.45 }
});
