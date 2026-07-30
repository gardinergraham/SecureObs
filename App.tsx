import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Image, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AdminSettingsScreen } from "./src/screens/AdminSettingsScreen";
import { AnalyticsDashboardScreen } from "./src/screens/AnalyticsDashboardScreen";
import { AuditLogScreen } from "./src/screens/AuditLogScreen";
import { ComplianceGovernanceScreen } from "./src/screens/ComplianceGovernanceScreen";
import { BankAgencyStaffScreen } from "./src/screens/BankAgencyStaffScreen";
import { EnhancedObservationScreen } from "./src/screens/EnhancedObservationScreen";
import { FamilyPortalScreen } from "./src/screens/FamilyPortalScreen";
import { FoodFluidChartScreen } from "./src/screens/FoodFluidChartScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MedicationChartScreen } from "./src/screens/MedicationChartScreen";
import { News2Screen } from "./src/screens/News2Screen";
import { PatientManagementScreen } from "./src/screens/PatientManagementScreen";
import { PatientAssessmentFormsScreen } from "./src/screens/PatientAssessmentFormsScreen";
import { PatientCarePlansScreen } from "./src/screens/PatientCarePlansScreen";
import { PatientDashboardScreen } from "./src/screens/PatientDashboardScreen";
import { PatientNotesScreen } from "./src/screens/PatientNotesScreen";
import { PatientTasksScreen } from "./src/screens/PatientTasksScreen";
import { PatientVoiceScreen } from "./src/screens/PatientVoiceScreen";
import { PatientSettingsScreen } from "./src/screens/PatientSettingsScreen";
import { PreviousObservationsScreen } from "./src/screens/PreviousObservationsScreen";
import { SecurityCheckSettingsScreen } from "./src/screens/SecurityCheckSettingsScreen";
import { SecurityChecks } from "./src/screens/SecurityChecks";
import { SafetyEscalationScreen } from "./src/screens/SafetyEscalationScreen";
import { ShiftHandoverScreen } from "./src/screens/ShiftHandoverScreen";
import { StaffCoverScreen } from "./src/screens/StaffCoverScreen";
import { StaffRotaScreen } from "./src/screens/StaffRotaScreen";
import { WardDashboard } from "./src/screens/WardDashboard";
import { WardOverviewScreen } from "./src/screens/WardOverviewScreen";
import { WardSettingsScreen } from "./src/screens/WardSettingsScreen";
import { seedData } from "./src/data/seedData";
import {
  createMissedObservation as persistMissedObservation,
  createMedicationAdministration as persistMedicationAdministration,
  createMedicationPrescription as persistMedicationPrescription,
  createFoodFluidEntry as persistFoodFluidEntry,
  createNews2Reading as persistNews2Reading,
  createPatientCarePlan as persistPatientCarePlan,
  createPatientNote as persistPatientNote,
  createShiftHandover as persistShiftHandover,
  savePatientTask as persistPatientTask,
  saveSafetyIncident as persistSafetyIncident,
  saveOrganisationSettings as persistOrganisationSettings,
  createSite as persistSite,
  createStaffMember as persistStaffMember,
  createSecurityCheck as persistSecurityCheck,
  deleteRotaAssignment as persistRotaAssignmentDelete,
  deleteDemoWard as persistDemoWardDelete,
  deleteSecurityArea as persistSecurityAreaDelete,
  deleteStaffShiftAssignment as persistStaffShiftAssignmentDelete,
  createWard as persistWard,
  createCustomerOrganisation,
  deleteCustomerOrganisation,
  loadSecurityAreas,
  loadSites,
  loadMedicationAdministrations,
  loadMedicationPrescriptions,
  loadFoodFluidEntries,
  loadMissedObservations,
  loadNews2Readings,
  loadObservations,
  loadOrganisationSettings,
  loadPatients,
  loadPatientCarePlans,
  loadPatientNotes,
  loadSafetyIncidents,
  loadShiftHandovers,
  loadPatientTasks,
  loadRotaAssignments,
  loadSecurityChecks,
  loadStaffShiftAssignments,
  loadWards,
  loadCustomerOrganisations,
  loadCurrentStaffSession,
  loadStaff,
  changeStaffPin,
  loginBankStaffByPin,
  loginStaffByPin,
  lookupStaffByCode,
  saveRotaAssignment as persistRotaAssignment,
  saveSecurityArea as persistSecurityArea,
  saveStaffShiftAssignment as persistStaffShiftAssignment,
  savePatient as persistPatient,
  savePatientDirect as persistManagedPatient,
  transferPatient as persistPatientTransfer,
  archivePatient as persistPatientArchive,
  restorePatient as persistPatientRestore,
  resetStaffPin,
  unlockStaffAccess,
  updateMedicationPrescription as persistMedicationPrescriptionUpdate
} from "./src/services/api";
import {
  clearAuthSession,
  expireAuthSession,
  getAuthSession,
  getAuthSessionLockDeadline,
  storeAuthSessionLockDeadline,
  subscribeToAuthSessionExpiry
} from "./src/services/authSession";
import {
  flushSyncQueue,
  isQueuedSyncError,
  removeSyncQueueItem,
  removeSyncQueueItemsNeedingReview,
  restoreSyncQueue,
  subscribeToSyncQueue,
  type SyncQueueState,
  type SyncQueueStateItem
} from "./src/services/syncQueue";
import { parseStaffCardData } from "./src/utils/nfcStaffCard";
import { readNfcTextPayload } from "./src/utils/nfcReader";
import { calculateNews2Score } from "./src/utils/news2";
import { hasAdminAccess, hasStaffRole } from "./src/utils/staffRole";
import type {
  CustomerOrganisation,
  FoodFluidEntry,
  MedicationAdministration,
  MissedObservation,
  MedicationPrescription,
  News2Reading,
  Observation,
  OrganisationSettings,
  OrganisationFeatureKey,
  Patient,
  PatientCarePlan,
  PatientNote,
  PatientTask,
  PatientLocation,
  PatientPresentation,
  RotaAssignment,
  SafetyIncident,
  ShiftHandover,
  SecurityArea,
  SecurityCheck,
  Site,
  StaffMember,
  StaffShiftAssignment,
  Ward
} from "./src/types/domain";

const defaultOrganisationId = "00000000-0000-0000-0000-000000000001";
const defaultOrganisationSettings: OrganisationSettings = {
  organisationId: defaultOrganisationId,
  nfcStaffCodeFormat: "passcode={STAFFCODE}",
  logoDataUri: null,
  subscriptionPlan: "hospital",
  featureOverrides: {},
  serviceStatus: "active",
  suspensionMessage: "",
  siteLimitOverride: null,
  wardsPerSiteLimitOverride: null
};

type AppScreen =
  | "home"
  | "wardOverview"
  | "adminSettings"
  | "auditLog"
  | "complianceGovernance"
  | "analytics"
  | "observations"
  | "enhanced"
  | "patientManagement"
  | "patientAssessmentForms"
  | "patientCarePlans"
  | "patientDashboard"
  | "patientNotes"
  | "patientTasks"
  | "patientVoice"
  | "familyPortal"
  | "safetyEscalation"
  | "shiftHandover"
  | "patientSettings"
  | "previousObservations"
  | "bankAgencyStaff"
  | "staffCover"
  | "staffRota"
  | "wardSettings"
  | "securityCheckSettings"
  | "medicationChart"
  | "foodFluidChart"
  | "news2"
  | "securityChecks";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [workspaceBackScreen, setWorkspaceBackScreen] = useState<"wardOverview" | "observations" | "complianceGovernance">("wardOverview");
  const [news2Readings, setNews2Readings] = useState<News2Reading[]>(() => createDemoNews2Readings(seedData.patients[0]?.id ?? ""));
  const [foodFluidEntries, setFoodFluidEntries] = useState<FoodFluidEntry[]>([]);
  const [observations, setObservations] = useState<Observation[]>(seedData.observations);
  const [patientCarePlans, setPatientCarePlans] = useState<PatientCarePlan[]>([]);
  const [patientNotes, setPatientNotes] = useState<PatientNote[]>([]);
  const [safetyIncidents, setSafetyIncidents] = useState<SafetyIncident[]>([]);
  const [shiftHandovers, setShiftHandovers] = useState<ShiftHandover[]>([]);
  const [patientTasks, setPatientTasks] = useState<PatientTask[]>([]);
  const [patients, setPatients] = useState<Patient[]>(() => createDemoPatients());
  const [rotaAssignments, setRotaAssignments] = useState<RotaAssignment[]>(seedData.rotaAssignments);
  const [staffShiftAssignments, setStaffShiftAssignments] = useState<StaffShiftAssignment[]>(
    () => createDemoStaffShiftAssignments()
  );
  const [securityAreas, setSecurityAreas] = useState<SecurityArea[]>(seedData.securityAreas);
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>(seedData.securityChecks);
  const [medicationPrescriptions, setMedicationPrescriptions] = useState<MedicationPrescription[]>(
    seedData.medicationPrescriptions
  );
  const [medicationAdministrations, setMedicationAdministrations] = useState<MedicationAdministration[]>(
    seedData.medicationAdministrations
  );
  const [missedObservations, setMissedObservations] = useState<MissedObservation[]>([]);
  const [wards, setWards] = useState<Ward[]>(seedData.wards);
  const [sites, setSites] = useState<Site[]>(seedData.sites);
  const [organisationSettings, setOrganisationSettings] = useState<OrganisationSettings>(defaultOrganisationSettings);
  const [customerOrganisations, setCustomerOrganisations] = useState<CustomerOrganisation[]>([]);
  const [platformSites, setPlatformSites] = useState<Site[]>([]);
  const [platformWards, setPlatformWards] = useState<Ward[]>([]);
  const [adminOrganisationId, setAdminOrganisationId] = useState(defaultOrganisationId);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(seedData.staff);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const selectedStaff = staffMembers.find((staff) => staff.id === selectedStaffId);
  const activeStaff = selectedStaff;
  const selectedStaffCanPrescribe = Boolean(activeStaff?.canPrescribe || hasStaffRole(activeStaff, "doctor"));
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedWardId, setSelectedWardId] = useState("");
  const selectedWardRecord = wards.find((ward) => ward.id === selectedWardId);
  const selectedWard = selectedWardRecord
    ? applyOrganisationEntitlements(selectedWardRecord, organisationSettings)
    : undefined;
  const analyticsEnabled = isOrganisationFeatureEnabled(organisationSettings, "dashboard");
  const rosteringEnabled = isOrganisationFeatureEnabled(organisationSettings, "rostering");
  const cqcReportingEnabled = isOrganisationFeatureEnabled(organisationSettings, "cqcReporting");
  const [selectedPatientId, setSelectedPatientId] = useState(seedData.patients[0]?.id ?? "");
  const lastActivityAtRef = useRef(Date.now());
  const inactivityCountdownStartedAtRef = useRef<number | null>(null);
  const lastActivityDeadlinePersistedAtRef = useRef(0);
  const keyboardActiveRef = useRef(false);
  const [syncQueueState, setSyncQueueState] = useState<SyncQueueState>({
    pendingCount: 0,
    isReady: false,
    isSyncing: false,
    items: []
  });
  const [isSyncStatusVisible, setIsSyncStatusVisible] = useState(false);

  const refreshClinicalDocuments = useCallback(async () => {
    if (screen === "adminSettings" || !selectedStaff || !selectedWardId) {
      return;
    }

    const organisationId = hasAdminAccess(selectedStaff)
      ? adminOrganisationId
      : selectedStaff.organisationId ?? defaultOrganisationId;
    const [notesResult, carePlansResult] = await Promise.allSettled([
      loadPatientNotes(organisationId, selectedWardId),
      loadPatientCarePlans(organisationId, selectedWardId)
    ]);

    if (notesResult.status === "fulfilled") {
      setPatientNotes((currentNotes) => mergeById(notesResult.value.patientNotes, currentNotes));
    } else {
      console.warn("Unable to refresh patient notes", notesResult.reason);
    }

    if (carePlansResult.status === "fulfilled") {
      setPatientCarePlans((currentPlans) => mergeById(carePlansResult.value.patientCarePlans, currentPlans));
    } else {
      console.warn("Unable to refresh patient care plans", carePlansResult.reason);
    }
  }, [adminOrganisationId, screen, selectedStaff, selectedWardId]);

  const refreshWardSettings = useCallback(async () => {
    if (!selectedStaff) {
      return;
    }

    try {
      const organisationId = hasAdminAccess(selectedStaff)
        ? adminOrganisationId
        : selectedStaff.organisationId ?? defaultOrganisationId;
      const result = await loadWards(organisationId);
      setWards((currentWards) => mergeById(result.wards, currentWards));
    } catch (error) {
      console.warn("Unable to refresh ward settings", error);
    }
  }, [adminOrganisationId, selectedStaff]);

  const selectAdminOrganisation = useCallback(async (organisationId: string) => {
    const [siteResult, wardResult, staffResult, settingsResult] = await Promise.all([
      loadSites(organisationId),
      loadWards(organisationId),
      loadStaff(organisationId),
      loadOrganisationSettings(organisationId)
    ]);
    setAdminOrganisationId(organisationId);
    setSites(siteResult.sites);
    setWards(wardResult.wards);
    setStaffMembers((currentStaff) => [
      ...currentStaff.filter((member) => member.organisationId !== organisationId),
      ...staffResult.staff
    ]);
    setOrganisationSettings(settingsResult.settings);
    setSelectedSiteId(siteResult.sites[0]?.id ?? "");
    setSelectedWardId(wardResult.wards[0]?.id ?? "");
  }, []);

  const refreshCustomerOrganisations = useCallback(async () => {
    if (!hasAdminAccess(selectedStaff)) return;
    const result = await loadCustomerOrganisations();
    setCustomerOrganisations(result.organisations);
    const configurations = await Promise.all(
      result.organisations.map(async (organisation) => {
        const [siteResult, wardResult] = await Promise.all([
          loadSites(organisation.id),
          loadWards(organisation.id)
        ]);
        return {
          sites: siteResult.sites.map((site) => ({
            ...site,
            name: `${site.name} — ${organisation.name}`,
            organisationId: organisation.id
          })),
          wards: wardResult.wards.map((ward) => ({ ...ward, organisationId: organisation.id }))
        };
      })
    );
    setPlatformSites(configurations.flatMap((configuration) => configuration.sites));
    setPlatformWards(configurations.flatMap((configuration) => configuration.wards));
  }, [selectedStaff]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncQueue(setSyncQueueState);
    void restoreSyncQueue().then(() => flushSyncQueue());
    const retryTimer = setInterval(() => {
      void flushSyncQueue();
    }, 15000);

    return () => {
      clearInterval(retryTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshClinicalDocuments();
    const refreshTimer = setInterval(() => {
      void refreshClinicalDocuments();
    }, 2 * 60 * 1000);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshClinicalDocuments();
      }
    });

    return () => {
      clearInterval(refreshTimer);
      subscription.remove();
    };
  }, [refreshClinicalDocuments]);

  useEffect(() => {
    if (screen === "patientNotes" || screen === "patientCarePlans") {
      void refreshClinicalDocuments();
    }
  }, [refreshClinicalDocuments, screen]);

  useEffect(() => {
    if (screen === "wardSettings") {
      void refreshWardSettings();
    }
  }, [refreshWardSettings, screen]);

  useEffect(() => {
    if (!selectedStaff) return;
    void loadOrganisationSettings(selectedStaff.organisationId ?? defaultOrganisationId)
      .then((result) => setOrganisationSettings(result.settings))
      .catch((error) => console.warn("Unable to refresh subscription status", error));
  }, [selectedStaff]);

  useEffect(() => {
    void refreshCustomerOrganisations();
  }, [refreshCustomerOrganisations]);

  useEffect(
    () =>
      subscribeToAuthSessionExpiry(() => {
        setSelectedStaffId("");
        setSelectedSiteId("");
        setSelectedWardId("");
        setSelectedPatientId("");
        setScreen("home");
        Alert.alert("Staff session expired", "Sign in again to save records and retry waiting uploads.");
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const loadConfiguration = async () => {
      if (screen === "adminSettings" && hasAdminAccess(selectedStaff)) return;
      const organisationId = hasAdminAccess(selectedStaff)
        ? adminOrganisationId
        : selectedStaff?.organisationId ?? defaultOrganisationId;
      try {
        const [
          siteResult,
          staffResult,
          wardResult,
          observationResult,
          patientResult,
          patientCarePlanResult,
          patientNoteResult,
          safetyIncidentResult,
          shiftHandoverResult,
          patientTaskResult,
          securityAreaResult,
          securityCheckResult,
          news2Result,
          foodFluidResult,
          medicationPrescriptionResult,
          medicationAdministrationResult,
          missedObservationResult,
          rotaAssignmentResult,
          staffShiftAssignmentResult,
          organisationSettingsResult
        ] = await Promise.all([
          loadSites(organisationId),
          loadStaff(organisationId),
          loadWards(organisationId),
          loadObservations(organisationId),
          loadPatients(organisationId, true),
          loadPatientCarePlans(organisationId, selectedWardId || undefined),
          loadPatientNotes(organisationId, selectedWardId || undefined),
          loadSafetyIncidents(organisationId, selectedWardId || undefined),
          loadShiftHandovers(organisationId, selectedWardId || undefined),
          loadPatientTasks(organisationId, selectedWardId || undefined),
          loadSecurityAreas(organisationId, selectedWardId || undefined),
          loadSecurityChecks(organisationId),
          loadNews2Readings(organisationId),
          loadFoodFluidEntries(organisationId),
          loadMedicationPrescriptions(organisationId),
          loadMedicationAdministrations(organisationId),
          loadMissedObservations(organisationId, selectedWardId || undefined),
          loadRotaAssignments(organisationId, selectedWardId || undefined),
          loadStaffShiftAssignments(organisationId, selectedWardId || undefined),
          loadOrganisationSettings(organisationId)
        ]);
        if (cancelled) return;
        setSites(siteResult.sites);
        setStaffMembers((currentStaff) => mergeById(staffResult.staff, currentStaff));
        setWards(wardResult.wards);
        setPatients((currentPatients) =>
          applyLatestGeneralObservations(
            mergeById(patientResult.patients, currentPatients),
            observationResult.observations
          )
        );
        setObservations((currentObservations) => mergeById(observationResult.observations, currentObservations));
        setPatientCarePlans((currentPlans) => mergeById(patientCarePlanResult.patientCarePlans, currentPlans));
        setPatientNotes((currentNotes) => mergeById(patientNoteResult.patientNotes, currentNotes));
        setSafetyIncidents((currentIncidents) =>
          mergeById(safetyIncidentResult.safetyIncidents, currentIncidents)
        );
        setShiftHandovers((currentHandovers) =>
          mergeById(shiftHandoverResult.shiftHandovers, currentHandovers)
        );
        setPatientTasks((currentTasks) => mergeById(patientTaskResult.patientTasks, currentTasks));
        setSecurityAreas((currentAreas) =>
          selectedWardId
            ? [
                ...currentAreas.filter((area) => area.wardId !== selectedWardId),
                ...securityAreaResult.securityAreas
              ]
            : securityAreaResult.securityAreas
        );
        setSecurityChecks((currentChecks) => mergeById(securityCheckResult.securityChecks, currentChecks));
        setNews2Readings((currentReadings) => mergeById(news2Result.news2Readings, currentReadings));
        setFoodFluidEntries((currentEntries) => mergeById(foodFluidResult.foodFluidEntries, currentEntries));
        setMedicationPrescriptions((currentPrescriptions) =>
          mergeById(medicationPrescriptionResult.medicationPrescriptions, currentPrescriptions)
        );
        setMedicationAdministrations((currentAdministrations) =>
          mergeById(medicationAdministrationResult.medicationAdministrations, currentAdministrations)
        );
        setMissedObservations((currentMissedObservations) =>
          mergeById(missedObservationResult.missedObservations, currentMissedObservations)
        );
        setRotaAssignments((currentAssignments) =>
          mergeById(rotaAssignmentResult.rotaAssignments, currentAssignments)
        );
        setStaffShiftAssignments((currentAssignments) =>
          mergeById(staffShiftAssignmentResult.staffShiftAssignments, currentAssignments)
        );
        setOrganisationSettings(organisationSettingsResult.settings);
      } catch (error) {
        console.warn("Unable to load backend data", error);
      }
    };

    void loadConfiguration();
    return () => {
      cancelled = true;
    };
  }, [adminOrganisationId, screen, selectedStaff?.organisationId, selectedWardId]);

  useEffect(() => {
    if (screen === "adminSettings" || !selectedStaff || wards.length === 0) return;
    const currentWard = wards.find((ward) => ward.id === selectedWardId);
    const currentWardAllowed = currentWard && (
      hasAdminAccess(selectedStaff) ||
      selectedStaff.allowedWardIds.includes(currentWard.id) ||
      selectedStaff.allowedSiteIds.includes(currentWard.siteId)
    );
    if (currentWardAllowed) return;

    const firstWard = wards.find((ward) =>
      hasAdminAccess(selectedStaff) ||
      selectedStaff.allowedWardIds.includes(ward.id) ||
      selectedStaff.allowedSiteIds.includes(ward.siteId)
    );
    if (!firstWard) return;
    setSelectedSiteId(firstWard.siteId);
    setSelectedWardId(firstWard.id);
    setSelectedPatientId(patients.find((patient) => patient.wardId === firstWard.id)?.id ?? "");
  }, [patients, screen, selectedStaff, selectedWardId, wards]);

  const persistOrQueue = async <T,>(
    label: string,
    run: () => Promise<T>,
    rethrowPermanentError = false
  ) => {
    try {
      const result = await run();
      await flushSyncQueue();
      return result;
    } catch (error) {
      if (!isQueuedSyncError(error)) {
        console.warn(`${label} save failed`, error);
        if (rethrowPermanentError) {
          throw error;
        }
      }
      return undefined;
    }
  };

  const showSyncStatus = () => {
    setIsSyncStatusVisible(true);
  };

  const confirmRemoveSyncItem = (item: SyncQueueStateItem) => {
    Alert.alert(
      "Remove this upload?",
      `${item.label}\n${item.path}\n\nOnly remove this if it is known to be stale, invalid or already saved elsewhere.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeSyncQueueItem(item.id);
          }
        }
      ]
    );
  };

  const confirmRemoveReviewSyncItems = () => {
    const reviewCount = syncQueueState.items.filter((item) => item.needsReview).length;
    if (reviewCount === 0) {
      return;
    }

    Alert.alert(
      "Remove uploads needing review?",
      `${reviewCount} upload${reviewCount === 1 ? "" : "s"} failed with a permanent issue such as malformed data or a parse error.\n\nOnly remove them if they are stale, invalid, or have already been recorded another way.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeSyncQueueItemsNeedingReview();
          }
        }
      ]
    );
  };

  const accessibleSites = useMemo(() => {
    if (!selectedStaff) {
      return [];
    }

    if (hasAdminAccess(selectedStaff)) {
      return platformSites;
    }

    const allowedWardSiteIds = wards
      .filter((ward) => selectedStaff.allowedWardIds.includes(ward.id))
      .map((ward) => ward.siteId);
    const allowedSiteIds = new Set([...selectedStaff.allowedSiteIds, ...allowedWardSiteIds]);

    return sites.filter((site) => allowedSiteIds.has(site.id));
  }, [platformSites, selectedStaff, sites, wards]);

  const siteWards = useMemo(
    () =>
      (hasAdminAccess(selectedStaff) ? platformWards : wards).filter(
        (ward) =>
          ward.siteId === selectedSiteId &&
          (hasAdminAccess(selectedStaff) || selectedStaff?.allowedWardIds.includes(ward.id))
      ).map((ward) => applyOrganisationEntitlements(ward, organisationSettings)),
    [organisationSettings, platformWards, selectedSiteId, selectedStaff, wards]
  );

  const accessibleWards = useMemo(() => {
    if (!selectedStaff) {
      return [];
    }

    if (hasAdminAccess(selectedStaff)) {
      return platformWards;
    }

    return wards.filter((ward) => selectedStaff.allowedWardIds.includes(ward.id));
  }, [platformWards, selectedStaff, wards]);

  const wardPatients = useMemo(
    () => patients.filter((patient) => !patient.archived && patient.wardId === selectedWardId),
    [patients, selectedWardId]
  );

  const handleSelectStaff = async (staffId: string) => {
    if (!staffId) {
      await clearAuthSession();
      selectStaffSession(undefined);
      setScreen("home");
      return;
    }

    const staff = staffMembers.find((item) => item.id === staffId);
    selectStaffSession(staff);
  };

  const selectStaffSession = (staff: StaffMember | undefined) => {
    setSelectedStaffId(staff?.id ?? "");
    if (!staff) {
      setSelectedSiteId("");
      setSelectedWardId("");
      setSelectedPatientId("");
      return;
    }

    const staffCanSeeAll = hasAdminAccess(staff);
    if (staffCanSeeAll && staff.organisationId) {
      setAdminOrganisationId(staff.organisationId);
    }
    const firstWard = wards.find((ward) =>
      staffCanSeeAll
        ? true
        : staff.allowedWardIds.includes(ward.id) ||
          staff.allowedSiteIds.includes(ward.siteId)
    );
    const firstSiteId = firstWard?.siteId ?? staff.allowedSiteIds[0] ?? "";

    setSelectedSiteId(firstSiteId);
    setSelectedWardId(firstWard?.id ?? "");
    const firstPatient = patients.find((patient) => patient.wardId === firstWard?.id);
    setSelectedPatientId(firstPatient?.id ?? "");
  };

  const persistActivityDeadline = useCallback(
    (now = Date.now(), force = false) => {
      if (!selectedStaffId) {
        return;
      }

      const deadlineAt = now + getInactivityGraceMs() + getSessionTimeoutMs(selectedWard);
      if (force || now - lastActivityDeadlinePersistedAtRef.current >= 30000) {
        lastActivityDeadlinePersistedAtRef.current = now;
        void storeAuthSessionLockDeadline(deadlineAt);
      }
    },
    [selectedStaffId, selectedWard?.sessionTimeoutMinutes]
  );

  const resetActivityTimer = useCallback(() => {
    const now = Date.now();
    lastActivityAtRef.current = now;
    inactivityCountdownStartedAtRef.current = null;
    persistActivityDeadline(now);
  }, [persistActivityDeadline]);

  useEffect(() => {
    if (selectedStaffId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const lockDeadlineAt = await getAuthSessionLockDeadline();
      if (lockDeadlineAt && Date.now() >= lockDeadlineAt) {
        await clearAuthSession();
        if (!cancelled) {
          Alert.alert("Staff session expired", "Sign in again to continue.");
        }
        return undefined;
      }

      return loadCurrentStaffSession();
    })()
      .then((staff) => {
        if (!staff || cancelled) return;
        setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, staff));
        selectStaffSession(staff);
        void flushSyncQueue();
      })
      .catch((error) => {
        console.warn("Unable to restore staff session", error);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStaffId, patients, wards]);

  useEffect(() => {
    if (!selectedStaffId) {
      lastActivityDeadlinePersistedAtRef.current = 0;
      return;
    }

    resetActivityTimer();
  }, [resetActivityTimer, selectedStaffId, selectedWard?.sessionTimeoutMinutes]);

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener("keyboardDidShow", () => {
      keyboardActiveRef.current = true;
      resetActivityTimer();
    });
    const keyboardHideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      keyboardActiveRef.current = false;
      resetActivityTimer();
    });

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [resetActivityTimer]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }

    document.addEventListener("keydown", resetActivityTimer);
    document.addEventListener("pointerdown", resetActivityTimer);
    document.addEventListener("wheel", resetActivityTimer);

    return () => {
      document.removeEventListener("keydown", resetActivityTimer);
      document.removeEventListener("pointerdown", resetActivityTimer);
      document.removeEventListener("wheel", resetActivityTimer);
    };
  }, [resetActivityTimer]);

  const lockInactiveStaffSession = useCallback(async () => {
    if (!selectedStaffId) {
      return;
    }

    const session = await getAuthSession();
    if (session) {
      const expired = await expireAuthSession(session.token);
      if (!expired) return;
    } else {
      setSelectedStaffId("");
      setSelectedSiteId("");
      setSelectedWardId("");
      setSelectedPatientId("");
      setScreen("home");
      Alert.alert("Session locked", "The staff session was locked after inactivity. Sign in again to continue.");
    }
  }, [selectedStaffId]);

  useEffect(() => {
    if (!selectedStaffId) {
      return;
    }

    resetActivityTimer();
    const inactivityGraceMs = getInactivityGraceMs();
    const timeoutMs = getSessionTimeoutMs(selectedWard);
    const timer = setInterval(() => {
      if (keyboardActiveRef.current) {
        resetActivityTimer();
        return;
      }

      const now = Date.now();
      const inactiveForMs = now - lastActivityAtRef.current;
      if (inactiveForMs < inactivityGraceMs) {
        inactivityCountdownStartedAtRef.current = null;
        return;
      }

      if (!inactivityCountdownStartedAtRef.current) {
        inactivityCountdownStartedAtRef.current = now;
        return;
      }

      if (now - inactivityCountdownStartedAtRef.current >= timeoutMs) {
        void lockInactiveStaffSession();
      }
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, [lockInactiveStaffSession, resetActivityTimer, selectedStaffId, selectedWard?.sessionTimeoutMinutes]);

  useEffect(() => {
    if (!selectedStaffId) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        persistActivityDeadline(Date.now(), true);
        return;
      }

      void (async () => {
        const now = Date.now();
        const lockDeadlineAt = await getAuthSessionLockDeadline();
        if (lockDeadlineAt && now >= lockDeadlineAt) {
          await lockInactiveStaffSession();
          return;
        }

        const inactiveForMs = now - lastActivityAtRef.current;
        const countdownStartedAt = inactivityCountdownStartedAtRef.current;
        if (
          inactiveForMs >= getInactivityGraceMs() &&
          countdownStartedAt &&
          now - countdownStartedAt >= getSessionTimeoutMs(selectedWard)
        ) {
          await lockInactiveStaffSession();
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [lockInactiveStaffSession, persistActivityDeadline, selectedStaffId, selectedWard?.sessionTimeoutMinutes]);

  const handleReadStaffCardData = async (cardData: string) => {
    const parsedCard = parseStaffCardData(cardData, organisationSettings.nfcStaffCodeFormat);

    if (!parsedCard) {
      return "No STAFFCODE found on that card data.";
    }

    const matchingLocalStaff = staffMembers.filter(
      (staff) => staff.staffCode.toLowerCase() === parsedCard.staffCode.toLowerCase()
    );
    const localOrganisationId =
      matchingLocalStaff.length === 1 ? matchingLocalStaff[0]?.organisationId : undefined;
    const organisationHint = selectedStaff?.organisationId ?? localOrganisationId;

    try {
      const { staff } = await lookupStaffByCode(parsedCard.staffCode, organisationHint);
      setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, staff));
      selectStaffSession(staff);
      void flushSyncQueue();
      return `Selected ${staff.name} from Postgres STAFFCODE ${parsedCard.staffCode}.`;
    } catch (error) {
      const matchedStaff = matchingLocalStaff.length === 1 ? matchingLocalStaff[0] : undefined;

      if (!matchedStaff) {
        return error instanceof Error
          ? `NFC card read, but sign-in was not completed: ${error.message}`
          : `No staff found for STAFFCODE ${parsedCard.staffCode}.`;
      }

      if (matchedStaff.loginPinMustChange) {
        return "NFC card recognised, but an authenticated session could not be started. Check the connection and scan the card again before changing the temporary PIN.";
      }

      selectStaffSession(matchedStaff);
      return `Selected ${matchedStaff.name} for offline local access. Online-only changes will require a fresh authenticated sign-in.`;
    }
  };

  const handleBankStaffPinLogin = async (staffCode: string, loginPin: string) => {
    const { staff } = await loginBankStaffByPin(
      staffCode,
      loginPin,
      selectedStaff?.organisationId ?? defaultOrganisationId
    );
    setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, staff));
    selectStaffSession(staff);
    void flushSyncQueue();
    return `Selected ${staff.name} for bank/temp access.`;
  };

  const handleStaffPinLogin = async (staffCode: string, loginPin: string) => {
    const { staff } = await loginStaffByPin(
      staffCode,
      loginPin,
      selectedStaff?.organisationId ?? defaultOrganisationId
    );
    setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, staff));
    selectStaffSession(staff);
    void flushSyncQueue();
    return `Selected ${staff.name}.`;
  };

  const handleChangeStaffPin = async (currentPin: string, newPin: string) => {
    const { staff } = await changeStaffPin(currentPin, newPin);
    setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, staff));
    selectStaffSession(staff);
    void flushSyncQueue();
    return "PIN updated. You can now continue.";
  };

  const handleUnlockStaffAccess = async (lockedStaffCode: string, nurseInChargeStaffCode: string) => {
    const result = await unlockStaffAccess(
      lockedStaffCode,
      nurseInChargeStaffCode,
      selectedStaff?.organisationId ?? defaultOrganisationId
    );
    return result.message;
  };

  const handleScanStaffCard = async () => {
    const cardData = await readNfcTextPayload();

    return handleReadStaffCardData(cardData);
  };

  const handleSelectSite = async (siteId: string) => {
    if (hasAdminAccess(selectedStaff)) {
      const site = platformSites.find((item) => item.id === siteId);
      if (site?.organisationId && site.organisationId !== adminOrganisationId) {
        await selectAdminOrganisation(site.organisationId);
      }
      const firstPlatformWard = platformWards.find((ward) => ward.siteId === siteId);
      setSelectedSiteId(siteId);
      setSelectedWardId(firstPlatformWard?.id ?? "");
      setSelectedPatientId("");
      return;
    }
    setSelectedSiteId(siteId);
    const firstWard = wards.find(
      (ward) => ward.siteId === siteId && selectedStaff?.allowedWardIds.includes(ward.id)
    );
    if (firstWard) {
      setSelectedWardId(firstWard.id);
      const firstPatient = patients.find((patient) => patient.wardId === firstWard.id);
      setSelectedPatientId(firstPatient?.id ?? "");
    }
  };

  const handleSelectWard = async (wardId: string) => {
    if (hasAdminAccess(selectedStaff)) {
      const platformWard = platformWards.find((ward) => ward.id === wardId);
      if (platformWard?.organisationId && platformWard.organisationId !== adminOrganisationId) {
        await selectAdminOrganisation(platformWard.organisationId);
      }
      if (platformWard) setSelectedSiteId(platformWard.siteId);
    }
    setSelectedWardId(wardId);
    const firstPatient = patients.find((patient) => patient.wardId === wardId);
    setSelectedPatientId(firstPatient?.id ?? "");
  };

  const handleObservationSaved = (observation: Observation) => {
    setObservations((currentObservations) => [observation, ...currentObservations]);
    if (observation.source !== "General observations") {
      return;
    }

    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.id === observation.patientId
          ? {
              ...patient,
              latestObservationPlace: observation.location,
              latestObservationTime: observation.observedAt,
              latestObservedBy: observation.observerName,
              latestPresentation: observation.presentation,
              onOffWard: observation.location === "Off ward" || observation.location === "LOA" ? "Off ward" : "On ward"
            }
          : patient
      )
    );
  };

  const handleUpdateWardInterval = (wardId: string, observationIntervalMinutes: number) => {
    const updatedWard = wards.find((ward) => ward.id === wardId);

    if (updatedWard) {
      void persistOrQueue("ward", () =>
        persistWard({
          ...updatedWard,
          observationIntervalMinutes,
          organisationId: hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId
        })
      );
    }

    setWards((currentWards) =>
      currentWards.map((ward) =>
        ward.id === wardId
          ? {
              ...ward,
              observationIntervalMinutes
            }
          : ward
      )
    );
    if (hasAdminAccess(selectedStaff)) {
      setPlatformWards((currentWards) =>
        currentWards.map((ward) =>
          ward.id === wardId ? { ...ward, observationIntervalMinutes } : ward
        )
      );
    }
  };

  const handleUpdateWardRotaEnabled = (wardId: string, staffRotaEnabled: boolean) => {
    const updatedWard = wards.find((ward) => ward.id === wardId);

    if (updatedWard) {
      void persistOrQueue("ward", () =>
        persistWard({
          ...updatedWard,
          staffRotaEnabled,
          organisationId: hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId
        })
      );
    }

    setWards((currentWards) =>
      currentWards.map((ward) =>
        ward.id === wardId
          ? {
              ...ward,
              staffRotaEnabled
            }
          : ward
      )
    );
    if (hasAdminAccess(selectedStaff)) {
      setPlatformWards((currentWards) =>
        currentWards.map((ward) => ward.id === wardId ? { ...ward, staffRotaEnabled } : ward)
      );
    }
  };

  const handleUpdateWardRotaSettings = async (updatedWard: Ward) => {
    setWards((currentWards) =>
      currentWards.map((ward) => (ward.id === updatedWard.id ? updatedWard : ward))
    );
    if (hasAdminAccess(selectedStaff)) {
      setPlatformWards((currentWards) =>
        currentWards.map((ward) =>
          ward.id === updatedWard.id ? { ...updatedWard, organisationId: ward.organisationId } : ward
        )
      );
    }
    const savedWard = await persistOrQueue("ward", () =>
      persistWard({
        ...updatedWard,
        organisationId: hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId
      })
    );
    if (savedWard) {
      setWards((currentWards) => upsertWard(currentWards, savedWard));
    }
  };

  const handleCreateSite = async (site: Site) => {
    const savedSite = await persistOrQueue("site", () =>
      persistSite({ ...site, organisationId: site.organisationId ?? (hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId) }),
      true
    );
    setSites((currentSites) => upsertSite(currentSites, savedSite ?? site));
    if (hasAdminAccess(selectedStaff)) {
      setSelectedSiteId((savedSite ?? site).id);
      await refreshCustomerOrganisations();
    }
  };

  const handleCreateWard = async (ward: Ward) => {
    const savedWard = await persistOrQueue("ward", () =>
      persistWard({ ...ward, organisationId: ward.organisationId ?? (hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId) }),
      true
    );
    setWards((currentWards) => upsertWard(currentWards, savedWard ?? ward));
    if (hasAdminAccess(selectedStaff)) {
      setSelectedWardId((savedWard ?? ward).id);
      await refreshCustomerOrganisations();
    }
  };

  const handleDeleteDemoWard = async (ward: Ward) => {
    const result = await persistDemoWardDelete(ward.id, adminOrganisationId, ward.name);
    const deletedPatientIds = new Set(
      patients.filter((patient) => patient.wardId === ward.id).map((patient) => patient.id)
    );
    const deletedSecurityAreaIds = new Set(
      securityAreas.filter((area) => area.wardId === ward.id).map((area) => area.id)
    );

    setPatients((current) => current.filter((patient) => patient.wardId !== ward.id));
    setObservations((current) => current.filter((item) => !deletedPatientIds.has(item.patientId)));
    setNews2Readings((current) => current.filter((item) => !deletedPatientIds.has(item.patientId)));
    setFoodFluidEntries((current) => current.filter((item) => !deletedPatientIds.has(item.patientId)));
    setMedicationPrescriptions((current) => current.filter((item) => !deletedPatientIds.has(item.patientId)));
    setMedicationAdministrations((current) => current.filter((item) => !deletedPatientIds.has(item.patientId)));
    setPatientCarePlans((current) => current.filter((item) => item.wardId !== ward.id));
    setPatientNotes((current) => current.filter((item) => item.wardId !== ward.id));
    setSafetyIncidents((current) => current.filter((item) => item.wardId !== ward.id));
    setShiftHandovers((current) => current.filter((item) => item.wardId !== ward.id));
    setPatientTasks((current) => current.filter((item) => item.wardId !== ward.id));
    setMissedObservations((current) => current.filter((item) => item.wardId !== ward.id));
    setRotaAssignments((current) => current.filter((item) => item.wardId !== ward.id));
    setStaffShiftAssignments((current) => current.filter((item) => item.wardId !== ward.id));
    setSecurityAreas((current) => current.filter((item) => item.wardId !== ward.id));
    setSecurityChecks((current) => current.filter((item) => !deletedSecurityAreaIds.has(item.areaId)));
    setWards((current) => current.filter((item) => item.id !== ward.id));
    setPlatformWards((current) => current.filter((item) => item.id !== ward.id));
    setSelectedWardId((current) => current === ward.id ? "" : current);

    await Promise.all([
      selectAdminOrganisation(adminOrganisationId),
      refreshCustomerOrganisations()
    ]);
    return result;
  };

  const handleUpdateOrganisationSettings = async (settings: OrganisationSettings) => {
    const nextSettings = {
      ...settings,
      organisationId: hasAdminAccess(selectedStaff)
        ? settings.organisationId
        : selectedStaff?.organisationId ?? defaultOrganisationId
    };
    const result = await persistOrQueue("organisation settings", () =>
      persistOrganisationSettings({
        ...nextSettings,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
    setOrganisationSettings(result?.settings ?? nextSettings);
    await refreshCustomerOrganisations();
  };

  const handleCreateCustomerOrganisation = async (name: string) => {
    const result = await createCustomerOrganisation(name);
    await refreshCustomerOrganisations();
    await selectAdminOrganisation(result.organisation.id);
  };

  const handleDeleteCustomerOrganisation = async (organisationId: string) => {
    await deleteCustomerOrganisation(organisationId);
    const result = await loadCustomerOrganisations();
    setCustomerOrganisations(result.organisations);
    const fallback = result.organisations.find((organisation) => organisation.id === selectedStaff?.organisationId)
      ?? result.organisations[0];
    if (fallback) await selectAdminOrganisation(fallback.id);
  };

  const handleCreateStaffMember = async (staff: StaffMember) => {
    const result = await persistOrQueue("staff member", () =>
      persistStaffMember({
        ...staff,
        organisationId: staff.organisationId ?? selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
    setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, result?.staff ?? staff));
  };

  const handleResetStaffPin = async (staffId: string) => {
    const result = await resetStaffPin(staffId);
    setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, result.staff));
  };

  const handleUpdatePatient = async (updatedPatient: Patient) => {
    const previousPatient = patients.find((patient) => patient.id === updatedPatient.id);
    const tesoHasEnded =
      Boolean(previousPatient?.enhancedObservation) &&
      !updatedPatient.enhancedObservation &&
      updatedPatient.observationLevel === "Intermittent";

    setPatients((currentPatients) =>
      currentPatients.map((patient) => (patient.id === updatedPatient.id ? updatedPatient : patient))
    );

    if (tesoHasEnded) {
      setRotaAssignments((currentAssignments) =>
        currentAssignments.filter(
          (assignment) => assignment.role !== "Enhanced/TESO" || assignment.patientId !== updatedPatient.id
        )
      );
    }
    await persistOrQueue("patient update", () =>
      persistPatient({
        ...updatedPatient,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
  };

  const handleRefreshPatients = async () => {
    const result = await loadPatients(
      hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId ?? defaultOrganisationId,
      true
    );
    setPatients((currentPatients) => mergeById(result.patients, currentPatients));
  };

  const handleSaveManagedPatient = async (patient: Patient) => {
    const result = await persistManagedPatient({
      ...patient,
      organisationId: hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId,
      actorStaffId: selectedStaff?.id,
      actorStaffCode: selectedStaff?.staffCode
    });
    setPatients((currentPatients) => upsertPatient(currentPatients, result.patient));
  };

  const activePatientOrganisationId = () =>
    hasAdminAccess(selectedStaff) ? adminOrganisationId : selectedStaff?.organisationId;

  const handleTransferManagedPatient = async (patientId: string, wardId: string, reason: string) => {
    const result = await persistPatientTransfer(patientId, wardId, reason, activePatientOrganisationId());
    setPatients((currentPatients) => upsertPatient(currentPatients, result.patient));
  };

  const handleArchiveManagedPatient = async (patientId: string, reason: string) => {
    const result = await persistPatientArchive(patientId, reason, activePatientOrganisationId());
    setPatients((currentPatients) => upsertPatient(currentPatients, result.patient));
  };

  const handleRestoreManagedPatient = async (patientId: string, wardId: string, reason: string) => {
    const result = await persistPatientRestore(patientId, wardId, reason, activePatientOrganisationId());
    setPatients((currentPatients) => upsertPatient(currentPatients, result.patient));
  };

  const handleCreatePatientNote = async (note: PatientNote) => {
    const result = await persistOrQueue(
      "patient note",
      () =>
        persistPatientNote({
          ...note,
          organisationId: selectedStaff?.organisationId,
          actorStaffId: selectedStaff?.id,
          actorStaffCode: selectedStaff?.staffCode
        }),
      true
    );
    setPatientNotes((currentNotes) => upsertById(currentNotes, result ?? note));
  };

  const handleCreatePatientCarePlan = async (plan: PatientCarePlan) => {
    const result = await persistOrQueue(
      "patient care plan",
      () =>
        persistPatientCarePlan({
          ...plan,
          organisationId: selectedStaff?.organisationId,
          actorStaffId: selectedStaff?.id,
          actorStaffCode: selectedStaff?.staffCode
        }),
      true
    );
    setPatientCarePlans((currentPlans) => upsertById(currentPlans, result ?? plan));
  };

  const handleSaveSafetyIncident = async (incident: SafetyIncident) => {
    const previousIncident = safetyIncidents.find((item) => item.id === incident.id);
    setSafetyIncidents((currentIncidents) => upsertById(currentIncidents, incident));
    try {
      const result = await persistOrQueue(
        "safety incident",
        () =>
          persistSafetyIncident({
            ...incident,
            organisationId: selectedStaff?.organisationId,
            actorStaffId: selectedStaff?.id,
            actorStaffCode: selectedStaff?.staffCode
          }),
        true
      );
      if (result) {
        setSafetyIncidents((currentIncidents) => upsertById(currentIncidents, result));
      }
    } catch (error) {
      setSafetyIncidents((currentIncidents) =>
        previousIncident
          ? upsertById(currentIncidents, previousIncident)
          : currentIncidents.filter((item) => item.id !== incident.id)
      );
      throw error;
    }
  };

  const handleCreateShiftHandover = async (handover: ShiftHandover) => {
    const result = await persistOrQueue(
      "shift handover",
      () =>
        persistShiftHandover({
          ...handover,
          organisationId: selectedStaff?.organisationId,
          actorStaffId: selectedStaff?.id,
          actorStaffCode: selectedStaff?.staffCode
        }),
      true
    );
    setShiftHandovers((currentHandovers) => upsertById(currentHandovers, result ?? handover));
  };

  const handleSavePatientTask = async (task: PatientTask) => {
    const previousTask = patientTasks.find((item) => item.id === task.id);
    setPatientTasks((currentTasks) => upsertById(currentTasks, task));
    try {
      const result = await persistOrQueue(
        "patient task",
        () =>
          persistPatientTask({
            ...task,
            organisationId: selectedStaff?.organisationId,
            actorStaffId: selectedStaff?.id,
            actorStaffCode: selectedStaff?.staffCode
          }),
        true
      );
      if (result) {
        setPatientTasks((currentTasks) => upsertById(currentTasks, result));
      }
    } catch (error) {
      setPatientTasks((currentTasks) =>
        previousTask
          ? upsertById(currentTasks, previousTask)
          : currentTasks.filter((item) => item.id !== task.id)
      );
      throw error;
    }
  };

  const handleCreateRotaAssignment = (assignment: RotaAssignment) => {
    if (!rosteringEnabled) {
      showFeatureUpgrade("Staff rostering");
      return;
    }
    setRotaAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("rota assignment", () =>
      persistRotaAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleUpdateRotaAssignment = (assignment: RotaAssignment) => {
    if (!rosteringEnabled) {
      showFeatureUpgrade("Staff rostering");
      return;
    }
    setRotaAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("rota assignment", () =>
      persistRotaAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleRemoveRotaAssignment = (assignmentId: string) => {
    if (!rosteringEnabled) {
      showFeatureUpgrade("Staff rostering");
      return;
    }
    setRotaAssignments((currentAssignments) => currentAssignments.filter((assignment) => assignment.id !== assignmentId));
    void persistOrQueue("rota assignment delete", () =>
      persistRotaAssignmentDelete(assignmentId, selectedStaff?.organisationId)
    );
  };

  const handleAssignStaffShift = (assignment: StaffShiftAssignment) => {
    if (!rosteringEnabled) {
      showFeatureUpgrade("Staff rostering");
      return;
    }
    setStaffShiftAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("staff shift assignment", () =>
      persistStaffShiftAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleRemoveStaffShiftAssignment = (assignmentId: string) => {
    if (!rosteringEnabled) {
      showFeatureUpgrade("Staff rostering");
      return;
    }
    setStaffShiftAssignments((currentAssignments) =>
      currentAssignments.filter((assignment) => assignment.id !== assignmentId)
    );
    void persistOrQueue("staff shift assignment delete", () =>
      persistStaffShiftAssignmentDelete(assignmentId, selectedStaff?.organisationId)
    );
  };

  const handleUpdateStaffShiftAssignment = (assignment: StaffShiftAssignment) => {
    if (!rosteringEnabled) {
      showFeatureUpgrade("Staff rostering");
      return;
    }
    setStaffShiftAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("staff shift assignment", () =>
      persistStaffShiftAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleCreateNews2Reading = (reading: News2Reading) => {
    setNews2Readings((currentReadings) => [...currentReadings, reading]);
    void persistOrQueue("NEWS2 reading", () =>
      persistNews2Reading({ ...reading, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleCreateFoodFluidEntry = (entry: FoodFluidEntry) => {
    setFoodFluidEntries((currentEntries) => [entry, ...currentEntries]);
    void persistOrQueue("food and fluid entry", () =>
      persistFoodFluidEntry({
        ...entry,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
  };

  const handleCreateSecurityCheck = (check: SecurityCheck) => {
    setSecurityChecks((currentChecks) => [check, ...currentChecks]);
    void persistOrQueue("security check", () =>
      persistSecurityCheck({ ...check, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleSaveSecurityArea = async (area: SecurityArea) => {
    setSecurityAreas((currentAreas) => upsertById(currentAreas, area));
    const saved = await persistOrQueue("security area", () =>
      persistSecurityArea({
        ...area,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
    if (saved?.securityArea) {
      setSecurityAreas((currentAreas) => upsertById(currentAreas, saved.securityArea));
    }
    return Boolean(saved?.securityArea);
  };

  const handleDeleteSecurityArea = async (areaId: string) => {
    setSecurityAreas((currentAreas) => currentAreas.filter((area) => area.id !== areaId));
    const result = await persistOrQueue("security area delete", () =>
      persistSecurityAreaDelete(areaId, selectedStaff?.organisationId)
    );
    return Boolean(result?.deletedId);
  };

  const handleCreateMedicationPrescription = (prescription: MedicationPrescription) => {
    setMedicationPrescriptions((currentPrescriptions) => [prescription, ...currentPrescriptions]);
    void persistOrQueue("medication prescription", () =>
      persistMedicationPrescription({
        ...prescription,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
  };

  const handleCreateMedicationAdministration = (administration: MedicationAdministration) => {
    setMedicationAdministrations((currentAdministrations) => upsertById(currentAdministrations, administration));
    void persistOrQueue("medication administration", () =>
      persistMedicationAdministration({
        ...administration,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
  };

  const handleCreateMissedObservation = (missedObservation: MissedObservation) => {
    setMissedObservations((currentMissedObservations) => [missedObservation, ...currentMissedObservations]);
    void persistOrQueue("missed observation", () =>
      persistMissedObservation({
        ...missedObservation,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
  };

  const handleDiscontinueMedicationPrescription = (updatedPrescription: MedicationPrescription) => {
    setMedicationPrescriptions((currentPrescriptions) =>
      currentPrescriptions.map((prescription) =>
        prescription.id === updatedPrescription.id ? updatedPrescription : prescription
      )
    );
    void persistOrQueue("medication prescription update", () =>
      persistMedicationPrescriptionUpdate({
        ...updatedPrescription,
        organisationId: selectedStaff?.organisationId,
        actorStaffId: selectedStaff?.id,
        actorStaffCode: selectedStaff?.staffCode
      })
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={["top", "left", "right"]} onTouchStart={resetActivityTimer} style={styles.shell}>
        <StatusBar backgroundColor="#ffffff" style="dark" />
        <View style={styles.header}>
        <View style={styles.brand}>
          {organisationSettings.logoDataUri ? (
            <View style={styles.organisationLogoFrame}>
              <Image
                accessibilityLabel="Company logo"
                resizeMode="contain"
                source={{ uri: organisationSettings.logoDataUri }}
                style={styles.organisationLogo}
              />
            </View>
          ) : null}
          <View>
            <Text style={styles.appName}>Secure Obs</Text>
            <Text style={styles.subtitle}>High secure ward observation workflow</Text>
          </View>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={showSyncStatus} style={styles.badge}>
          <Text style={styles.badgeText}>{syncStatusLabel(syncQueueState)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={screen === "home" ? styles.homeContent : styles.content}
        horizontal={false}
        keyboardShouldPersistTaps="handled"
      >
        {screen === "home" ? (
          <HomeScreen
            selectedStaffId={selectedStaffId}
            selectedSiteId={selectedSiteId}
            selectedWardId={selectedWardId}
            sites={accessibleSites}
            staff={staffMembers}
            wards={siteWards}
            onSelectStaff={handleSelectStaff}
            onSelectSite={handleSelectSite}
            onSelectWard={handleSelectWard}
            onStaffPinLogin={handleStaffPinLogin}
            onChangeStaffPin={handleChangeStaffPin}
            onBankStaffPinLogin={handleBankStaffPinLogin}
            onUnlockStaffAccess={handleUnlockStaffAccess}
            onScanStaffCard={handleScanStaffCard}
            onOpenAdminSettings={() => setScreen("adminSettings")}
            onOpenWardSettings={() => setScreen("wardSettings")}
            complianceGovernanceEnabled={cqcReportingEnabled}
            onOpenComplianceGovernance={() => setScreen("complianceGovernance")}
            onStart={() => setScreen(selectedWard?.landingPage === "observations" ? "observations" : "wardOverview")}
          />
        ) : screen === "adminSettings" ? (
          <AdminSettingsScreen
            customerOrganisations={customerOrganisations}
            selectedOrganisationId={adminOrganisationId}
            organisationSettings={organisationSettings}
            sites={sites}
            staff={staffMembers.filter((member) => member.organisationId === adminOrganisationId)}
            wards={wards}
            onBack={() => {
              setScreen("home");
              const staffOrganisationId = selectedStaff?.organisationId ?? defaultOrganisationId;
              if (adminOrganisationId !== staffOrganisationId) void selectAdminOrganisation(staffOrganisationId);
            }}
            onCreateCustomerOrganisation={handleCreateCustomerOrganisation}
            onDeleteCustomerOrganisation={handleDeleteCustomerOrganisation}
            onSelectCustomerOrganisation={selectAdminOrganisation}
            onOpenAuditLog={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("auditLog");
            }}
            onCreateSite={handleCreateSite}
            onCreateStaff={handleCreateStaffMember}
            onCreateWard={handleCreateWard}
            onDeleteDemoWard={handleDeleteDemoWard}
            onUpdateOrganisationSettings={handleUpdateOrganisationSettings}
          />
        ) : screen === "auditLog" ? (
          <AuditLogScreen
            organisationId={selectedStaff?.organisationId ?? defaultOrganisationId}
            selectedStaff={selectedStaff}
            backLabel={workspaceBackScreen === "complianceGovernance" ? "Back to compliance" : "Back"}
            onBack={() => setScreen(workspaceBackScreen === "complianceGovernance" ? "complianceGovernance" : "adminSettings")}
          />
        ) : screen === "complianceGovernance" ? (
          <ComplianceGovernanceScreen
            carePlans={patientCarePlans}
            incidents={safetyIncidents}
            missedObservations={missedObservations}
            news2Readings={news2Readings}
            patients={wardPatients}
            patientTasks={patientTasks}
            securityAreas={securityAreas}
            securityChecks={securityChecks}
            shiftHandovers={shiftHandovers}
            ward={selectedWard}
            onBack={() => setScreen("home")}
            onOpenAuditLog={() => {
              setWorkspaceBackScreen("complianceGovernance");
              setScreen("auditLog");
            }}
            onOpenIncidents={() => {
              setWorkspaceBackScreen("complianceGovernance");
              setScreen("safetyEscalation");
            }}
            onOpenPatientCarePlans={() => {
              setWorkspaceBackScreen("complianceGovernance");
              setScreen("patientCarePlans");
            }}
            onOpenPatientTasks={() => {
              setWorkspaceBackScreen("complianceGovernance");
              setScreen("patientTasks");
            }}
            onOpenWardSettings={() => setScreen("wardSettings")}
          />
        ) : screen === "wardSettings" ? (
          <WardSettingsScreen
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            organisationSettings={organisationSettings}
            staff={staffMembers}
            wards={hasAdminAccess(selectedStaff)
              ? wards
                  .filter((ward) => ward.siteId === selectedSiteId)
                  .map((ward) => applyOrganisationEntitlements(ward, organisationSettings))
              : siteWards}
            onBack={() => setScreen("home")}
            onUpdateWardInterval={handleUpdateWardInterval}
            onUpdateWardRotaEnabled={handleUpdateWardRotaEnabled}
            onUpdateWardRotaSettings={handleUpdateWardRotaSettings}
            onOpenSecurityCheckSettings={() => setScreen("securityCheckSettings")}
            onCreateStaff={handleCreateStaffMember}
            onResetStaffPin={handleResetStaffPin}
          />
        ) : screen === "securityCheckSettings" ? (
          <SecurityCheckSettingsScreen
            areas={securityAreas}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={siteWards}
            onBack={() => setScreen("wardSettings")}
            onDeleteArea={handleDeleteSecurityArea}
            onSaveArea={handleSaveSecurityArea}
          />
        ) : screen === "wardOverview" ? (
          <WardOverviewScreen
            foodFluidEntries={foodFluidEntries}
            incidents={safetyIncidents}
            news2Readings={news2Readings}
            observations={observations}
            patients={wardPatients}
            patientTasks={patientTasks}
            securityAreas={securityAreas}
            securityChecks={securityChecks}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            staffShiftAssignments={staffShiftAssignments}
            syncPendingCount={syncQueueState.pendingCount}
            ward={selectedWard}
            onChangeStaffOrWard={() => setScreen("home")}
            onOpenEnhanced={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("enhanced");
            }}
            onOpenAnalytics={() => {
              if (!analyticsEnabled) {
                Alert.alert("Feature not included", "Analytics dashboard is not enabled for this SecureObs package.");
                return;
              }
              setWorkspaceBackScreen("wardOverview");
              setScreen("analytics");
            }}
            onOpenGeneralObservations={() => setScreen("observations")}
            onOpenFoodFluidChart={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("foodFluidChart");
            }}
            onOpenMedicationChart={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("medicationChart");
            }}
            onOpenNews2={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("news2");
            }}
            onOpenPatientManagement={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("patientManagement");
            }}
            onOpenPatientCarePlans={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("patientCarePlans");
            }}
            onOpenPatientDashboard={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("patientDashboard");
            }}
            onOpenPatientNotes={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("patientNotes");
            }}
            onOpenPatientTasks={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("patientTasks");
            }}
            onOpenSafetyCentre={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("safetyEscalation");
            }}
            onOpenShiftHandover={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("shiftHandover");
            }}
            onOpenPatientSettings={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("patientSettings");
            }}
            onOpenPreviousObservations={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("previousObservations");
            }}
            onOpenSecurityChecks={() => {
              setWorkspaceBackScreen("wardOverview");
              setScreen("securityChecks");
            }}
            onOpenStaffRota={() => {
              if (!rosteringEnabled) {
                showFeatureUpgrade("Staff rostering");
                return;
              }
              setWorkspaceBackScreen("wardOverview");
              setScreen("staffRota");
            }}
          />
        ) : screen === "observations" ? (
          <WardDashboard
            incidents={safetyIncidents}
            news2Readings={news2Readings}
            missedObservations={missedObservations}
            observations={observations}
            patients={wardPatients}
            patientTasks={patientTasks}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staffShiftAssignments={staffShiftAssignments}
            staff={staffMembers}
            wards={siteWards}
            onBackToHome={() => setScreen("home")}
            onOpenOverview={() => setScreen("wardOverview")}
            onOpenFoodFluidChart={() => {
              setWorkspaceBackScreen("observations");
              setScreen("foodFluidChart");
            }}
            onOpenNews2={() => {
              setWorkspaceBackScreen("observations");
              setScreen("news2");
            }}
            onOpenEnhanced={() => {
              setWorkspaceBackScreen("observations");
              setScreen("enhanced");
            }}
            onOpenAnalytics={() => {
              if (!analyticsEnabled) {
                Alert.alert("Feature not included", "Analytics dashboard is not enabled for this SecureObs package.");
                return;
              }
              setWorkspaceBackScreen("observations");
              setScreen("analytics");
            }}
            onOpenPatientSettings={() => {
              setWorkspaceBackScreen("observations");
              setScreen("patientSettings");
            }}
            onOpenPreviousObservations={() => {
              setWorkspaceBackScreen("observations");
              setScreen("previousObservations");
            }}
            onOpenSecurityChecks={() => {
              setWorkspaceBackScreen("observations");
              setScreen("securityChecks");
            }}
            onOpenMedicationChart={() => {
              setWorkspaceBackScreen("observations");
              setScreen("medicationChart");
            }}
            onOpenPatientManagement={() => {
              setWorkspaceBackScreen("observations");
              setScreen("patientManagement");
            }}
            onOpenPatientCarePlans={() => {
              setWorkspaceBackScreen("observations");
              setScreen("patientCarePlans");
            }}
            onOpenPatientDashboard={() => {
              setWorkspaceBackScreen("observations");
              setScreen("patientDashboard");
            }}
            onOpenPatientNotes={() => {
              setWorkspaceBackScreen("observations");
              setScreen("patientNotes");
            }}
            onOpenPatientTasks={() => {
              setWorkspaceBackScreen("observations");
              setScreen("patientTasks");
            }}
            onOpenSafetyCentre={() => {
              setWorkspaceBackScreen("observations");
              setScreen("safetyEscalation");
            }}
            onOpenShiftHandover={() => {
              setWorkspaceBackScreen("observations");
              setScreen("shiftHandover");
            }}
            onOpenStaffRota={() => {
              if (!rosteringEnabled) {
                showFeatureUpgrade("Staff rostering");
                return;
              }
              setWorkspaceBackScreen("observations");
              setScreen("staffRota");
            }}
            onMissedObservationSaved={handleCreateMissedObservation}
            onObservationSaved={handleObservationSaved}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "enhanced" ? (
          <EnhancedObservationScreen
            missedObservations={missedObservations}
            observations={observations}
            patients={wardPatients}
            rotaAssignments={rotaAssignments}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            onBack={() => setScreen(workspaceBackScreen)}
            onMissedObservationSaved={handleCreateMissedObservation}
            onObservationSaved={handleObservationSaved}
          />
        ) : screen === "analytics" ? (
          <AnalyticsDashboardScreen
            carePlans={patientCarePlans}
            foodFluidEntries={foodFluidEntries}
            handovers={shiftHandovers}
            incidents={safetyIncidents}
            medicationAdministrations={medicationAdministrations}
            medicationPrescriptions={medicationPrescriptions}
            missedObservations={missedObservations}
            news2Readings={news2Readings}
            observations={observations}
            patientTasks={patientTasks}
            patients={wardPatients}
            securityAreas={securityAreas}
            securityChecks={securityChecks}
            staff={staffMembers}
            staffShiftAssignments={staffShiftAssignments}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
          />
        ) : screen === "patientManagement" ? (
          <PatientManagementScreen
            patients={patients.filter((patient) => hasAdminAccess(selectedStaff) || selectedStaff?.allowedWardIds.includes(patient.wardId))}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={accessibleWards}
            onBack={() => setScreen(workspaceBackScreen)}
            onSavePatient={handleSaveManagedPatient}
            onTransferPatient={handleTransferManagedPatient}
            onArchivePatient={handleArchiveManagedPatient}
            onRestorePatient={handleRestoreManagedPatient}
          />
        ) : screen === "patientAssessmentForms" ? (
          <PatientAssessmentFormsScreen
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            onBack={() => setScreen("patientSettings")}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "previousObservations" ? (
          <PreviousObservationsScreen
            missedObservations={missedObservations}
            observations={observations}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedWardId={selectedWardId}
            wards={siteWards}
            onBack={() => setScreen(workspaceBackScreen)}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "patientCarePlans" ? (
          <PatientCarePlansScreen
            carePlans={patientCarePlans}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateCarePlan={handleCreatePatientCarePlan}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "patientDashboard" ? (
          <PatientDashboardScreen
            carePlans={patientCarePlans}
            foodFluidEntries={foodFluidEntries}
            incidents={safetyIncidents}
            medicationAdministrations={medicationAdministrations}
            medicationPrescriptions={medicationPrescriptions}
            news2Readings={news2Readings}
            notes={patientNotes}
            observations={observations}
            patients={wardPatients}
            patientTasks={patientTasks}
            selectedPatientId={selectedPatientId}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
            onOpenPatientVoice={() => setScreen("patientVoice")}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "patientVoice" ? (
          <PatientVoiceScreen
            notes={patientNotes}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            ward={selectedWard}
            onBack={() => setScreen("patientDashboard")}
            onOpenFamilyPortal={() => setScreen("familyPortal")}
            onRefreshPatients={handleRefreshPatients}
            onSelectPatient={setSelectedPatientId}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "familyPortal" ? (
          <FamilyPortalScreen
            carePlans={patientCarePlans}
            notes={patientNotes}
            patient={wardPatients.find((patient) => patient.id === selectedPatientId)}
            selectedStaff={selectedStaff}
            ward={selectedWard}
            onBack={() => setScreen("patientVoice")}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "patientNotes" ? (
          <PatientNotesScreen
            notes={patientNotes}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateNote={handleCreatePatientNote}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "patientTasks" ? (
          <PatientTasksScreen
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            tasks={patientTasks}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
            onSaveTask={handleSavePatientTask}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "safetyEscalation" ? (
          <SafetyEscalationScreen
            incidents={safetyIncidents}
            patients={wardPatients}
            patientTasks={patientTasks}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
            onSaveIncident={handleSaveSafetyIncident}
            onOpenPatientTasks={() => setScreen("patientTasks")}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "shiftHandover" ? (
          <ShiftHandoverScreen
            foodFluidEntries={foodFluidEntries}
            handovers={shiftHandovers}
            incidents={safetyIncidents}
            medicationAdministrations={medicationAdministrations}
            medicationPrescriptions={medicationPrescriptions}
            missedObservations={missedObservations}
            news2Readings={news2Readings}
            observations={observations}
            patients={wardPatients}
            patientTasks={patientTasks}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            ward={selectedWard}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateHandover={handleCreateShiftHandover}
          />
        ) : screen === "staffRota" ? (
          <StaffRotaScreen
            assignments={rotaAssignments}
            patients={wardPatients}
            selectedWardId={selectedWardId}
            staffShiftAssignments={staffShiftAssignments}
            staff={staffMembers}
            wards={siteWards}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateAssignment={handleCreateRotaAssignment}
            onOpenBankAgencyStaff={() => setScreen("bankAgencyStaff")}
            onOpenStaffCover={() => setScreen("staffCover")}
            onRemoveAssignment={handleRemoveRotaAssignment}
            onUpdateAssignment={handleUpdateRotaAssignment}
          />
        ) : screen === "bankAgencyStaff" ? (
          <BankAgencyStaffScreen
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={siteWards}
            onBack={() => setScreen("staffRota")}
            onCreateStaff={handleCreateStaffMember}
          />
        ) : screen === "staffCover" ? (
          <StaffCoverScreen
            assignments={staffShiftAssignments}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={siteWards}
            onAssignStaff={handleAssignStaffShift}
            onBack={() => setScreen("staffRota")}
            onRemoveAssignment={handleRemoveStaffShiftAssignment}
            onUpdateAssignment={handleUpdateStaffShiftAssignment}
          />
        ) : screen === "news2" ? (
          <News2Screen
            patients={wardPatients}
            readings={news2Readings}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateReading={handleCreateNews2Reading}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "foodFluidChart" ? (
          <FoodFluidChartScreen
            entries={foodFluidEntries}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateEntry={handleCreateFoodFluidEntry}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "medicationChart" ? (
          <MedicationChartScreen
            administrations={medicationAdministrations}
            initialViewMode={selectedStaffCanPrescribe ? "admin" : "chart"}
            patients={wardPatients}
            prescriptions={medicationPrescriptions}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateAdministration={handleCreateMedicationAdministration}
            onCreatePrescription={handleCreateMedicationPrescription}
            onDiscontinuePrescription={handleDiscontinueMedicationPrescription}
            onSelectPatient={setSelectedPatientId}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "securityChecks" ? (
          <SecurityChecks
            areas={securityAreas.filter((area) => area.wardId === selectedWardId && area.active !== false)}
            checks={securityChecks}
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            wardName={wards.find((ward) => ward.id === selectedWardId)?.name ?? "Ward"}
            onBack={() => setScreen(workspaceBackScreen)}
            onCreateCheck={handleCreateSecurityCheck}
          />
        ) : (
          <PatientSettingsScreen
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            assessmentFormsEnabled={Boolean(selectedWard?.assessmentFormsEnabled)}
            onBack={() => setScreen(workspaceBackScreen)}
            onOpenAssessmentForms={() => setScreen("patientAssessmentForms")}
            onUpdatePatient={handleUpdatePatient}
          />
        )}
      </ScrollView>
      <Modal animationType="fade" transparent visible={isSyncStatusVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.syncModal}>
            <View style={styles.syncModalHeader}>
              <View>
                <Text style={styles.syncModalTitle}>Sync status</Text>
                <Text style={styles.syncModalMeta}>{syncStatusLabel(syncQueueState)}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setIsSyncStatusVisible(false)}
                style={styles.syncCloseButton}
              >
                <Text style={styles.syncCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            {syncQueueState.lastError ? (
              <View style={styles.syncIssueBanner}>
                <Text style={styles.syncIssueText}>Last issue: {syncQueueState.lastError}</Text>
              </View>
            ) : null}

            <View style={styles.syncActions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={syncQueueState.pendingCount === 0 || syncQueueState.isSyncing}
                onPress={() => {
                  void flushSyncQueue({ includeNeedsReview: true });
                }}
                style={[
                  styles.syncPrimaryButton,
                  (syncQueueState.pendingCount === 0 || syncQueueState.isSyncing) && styles.syncButtonDisabled
                ]}
              >
                <Text style={styles.syncPrimaryButtonText}>{syncQueueState.isSyncing ? "Retrying" : "Retry all"}</Text>
              </TouchableOpacity>
              {syncQueueState.items.some((item) => item.needsReview) ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={syncQueueState.isSyncing}
                  onPress={confirmRemoveReviewSyncItems}
                  style={[styles.syncReviewButton, syncQueueState.isSyncing && styles.syncButtonDisabled]}
                >
                  <Text style={styles.syncReviewButtonText}>Remove review uploads</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={styles.syncList} contentContainerStyle={styles.syncListContent}>
              {syncQueueState.items.length === 0 ? (
                <View style={styles.syncEmpty}>
                  <Text style={styles.syncEmptyTitle}>No waiting uploads</Text>
                  <Text style={styles.syncEmptyText}>Everything saved locally has reached the backend.</Text>
                </View>
              ) : (
                syncQueueState.items.map((item, index) => (
                  <View key={item.id} style={styles.syncItem}>
                    <View style={styles.syncItemHeader}>
                      <Text style={styles.syncItemTitle}>
                        {index + 1}. {item.label}
                      </Text>
                      <Text style={styles.syncItemAttempts}>Attempts {item.attempts}</Text>
                    </View>
                    <Text style={styles.syncItemMeta}>Path: {item.path}</Text>
                    <Text style={styles.syncItemMeta}>Queued: {formatSyncDate(item.createdAt)}</Text>
                    {item.needsReview ? (
                      <Text style={styles.syncItemReview}>Needs review before automatic retry</Text>
                    ) : null}
                    {item.lastError ? <Text style={styles.syncItemError}>Issue: {item.lastError}</Text> : null}
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => confirmRemoveSyncItem(item)}
                      style={styles.syncRemoveButton}
                    >
                      <Text style={styles.syncRemoveButtonText}>Remove this upload</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
        </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(
          selectedStaff && !hasAdminAccess(selectedStaff) && organisationSettings.serviceStatus === "suspended"
        )}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.syncModal}>
            <Text style={styles.syncModalTitle}>SecureObs service suspended</Text>
            <Text style={styles.syncEmptyText}>
              {organisationSettings.suspensionMessage ||
                "SecureObs access is temporarily suspended. Please contact your account administrator."}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void handleSelectStaff("")}
              style={styles.syncPrimaryButton}
            >
              <Text style={styles.syncPrimaryButtonText}>Return to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function createDemoPatients() {
  const now = Date.now();

  return seedData.patients.map((patient) => {
    if (patient.id === "patient-4") {
      return {
        ...patient,
        latestObservationTime: new Date(now - 12 * 60 * 1000).toISOString()
      };
    }

    if (patient.id === "patient-3") {
      return {
        ...patient,
        latestObservationTime: new Date(now - 65 * 60 * 1000).toISOString()
      };
    }

    return {
      ...patient,
      latestObservationTime: new Date(now - 3 * 60 * 1000).toISOString()
    };
  });
}

function createDemoNews2Readings(patientId: string): News2Reading[] {
  if (!patientId) {
    return [];
  }

  const now = Date.now();
  const respirationRates = [12, 18, 20, 21, 14, 11, 18, 19, 13, 17, 18, 10];
  const spo2 = [96, 95, 94, 93, 96, 97, 95, 92, 94, 96, 95, 94];
  const systolicBp = [128, 134, 140, 118, 126, 132, 138, 142, 136, 130, 124, 122];
  const pulse = [82, 88, 92, 104, 98, 86, 84, 94, 100, 90, 88, 86];
  const temperatures = [36.8, 36.7, 36.5, 37.2, 36.9, 36.6, 36.7, 37.4, 36.8, 36.5, 36.4, 36.7];

  return respirationRates.map((respirationRate, index) => {
    const reading = {
      id: `demo-news2-${index}`,
      patientId,
      recordedAt: new Date(now - (respirationRates.length - index) * 2 * 60 * 60 * 1000).toISOString(),
      recordedBy: "Alex Nurse",
      respirationRate,
      spo2: spo2[index] ?? 96,
      spo2Scale: "Scale 1" as const,
      onOxygen: false,
      systolicBp: systolicBp[index] ?? 128,
      pulse: pulse[index] ?? 82,
      consciousness: "Alert" as const,
      temperature: temperatures[index] ?? 36.8,
      totalScore: 0
    };

    return {
      ...reading,
      totalScore: calculateNews2Score(reading)
    };
  });
}

function createDemoStaffShiftAssignments() {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  return seedData.staffShiftAssignments.map((assignment) => ({
    ...assignment,
    date
  }));
}

function upsertStaffByCode(currentStaff: StaffMember[], staff: StaffMember) {
  const existingIndex = currentStaff.findIndex(
    (member) => member.staffCode.toLowerCase() === staff.staffCode.toLowerCase()
  );

  if (existingIndex === -1) {
    return [...currentStaff, staff];
  }

  return currentStaff.map((member, index) => (index === existingIndex ? staff : member));
}

function upsertSite(currentSites: Site[], site: Site) {
  return currentSites.some((currentSite) => currentSite.id === site.id)
    ? currentSites.map((currentSite) => (currentSite.id === site.id ? site : currentSite))
    : [...currentSites, site];
}

function upsertWard(currentWards: Ward[], ward: Ward) {
  return currentWards.some((currentWard) => currentWard.id === ward.id)
    ? currentWards.map((currentWard) => (currentWard.id === ward.id ? ward : currentWard))
    : [...currentWards, ward];
}

function upsertPatient(currentPatients: Patient[], patient: Patient) {
  return currentPatients.some((currentPatient) => currentPatient.id === patient.id)
    ? currentPatients.map((currentPatient) => (currentPatient.id === patient.id ? patient : currentPatient))
    : [...currentPatients, patient];
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some((currentItem) => currentItem.id === item.id)
    ? items.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
    : [item, ...items];
}

function mergeById<T extends { id: string }>(incoming: T[], existing: T[]) {
  const records = new Map<string, T>();
  existing.forEach((record) => records.set(record.id, record));
  incoming.forEach((record) => records.set(record.id, record));
  return Array.from(records.values());
}

function applyLatestGeneralObservations(patients: Patient[], observations: Observation[]) {
  const latestByPatientId = new Map<string, Observation>();

  observations
    .filter((observation) => observation.source === "General observations")
    .forEach((observation) => {
      const latest = latestByPatientId.get(observation.patientId);

      if (!latest || observation.observedAt > latest.observedAt) {
        latestByPatientId.set(observation.patientId, observation);
      }
    });

  if (latestByPatientId.size === 0) {
    return patients;
  }

  return patients.map((patient) => {
    const latest = latestByPatientId.get(patient.id);

    if (!latest) {
      return patient;
    }

    const onOffWard: Patient["onOffWard"] =
      latest.location === "Off ward" || latest.location === "LOA" ? "Off ward" : "On ward";

    return {
      ...patient,
      latestObservationPlace: latest.location,
      latestObservationTime: latest.observedAt,
      latestObservedBy: latest.observerName,
      latestPresentation: latest.presentation,
      onOffWard
    };
  });
}

function syncStatusLabel(state: SyncQueueState) {
  if (!state.isReady) {
    return "Preparing sync";
  }

  if (state.isSyncing && state.pendingCount > 0) {
    return `Syncing ${state.pendingCount}`;
  }

  if (state.pendingCount > 0) {
    if (state.lastError) {
      return `${state.pendingCount} sync issue`;
    }

    return `${state.pendingCount} pending sync`;
  }

  return state.lastSyncedAt ? "Synced" : "Ready";
}

function getSessionTimeoutMs(ward: Ward | undefined) {
  return Math.max(15, ward?.sessionTimeoutMinutes ?? 15) * 60 * 1000;
}

function getInactivityGraceMs() {
  return 2 * 60 * 1000;
}

function formatSyncDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function isOrganisationFeatureEnabled(
  settings: OrganisationSettings,
  feature: OrganisationFeatureKey
) {
  const packageDefault = settings.subscriptionPlan !== "essential";
  return settings.featureOverrides[feature] ?? packageDefault;
}

function applyOrganisationEntitlements(ward: Ward, settings: OrganisationSettings): Ward {
  return {
    ...ward,
    medicationChartEnabled:
      ward.medicationChartEnabled && isOrganisationFeatureEnabled(settings, "medication"),
    securityChecksEnabled:
      ward.securityChecksEnabled && isOrganisationFeatureEnabled(settings, "securityChecks"),
    staffRotaEnabled:
      ward.staffRotaEnabled && isOrganisationFeatureEnabled(settings, "rostering")
  };
}

function showFeatureUpgrade(feature: string) {
  Alert.alert(
    `${feature} is not included`,
    "This feature is not included in your organisation's current SecureObs package. Please contact SecureObs to add it or upgrade the package."
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#eef3f4"
  },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#d9e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  organisationLogoFrame: {
    alignItems: "center",
    borderColor: "#d9e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: "center",
    overflow: "hidden",
    padding: 4,
    width: 112
  },
  organisationLogo: {
    height: "100%",
    width: "100%"
  },
  appName: {
    color: "#18262c",
    fontSize: 24,
    fontWeight: "900"
  },
  subtitle: {
    color: "#617078",
    fontSize: 13,
    marginTop: 2
  },
  badge: {
    backgroundColor: "#e9f3ef",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  badgeText: {
    color: "#276149",
    fontSize: 12,
    fontWeight: "800"
  },
  homeContent: {
    minWidth: 820,
    padding: 14,
    paddingBottom: 96
  },
  content: {
    minWidth: 820,
    padding: 14,
    paddingBottom: 112
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 28, 34, 0.52)",
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  syncModal: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    maxHeight: "86%",
    maxWidth: 760,
    padding: 18,
    width: "100%"
  },
  syncModalHeader: {
    alignItems: "center",
    borderBottomColor: "#d9e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12
  },
  syncModalTitle: {
    color: "#18262c",
    fontSize: 22,
    fontWeight: "900"
  },
  syncModalMeta: {
    color: "#617078",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3
  },
  syncCloseButton: {
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  syncCloseButtonText: {
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900"
  },
  syncIssueBanner: {
    backgroundColor: "#fff7df",
    borderColor: "#e2b857",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 10
  },
  syncIssueText: {
    color: "#6f4b00",
    fontSize: 13,
    fontWeight: "800"
  },
  syncActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12
  },
  syncPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  syncPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  syncReviewButton: {
    alignItems: "center",
    borderColor: "#9f6b00",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  syncReviewButtonText: {
    color: "#795518",
    fontSize: 13,
    fontWeight: "900"
  },
  syncButtonDisabled: {
    opacity: 0.45
  },
  syncList: {
    marginTop: 12
  },
  syncListContent: {
    gap: 10,
    paddingBottom: 4
  },
  syncEmpty: {
    backgroundColor: "#f8fafb",
    borderColor: "#d9e0e3",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  syncEmptyTitle: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  syncEmptyText: {
    color: "#617078",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4
  },
  syncItem: {
    backgroundColor: "#f8fafb",
    borderColor: "#d9e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12
  },
  syncItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  syncItemTitle: {
    color: "#18262c",
    flex: 1,
    fontSize: 15,
    fontWeight: "900"
  },
  syncItemAttempts: {
    color: "#617078",
    fontSize: 12,
    fontWeight: "900"
  },
  syncItemMeta: {
    color: "#617078",
    fontSize: 12,
    fontWeight: "800"
  },
  syncItemError: {
    color: "#8a2d2d",
    fontSize: 12,
    fontWeight: "900"
  },
  syncItemReview: {
    backgroundColor: "#fff4d6",
    borderRadius: 6,
    color: "#795518",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  syncRemoveButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#9f2d28",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  syncRemoveButtonText: {
    color: "#9f2d28",
    fontSize: 12,
    fontWeight: "900"
  }
});
