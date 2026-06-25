import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { OrganisationSettings, ServiceType, Site, StaffMember, Ward } from "../types/domain";

const serviceTypes: ServiceType[] = ["High secure hospital", "Medium secure hospital", "Care home"];
const intervals = [5, 10, 15, 30, 60];

type AdminSettingsScreenProps = {
  organisationSettings: OrganisationSettings;
  sites: Site[];
  wards: Ward[];
  onBack: () => void;
  onOpenAuditLog: () => void;
  onCreateSite: (site: Site) => Promise<void>;
  onCreateStaff: (staff: StaffMember) => Promise<void>;
  onCreateWard: (ward: Ward) => Promise<void>;
  onUpdateOrganisationSettings: (settings: OrganisationSettings) => Promise<void>;
};

export function AdminSettingsScreen({
  organisationSettings,
  sites,
  wards,
  onBack,
  onOpenAuditLog,
  onCreateSite,
  onCreateStaff,
  onCreateWard,
  onUpdateOrganisationSettings
}: AdminSettingsScreenProps) {
  const [siteName, setSiteName] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? "");
  const [wardName, setWardName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerStaffCode, setManagerStaffCode] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("Care home");
  const [observationIntervalMinutes, setObservationIntervalMinutes] = useState(15);
  const [nfcStaffCodeFormat, setNfcStaffCodeFormat] = useState(organisationSettings.nfcStaffCodeFormat);
  const [isSaving, setIsSaving] = useState(false);
  const selectedSiteWards = useMemo(
    () => wards.filter((ward) => ward.siteId === selectedSiteId),
    [selectedSiteId, wards]
  );

  useEffect(() => {
    setNfcStaffCodeFormat(organisationSettings.nfcStaffCodeFormat);
  }, [organisationSettings.nfcStaffCodeFormat]);

  const saveSite = async () => {
    const trimmedName = siteName.trim();
    if (!trimmedName) {
      Alert.alert("Site name needed", "Enter the site or care home name before saving.");
      return;
    }

    const site = {
      id: createId("site", trimmedName),
      name: trimmedName
    };

    setIsSaving(true);
    try {
      await onCreateSite(site);
      setSelectedSiteId(site.id);
      setSiteName("");
      Alert.alert("Site added", `${site.name} is ready for wards.`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveWard = async () => {
    const trimmedName = wardName.trim();
    if (!selectedSiteId || !trimmedName) {
      Alert.alert("Ward details needed", "Choose a site and enter the ward name before saving.");
      return;
    }
    if ((managerName.trim() || managerStaffCode.trim()) && (!managerName.trim() || !managerStaffCode.trim())) {
      Alert.alert("Manager details needed", "Enter both the ward manager name and STAFFCODE.");
      return;
    }

    const ward: Ward = {
      id: createId("ward", `${selectedSiteId}-${trimmedName}`),
      siteId: selectedSiteId,
      name: trimmedName,
      serviceType,
      observationIntervalMinutes,
      news2Enabled: true,
      enhancedObservationsEnabled: true,
      securityChecksEnabled: true,
      medicationChartEnabled: true,
      staffRotaEnabled: true,
      sessionTimeoutMinutes: 15,
      rotaShiftCount: 3,
      rotaShifts: [
        { id: `${createId("ward", trimmedName)}-shift-1`, startsAt: "07:00", endsAt: "15:00" },
        { id: `${createId("ward", trimmedName)}-shift-2`, startsAt: "15:00", endsAt: "23:00" },
        { id: `${createId("ward", trimmedName)}-shift-3`, startsAt: "23:00", endsAt: "07:00" }
      ],
      breakDurationMinutes: 30,
      selected: false
    };

    setIsSaving(true);
    try {
      await onCreateWard(ward);
      if (managerName.trim() && managerStaffCode.trim()) {
        await onCreateStaff({
          id: `staff-${managerStaffCode.trim().toLowerCase()}`,
          keyNumber: Date.now() % 100000,
          staffCode: managerStaffCode.trim(),
          name: managerName.trim(),
          role: "manager",
          designation: "Ward Manager",
          canPrescribe: false,
          wardId: ward.id,
          allowedSiteIds: [selectedSiteId],
          allowedWardIds: [ward.id],
          active: true
        });
      }
      setWardName("");
      setManagerName("");
      setManagerStaffCode("");
      Alert.alert("Ward added", `${ward.name} has been added${managerName.trim() ? " with a manager" : ""}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveOrganisationSettings = async () => {
    const trimmedFormat = nfcStaffCodeFormat.trim();
    if (!trimmedFormat.includes("{STAFFCODE}")) {
      Alert.alert("NFC format invalid", "Include {STAFFCODE} where the staff code appears, for example passcode={STAFFCODE}.");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateOrganisationSettings({
        ...organisationSettings,
        nfcStaffCodeFormat: trimmedFormat
      });
      Alert.alert("NFC format saved", "Staff card parsing has been updated.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SecureObs admin</Text>
          <Text style={styles.meta}>Add organisation sites and wards.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity accessibilityRole="button" onPress={onOpenAuditLog} style={styles.auditHeaderButton}>
            <Text style={styles.auditHeaderButtonText}>Audit log</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to start</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity accessibilityRole="button" onPress={onOpenAuditLog} style={styles.auditButton}>
        <View>
          <Text style={styles.auditButtonTitle}>Audit log</Text>
          <Text style={styles.auditButtonMeta}>Search staff lookups, observation saves, medication, settings and failed access.</Text>
        </View>
        <Text style={styles.auditButtonArrow}>Open</Text>
      </TouchableOpacity>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>NFC staff card format</Text>
        <Text style={styles.meta}>
          Use {"{STAFFCODE}"} where the staff code appears. Existing fallback formats and plain STAFFCODE still work.
        </Text>
        <TextInput placeholderTextColor="#6f7f87"
          autoCapitalize="none"
          onChangeText={setNfcStaffCodeFormat}
          placeholder="passcode={STAFFCODE}"
          style={styles.input}
          value={nfcStaffCodeFormat}
        />
        <Text style={styles.listMeta}>Examples: passcode={"{STAFFCODE}"} | staffCode={"{STAFFCODE}"} | secureobs:{"{STAFFCODE}"}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={isSaving}
          onPress={saveOrganisationSettings}
          style={[styles.primaryButton, isSaving && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>Save NFC format</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sites</Text>
          <TextInput placeholderTextColor="#6f7f87"
            onChangeText={setSiteName}
            placeholder="Site or care home name"
            style={styles.input}
            value={siteName}
          />
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isSaving}
            onPress={saveSite}
            style={[styles.primaryButton, isSaving && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Add site</Text>
          </TouchableOpacity>

          <View style={styles.list}>
            {sites.map((site) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={site.id}
                onPress={() => setSelectedSiteId(site.id)}
                style={[styles.listRow, selectedSiteId === site.id && styles.listRowActive]}
              >
                <Text style={styles.listTitle}>{site.name}</Text>
                <Text style={styles.listMeta}>{site.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Wards</Text>
          <TextInput placeholderTextColor="#6f7f87"
            onChangeText={setWardName}
            placeholder="Ward name"
            style={styles.input}
            value={wardName}
          />
          <TextInput placeholderTextColor="#6f7f87"
            onChangeText={setManagerName}
            placeholder="Ward manager name"
            style={styles.input}
            value={managerName}
          />
          <TextInput placeholderTextColor="#6f7f87"
            autoCapitalize="none"
            onChangeText={setManagerStaffCode}
            placeholder="Manager STAFFCODE for NFC card"
            style={styles.input}
            value={managerStaffCode}
          />

          <Text style={styles.label}>Service type</Text>
          <View style={styles.optionRow}>
            {serviceTypes.map((type) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={type}
                onPress={() => setServiceType(type)}
                style={[styles.optionButton, serviceType === type && styles.optionButtonActive]}
              >
                <Text style={[styles.optionText, serviceType === type && styles.optionTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Observation interval</Text>
          <View style={styles.optionRow}>
            {intervals.map((interval) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={interval}
                onPress={() => setObservationIntervalMinutes(interval)}
                style={[styles.optionButton, observationIntervalMinutes === interval && styles.optionButtonActive]}
              >
                <Text style={[styles.optionText, observationIntervalMinutes === interval && styles.optionTextActive]}>
                  {interval}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            disabled={isSaving || !selectedSiteId}
            onPress={saveWard}
            style={[styles.primaryButton, (isSaving || !selectedSiteId) && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Add ward</Text>
          </TouchableOpacity>

          <View style={styles.list}>
            {selectedSiteWards.map((ward) => (
              <View key={ward.id} style={styles.listRow}>
                <Text style={styles.listTitle}>{ward.name}</Text>
                <Text style={styles.listMeta}>
                  {ward.serviceType} | {ward.observationIntervalMinutes}m
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function createId(prefix: string, value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 36);

  return `${prefix}-${slug || Date.now()}`;
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
    padding: 14
  },
  title: { color: "#18262c", fontSize: 24, fontWeight: "900" },
  meta: { color: "#617078", fontSize: 13, fontWeight: "700", marginTop: 3 },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  auditHeaderButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  auditHeaderButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  backButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  auditButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#1f5262",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  auditButtonTitle: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  auditButtonMeta: { color: "#617078", fontSize: 12, fontWeight: "800", marginTop: 3 },
  auditButtonArrow: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  split: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 10,
    padding: 14
  },
  panelTitle: { color: "#18262c", fontSize: 18, fontWeight: "900" },
  input: {
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 10
  },
  label: { color: "#31454d", fontSize: 12, fontWeight: "900", marginTop: 2 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  optionButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  optionText: { color: "#31454d", fontSize: 12, fontWeight: "900" },
  optionTextActive: { color: "#ffffff" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    minHeight: 44,
    justifyContent: "center"
  },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  list: { gap: 8, marginTop: 4 },
  listRow: {
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    padding: 10
  },
  listRowActive: { backgroundColor: "#e8f2f5", borderColor: "#1f5262" },
  listTitle: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  listMeta: { color: "#617078", fontSize: 12, fontWeight: "700", marginTop: 3 }
});
