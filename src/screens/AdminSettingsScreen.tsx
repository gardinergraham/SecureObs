import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { CustomerOrganisation, OrganisationFeatureKey, OrganisationSettings, ServiceType, Site, StaffMember, Ward } from "../types/domain";
import { buildStaffCardPayload } from "../utils/nfcStaffCard";
import { writeNfcTextPayload } from "../utils/nfcWriter";
import { defaultObservationLocations } from "../utils/observationLocations";
import { createBillingPortalSession, syncBillingCustomerDetails } from "../services/api";

const serviceTypes: ServiceType[] = ["High secure hospital", "Medium secure hospital", "Care home"];
const intervals = [5, 10, 15, 30, 60];
const plans: Array<{ id: OrganisationSettings["subscriptionPlan"]; label: string; price: string }> = [
  { id: "essential", label: "Essential", price: "£149/month" },
  { id: "professional", label: "Professional", price: "£299/month" },
  { id: "enterprise", label: "Enterprise", price: "From £1,499/month" },
  { id: "hospital", label: "Hospital", price: "Custom pricing" }
];
const featureLabels: Array<{ key: OrganisationFeatureKey; label: string }> = [
  { key: "medication", label: "Medication" },
  { key: "rostering", label: "Rostering" },
  { key: "dashboard", label: "Analytics dashboard" },
  { key: "cqcReporting", label: "CQC reporting & governance" },
  { key: "securityChecks", label: "Security checks" },
  { key: "multiSite", label: "Multiple sites" },
  { key: "multiWard", label: "Multiple wards" },
  { key: "prioritySupport", label: "Priority support" },
  { key: "dedicatedSupport", label: "Dedicated support" },
  { key: "staffTraining", label: "Staff training" },
  { key: "dedicatedDatabase", label: "Dedicated database" },
  { key: "sqlIntegration", label: "SQL integration" }
];
const planFeatures: Record<OrganisationSettings["subscriptionPlan"], Record<OrganisationFeatureKey, boolean>> = {
  essential: { medication: false, rostering: false, dashboard: false, cqcReporting: false, securityChecks: false, multiSite: false, multiWard: false, prioritySupport: false, dedicatedSupport: false, staffTraining: false, dedicatedDatabase: false, sqlIntegration: false },
  professional: { medication: true, rostering: true, dashboard: true, cqcReporting: true, securityChecks: true, multiSite: false, multiWard: false, prioritySupport: true, dedicatedSupport: false, staffTraining: false, dedicatedDatabase: false, sqlIntegration: false },
  enterprise: { medication: true, rostering: true, dashboard: true, cqcReporting: true, securityChecks: true, multiSite: true, multiWard: true, prioritySupport: true, dedicatedSupport: true, staffTraining: true, dedicatedDatabase: false, sqlIntegration: false },
  hospital: { medication: true, rostering: true, dashboard: true, cqcReporting: true, securityChecks: true, multiSite: true, multiWard: true, prioritySupport: true, dedicatedSupport: true, staffTraining: true, dedicatedDatabase: true, sqlIntegration: true }
};

type AdminSettingsScreenProps = {
  customerOrganisations: CustomerOrganisation[];
  selectedOrganisationId: string;
  organisationSettings: OrganisationSettings;
  sites: Site[];
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onCreateCustomerOrganisation: (name: string) => Promise<void>;
  onDeleteCustomerOrganisation: (organisationId: string) => Promise<void>;
  onSelectCustomerOrganisation: (organisationId: string) => Promise<void>;
  onOpenAuditLog: () => void;
  onCreateSite: (site: Site) => Promise<void>;
  onCreateStaff: (staff: StaffMember) => Promise<void>;
  onCreateWard: (ward: Ward) => Promise<void>;
  onDeleteDemoWard: (ward: Ward) => Promise<{
    deletedWardId: string;
    wardName: string;
    siteName: string;
    deletedPatientCount: number;
  }>;
  onUpdateOrganisationSettings: (settings: OrganisationSettings) => Promise<void>;
};

export function AdminSettingsScreen({
  customerOrganisations,
  selectedOrganisationId,
  organisationSettings,
  sites,
  staff,
  wards,
  onBack,
  onCreateCustomerOrganisation,
  onDeleteCustomerOrganisation,
  onSelectCustomerOrganisation,
  onOpenAuditLog,
  onCreateSite,
  onCreateStaff,
  onCreateWard,
  onDeleteDemoWard,
  onUpdateOrganisationSettings
}: AdminSettingsScreenProps) {
  const [customerName, setCustomerName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? "");
  const [managedWardId, setManagedWardId] = useState("");
  const [wardName, setWardName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerStaffCode, setManagerStaffCode] = useState("");
  const [editingManagerId, setEditingManagerId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("Care home");
  const [observationIntervalMinutes, setObservationIntervalMinutes] = useState(15);
  const [nfcStaffCodeFormat, setNfcStaffCodeFormat] = useState(organisationSettings.nfcStaffCodeFormat);
  const [logoDataUri, setLogoDataUri] = useState(organisationSettings.logoDataUri ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isWritingManagerTag, setIsWritingManagerTag] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState(organisationSettings.subscriptionPlan);
  const [featureOverrides, setFeatureOverrides] = useState(organisationSettings.featureOverrides);
  const [serviceStatus, setServiceStatus] = useState(organisationSettings.serviceStatus);
  const [suspensionMessage, setSuspensionMessage] = useState(organisationSettings.suspensionMessage);
  const [siteLimitOverride, setSiteLimitOverride] = useState(
    organisationSettings.siteLimitOverride ? String(organisationSettings.siteLimitOverride) : ""
  );
  const [wardLimitOverride, setWardLimitOverride] = useState(
    organisationSettings.wardsPerSiteLimitOverride ? String(organisationSettings.wardsPerSiteLimitOverride) : ""
  );
  const selectedCustomer = customerOrganisations.find((organisation) => organisation.id === selectedOrganisationId);
  const packageSiteLimit = subscriptionPlan === "essential" ? 1 : subscriptionPlan === "professional" ? 5 : null;
  const packageWardLimit = subscriptionPlan === "essential" ? 1 : subscriptionPlan === "professional" ? 5 : null;
  const effectiveSiteLimit = siteLimitOverride ? Number(siteLimitOverride) : packageSiteLimit;
  const effectiveWardLimit = wardLimitOverride ? Number(wardLimitOverride) : packageWardLimit;
  const selectedSiteWards = useMemo(
    () => wards.filter((ward) => ward.siteId === selectedSiteId),
    [selectedSiteId, wards]
  );
  const selectedWardManagers = staff.filter(
    (member) => member.role === "manager" && (member.wardId === managedWardId || member.allowedWardIds.includes(managedWardId))
  );
  const managedWard = wards.find((ward) => ward.id === managedWardId);
  const managedWardSite = sites.find((site) => site.id === managedWard?.siteId);
  const canAddSite = effectiveSiteLimit === null || sites.length < effectiveSiteLimit;
  const canAddWard = Boolean(selectedSiteId) && (effectiveWardLimit === null || selectedSiteWards.length < effectiveWardLimit);

  const confirmDeleteDemoWard = () => {
    if (!managedWard || !managedWard.name.toLowerCase().includes("demo")) return;
    Alert.alert(
      "Delete demonstration ward?",
      `Permanently delete “${managedWard.name}” from “${managedWardSite?.name ?? "this site"}”, including all demonstration patients and their linked notes, observations, tasks, incidents and other ward records?\n\nStaff accounts will remain, but access to this ward will be removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              `Check the site carefully: ${managedWardSite?.name ?? "Unknown site"}.\n\nDelete ${managedWard.name} and all of its demonstration records?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete demo ward",
                  style: "destructive",
                  onPress: async () => {
                    setIsSaving(true);
                    try {
                      const result = await onDeleteDemoWard(managedWard);
                      setManagedWardId("");
                      Alert.alert(
                        "Demonstration ward deleted",
                        `${result.wardName} was removed from ${result.siteName}, together with ${result.deletedPatientCount} demonstration patient${result.deletedPatientCount === 1 ? "" : "s"} and their linked records.`
                      );
                    } catch (error) {
                      Alert.alert(
                        "Ward not deleted",
                        error instanceof Error ? error.message : "The demonstration ward could not be deleted."
                      );
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  useEffect(() => {
    setNfcStaffCodeFormat(organisationSettings.nfcStaffCodeFormat);
  }, [organisationSettings.nfcStaffCodeFormat]);

  useEffect(() => {
    setLogoDataUri(organisationSettings.logoDataUri ?? null);
  }, [organisationSettings.logoDataUri]);

  useEffect(() => {
    setSubscriptionPlan(organisationSettings.subscriptionPlan);
    setFeatureOverrides(organisationSettings.featureOverrides);
    setServiceStatus(organisationSettings.serviceStatus);
    setSuspensionMessage(organisationSettings.suspensionMessage);
    setSiteLimitOverride(organisationSettings.siteLimitOverride ? String(organisationSettings.siteLimitOverride) : "");
    setWardLimitOverride(organisationSettings.wardsPerSiteLimitOverride ? String(organisationSettings.wardsPerSiteLimitOverride) : "");
  }, [organisationSettings]);

  useEffect(() => {
    if (!selectedSiteWards.some((ward) => ward.id === managedWardId)) {
      setManagedWardId(selectedSiteWards[0]?.id ?? "");
      setEditingManagerId("");
    }
  }, [managedWardId, selectedSiteWards]);

  const saveCustomer = async () => {
    if (!customerName.trim()) {
      Alert.alert("Customer name needed", "Enter the organisation or provider name.");
      return;
    }
    setIsSaving(true);
    try {
      const createdName = customerName.trim();
      await onCreateCustomerOrganisation(createdName);
      setCustomerName("");
      Alert.alert("Customer created", `${createdName} is selected. You can now choose and save its package.`);
    } catch (error) {
      Alert.alert("Customer not created", error instanceof Error ? error.message : "The customer organisation could not be created.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteCustomer = () => {
    if (!selectedCustomer) return;
    Alert.alert(
      "Delete empty customer?",
      `Delete ${selectedCustomer.name}? This is only allowed when it has no sites, staff or patients.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete customer",
          style: "destructive",
          onPress: () => void (async () => {
            setIsSaving(true);
            try {
              await onDeleteCustomerOrganisation(selectedCustomer.id);
              Alert.alert("Customer deleted", `${selectedCustomer.name} has been removed.`);
            } catch (error) {
              Alert.alert("Customer not deleted", error instanceof Error ? error.message : "The customer could not be deleted.");
            } finally {
              setIsSaving(false);
            }
          })()
        }
      ]
    );
  };

  const saveSubscription = async () => {
    setIsSaving(true);
    try {
      await onUpdateOrganisationSettings({
        ...organisationSettings,
        subscriptionPlan,
        featureOverrides,
        serviceStatus,
        suspensionMessage: suspensionMessage.trim(),
        siteLimitOverride: siteLimitOverride ? Number(siteLimitOverride) : null,
        wardsPerSiteLimitOverride: wardLimitOverride ? Number(wardLimitOverride) : null
      });
      Alert.alert(
        serviceStatus === "suspended" ? "Service suspended" : "Subscription saved",
        serviceStatus === "suspended" ? "Non-admin access has been temporarily suspended." : "Package and feature access have been updated."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFeature = (key: OrganisationFeatureKey) => {
    const enabled = featureOverrides[key] ?? planFeatures[subscriptionPlan][key];
    setFeatureOverrides((current) => ({ ...current, [key]: !enabled }));
  };

  const chooseLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85
    });

    if (result.canceled) return;

    try {
      const asset = result.assets[0];
      if (!asset) throw new Error("No image was selected.");
      const format = asset.mimeType === "image/png" ? SaveFormat.PNG : SaveFormat.JPEG;
      const resized = await manipulateAsync(
        asset.uri,
        asset.width > 720 ? [{ resize: { width: 720 } }] : [],
        { base64: true, compress: 0.78, format }
      );
      if (!resized.base64) throw new Error("No image data was returned.");

      const nextLogo = `data:image/${format};base64,${resized.base64}`;
      if (nextLogo.length > 900_000) {
        Alert.alert("Logo is too large", "Choose a simpler or smaller image and try again.");
        return;
      }
      setLogoDataUri(nextLogo);
    } catch {
      Alert.alert("Logo could not be prepared", "Please choose a JPG or PNG image and try again.");
    }
  };

  const saveBranding = async () => {
    setIsSaving(true);
    try {
      await onUpdateOrganisationSettings({
        ...organisationSettings,
        logoDataUri
      });
      Alert.alert("Branding saved", logoDataUri ? "Your company logo now appears across SecureObs." : "The company logo has been removed.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSite = async () => {
    const trimmedName = siteName.trim();
    if (!trimmedName) {
      Alert.alert("Site name needed", "Enter the site or care home name before saving.");
      return;
    }

    const site = {
      id: createId("site", trimmedName),
      name: trimmedName,
      organisationId: selectedOrganisationId
    };

    setIsSaving(true);
    try {
      await onCreateSite(site);
      setSelectedSiteId(site.id);
      setSiteName("");
      Alert.alert("Site added", `${site.name} is ready for wards.`);
    } catch (error) {
      Alert.alert("Site not added", error instanceof Error ? error.message : "The site could not be added.");
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
      organisationId: selectedOrganisationId,
      siteId: selectedSiteId,
      name: trimmedName,
      serviceType,
      observationIntervalMinutes,
      news2Enabled: true,
      enhancedObservationsEnabled: true,
      securityChecksEnabled: true,
      medicationChartEnabled: true,
      staffRotaEnabled: true,
      assessmentFormsEnabled: serviceType === "Care home",
      foodFluidChartEnabled: serviceType === "Care home",
      observationLocations: defaultObservationLocations(serviceType),
      landingPage: "overview",
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
      setManagedWardId(ward.id);
      let manager: StaffMember | undefined;
      if (managerName.trim() && managerStaffCode.trim()) {
        manager = {
          id: `staff-${managerStaffCode.trim().toLowerCase()}`,
          organisationId: selectedOrganisationId,
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
        };
        await onCreateStaff(manager);
      }
      setWardName("");
      setManagerName("");
      setManagerStaffCode("");
      if (manager) {
        Alert.alert("Ward and manager added", `${manager.name} can use STAFFCODE ${manager.staffCode}.`, [
          { text: "Write later", style: "cancel" },
          { text: "Write NFC tag", onPress: () => void writeManagerNfcTag(manager) }
        ]);
      } else {
        Alert.alert("Ward added", `${ward.name} has been added.`);
      }
    } catch (error) {
      Alert.alert("Ward not added", error instanceof Error ? error.message : "The ward could not be added.");
    } finally {
      setIsSaving(false);
    }
  };

  const writeManagerNfcTag = async (manager: StaffMember) => {
    const payload = buildStaffCardPayload(manager.staffCode, organisationSettings.nfcStaffCodeFormat);
    setIsWritingManagerTag(true);
    try {
      await writeNfcTextPayload(payload);
      Alert.alert("NFC manager tag written", `${manager.name}'s tag now contains STAFFCODE ${manager.staffCode}.`);
    } catch (error) {
      Alert.alert("NFC tag not written", error instanceof Error ? error.message : "Unable to write that NFC tag.");
    } finally {
      setIsWritingManagerTag(false);
    }
  };

  const editWardManager = (manager: StaffMember) => {
    setEditingManagerId(manager.id);
    setManagerName(manager.name);
    setManagerStaffCode(manager.staffCode);
  };

  const saveExistingWardManager = async () => {
    const ward = wards.find((item) => item.id === managedWardId);
    if (!ward || !managerName.trim() || !managerStaffCode.trim()) {
      Alert.alert("Manager details needed", "Select a ward and enter the manager name and STAFFCODE.");
      return;
    }
    const existing = staff.find((member) => member.id === editingManagerId);
    const manager: StaffMember = {
      ...(existing ?? {
        id: `staff-${managerStaffCode.trim().toLowerCase()}`,
        keyNumber: Date.now() % 100000,
        canPrescribe: false,
        active: true
      }),
      organisationId: selectedOrganisationId,
      staffCode: managerStaffCode.trim(),
      name: managerName.trim(),
      role: "manager",
      designation: "Ward Manager",
      wardId: ward.id,
      allowedSiteIds: Array.from(new Set([...(existing?.allowedSiteIds ?? []), ward.siteId])),
      allowedWardIds: Array.from(new Set([...(existing?.allowedWardIds ?? []), ward.id]))
    };
    setIsSaving(true);
    try {
      await onCreateStaff(manager);
      setEditingManagerId(manager.id);
      Alert.alert("Ward manager saved", `${manager.name} is assigned to ${ward.name}.`, [
        { text: "Done", style: "cancel" },
        { text: "Write NFC tag", onPress: () => void writeManagerNfcTag(manager) }
      ]);
    } catch (error) {
      Alert.alert("Manager not saved", error instanceof Error ? error.message : "The ward manager could not be saved.");
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
        <Text style={styles.panelTitle}>Customer organisation</Text>
        <Text style={styles.meta}>Select an existing customer before managing its package, sites and wards.</Text>
        <View style={styles.customerGrid}>
          {customerOrganisations.map((organisation) => (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isSaving}
              key={organisation.id}
              onPress={() => void onSelectCustomerOrganisation(organisation.id)}
              style={[styles.customerButton, selectedOrganisationId === organisation.id && styles.optionButtonActive]}
            >
              <Text style={[styles.listTitle, selectedOrganisationId === organisation.id && styles.optionTextActive]}>{organisation.name}</Text>
              <Text style={[styles.listMeta, selectedOrganisationId === organisation.id && styles.optionTextActive]}>
                {organisation.subscriptionPlan} · {organisation.siteCount} sites · {organisation.wardCount} wards
              </Text>
              {organisation.billingContactName || organisation.billingEmail ? (
                <Text style={[styles.listMeta, selectedOrganisationId === organisation.id && styles.optionTextActive]}>
                  {[organisation.billingContactName, organisation.billingEmail,
                    [organisation.billingCity, organisation.billingPostcode, organisation.billingCountry].filter(Boolean).join(" ")]
                    .filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.createCustomerRow}>
          <TextInput placeholderTextColor="#6f7f87" onChangeText={setCustomerName} placeholder="New customer organisation" style={[styles.input, styles.customerInput]} value={customerName} />
          <TouchableOpacity accessibilityRole="button" disabled={isSaving} onPress={saveCustomer} style={[styles.primaryButton, styles.createCustomerButton, isSaving && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>Create customer</Text>
          </TouchableOpacity>
        </View>
        {selectedCustomer ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isSaving}
            onPress={confirmDeleteCustomer}
            style={[styles.removeButton, isSaving && styles.disabledButton]}
          >
            <Text style={styles.removeButtonText}>Delete selected empty customer: {selectedCustomer.name}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Subscription and service control</Text>
        <Text style={styles.meta}>SecureObs super-admin only. Select a package, then use overrides for an agreed customer variation.</Text>
        <View style={styles.billingSummary}>
          <Text style={styles.listTitle}>Stripe billing: {(organisationSettings.billingStatus ?? "not_configured").replace("_", " ")}</Text>
          <Text style={styles.listMeta}>
            {organisationSettings.billingInterval ? `${organisationSettings.billingInterval} billing` : "No online subscription linked"}
            {organisationSettings.currentPeriodEnd ? ` · Current period ends ${new Date(organisationSettings.currentPeriodEnd).toLocaleDateString("en-GB")}` : ""}
          </Text>
          {organisationSettings.billingContactName || organisationSettings.billingEmail ? (
            <View style={styles.billingContact}>
              <Text style={styles.label}>Customer billing contact</Text>
              {organisationSettings.billingContactName ? <Text style={styles.listTitle}>{organisationSettings.billingContactName}</Text> : null}
              {organisationSettings.billingEmail ? <Text style={styles.listMeta}>{organisationSettings.billingEmail}</Text> : null}
              {organisationSettings.billingPhone ? <Text style={styles.listMeta}>{organisationSettings.billingPhone}</Text> : null}
              {[organisationSettings.billingAddressLine1, organisationSettings.billingAddressLine2,
                organisationSettings.billingCity, organisationSettings.billingCounty,
                organisationSettings.billingPostcode, organisationSettings.billingCountry].filter(Boolean).length ? (
                <Text style={styles.listMeta}>{[
                  organisationSettings.billingAddressLine1, organisationSettings.billingAddressLine2,
                  organisationSettings.billingCity, organisationSettings.billingCounty,
                  organisationSettings.billingPostcode, organisationSettings.billingCountry
                ].filter(Boolean).join(", ")}</Text>
              ) : null}
            </View>
          ) : null}
          {organisationSettings.billingStatus === "past_due" && organisationSettings.gracePeriodEndsAt ? (
            <Text style={styles.billingWarning}>Payment overdue · access remains available until {new Date(organisationSettings.gracePeriodEndsAt).toLocaleString("en-GB")}</Text>
          ) : null}
          {organisationSettings.billingPortalAvailable ? (
            <View style={styles.billingActions}>
              <TouchableOpacity accessibilityRole="button" onPress={async () => {
                try {
                  await syncBillingCustomerDetails(selectedOrganisationId);
                  await onSelectCustomerOrganisation(selectedOrganisationId);
                  Alert.alert("Billing contact refreshed", "The latest customer contact and address have been imported from Stripe.");
                } catch (error) {
                  Alert.alert("Billing contact unavailable", error instanceof Error ? error.message : "Billing details could not be refreshed.");
                }
              }} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Refresh contact from Stripe</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={async () => {
                try {
                  const result = await createBillingPortalSession(selectedOrganisationId);
                  await Linking.openURL(result.portalUrl);
                } catch (error) {
                  Alert.alert("Billing portal unavailable", error instanceof Error ? error.message : "The billing portal could not be opened.");
                }
              }} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Open Stripe billing portal</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        <View style={styles.optionRow}>
          {plans.map((plan) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={plan.id}
              onPress={() => {
                setSubscriptionPlan(plan.id);
                setFeatureOverrides({});
                setSiteLimitOverride("");
                setWardLimitOverride("");
              }}
              style={[styles.planButton, subscriptionPlan === plan.id && styles.optionButtonActive]}
            >
              <Text style={[styles.optionText, subscriptionPlan === plan.id && styles.optionTextActive]}>{plan.label}</Text>
              <Text style={[styles.planPrice, subscriptionPlan === plan.id && styles.optionTextActive]}>{plan.price}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Feature access</Text>
        <View style={styles.featureGrid}>
          {featureLabels.map((feature) => {
            const enabled = featureOverrides[feature.key] ?? planFeatures[subscriptionPlan][feature.key];
            const overridden = featureOverrides[feature.key] !== undefined;
            return (
              <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: enabled }} key={feature.key} onPress={() => toggleFeature(feature.key)} style={[styles.featureButton, enabled && styles.featureButtonActive]}>
                <Text style={[styles.featureText, enabled && styles.optionTextActive]}>{enabled ? "✓ " : ""}{feature.label}</Text>
                <Text style={[styles.featureSource, enabled && styles.optionTextActive]}>{overridden ? "Override" : "Package"}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.label}>Package allowances</Text>
        <Text style={styles.meta}>
          {selectedCustomer?.siteCount ?? sites.length} of {effectiveSiteLimit ?? "unlimited"} sites used · Wards allowed per site: {effectiveWardLimit ?? "unlimited"}
        </Text>
        <View style={styles.allowanceRow}>
          <View style={styles.allowanceField}>
            <Text style={styles.label}>Site allowance override</Text>
            <TextInput placeholderTextColor="#6f7f87" keyboardType="number-pad" onChangeText={setSiteLimitOverride} placeholder={packageSiteLimit ? String(packageSiteLimit) : "Unlimited"} style={styles.input} value={siteLimitOverride} />
          </View>
          <View style={styles.allowanceField}>
            <Text style={styles.label}>Wards per site override</Text>
            <TextInput placeholderTextColor="#6f7f87" keyboardType="number-pad" onChangeText={setWardLimitOverride} placeholder={packageWardLimit ? String(packageWardLimit) : "Unlimited"} style={styles.input} value={wardLimitOverride} />
          </View>
        </View>
        <Text style={styles.label}>Service status</Text>
        <View style={styles.optionRow}>
          {(["active", "suspended"] as const).map((status) => (
            <TouchableOpacity accessibilityRole="button" key={status} onPress={() => setServiceStatus(status)} style={[styles.optionButton, serviceStatus === status && (status === "active" ? styles.optionButtonActive : styles.suspendButtonActive)]}>
              <Text style={[styles.optionText, serviceStatus === status && styles.optionTextActive]}>{status === "active" ? "Active" : "Suspended"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {serviceStatus === "suspended" ? (
          <TextInput placeholderTextColor="#6f7f87" multiline onChangeText={setSuspensionMessage} placeholder="SecureObs access is temporarily suspended. Please contact your account administrator." style={[styles.input, styles.messageInput]} value={suspensionMessage} />
        ) : null}
        <TouchableOpacity accessibilityRole="button" disabled={isSaving} onPress={saveSubscription} style={[styles.primaryButton, isSaving && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{isSaving ? "Saving subscription…" : "Save subscription and service status"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <View>
          <Text style={styles.panelTitle}>Company branding</Text>
          <Text style={styles.meta}>Add a wide company logo to the header across SecureObs screens.</Text>
        </View>
        <View style={styles.brandingRow}>
          <View style={styles.logoPreview}>
            {logoDataUri ? (
              <Image
                accessibilityLabel="Company logo preview"
                resizeMode="contain"
                source={{ uri: logoDataUri }}
                style={styles.logoPreviewImage}
              />
            ) : (
              <Text style={styles.logoPlaceholder}>Your logo</Text>
            )}
          </View>
          <View style={styles.brandingActions}>
            <TouchableOpacity accessibilityRole="button" onPress={chooseLogo} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{logoDataUri ? "Choose another logo" : "Choose logo"}</Text>
            </TouchableOpacity>
            {logoDataUri ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => setLogoDataUri(null)} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={isSaving || logoDataUri === (organisationSettings.logoDataUri ?? null)}
          onPress={saveBranding}
          style={[
            styles.primaryButton,
            (isSaving || logoDataUri === (organisationSettings.logoDataUri ?? null)) && styles.disabledButton
          ]}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? "Saving" : "Save branding"}</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.listMeta}>{sites.length} of {effectiveSiteLimit ?? "unlimited"} sites used</Text>
          <TextInput placeholderTextColor="#6f7f87"
            onChangeText={setSiteName}
            placeholder="Site or care home name"
            style={styles.input}
            value={siteName}
          />
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isSaving || !canAddSite}
            onPress={saveSite}
            style={[styles.primaryButton, (isSaving || !canAddSite) && styles.disabledButton]}
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
          <Text style={styles.listMeta}>{selectedSiteWards.length} of {effectiveWardLimit ?? "unlimited"} wards used at this site</Text>
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
            disabled={isSaving || isWritingManagerTag || !canAddWard}
            onPress={saveWard}
            style={[styles.primaryButton, (isSaving || isWritingManagerTag || !canAddWard) && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>{isWritingManagerTag ? "Hold NFC tag…" : "Add ward"}</Text>
          </TouchableOpacity>

          <View style={styles.list}>
            {selectedSiteWards.map((ward) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={ward.id}
                onPress={() => {
                  setManagedWardId(ward.id);
                  setEditingManagerId("");
                  setManagerName("");
                  setManagerStaffCode("");
                }}
                style={[styles.listRow, managedWardId === ward.id && styles.listRowActive]}
              >
                <Text style={styles.listTitle}>{ward.name}</Text>
                <Text style={styles.listMeta}>
                  {ward.serviceType} | {ward.observationIntervalMinutes}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {managedWardId ? (
            <View style={styles.managerPanel}>
              <Text style={styles.label}>Manage selected ward manager</Text>
              {selectedWardManagers.length > 0 ? selectedWardManagers.map((manager) => (
                <View key={manager.id} style={styles.managerRow}>
                  <TouchableOpacity accessibilityRole="button" onPress={() => editWardManager(manager)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{manager.name} · {manager.staffCode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" disabled={isWritingManagerTag} onPress={() => void writeManagerNfcTag(manager)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{isWritingManagerTag ? "Hold tag…" : "Rewrite NFC tag"}</Text>
                  </TouchableOpacity>
                </View>
              )) : <Text style={styles.listMeta}>No manager is currently assigned to this ward.</Text>}
              <Text style={styles.listMeta}>Select a manager above to edit them, or enter a new name and STAFFCODE in the manager fields.</Text>
              <TouchableOpacity accessibilityRole="button" disabled={isSaving || isWritingManagerTag} onPress={saveExistingWardManager} style={[styles.primaryButton, (isSaving || isWritingManagerTag) && styles.disabledButton]}>
                <Text style={styles.primaryButtonText}>{editingManagerId ? "Update ward manager" : "Assign new ward manager"}</Text>
              </TouchableOpacity>
              {managedWard?.name.toLowerCase().includes("demo") ? (
                <View style={styles.demoDeletePanel}>
                  <Text style={styles.demoDeleteTitle}>Demonstration data cleanup</Text>
                  <Text style={styles.listMeta}>
                    Deletes this ward from {managedWardSite?.name ?? "the selected site"}, including its demonstration patients and linked records.
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={isSaving || isWritingManagerTag}
                    onPress={confirmDeleteDemoWard}
                    style={[styles.demoDeleteButton, (isSaving || isWritingManagerTag) && styles.disabledButton]}
                  >
                    <Text style={styles.demoDeleteButtonText}>{isSaving ? "Deleting…" : "Delete this demonstration ward"}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
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
  customerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  customerButton: { borderColor: "#c7d2d6", borderRadius: 7, borderWidth: 1, minWidth: 220, padding: 10 },
  createCustomerRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  customerInput: { flex: 1 },
  createCustomerButton: { minWidth: 160, paddingHorizontal: 12 },
  managerPanel: { borderColor: "#d8e0e3", borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 4, padding: 10 },
  demoDeletePanel: { backgroundColor: "#fff7f5", borderColor: "#efb5ad", borderRadius: 7, borderWidth: 1, gap: 7, marginTop: 8, padding: 10 },
  demoDeleteTitle: { color: "#81251f", fontSize: 14, fontWeight: "900" },
  demoDeleteButton: { alignItems: "center", backgroundColor: "#9f2d28", borderRadius: 6, justifyContent: "center", minHeight: 42, paddingHorizontal: 12 },
  demoDeleteButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  managerRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  allowanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  allowanceField: { flex: 1, minWidth: 220 },
  billingSummary: { backgroundColor: "#f4f8fa", borderColor: "#c7d2d6", borderRadius: 7, borderWidth: 1, gap: 7, padding: 11 },
  billingContact: { borderTopColor: "#d8e0e3", borderTopWidth: 1, gap: 2, marginTop: 3, paddingTop: 8 },
  billingActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  billingWarning: { color: "#8a4b08", fontSize: 12, fontWeight: "900" },
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
  brandingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  logoPreview: {
    alignItems: "center",
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 96,
    justifyContent: "center",
    overflow: "hidden",
    padding: 8,
    width: 288
  },
  logoPreviewImage: {
    height: "100%",
    width: "100%"
  },
  logoPlaceholder: {
    color: "#7b898f",
    fontSize: 15,
    fontWeight: "800"
  },
  brandingActions: {
    alignItems: "flex-start",
    gap: 8
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  secondaryButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  removeButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 4
  },
  removeButtonText: { color: "#9f2d28", fontSize: 13, fontWeight: "900" },
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
  planButton: { borderColor: "#c7d2d6", borderRadius: 7, borderWidth: 1, minWidth: 150, padding: 11 },
  planPrice: { color: "#617078", fontSize: 11, fontWeight: "800", marginTop: 3 },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featureButton: { borderColor: "#c7d2d6", borderRadius: 7, borderWidth: 1, minWidth: 180, padding: 10 },
  featureButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  featureText: { color: "#31454d", fontSize: 12, fontWeight: "900" },
  featureSource: { color: "#738289", fontSize: 10, fontWeight: "800", marginTop: 3 },
  suspendButtonActive: { backgroundColor: "#9f2d28", borderColor: "#9f2d28" },
  messageInput: { minHeight: 84, paddingTop: 10, textAlignVertical: "top" },
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
