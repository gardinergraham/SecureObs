import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { Site, StaffMember, Ward } from "../types/domain";

const shiftCountOptions = [1, 2, 3, 4];
const breakDurationOptions = [15, 30, 60];
const defaultRotaShifts = [
  { id: "shift-1", startsAt: "07:00", endsAt: "15:00" },
  { id: "shift-2", startsAt: "13:30", endsAt: "23:00" },
  { id: "shift-3", startsAt: "21:30", endsAt: "07:00" },
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
  onReadStaffCardData: (cardData: string) => Promise<string>;
  onScanStaffCard: () => Promise<string>;
  onOpenAdminSettings: () => void;
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
  onReadStaffCardData,
  onScanStaffCard,
  onOpenAdminSettings,
  onOpenWardSettings,
  onStart
}: HomeScreenProps) {
  const [staffCardData, setStaffCardData] = useState("");
  const [staffCardMessage, setStaffCardMessage] = useState("");
  const [isScanningStaffCard, setIsScanningStaffCard] = useState(false);
  const canStart = selectedStaffId.length > 0 && selectedSiteId.length > 0 && selectedWardId.length > 0;
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canOpenAdminSettings = selectedStaff?.staffCode === "GardinerG";
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
            label: `${member.name} (${member.staffCode})`
          }))}
          selectedId={selectedStaffId}
          onSelect={onSelectStaff}
        />

        <View style={styles.cardPanel}>
          <Text style={styles.cardTitle}>NFC staff card demo</Text>
          <View style={styles.cardActionRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isScanningStaffCard}
              onPress={async () => {
                setIsScanningStaffCard(true);
                setStaffCardMessage("Hold the staff card against the tablet.");

                try {
                  setStaffCardMessage(await onScanStaffCard());
                } catch (error) {
                  setStaffCardMessage(error instanceof Error ? error.message : "Unable to read that NFC card.");
                } finally {
                  setIsScanningStaffCard(false);
                }
              }}
              style={[styles.cardButton, isScanningStaffCard && styles.cardButtonDisabled]}
            >
              <Text style={styles.cardButtonText}>
                {isScanningStaffCard ? "Scanning..." : "Scan NFC card"}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            autoCapitalize="none"
            onChangeText={setStaffCardData}
            placeholder="totalmobile://formcapture?SCORE=1&CLINICIAN=GrahamGardiner&STAFFCODE=GardinerG"
            style={styles.cardInput}
            value={staffCardData}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={async () => {
              setIsScanningStaffCard(true);
              try {
                setStaffCardMessage(await onReadStaffCardData(staffCardData));
              } catch (error) {
                setStaffCardMessage(error instanceof Error ? error.message : "Unable to use that card data.");
              } finally {
                setIsScanningStaffCard(false);
              }
            }}
            style={styles.cardSecondaryButton}
          >
            <Text style={styles.cardSecondaryButtonText}>Use pasted card data</Text>
          </TouchableOpacity>
          {staffCardMessage ? <Text style={styles.cardMessage}>{staffCardMessage}</Text> : null}
        </View>

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
            {selectedWard?.serviceType ?? "No service type"} | NEWS2 {selectedWard?.news2Enabled ? "on" : "off"} |{" "}
            Enhanced {selectedWard?.enhancedObservationsEnabled ? "on" : "off"} | Security{" "}
            {selectedWard?.securityChecksEnabled ? "on" : "off"} | Meds{" "}
            {selectedWard?.medicationChartEnabled ? "on" : "off"}
          </Text>
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

        {canOpenAdminSettings ? (
          <TouchableOpacity accessibilityRole="button" onPress={onOpenAdminSettings} style={styles.adminButton}>
            <Text style={styles.adminButtonText}>Open SecureObs admin</Text>
          </TouchableOpacity>
        ) : null}

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
  cardPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginBottom: 16,
    padding: 12
  },
  cardTitle: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "900"
  },
  cardInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 10
  },
  cardActionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  cardButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14
  },
  cardButtonDisabled: {
    backgroundColor: "#97a9b0"
  },
  cardButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  cardSecondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12
  },
  cardSecondaryButtonText: {
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900"
  },
  cardMessage: {
    color: "#315748",
    fontSize: 12,
    fontWeight: "800"
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
  adminButton: {
    alignItems: "center",
    backgroundColor: "#31454d",
    borderRadius: 6,
    marginBottom: 12,
    minHeight: 44,
    justifyContent: "center"
  },
  adminButtonText: {
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
