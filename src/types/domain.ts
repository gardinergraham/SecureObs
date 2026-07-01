export type ObservationLevel = "Eyesight" | "Within arms length" | "General observation" | "Intermittent";
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
export type WardLandingPage = "overview" | "observations";
export type FoodFluidMealPeriod =
  | "Breakfast"
  | "Mid-morning"
  | "Lunch"
  | "Mid-afternoon"
  | "Evening meal"
  | "Bedtime";
export type FoodFluidEntryType = "Food" | "Drink" | "Supplement";
export type FoodFluidIntakeLevel = "Refused" | "Less than half" | "Half" | "More than half" | "All";
export type MedicationAdministrationStatus = "Given" | "Omitted" | "Refused";
export type MedicationOmissionCode = "N" | "X" | "F" | "S" | "O" | "U";
export type MedicationPrescriptionType = "regular" | "prn" | "depot" | "rapid";

export type Site = {
  id: string;
  name: string;
};

export type OrganisationSettings = {
  organisationId: string;
  nfcStaffCodeFormat: string;
  logoDataUri?: string | null;
};

export type PatientNote = {
  id: string;
  patientId: string;
  wardId: string;
  body: string;
  recordedByStaffId: string;
  recordedByName: string;
  recordedByStaffCode: string;
  recordedAt: string;
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
  assessmentFormsEnabled: boolean;
  foodFluidChartEnabled: boolean;
  landingPage: WardLandingPage;
  sessionTimeoutMinutes: number;
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
  nurseInCharge?: boolean;
  medicationNurse?: boolean;
};

export type StaffMember = {
  id: string;
  organisationId?: string;
  keyNumber: number;
  staffCode: string;
  name: string;
  role: "nurse" | "hcf" | "ot" | "security" | "manager" | "doctor" | "super_admin";
  designation?: string;
  canPrescribe?: boolean;
  employmentType?: "permanent" | "bank";
  accessStartsAt?: string;
  accessExpiresAt?: string;
  loginPin?: string;
  loginPinMustChange?: boolean;
  wardId: string;
  allowedSiteIds: string[];
  allowedWardIds: string[];
  active?: boolean;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  staffId: string;
  organisationId: string;
};

export type AuditEvent = {
  id: string;
  actorStaffId?: string;
  actorStaffCode?: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  outcome: "success" | "failure";
  details: Record<string, unknown>;
  occurredAt: string;
};

export type EnhancedObservationPlan = {
  staffRatio: StaffRatio;
  reasons: TesoReason[];
  otherReason: string;
  startedAt: string;
  authorisedBy: string;
  assignedStaffIds: string[];
  carePlan: string;
  reviewFrequencyMinutes?: number;
  nextReviewAt?: string;
  lastCarePlanUpdatedAt?: string;
  lastCarePlanUpdatedBy?: string;
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
  reviewFrequencyMinutes?: number;
  nextReviewAt?: string;
  endedReason?: string;
};

export type PatientFormSectionRisk =
  | "Low"
  | "Medium"
  | "High"
  | "Independent"
  | "Prompting"
  | "Assistance"
  | "Full support"
  | "Yes"
  | "No"
  | "Not assessed";

export type PatientFormSection = {
  id: string;
  title: string;
  risk: PatientFormSectionRisk;
  notes: string;
  actions: string;
};

export type PatientFormRecord = {
  id: string;
  templateId: string;
  title: string;
  status: "Draft" | "Completed" | "Printed";
  completedAt: string;
  completedBy: string;
  reviewDate: string;
  serviceUserSignature: string;
  staffSignature: string;
  sections: PatientFormSection[];
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
  allergies?: string;
  adverseDrugReactions?: string;
  archived?: boolean;
  enhancedObservation?: EnhancedObservationPlan;
  tesoHistory?: TesoEpisode[];
  patientForms?: PatientFormRecord[];
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
  source?: ObservationSource;
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

export type FoodFluidEntry = {
  id: string;
  patientId: string;
  recordedAt: string;
  recordedBy: string;
  mealPeriod: FoodFluidMealPeriod;
  entryType: FoodFluidEntryType;
  itemDescription: string;
  portionOffered: string;
  intakeLevel: FoodFluidIntakeLevel;
  fluidOfferedMl?: number;
  fluidTakenMl?: number;
  assistanceNotes: string;
  comments: string;
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

export type SecurityCheckCategory =
  | "cutlery"
  | "ward_security"
  | "level_1_patient_search"
  | "level_1_room_locker_zone"
  | "custom";
export type SecurityCheckFrequency = "per_shift" | "per_meal" | "daily" | "weekly" | "weekly_ad_hoc" | "monthly";
export type SecurityCheckTargetType = "ward" | "patient" | "items";

export type SecurityArea = {
  id: string;
  wardId: string;
  name: string;
  frequencyMinutes: number;
  requiresCount: boolean;
  category?: SecurityCheckCategory;
  frequencyType?: SecurityCheckFrequency;
  expectedItems?: SecurityExpectedItems;
  active?: boolean;
};

export type SecurityExpectedItems = {
  targetType?: SecurityCheckTargetType;
  cutlery?: {
    knives: number;
    forks: number;
    spoons: number;
  };
  checklist?: Array<{
    id: string;
    name: string;
    expectedCount: number;
  }>;
};

export type SecurityCheckResultDetails = {
  patientId?: string;
  patientName?: string;
  trigger?: string;
  cutlery?: {
    knives: number;
    forks: number;
    spoons: number;
  };
  checklist?: Array<{
    id: string;
    name: string;
    expectedCount: number;
    checked: boolean;
    actualCount?: number;
  }>;
  completionPercent?: number;
};

export type SecurityCheck = {
  id: string;
  areaId: string;
  checkName: string;
  checkedBy: string;
  checkedAt: string;
  notes: string;
  countedTotal?: number;
  resultDetails?: SecurityCheckResultDetails;
};
