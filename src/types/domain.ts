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

export type PatientLocation = string;

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
export type IncidentSeverity = "green" | "amber" | "red";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentCategory =
  | "Injury or physical concern"
  | "Violence or aggression"
  | "Self-harm"
  | "Fall"
  | "Medication"
  | "Safeguarding"
  | "Security"
  | "Other";
export type PatientTaskCategory =
  | "Physical health"
  | "Mental health"
  | "Medication"
  | "Nutrition and hydration"
  | "Care plan"
  | "Incident follow-up"
  | "Appointment"
  | "Family or advocate"
  | "Other";
export type PatientTaskStatus = "open" | "accepted" | "completed" | "cancelled";
export type PatientTaskRecurrence = "none" | "every_shift" | "daily";

export type Site = {
  id: string;
  name: string;
  organisationId?: string;
};

export type CustomerOrganisation = {
  id: string;
  name: string;
  subscriptionPlan: OrganisationSettings["subscriptionPlan"];
  serviceStatus: OrganisationSettings["serviceStatus"];
  siteLimitOverride?: number | null;
  wardsPerSiteLimitOverride?: number | null;
  siteCount: number;
  wardCount: number;
  billingStatus?: OrganisationSettings["billingStatus"];
  billingInterval?: OrganisationSettings["billingInterval"];
  currentPeriodEnd?: string | null;
  gracePeriodEndsAt?: string | null;
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingCity?: string | null;
  billingPostcode?: string | null;
  billingCountry?: string | null;
};

export type OrganisationSettings = {
  organisationId: string;
  nfcStaffCodeFormat: string;
  logoDataUri?: string | null;
  subscriptionPlan: "essential" | "professional" | "enterprise" | "hospital";
  featureOverrides: Partial<Record<OrganisationFeatureKey, boolean>>;
  serviceStatus: "active" | "suspended";
  suspensionMessage: string;
  siteLimitOverride?: number | null;
  wardsPerSiteLimitOverride?: number | null;
  billingStatus?: "not_configured" | "pending_checkout" | "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "canceled";
  billingInterval?: "monthly" | "yearly" | null;
  licensedWardQuantity?: number | null;
  currentPeriodEnd?: string | null;
  gracePeriodEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  billingPortalAvailable?: boolean;
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingCity?: string | null;
  billingCounty?: string | null;
  billingPostcode?: string | null;
  billingCountry?: string | null;
};

export type OrganisationFeatureKey =
  | "medication"
  | "rostering"
  | "dashboard"
  | "cqcReporting"
  | "verifiedObservations"
  | "securityChecks"
  | "multiSite"
  | "multiWard"
  | "prioritySupport"
  | "dedicatedSupport"
  | "staffTraining"
  | "dedicatedDatabase"
  | "sqlIntegration";

export type PatientIdentificationProfile = {
  roomTagToken?: string;
  personalTagToken?: string;
  photoDataUri?: string;
  showPhoto: boolean;
  showDateOfBirth: boolean;
  showHospitalNumber: boolean;
  showWardAndRoom: boolean;
  showAllergies: boolean;
  consentStatus: "not_recorded" | "consented" | "best_interests" | "declined";
  updatedAt?: string;
  updatedBy?: string;
};

export type BillingReportRow = {
  id: string;
  organisationName: string;
  billingContactName: string;
  billingEmail: string;
  subscriptionPlan: "essential" | "professional" | "enterprise";
  billingInterval: "monthly" | "yearly";
  licensedWardQuantity: number;
  billingStatus: "pending_checkout" | "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "canceled";
  expectedAmount: number;
  lastPaymentAmount: number | null;
  billingCurrency: string;
  lastPaymentAt: string | null;
  nextDueAt: string | null;
  daysUntilDue: number | null;
  paymentFailedAt: string | null;
  gracePeriodEndsAt: string | null;
  graceDay: number | null;
  graceDaysRemaining: number | null;
  cancelAtPeriodEnd: boolean;
  reminderStatus: string;
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

export type PatientCarePlan = {
  id: string;
  patientId: string;
  wardId: string;
  title: string;
  identifiedNeeds: string;
  risksAndTriggers: string;
  goals: string;
  interventions: string;
  patientViews: string;
  reviewDate: string;
  additionalNotes: string;
  createdByStaffId: string;
  createdByName: string;
  createdByStaffCode: string;
  createdAt: string;
};

export type SafetyIncident = {
  id: string;
  patientId: string;
  wardId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  details: string;
  immediateAction: string;
  bodyAreas: string[];
  patientAccount: string;
  ownerStaffId?: string;
  ownerName?: string;
  reportedByStaffId: string;
  reportedByName: string;
  reportedByStaffCode: string;
  reportedAt: string;
  acknowledgedByStaffId?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  resolutionNotes?: string;
  resolvedByStaffId?: string;
  resolvedByName?: string;
  resolvedAt?: string;
};

export type ShiftHandoverPatientSummary = {
  patientId: string;
  patientName: string;
  roomNumber: number;
  observationCount: number;
  movementSummary: string;
  presentationSummary: string;
  nutritionSummary: string;
  news2Summary: string;
  medicationSummary: string;
  incidentSummary: string;
  taskSummary?: string;
  patientVoiceSummary?: string;
  narrative: string;
  staffNotes: string;
};

export type ShiftHandover = {
  id: string;
  wardId: string;
  shiftId: string;
  shiftLabel: string;
  shiftStartedAt: string;
  shiftEndedAt: string;
  overallSummary: string;
  patientSummaries: ShiftHandoverPatientSummary[];
  createdByStaffId: string;
  createdByName: string;
  createdByStaffCode: string;
  createdAt: string;
};

export type PatientTask = {
  id: string;
  patientId: string;
  wardId: string;
  title: string;
  details: string;
  category: PatientTaskCategory;
  priority: IncidentSeverity;
  status: PatientTaskStatus;
  dueAt: string;
  recurrence: PatientTaskRecurrence;
  assignedToStaffId?: string;
  assignedToName?: string;
  assignedRole?: StaffMember["role"];
  sourceType?: "manual" | "incident" | "care_plan";
  sourceId?: string;
  createdByStaffId: string;
  createdByName: string;
  createdByStaffCode: string;
  createdAt: string;
  acceptedByStaffId?: string;
  acceptedByName?: string;
  acceptedAt?: string;
  completionNotes?: string;
  completedByStaffId?: string;
  completedByName?: string;
  completedAt?: string;
  cancelledByStaffId?: string;
  cancelledByName?: string;
  cancelledAt?: string;
};

export type Ward = {
  id: string;
  organisationId?: string;
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
  verifiedObservationsEnabled: boolean;
  observationLocations?: PatientLocation[];
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

export type PatientVoiceRating = 1 | 2 | 3 | 4 | 5;
export type PatientVoiceReviewFrequency = "Initial" | "Weekly" | "Monthly";

export type PatientVoiceProfile = {
  whatMatters: string;
  careGoals: string;
  communicationNeeds: string;
  sensoryNeeds: string;
  culturalSpiritualNeeds: string;
  dietaryNeeds: string;
  accessibilityNeeds: string;
  distressSupport: string;
  preferredInvolvement: string;
  updatedAt: string;
  updatedWithPatient: boolean;
  recordedByStaffId: string;
  recordedByName: string;
};

export type PatientVoiceCheckIn = {
  id: string;
  frequency: PatientVoiceReviewFrequency;
  foodRating: PatientVoiceRating;
  staffSupportRating: PatientVoiceRating;
  accommodationRating: PatientVoiceRating;
  activitiesRating: PatientVoiceRating;
  safetyRating: PatientVoiceRating;
  overallRating: PatientVoiceRating;
  goingWell: string;
  wouldChange: string;
  needsChanged: string;
  concerns: string;
  completedBy: "Patient" | "Patient with support";
  submittedAt: string;
  witnessedByStaffId: string;
  witnessedByName: string;
  staffResponse?: string;
  acknowledgedAt?: string;
  acknowledgedByStaffId?: string;
  acknowledgedByName?: string;
};

export type FamilyShareCategory =
  | "Patient voice"
  | "Progress summary"
  | "Care-plan goals"
  | "Approved notes";

export type FamilyPortalContact = {
  id: string;
  name: string;
  relationship: string;
  categories: FamilyShareCategory[];
  active: boolean;
  canContribute: boolean;
  accessExpiresAt?: string;
};

export type FamilySharingPreferences = {
  patientConsented: boolean;
  consentNotes: string;
  consentRecordedAt?: string;
  consentRecordedByStaffId?: string;
  consentRecordedByName?: string;
  consentReviewDate?: string;
  contacts: FamilyPortalContact[];
  sharedNoteIds: string[];
};

export type FamilyPortalContribution = {
  id: string;
  contactId: string;
  contactName: string;
  body: string;
  submittedAt: string;
  recordedByStaffId?: string;
  recordedByName?: string;
  source?: "Family portal" | "Ward tablet";
  reviewStatus?: "Awaiting staff review" | "Reviewed";
  staffReviewNote?: string;
  reviewedAt?: string;
  reviewedByStaffId?: string;
  reviewedByName?: string;
};

export type Patient = {
  id: string;
  patientNumber: number;
  hospitalNumber: string;
  firstName: string;
  surname: string;
  dateOfBirth?: string;
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinTelephone?: string;
  nextOfKinEmail?: string;
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
  identificationProfile?: PatientIdentificationProfile;
  enhancedObservation?: EnhancedObservationPlan;
  tesoHistory?: TesoEpisode[];
  patientForms?: PatientFormRecord[];
  patientVoiceProfile?: PatientVoiceProfile;
  patientVoiceCheckIns?: PatientVoiceCheckIn[];
  familySharing?: FamilySharingPreferences;
  familyContributions?: FamilyPortalContribution[];
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
  verificationMethod?: "none" | "nfc_room" | "nfc_personal" | "qr_room" | "qr_personal" | "manual_exception";
  verificationToken?: string;
  verificationScannedAt?: string;
  visualConfirmation?: boolean;
  verificationExceptionReason?: string;
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
