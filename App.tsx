import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AdminSettingsScreen } from "./src/screens/AdminSettingsScreen";
import { EnhancedObservationScreen } from "./src/screens/EnhancedObservationScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MedicationChartScreen } from "./src/screens/MedicationChartScreen";
import { News2Screen } from "./src/screens/News2Screen";
import { PatientManagementScreen } from "./src/screens/PatientManagementScreen";
import { PatientSettingsScreen } from "./src/screens/PatientSettingsScreen";
import { PreviousObservationsScreen } from "./src/screens/PreviousObservationsScreen";
import { SecurityChecks } from "./src/screens/SecurityChecks";
import { StaffCoverScreen } from "./src/screens/StaffCoverScreen";
import { StaffRotaScreen } from "./src/screens/StaffRotaScreen";
import { WardDashboard } from "./src/screens/WardDashboard";
import { WardSettingsScreen } from "./src/screens/WardSettingsScreen";
import { seedData } from "./src/data/seedData";
import {
  createMissedObservation as persistMissedObservation,
  createMedicationAdministration as persistMedicationAdministration,
  createMedicationPrescription as persistMedicationPrescription,
  createNews2Reading as persistNews2Reading,
  createSite as persistSite,
  createStaffMember as persistStaffMember,
  createSecurityCheck as persistSecurityCheck,
  deleteRotaAssignment as persistRotaAssignmentDelete,
  deleteStaffShiftAssignment as persistStaffShiftAssignmentDelete,
  createWard as persistWard,
  loadSites,
  loadMedicationAdministrations,
  loadMedicationPrescriptions,
  loadMissedObservations,
  loadNews2Readings,
  loadObservations,
  loadPatients,
  loadRotaAssignments,
  loadSecurityChecks,
  loadStaffShiftAssignments,
  loadWards,
  loadStaff,
  loginBankStaffByPin,
  lookupStaffByCode,
  saveRotaAssignment as persistRotaAssignment,
  saveStaffShiftAssignment as persistStaffShiftAssignment,
  savePatient as persistPatient,
  updateMedicationPrescription as persistMedicationPrescriptionUpdate
} from "./src/services/api";
import {
  clearSyncQueue,
  flushSyncQueue,
  isQueuedSyncError,
  restoreSyncQueue,
  subscribeToSyncQueue,
  type SyncQueueState
} from "./src/services/syncQueue";
import { parseStaffCardData } from "./src/utils/nfcStaffCard";
import { readNfcTextPayload } from "./src/utils/nfcReader";
import { hasStaffRole } from "./src/utils/staffRole";
import type {
  MedicationAdministration,
  MissedObservation,
  MedicationPrescription,
  News2Reading,
  Observation,
  Patient,
  PatientLocation,
  PatientPresentation,
  RotaAssignment,
  SecurityCheck,
  Site,
  StaffMember,
  StaffShiftAssignment,
  Ward
} from "./src/types/domain";

const defaultOrganisationId = "00000000-0000-0000-0000-000000000001";

type AppScreen =
  | "home"
  | "adminSettings"
  | "observations"
  | "enhanced"
  | "patientManagement"
  | "patientSettings"
  | "previousObservations"
  | "staffCover"
  | "staffRota"
  | "wardSettings"
  | "medicationChart"
  | "news2"
  | "securityChecks";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [news2Readings, setNews2Readings] = useState<News2Reading[]>(() => createDemoNews2Readings(seedData.patients[0]?.id ?? ""));
  const [observations, setObservations] = useState<Observation[]>(seedData.observations);
  const [patients, setPatients] = useState<Patient[]>(() => createDemoPatients());
  const [rotaAssignments, setRotaAssignments] = useState<RotaAssignment[]>(seedData.rotaAssignments);
  const [staffShiftAssignments, setStaffShiftAssignments] = useState<StaffShiftAssignment[]>(
    () => createDemoStaffShiftAssignments()
  );
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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(seedData.staff);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const selectedStaff = staffMembers.find((staff) => staff.id === selectedStaffId);
  const activeStaff = selectedStaff;
  const selectedStaffCanPrescribe = Boolean(activeStaff?.canPrescribe || hasStaffRole(activeStaff, "doctor"));
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedWardId, setSelectedWardId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(seedData.patients[0]?.id ?? "");
  const [syncQueueState, setSyncQueueState] = useState<SyncQueueState>({
    pendingCount: 0,
    isReady: false,
    isSyncing: false
  });

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
    const loadConfiguration = async () => {
      const organisationId = selectedStaff?.organisationId ?? defaultOrganisationId;
      try {
        const [
          siteResult,
          staffResult,
          wardResult,
          observationResult,
          patientResult,
          securityCheckResult,
          news2Result,
          medicationPrescriptionResult,
          medicationAdministrationResult,
          missedObservationResult,
          rotaAssignmentResult,
          staffShiftAssignmentResult
        ] = await Promise.all([
          loadSites(organisationId),
          loadStaff(organisationId),
          loadWards(organisationId),
          loadObservations(organisationId),
          loadPatients(organisationId),
          loadSecurityChecks(organisationId),
          loadNews2Readings(organisationId),
          loadMedicationPrescriptions(organisationId),
          loadMedicationAdministrations(organisationId),
          loadMissedObservations(organisationId, selectedWardId || undefined),
          loadRotaAssignments(organisationId, selectedWardId || undefined),
          loadStaffShiftAssignments(organisationId, selectedWardId || undefined)
        ]);
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
        setSecurityChecks((currentChecks) => mergeById(securityCheckResult.securityChecks, currentChecks));
        setNews2Readings((currentReadings) => mergeById(news2Result.news2Readings, currentReadings));
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
      } catch (error) {
        console.warn("Unable to load backend data", error);
      }
    };

    void loadConfiguration();
  }, [selectedStaff?.organisationId, selectedWardId]);

  const persistOrQueue = async <T,>(label: string, run: () => Promise<T>) => {
    try {
      const result = await run();
      await flushSyncQueue();
      return result;
    } catch (error) {
      if (!isQueuedSyncError(error)) {
        console.warn(`${label} save failed`, error);
      }
      return undefined;
    }
  };

  const showSyncStatus = () => {
    const oldestItem = syncQueueState.oldestItem;
    const details = [
      syncStatusLabel(syncQueueState),
      syncQueueState.lastError ? `Last error: ${syncQueueState.lastError}` : undefined,
      oldestItem
        ? `Oldest item: ${oldestItem.label}\nPath: ${oldestItem.path}\nAttempts: ${oldestItem.attempts}`
        : undefined
    ]
      .filter(Boolean)
      .join("\n\n");

    if (syncQueueState.pendingCount === 0) {
      Alert.alert("Sync status", details || "No pending saves.");
      return;
    }

    Alert.alert("Sync status", details, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Retry now",
        onPress: () => {
          void flushSyncQueue();
        }
      },
      {
        text: "Clear pending",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Clear pending saves?",
            "Only use this if the pending items are known to be stale or already saved elsewhere. This removes them from this tablet.",
            [
              { text: "Keep", style: "cancel" },
              {
                text: "Clear",
                style: "destructive",
                onPress: () => {
                  void clearSyncQueue();
                }
              }
            ]
          );
        }
      }
    ]);
  };

  const accessibleSites = useMemo(() => {
    if (!selectedStaff) {
      return sites;
    }

    if (selectedStaff.staffCode === "GardinerG") {
      return sites;
    }

    return sites.filter((site) => selectedStaff.allowedSiteIds.includes(site.id));
  }, [selectedStaff, sites]);

  const siteWards = useMemo(
    () =>
      wards.filter(
        (ward) =>
          ward.siteId === selectedSiteId &&
          (selectedStaff?.staffCode === "GardinerG" || selectedStaff?.allowedWardIds.includes(ward.id))
      ),
    [selectedSiteId, selectedStaff, wards]
  );

  const accessibleWards = useMemo(() => {
    if (!selectedStaff) {
      return wards;
    }

    if (selectedStaff.staffCode === "GardinerG") {
      return wards;
    }

    return wards.filter((ward) => selectedStaff.allowedWardIds.includes(ward.id));
  }, [selectedStaff, wards]);

  const wardPatients = useMemo(
    () => patients.filter((patient) => patient.wardId === selectedWardId),
    [patients, selectedWardId]
  );

  const handleSelectStaff = (staffId: string) => {
    const staff = staffMembers.find((item) => item.id === staffId);
    selectStaffSession(staff);
  };

  const selectStaffSession = (staff: StaffMember | undefined) => {
    setSelectedStaffId(staff?.id ?? "");
    const firstSiteId = staff?.allowedSiteIds[0] ?? "";
    const firstWard = wards.find(
      (ward) => ward.siteId === firstSiteId && staff?.allowedWardIds.includes(ward.id)
    );

    setSelectedSiteId(firstSiteId);
    setSelectedWardId(firstWard?.id ?? "");
    const firstPatient = patients.find((patient) => patient.wardId === firstWard?.id);
    setSelectedPatientId(firstPatient?.id ?? "");
  };

  const handleReadStaffCardData = async (cardData: string) => {
    const parsedCard = parseStaffCardData(cardData);

    if (!parsedCard) {
      return "No STAFFCODE found on that card data.";
    }

    try {
      const { staff } = await lookupStaffByCode(parsedCard.staffCode, selectedStaff?.organisationId ?? defaultOrganisationId);
      setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, staff));
      selectStaffSession(staff);
      return `Selected ${staff.name} from Postgres STAFFCODE ${parsedCard.staffCode}.`;
    } catch {
      const matchedStaff = staffMembers.find(
        (staff) => staff.staffCode.toLowerCase() === parsedCard.staffCode.toLowerCase()
      );

      if (!matchedStaff) {
        return `No staff found for STAFFCODE ${parsedCard.staffCode}.`;
      }

      selectStaffSession(matchedStaff);
      return `Selected ${matchedStaff.name} from local STAFFCODE ${parsedCard.staffCode}.`;
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
    return `Selected ${staff.name} for bank/temp access.`;
  };

  const handleScanStaffCard = async () => {
    const cardData = await readNfcTextPayload();

    return handleReadStaffCardData(cardData);
  };

  const handleSelectSite = (siteId: string) => {
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

  const handleSelectWard = (wardId: string) => {
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
        persistWard({ ...updatedWard, observationIntervalMinutes, organisationId: selectedStaff?.organisationId })
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
  };

  const handleUpdateWardRotaEnabled = (wardId: string, staffRotaEnabled: boolean) => {
    const updatedWard = wards.find((ward) => ward.id === wardId);

    if (updatedWard) {
      void persistOrQueue("ward", () =>
        persistWard({ ...updatedWard, staffRotaEnabled, organisationId: selectedStaff?.organisationId })
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
  };

  const handleUpdateWardRotaSettings = (updatedWard: Ward) => {
    setWards((currentWards) =>
      currentWards.map((ward) => (ward.id === updatedWard.id ? updatedWard : ward))
    );
    void persistOrQueue("ward", () =>
      persistWard({ ...updatedWard, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleCreateSite = async (site: Site) => {
    const savedSite = await persistOrQueue("site", () =>
      persistSite({ ...site, organisationId: selectedStaff?.organisationId })
    );
    setSites((currentSites) => upsertSite(currentSites, savedSite ?? site));
    if (selectedStaff?.staffCode === "GardinerG") {
      setSelectedSiteId((savedSite ?? site).id);
    }
  };

  const handleCreateWard = async (ward: Ward) => {
    const savedWard = await persistOrQueue("ward", () =>
      persistWard({ ...ward, organisationId: selectedStaff?.organisationId })
    );
    setWards((currentWards) => upsertWard(currentWards, savedWard ?? ward));
    if (selectedStaff?.staffCode === "GardinerG") {
      setSelectedWardId((savedWard ?? ward).id);
    }
  };

  const handleCreateStaffMember = async (staff: StaffMember) => {
    const result = await persistOrQueue("staff member", () =>
      persistStaffMember({
        ...staff,
        organisationId: staff.organisationId ?? selectedStaff?.organisationId
      })
    );
    setStaffMembers((currentStaff) => upsertStaffByCode(currentStaff, result?.staff ?? staff));
  };

  const handleUpdatePatient = (updatedPatient: Patient) => {
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
    void persistOrQueue("patient update", () =>
      persistPatient({ ...updatedPatient, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleSaveManagedPatient = async (patient: Patient) => {
    const result = await persistOrQueue("patient", () =>
      persistPatient({
        ...patient,
        organisationId: selectedStaff?.organisationId
      })
    );
    setPatients((currentPatients) => upsertPatient(currentPatients, result?.patient ?? patient));
  };

  const handleCreateRotaAssignment = (assignment: RotaAssignment) => {
    setRotaAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("rota assignment", () =>
      persistRotaAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleUpdateRotaAssignment = (assignment: RotaAssignment) => {
    setRotaAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("rota assignment", () =>
      persistRotaAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleRemoveRotaAssignment = (assignmentId: string) => {
    setRotaAssignments((currentAssignments) => currentAssignments.filter((assignment) => assignment.id !== assignmentId));
    void persistOrQueue("rota assignment delete", () =>
      persistRotaAssignmentDelete(assignmentId, selectedStaff?.organisationId)
    );
  };

  const handleAssignStaffShift = (assignment: StaffShiftAssignment) => {
    setStaffShiftAssignments((currentAssignments) => upsertById(currentAssignments, assignment));
    void persistOrQueue("staff shift assignment", () =>
      persistStaffShiftAssignment({ ...assignment, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleRemoveStaffShiftAssignment = (assignmentId: string) => {
    setStaffShiftAssignments((currentAssignments) =>
      currentAssignments.filter((assignment) => assignment.id !== assignmentId)
    );
    void persistOrQueue("staff shift assignment delete", () =>
      persistStaffShiftAssignmentDelete(assignmentId, selectedStaff?.organisationId)
    );
  };

  const handleUpdateStaffShiftAssignment = (assignment: StaffShiftAssignment) => {
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

  const handleCreateSecurityCheck = (check: SecurityCheck) => {
    setSecurityChecks((currentChecks) => [check, ...currentChecks]);
    void persistOrQueue("security check", () =>
      persistSecurityCheck({ ...check, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleCreateMedicationPrescription = (prescription: MedicationPrescription) => {
    setMedicationPrescriptions((currentPrescriptions) => [prescription, ...currentPrescriptions]);
    void persistOrQueue("medication prescription", () =>
      persistMedicationPrescription({ ...prescription, organisationId: selectedStaff?.organisationId })
    );
  };

  const handleCreateMedicationAdministration = (administration: MedicationAdministration) => {
    setMedicationAdministrations((currentAdministrations) => upsertById(currentAdministrations, administration));
    void persistOrQueue("medication administration", () =>
      persistMedicationAdministration({ ...administration, organisationId: selectedStaff?.organisationId })
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
      persistMedicationPrescriptionUpdate({ ...updatedPrescription, organisationId: selectedStaff?.organisationId })
    );
  };

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Secure Obs</Text>
          <Text style={styles.subtitle}>High secure ward observation workflow</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={showSyncStatus} style={styles.badge}>
          <Text style={styles.badgeText}>{syncStatusLabel(syncQueueState)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={screen === "home" ? styles.homeContent : styles.content}
        horizontal={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={screen !== "medicationChart"}
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
            onReadStaffCardData={handleReadStaffCardData}
            onBankStaffPinLogin={handleBankStaffPinLogin}
            onScanStaffCard={handleScanStaffCard}
            onOpenAdminSettings={() => setScreen("adminSettings")}
            onOpenWardSettings={() => setScreen("wardSettings")}
            onStart={() => setScreen("observations")}
          />
        ) : screen === "adminSettings" ? (
          <AdminSettingsScreen
            sites={sites}
            wards={wards}
            onBack={() => setScreen("home")}
            onCreateSite={handleCreateSite}
            onCreateStaff={handleCreateStaffMember}
            onCreateWard={handleCreateWard}
          />
        ) : screen === "wardSettings" ? (
          <WardSettingsScreen
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={siteWards}
            onBack={() => setScreen("home")}
            onUpdateWardInterval={handleUpdateWardInterval}
            onUpdateWardRotaEnabled={handleUpdateWardRotaEnabled}
            onUpdateWardRotaSettings={handleUpdateWardRotaSettings}
            onCreateStaff={handleCreateStaffMember}
          />
        ) : screen === "observations" ? (
          <WardDashboard
            news2Readings={news2Readings}
            missedObservations={missedObservations}
            observations={observations}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={siteWards}
            onBackToHome={() => setScreen("home")}
            onOpenNews2={() => setScreen("news2")}
            onOpenEnhanced={() => setScreen("enhanced")}
            onOpenPatientSettings={() => setScreen("patientSettings")}
            onOpenPreviousObservations={() => setScreen("previousObservations")}
            onOpenSecurityChecks={() => setScreen("securityChecks")}
            onOpenMedicationChart={() => setScreen("medicationChart")}
            onOpenPatientManagement={() => setScreen("patientManagement")}
            onOpenStaffRota={() => setScreen("staffRota")}
            onMissedObservationSaved={handleCreateMissedObservation}
            onObservationSaved={handleObservationSaved}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "enhanced" ? (
          <EnhancedObservationScreen
            observations={observations}
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            onBack={() => setScreen("observations")}
            onObservationSaved={handleObservationSaved}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "patientManagement" ? (
          <PatientManagementScreen
            patients={patients.filter((patient) => selectedStaff?.staffCode === "GardinerG" || selectedStaff?.allowedWardIds.includes(patient.wardId))}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={staffMembers}
            wards={accessibleWards}
            onBack={() => setScreen("observations")}
            onSavePatient={handleSaveManagedPatient}
          />
        ) : screen === "previousObservations" ? (
          <PreviousObservationsScreen
            missedObservations={missedObservations}
            observations={observations}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedWardId={selectedWardId}
            wards={siteWards}
            onBack={() => setScreen("observations")}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "staffRota" ? (
          <StaffRotaScreen
            assignments={rotaAssignments}
            patients={wardPatients}
            selectedWardId={selectedWardId}
            staffShiftAssignments={staffShiftAssignments}
            staff={staffMembers}
            wards={siteWards}
            onBack={() => setScreen("observations")}
            onCreateAssignment={handleCreateRotaAssignment}
            onOpenStaffCover={() => setScreen("staffCover")}
            onRemoveAssignment={handleRemoveRotaAssignment}
            onUpdateAssignment={handleUpdateRotaAssignment}
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
            onBack={() => setScreen("observations")}
            onCreateReading={handleCreateNews2Reading}
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
            onBack={() => setScreen("observations")}
            onCreateAdministration={handleCreateMedicationAdministration}
            onCreatePrescription={handleCreateMedicationPrescription}
            onDiscontinuePrescription={handleDiscontinueMedicationPrescription}
            onSelectPatient={setSelectedPatientId}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "securityChecks" ? (
          <SecurityChecks
            areas={seedData.securityAreas.filter((area) => area.wardId === selectedWardId)}
            checks={securityChecks}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            wardName={wards.find((ward) => ward.id === selectedWardId)?.name ?? "Ward"}
            onBack={() => setScreen("observations")}
            onCreateCheck={handleCreateSecurityCheck}
          />
        ) : (
          <PatientSettingsScreen
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={staffMembers}
            staffShiftAssignments={staffShiftAssignments}
            onBack={() => setScreen("observations")}
            onUpdatePatient={handleUpdatePatient}
          />
        )}
      </ScrollView>
    </SafeAreaView>
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
      totalScore:
        scoreRespiration(reading.respirationRate) +
        scoreSpo2Scale1(reading.spo2) +
        scoreBp(reading.systolicBp) +
        scorePulse(reading.pulse) +
        scoreTemperature(reading.temperature)
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

function scoreRespiration(value: number) {
  if (value <= 8 || value >= 25) return 3;
  if (value >= 21) return 2;
  if (value >= 9 && value <= 11) return 1;
  return 0;
}

function scoreSpo2Scale1(value: number) {
  if (value <= 91) return 3;
  if (value <= 93) return 2;
  if (value <= 95) return 1;
  return 0;
}

function scoreBp(value: number) {
  if (value <= 90 || value >= 220) return 3;
  if (value <= 100) return 2;
  if (value <= 110) return 1;
  return 0;
}

function scorePulse(value: number) {
  if (value <= 40 || value >= 131) return 3;
  if (value >= 111) return 2;
  if ((value >= 41 && value <= 50) || (value >= 91 && value <= 110)) return 1;
  return 0;
}

function scoreTemperature(value: number) {
  if (value <= 35 || value >= 39.1) return 3;
  if (value >= 38.1 || value <= 36) return 1;
  return 0;
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
  }
});
