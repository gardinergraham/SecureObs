export type ObservationLevel = "Eyesight" | "Within arms length" | "Intermittent";
export type RotaRole = "General observations" | "Enhanced/TESO" | "Security checks" | "Break";
export type StaffRatio = "1:1" | "2:1" | "3:1" | "4:1" | "5:1" | "6:1";
export type TesoReason =
  | "Risk to self"
  | "Risk to others"
  | "Risk from others"
  | "Medication intervention"
  | "Security"
  | "Physical health"
  | "Other";

export type PatientLocation =
  | "Side room"
  | "Day room"
  | "Corridor"
  | "Dining room"
  | "Bathroom"
  | "Laundry"
  | "Off ward"
  | "LOA";

export type PatientPresentation = "Awake" | "Asleep";
export type ObservationSource = "General observations" | "Enhanced/TESO";
export type News2Consciousness = "Alert" | "New confusion" | "Voice" | "Pain" | "Unresponsive";
export type Spo2Scale = "Scale 1" | "Scale 2";
export type ServiceType = "High secure hospital" | "Medium secure hospital" | "Care home";
export type MedicationAdministrationStatus = "Given" | "Omitted" | "Refused";
export type MedicationOmissionCode = "R" | "N" | "X" | "F" | "S" | "O" | "U";
export type MedicationPrescriptionType = "regular" | "prn" | "depot" | "rapid";

export type Site = {
  id: string;
  name: string;
};

export type Ward = {
  id: string;
  siteId: string;
  name: string;
  serviceType: ServiceType;
  observationIntervalMinutes: number;
  news2Enabled: boolean;
  enhancedObservationsEnabled: boolean;
  securityChecksEnabled: boolean;
  medicationChartEnabled: boolean;
  staffRotaEnabled: boolean;
  rotaShiftCount: number;
  rotaShifts: RotaShift[];
  breakDurationMinutes: number;
  selected: boolean;
};

export type RotaShift = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type RotaAssignment = {
  id: string;
  wardId: string;
  staffId: string;
  role: RotaRole;
  startsAt: string;
  endsAt: string;
  patientId?: string;
  notes: string;
};

export type StaffShiftAssignment = {
  id: string;
  wardId: string;
  shiftId: string;
  staffId: string;
  date: string;
};

export type StaffMember = {
  id: string;
  organisationId?: string;
  keyNumber: number;
  staffCode: string;
  name: string;
  role: "nurse" | "hcf" | "security" | "manager" | "doctor";
  designation?: string;
  canPrescribe?: boolean;
  employmentType?: "permanent" | "bank";
  accessStartsAt?: string;
  accessExpiresAt?: string;
  loginPin?: string;
  wardId: string;
  allowedSiteIds: string[];
  allowedWardIds: string[];
  active?: boolean;
};

export type EnhancedObservationPlan = {
  staffRatio: StaffRatio;
  reasons: TesoReason[];
  otherReason: string;
  startedAt: string;
  authorisedBy: string;
  assignedStaffIds: string[];
  carePlan: string;
};

export type TesoEpisode = {
  id: string;
  startedAt: string;
  endedAt?: string;
  reasons: TesoReason[];
  otherReason: string;
  observationLevel: Exclude<ObservationLevel, "Intermittent">;
  staffRatio: StaffRatio;
  authorisedBy: string;
  carePlan: string;
};

export type Patient = {
  id: string;
  patientNumber: number;
  hospitalNumber: string;
  firstName: string;
  surname: string;
  wardId: string;
  roomNumber: number;
  observationLevel: ObservationLevel;
  latestObservationPlace: string;
  latestObservationTime: string;
  latestObservedBy: string;
  latestPresentation: PatientPresentation;
  onOffWard: "On ward" | "Off ward";
  seclusion: boolean;
  longTermSeclusion: boolean;
  archived?: boolean;
  enhancedObservation?: EnhancedObservationPlan;
  tesoHistory?: TesoEpisode[];
};

export type Observation = {
  id: string;
  patientId: string;
  observerName: string;
  source: ObservationSource;
  type: ObservationLevel;
  location: PatientLocation;
  presentation: PatientPresentation;
  comments: string;
  observedAt: string;
};

export type MissedObservation = {
  id: string;
  patientId: string;
  patientName: string;
  wardId: string;
  dueAt: string;
  recordedAt: string;
  allocatedStaffId?: string;
  allocatedStaffName: string;
  recordedByStaffId?: string;
  recordedByName: string;
  reason: string;
  details: string;
};

export type News2Reading = {
  id: string;
  patientId: string;
  recordedAt: string;
  recordedBy: string;
  respirationRate: number;
  spo2: number;
  spo2Scale: Spo2Scale;
  onOxygen: boolean;
  systolicBp: number;
  pulse: number;
  consciousness: News2Consciousness;
  temperature: number;
  totalScore: number;
};

export type MedicationPrescription = {
  id: string;
  patientId: string;
  drugName: string;
  dose: string;
  route: string;
  prescriptionType?: MedicationPrescriptionType;
  prnIndication?: string;
  depotIntervalDays?: number;
  administrationTimes: string[];
  startDate: string;
  stopDate?: string;
  additionalInstructions: string;
  prescribedBy: string;
  prescribedAt: string;
  discontinuedBy?: string;
  discontinuedAt?: string;
  discontinueReason?: string;
};

export type MedicationAdministration = {
  id: string;
  prescriptionId: string;
  patientId: string;
  scheduledAt: string;
  status: MedicationAdministrationStatus;
  omissionCode?: MedicationOmissionCode;
  recordedBy: string;
  recordedAt: string;
  notes: string;
};

export type PatientIncompatibility = {
  id: string;
  patientId: string;
  incompatiblePatientId: string;
  reason: string;
};

export type SecurityArea = {
  id: string;
  wardId: string;
  name: string;
  frequencyMinutes: number;
  requiresCount: boolean;
};

export type SecurityCheck = {
  id: string;
  areaId: string;
  checkName: string;
  checkedBy: string;
  checkedAt: string;
  notes: string;
  countedTotal?: number;
};
