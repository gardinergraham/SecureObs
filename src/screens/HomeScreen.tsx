import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Site, StaffMember, Ward } from "../types/domain";

const shiftCountOptions = [1, 2, 3, 4];
const breakDurationOptions = [15, 30, 60];
const defaultRotaShifts = [
  { id: "shift-1", startsAt: "07:00", endsAt: "15:00" },
  { id: "shift-2", startsAt: "15:00", endsAt: "23:00" },
  { id: "shift-3", startsAt: "23:00", endsAt: "07:00" },
  { id: "shift-4", startsAt: "07:00", endsAt: "13:00" }
];
const fallbackRotaShift = { id: "shift-fallback", startsAt: "07:00", endsAt: "15:00" };

type HomeScreenProps = {
  sites: Site[];
  wards: Ward[];
  staff: StaffMember[];
  selectedStaffId: string;
  selectedSiteId: string;
  selectedWardId: string;
  onSelectStaff: (staffId: string) => void;
  onSelectSite: (siteId: string) => void;
  onSelectWard: (wardId: string) => void;
  onOpenWardSettings: () => void;
  onStart: () => void;
};

export function HomeScreen({
  sites,
  wards,
  staff,
  selectedStaffId,
  selectedSiteId,
  selectedWardId,
  onSelectStaff,
  onSelectSite,
  onSelectWard,
  onOpenWardSettings,
  onStart
}: HomeScreenProps) {
  const canStart = selectedStaffId.length > 0 && selectedSiteId.length > 0 && selectedWardId.length > 0;
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEditWardSettings = selectedStaff?.role === "manager";

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.title}>Start ward observations</Text>
        <Text style={styles.subtitle}>Select staff, site, and ward for this session.</Text>

        <SelectorRow
          label="Staff"
          options={staff.map((member) => ({
            id: member.id,
            label: `${member.name} (${member.keyNumber})`
          }))}
          selectedId={selectedStaffId}
          onSelect={onSelectStaff}
        />

        <SelectorRow
          label="Site"
          options={sites.map((site) => ({ id: site.id, label: site.name }))}
          selectedId={selectedSiteId}
          onSelect={onSelectSite}
        />

        <SelectorRow
          label="Ward"
          options={wards.map((ward) => ({
            id: ward.id,
            label: `${ward.name} (${ward.observationIntervalMinutes}m)`
          }))}
          selectedId={selectedWardId}
          onSelect={onSelectWard}
        />

        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeader}>
            <View>
              <Text style={styles.settingsTitle}>Ward settings</Text>
              <Text style={styles.settingsMeta}>
                {selectedWard?.name ?? "Select a ward"} | {canEditWardSettings ? "Manager access" : "Manager locked"}
              </Text>
            </View>
            <View style={styles.intervalBadge}>
              <Text style={styles.intervalBadgeText}>{selectedWard?.observationIntervalMinutes ?? 0}m</Text>
            </View>
          </View>
          <Text style={styles.rotaMeta}>
            {selectedWard?.staffRotaEnabled ? "Staff rota enabled" : "Staff rota hidden"} |{" "}
            {selectedWard?.rotaShiftCount ?? 0} shifts | Breaks {selectedWard?.breakDurationMinutes ?? 0}m
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!selectedWard || !canEditWardSettings}
            onPress={onOpenWardSettings}
            style={[styles.settingsButton, (!selectedWard || !canEditWardSettings) && styles.startButtonDisabled]}
          >
            <Text style={styles.settingsButtonText}>
              {canEditWardSettings ? "Open ward settings" : "Manager access required"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          disabled={!canStart}
          onPress={onStart}
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
        >
          <Text style={styles.startButtonText}>Open observations</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


type SelectorRowProps = {
  label: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
};

function SelectorRow({ label, options, selectedId, onSelect }: SelectorRowProps) {
  return (
    <View style={styles.selectorRow}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorOptions}>
        {options.map((option) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.selectorButton, option.id === selectedId && styles.selectorButtonActive]}
          >
            <Text style={[styles.selectorText, option.id === selectedId && styles.selectorTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 560,
    padding: 20
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 760,
    padding: 20,
    width: "100%"
  },
  title: {
    color: "#18262c",
    fontSize: 26,
    fontWeight: "900"
  },
  subtitle: {
    color: "#617078",
    fontSize: 14,
    marginBottom: 18,
    marginTop: 4
  },
  selectorRow: {
    marginBottom: 16
  },
  selectorLabel: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7
  },
  selectorOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorButton: {
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  selectorButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  selectorText: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "700"
  },
  selectorTextActive: {
    color: "#ffffff"
  },
  settingsPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    padding: 14
  },
  settingsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  settingsTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900"
  },
  settingsMeta: {
    color: "#607078",
    fontSize: 13,
    marginTop: 2
  },
  intervalBadge: {
    alignItems: "center",
    backgroundColor: "#ddebd6",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 56,
    paddingHorizontal: 10
  },
  intervalBadgeText: {
    color: "#243f2b",
    fontSize: 15,
    fontWeight: "900"
  },
  settingLabel: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8
  },
  intervalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  intervalButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    minWidth: 86,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  compactButton: {
    minWidth: 46
  },
  intervalButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  disabledControl: {
    opacity: 0.45
  },
  intervalButtonText: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "800"
  },
  intervalButtonTextActive: {
    color: "#ffffff"
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  rotaSettingRow: {
    alignItems: "center",
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12
  },
  rotaMeta: {
    color: "#607078",
    fontSize: 12,
    marginTop: 2
  },
  rotaSettingsPanel: {
    borderTopColor: "#d8e0e3",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12
  },
  shiftSettingsBlock: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  shiftTitle: {
    color: "#18262c",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8
  },
  timeSettingRow: {
    marginBottom: 8
  },
  timeSettingLabel: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6
  },
  timeStepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  timeStepButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    height: 34,
    width: 42
  },
  timeStepButtonText: {
    color: "#1f5262",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  timeValueBox: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 76,
    paddingHorizontal: 10
  },
  timeValueText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
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
  toggleButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  toggleButtonText: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "900"
  },
  toggleButtonTextActive: {
    color: "#ffffff"
  },
  settingsButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44
  },
  settingsButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
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
  stepperText: {
    color: "#1f5262",
    fontSize: 15,
    fontWeight: "900"
  },
  stepperValue: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "800",
    minWidth: 92,
    textAlign: "center"
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52
  },
  startButtonDisabled: {
    backgroundColor: "#97a9b0"
  },
  startButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  }
});
