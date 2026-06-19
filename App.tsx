import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { EnhancedObservationScreen } from "./src/screens/EnhancedObservationScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MedicationChartScreen } from "./src/screens/MedicationChartScreen";
import { News2Screen } from "./src/screens/News2Screen";
import { PatientSettingsScreen } from "./src/screens/PatientSettingsScreen";
import { PreviousObservationsScreen } from "./src/screens/PreviousObservationsScreen";
import { SecurityChecks } from "./src/screens/SecurityChecks";
import { StaffCoverScreen } from "./src/screens/StaffCoverScreen";
import { StaffRotaScreen } from "./src/screens/StaffRotaScreen";
import { WardDashboard } from "./src/screens/WardDashboard";
import { WardSettingsScreen } from "./src/screens/WardSettingsScreen";
import { seedData } from "./src/data/seedData";
import { parseStaffCardData } from "./src/utils/nfcStaffCard";
import { readNfcTextPayload } from "./src/utils/nfcReader";
import type {
  MedicationAdministration,
  MedicationPrescription,
  News2Reading,
  Observation,
  Patient,
  PatientLocation,
  PatientPresentation,
  RotaAssignment,
  SecurityCheck,
  StaffShiftAssignment,
  Ward
} from "./src/types/domain";

type AppScreen =
  | "home"
  | "observations"
  | "enhanced"
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
  const [wards, setWards] = useState<Ward[]>(seedData.wards);
  const [selectedStaffId, setSelectedStaffId] = useState(seedData.staff[0]?.id ?? "");
  const selectedStaff = seedData.staff.find((staff) => staff.id === selectedStaffId) ?? seedData.staff[0];
  const selectedStaffCanPrescribe = Boolean(selectedStaff?.canPrescribe || selectedStaff?.role === "doctor");
  const firstAllowedSiteId = selectedStaff?.allowedSiteIds[0] ?? seedData.sites[0]?.id ?? "";
  const firstAllowedWardId = selectedStaff?.allowedWardIds[0] ?? wards[0]?.id ?? "";
  const [selectedSiteId, setSelectedSiteId] = useState(firstAllowedSiteId);
  const [selectedWardId, setSelectedWardId] = useState(firstAllowedWardId);
  const [selectedPatientId, setSelectedPatientId] = useState(seedData.patients[0]?.id ?? "");

  const accessibleSites = useMemo(() => {
    if (!selectedStaff) {
      return seedData.sites;
    }

    return seedData.sites.filter((site) => selectedStaff.allowedSiteIds.includes(site.id));
  }, [selectedStaff]);

  const siteWards = useMemo(
    () =>
      wards.filter(
        (ward) => ward.siteId === selectedSiteId && selectedStaff?.allowedWardIds.includes(ward.id)
      ),
    [selectedSiteId, selectedStaff, wards]
  );

  const wardPatients = useMemo(
    () => patients.filter((patient) => patient.wardId === selectedWardId),
    [patients, selectedWardId]
  );

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    const staff = seedData.staff.find((item) => item.id === staffId);
    const firstSiteId = staff?.allowedSiteIds[0] ?? "";
    const firstWard = wards.find(
      (ward) => ward.siteId === firstSiteId && staff?.allowedWardIds.includes(ward.id)
    );

    setSelectedSiteId(firstSiteId);
    setSelectedWardId(firstWard?.id ?? "");
    const firstPatient = patients.find((patient) => patient.wardId === firstWard?.id);
    setSelectedPatientId(firstPatient?.id ?? "");
  };

  const handleReadStaffCardData = (cardData: string) => {
    const parsedCard = parseStaffCardData(cardData);

    if (!parsedCard) {
      return "No STAFFCODE found on that card data.";
    }

    const matchedStaff = seedData.staff.find(
      (staff) => staff.staffCode.toLowerCase() === parsedCard.staffCode.toLowerCase()
    );

    if (!matchedStaff) {
      return `No demo staff found for STAFFCODE ${parsedCard.staffCode}.`;
    }

    handleSelectStaff(matchedStaff.id);
    return `Selected ${matchedStaff.name} from STAFFCODE ${parsedCard.staffCode}.`;
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
  };

  const handleCreateRotaAssignment = (assignment: RotaAssignment) => {
    setRotaAssignments((currentAssignments) => [...currentAssignments, assignment]);
  };

  const handleUpdateRotaAssignment = (assignment: RotaAssignment) => {
    setRotaAssignments((currentAssignments) =>
      currentAssignments.map((item) => (item.id === assignment.id ? assignment : item))
    );
  };

  const handleRemoveRotaAssignment = (assignmentId: string) => {
    setRotaAssignments((currentAssignments) => currentAssignments.filter((assignment) => assignment.id !== assignmentId));
  };

  const handleAssignStaffShift = (assignment: StaffShiftAssignment) => {
    setStaffShiftAssignments((currentAssignments) => [...currentAssignments, assignment]);
  };

  const handleRemoveStaffShiftAssignment = (assignmentId: string) => {
    setStaffShiftAssignments((currentAssignments) =>
      currentAssignments.filter((assignment) => assignment.id !== assignmentId)
    );
  };

  const handleCreateNews2Reading = (reading: News2Reading) => {
    setNews2Readings((currentReadings) => [...currentReadings, reading]);
  };

  const handleCreateSecurityCheck = (check: SecurityCheck) => {
    setSecurityChecks((currentChecks) => [check, ...currentChecks]);
  };

  const handleCreateMedicationPrescription = (prescription: MedicationPrescription) => {
    setMedicationPrescriptions((currentPrescriptions) => [prescription, ...currentPrescriptions]);
  };

  const handleCreateMedicationAdministration = (administration: MedicationAdministration) => {
    setMedicationAdministrations((currentAdministrations) => [administration, ...currentAdministrations]);
  };

  const handleDiscontinueMedicationPrescription = (updatedPrescription: MedicationPrescription) => {
    setMedicationPrescriptions((currentPrescriptions) =>
      currentPrescriptions.map((prescription) =>
        prescription.id === updatedPrescription.id ? updatedPrescription : prescription
      )
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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Prototype</Text>
        </View>
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
            staff={seedData.staff}
            wards={siteWards}
            onSelectStaff={handleSelectStaff}
            onSelectSite={handleSelectSite}
            onSelectWard={handleSelectWard}
            onReadStaffCardData={handleReadStaffCardData}
            onScanStaffCard={handleScanStaffCard}
            onOpenWardSettings={() => setScreen("wardSettings")}
            onStart={() => setScreen("observations")}
          />
        ) : screen === "wardSettings" ? (
          <WardSettingsScreen
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={seedData.staff}
            wards={siteWards}
            onBack={() => setScreen("home")}
            onUpdateWardInterval={handleUpdateWardInterval}
            onUpdateWardRotaEnabled={handleUpdateWardRotaEnabled}
            onUpdateWardRotaSettings={handleUpdateWardRotaSettings}
          />
        ) : screen === "observations" ? (
          <WardDashboard
            news2Readings={news2Readings}
            observations={observations}
            patients={wardPatients}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            selectedWardId={selectedWardId}
            staff={seedData.staff}
            wards={siteWards}
            onBackToHome={() => setScreen("home")}
            onOpenNews2={() => setScreen("news2")}
            onOpenEnhanced={() => setScreen("enhanced")}
            onOpenPatientSettings={() => setScreen("patientSettings")}
            onOpenPreviousObservations={() => setScreen("previousObservations")}
            onOpenSecurityChecks={() => setScreen("securityChecks")}
            onOpenMedicationChart={() => setScreen("medicationChart")}
            onOpenStaffRota={() => setScreen("staffRota")}
            onObservationSaved={handleObservationSaved}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "enhanced" ? (
          <EnhancedObservationScreen
            observations={observations}
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={seedData.staff}
            onBack={() => setScreen("observations")}
            onObservationSaved={handleObservationSaved}
            onUpdatePatient={handleUpdatePatient}
          />
        ) : screen === "previousObservations" ? (
          <PreviousObservationsScreen
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
            staff={seedData.staff}
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
            staff={seedData.staff}
            wards={siteWards}
            onAssignStaff={handleAssignStaffShift}
            onBack={() => setScreen("staffRota")}
            onRemoveAssignment={handleRemoveStaffShiftAssignment}
          />
        ) : screen === "news2" ? (
          <News2Screen
            patients={wardPatients}
            readings={news2Readings}
            selectedPatientId={selectedPatientId}
            selectedStaffId={selectedStaffId}
            staff={seedData.staff}
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
            staff={seedData.staff}
            onBack={() => setScreen("observations")}
            onCreateAdministration={handleCreateMedicationAdministration}
            onCreatePrescription={handleCreateMedicationPrescription}
            onDiscontinuePrescription={handleDiscontinueMedicationPrescription}
            onSelectPatient={setSelectedPatientId}
          />
        ) : screen === "securityChecks" ? (
          <SecurityChecks
            areas={seedData.securityAreas.filter((area) => area.wardId === selectedWardId)}
            checks={securityChecks}
            selectedStaffId={selectedStaffId}
            staff={seedData.staff}
            wardName={wards.find((ward) => ward.id === selectedWardId)?.name ?? "Ward"}
            onBack={() => setScreen("observations")}
            onCreateCheck={handleCreateSecurityCheck}
          />
        ) : (
          <PatientSettingsScreen
            patients={wardPatients}
            selectedStaffId={selectedStaffId}
            staff={seedData.staff}
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
