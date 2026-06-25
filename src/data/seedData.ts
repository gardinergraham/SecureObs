import type {
  MedicationAdministration,
  MedicationPrescription,
  Observation,
  Patient,
  PatientIncompatibility,
  SecurityArea,
  SecurityCheck,
  Site,
  RotaAssignment,
  StaffShiftAssignment,
  StaffMember,
  Ward
} from "../types/domain";

const now = new Date("2026-06-05T09:30:00.000Z").toISOString();
const tenMinutesAgo = new Date("2026-06-05T09:20:00.000Z").toISOString();
const fortyMinutesAgo = new Date("2026-06-05T08:50:00.000Z").toISOString();
const seventyMinutesAgo = new Date("2026-06-05T08:20:00.000Z").toISOString();

export const seedData: {
  sites: Site[];
  wards: Ward[];
  staff: StaffMember[];
  staffShiftAssignments: StaffShiftAssignment[];
  patients: Patient[];
  medicationPrescriptions: MedicationPrescription[];
  medicationAdministrations: MedicationAdministration[];
  rotaAssignments: RotaAssignment[];
  observations: Observation[];
  incompatibilities: PatientIncompatibility[];
  securityAreas: SecurityArea[];
  securityChecks: SecurityCheck[];
} = {
  sites: [
    { id: "site-1", name: "North Secure Hospital" },
    { id: "site-2", name: "Riverside Secure Unit" }
  ],
  wards: [
    {
      id: "ward-1",
      siteId: "site-1",
      name: "Cedar Ward",
      serviceType: "High secure hospital",
      observationIntervalMinutes: 15,
      news2Enabled: true,
      enhancedObservationsEnabled: true,
      securityChecksEnabled: true,
      medicationChartEnabled: true,
      staffRotaEnabled: true,
      rotaShiftCount: 3,
      rotaShifts: [
        { id: "ward-1-shift-1", startsAt: "07:00", endsAt: "15:00" },
        { id: "ward-1-shift-2", startsAt: "13:30", endsAt: "23:00" },
        { id: "ward-1-shift-3", startsAt: "21:30", endsAt: "07:00" }
      ],
      breakDurationMinutes: 30,
      selected: true
    },
    {
      id: "ward-2",
      siteId: "site-1",
      name: "Maple Ward",
      serviceType: "Medium secure hospital",
      observationIntervalMinutes: 30,
      news2Enabled: true,
      enhancedObservationsEnabled: true,
      securityChecksEnabled: true,
      medicationChartEnabled: false,
      staffRotaEnabled: false,
      rotaShiftCount: 3,
      rotaShifts: [
        { id: "ward-2-shift-1", startsAt: "07:00", endsAt: "15:00" },
        { id: "ward-2-shift-2", startsAt: "15:00", endsAt: "23:00" },
        { id: "ward-2-shift-3", startsAt: "23:00", endsAt: "07:00" }
      ],
      breakDurationMinutes: 30,
      selected: false
    },
    {
      id: "ward-3",
      siteId: "site-2",
      name: "River Ward",
      serviceType: "Care home",
      observationIntervalMinutes: 60,
      news2Enabled: true,
      enhancedObservationsEnabled: true,
      securityChecksEnabled: false,
      medicationChartEnabled: true,
      staffRotaEnabled: true,
      rotaShiftCount: 2,
      rotaShifts: [
        { id: "ward-3-shift-1", startsAt: "08:00", endsAt: "20:00" },
        { id: "ward-3-shift-2", startsAt: "20:00", endsAt: "08:00" }
      ],
      breakDurationMinutes: 60,
      selected: false
    }
  ],
  staff: [
    {
      id: "staff-1",
      keyNumber: 101,
      staffCode: "NurseA",
      name: "Alex Nurse",
      role: "nurse",
      wardId: "ward-1",
      allowedSiteIds: ["site-1"],
      allowedWardIds: ["ward-1", "ward-2"]
    },
    {
      id: "staff-2",
      keyNumber: 207,
      staffCode: "MorganH",
      name: "Morgan HCF",
      role: "hcf",
      wardId: "ward-1",
      allowedSiteIds: ["site-1", "site-2"],
      allowedWardIds: ["ward-1", "ward-3"]
    },
    {
      id: "staff-3",
      keyNumber: 314,
      staffCode: "RileyM",
      name: "Riley Ward Manager",
      role: "manager",
      wardId: "ward-2",
      allowedSiteIds: ["site-1", "site-2"],
      allowedWardIds: ["ward-1", "ward-2", "ward-3"]
    },
    {
      id: "staff-4",
      keyNumber: 118,
      staffCode: "JamieN",
      name: "Jamie Night Nurse",
      role: "nurse",
      wardId: "ward-1",
      allowedSiteIds: ["site-1"],
      allowedWardIds: ["ward-1"]
    },
    {
      id: "staff-5",
      keyNumber: 226,
      staffCode: "CaseyH",
      name: "Casey HCF",
      role: "hcf",
      wardId: "ward-1",
      allowedSiteIds: ["site-1"],
      allowedWardIds: ["ward-1", "ward-2"]
    },
    {
      id: "staff-6",
      keyNumber: 241,
      staffCode: "DevonH",
      name: "Devon HCF",
      role: "hcf",
      wardId: "ward-1",
      allowedSiteIds: ["site-1"],
      allowedWardIds: ["ward-1"]
    },
    {
      id: "staff-7",
      keyNumber: 411,
      staffCode: "HarperS",
      name: "Harper Security",
      role: "security",
      wardId: "ward-1",
      allowedSiteIds: ["site-1"],
      allowedWardIds: ["ward-1", "ward-2"]
    },
    {
      id: "staff-8",
      keyNumber: 512,
      staffCode: "RowanN",
      name: "Rowan Nurse",
      role: "nurse",
      wardId: "ward-3",
      allowedSiteIds: ["site-2"],
      allowedWardIds: ["ward-3"]
    },
    {
      id: "staff-9",
      keyNumber: 529,
      staffCode: "AveryH",
      name: "Avery HCF",
      role: "hcf",
      wardId: "ward-3",
      allowedSiteIds: ["site-2"],
      allowedWardIds: ["ward-3"]
    },
    {
      id: "staff-10",
      keyNumber: 700,
      staffCode: "GardinerG",
      name: "Graham Gardiner",
      role: "manager",
      wardId: "ward-1",
      allowedSiteIds: ["site-1", "site-2"],
      allowedWardIds: ["ward-1", "ward-2", "ward-3"]
    },
    {
      id: "staff-11",
      keyNumber: 901,
      staffCode: "PatelD",
      name: "Dr Anita Patel",
      role: "doctor",
      designation: "Prescriber",
      canPrescribe: true,
      wardId: "ward-1",
      allowedSiteIds: ["site-1", "site-2"],
      allowedWardIds: ["ward-1", "ward-2", "ward-3"]
    }
  ],
  staffShiftAssignments: [
    {
      id: "cover-1",
      wardId: "ward-1",
      shiftId: "ward-1-shift-1",
      staffId: "staff-1",
      date: "2026-06-06"
    },
    {
      id: "cover-2",
      wardId: "ward-1",
      shiftId: "ward-1-shift-1",
      staffId: "staff-5",
      date: "2026-06-06"
    },
    {
      id: "cover-3",
      wardId: "ward-1",
      shiftId: "ward-1-shift-2",
      staffId: "staff-2",
      date: "2026-06-06"
    },
    {
      id: "cover-4",
      wardId: "ward-1",
      shiftId: "ward-1-shift-2",
      staffId: "staff-7",
      date: "2026-06-06"
    },
    {
      id: "cover-5",
      wardId: "ward-1",
      shiftId: "ward-1-shift-3",
      staffId: "staff-4",
      date: "2026-06-06"
    },
    {
      id: "cover-6",
      wardId: "ward-1",
      shiftId: "ward-1-shift-3",
      staffId: "staff-6",
      date: "2026-06-06"
    }
  ],
  patients: [
    {
      id: "patient-1",
      patientNumber: 1001,
      hospitalNumber: "NH100234",
      firstName: "Sam",
      surname: "Green",
      wardId: "ward-1",
      roomNumber: 3,
      observationLevel: "Eyesight",
      latestObservationPlace: "Day room",
      latestObservationTime: tenMinutesAgo,
      latestObservedBy: "Alex Nurse",
      latestPresentation: "Awake",
      onOffWard: "On ward",
      seclusion: false,
      longTermSeclusion: false,
      enhancedObservation: {
        staffRatio: "1:1",
        reasons: ["Risk to self"],
        otherReason: "",
        startedAt: now,
        authorisedBy: "Riley Ward Manager",
        assignedStaffIds: ["staff-1"],
        carePlan: "Offer regular reassurance, maintain eyesight observation, and encourage time in quiet areas when unsettled."
      },
      tesoHistory: [
        {
          id: "teso-patient-1-active",
          startedAt: now,
          reasons: ["Risk to self"],
          otherReason: "",
          observationLevel: "Eyesight",
          staffRatio: "1:1",
          authorisedBy: "Riley Ward Manager",
          carePlan: "Offer regular reassurance, maintain eyesight observation, and encourage time in quiet areas when unsettled."
        }
      ]
    },
    {
      id: "patient-2",
      patientNumber: 1002,
      hospitalNumber: "NH100421",
      firstName: "Taylor",
      surname: "Brown",
      wardId: "ward-1",
      roomNumber: 7,
      observationLevel: "Within arms length",
      latestObservationPlace: "Corridor",
      latestObservationTime: now,
      latestObservedBy: "Morgan HCF",
      latestPresentation: "Awake",
      onOffWard: "Off ward",
      seclusion: false,
      longTermSeclusion: false,
      enhancedObservation: {
        staffRatio: "2:1",
        reasons: ["Security", "Risk to others"],
        otherReason: "",
        startedAt: now,
        authorisedBy: "Riley Ward Manager",
        assignedStaffIds: ["staff-1", "staff-2"],
        carePlan: "Use calm verbal engagement, maintain two staff nearby, and support structured activities away from busy areas."
      },
      tesoHistory: [
        {
          id: "teso-patient-2-active",
          startedAt: now,
          reasons: ["Security", "Risk to others"],
          otherReason: "",
          observationLevel: "Within arms length",
          staffRatio: "2:1",
          authorisedBy: "Riley Ward Manager",
          carePlan: "Use calm verbal engagement, maintain two staff nearby, and support structured activities away from busy areas."
        }
      ]
    },
    {
      id: "patient-4",
      patientNumber: 1004,
      hospitalNumber: "NH100677",
      firstName: "Casey",
      surname: "Black",
      wardId: "ward-1",
      roomNumber: 11,
      observationLevel: "Intermittent",
      latestObservationPlace: "Side room",
      latestObservationTime: fortyMinutesAgo,
      latestObservedBy: "Alex Nurse",
      latestPresentation: "Asleep",
      onOffWard: "On ward",
      seclusion: false,
      longTermSeclusion: true
    },
    {
      id: "patient-3",
      patientNumber: 2201,
      hospitalNumber: "RH220120",
      firstName: "Jordan",
      surname: "White",
      wardId: "ward-3",
      roomNumber: 4,
      observationLevel: "Intermittent",
      latestObservationPlace: "Room 4",
      latestObservationTime: seventyMinutesAgo,
      latestObservedBy: "Riley Ward Manager",
      latestPresentation: "Asleep",
      onOffWard: "On ward",
      seclusion: true,
      longTermSeclusion: false
    }
  ],
  medicationPrescriptions: [
    {
      id: "med-prescription-1",
      patientId: "patient-1",
      drugName: "Paracetamol",
      dose: "1 g",
      route: "Oral",
      administrationTimes: ["08:00", "14:00", "20:00"],
      startDate: now,
      additionalInstructions: "Maximum 4 g in 24 hours.",
      prescribedBy: "Dr Anita Patel",
      prescribedAt: now
    },
    {
      id: "med-prescription-2",
      patientId: "patient-2",
      drugName: "Lorazepam",
      dose: "1 mg",
      route: "Oral",
      administrationTimes: ["22:00"],
      startDate: now,
      additionalInstructions: "Offer with evening medication round if clinically indicated.",
      prescribedBy: "Dr Anita Patel",
      prescribedAt: now
    }
  ],
  medicationAdministrations: [
    {
      id: "med-admin-1",
      prescriptionId: "med-prescription-1",
      patientId: "patient-1",
      scheduledAt: new Date("2026-06-05T08:00:00.000Z").toISOString(),
      status: "Given",
      recordedBy: "Alex Nurse",
      recordedAt: now,
      notes: "Taken with water."
    }
  ],
  rotaAssignments: [
    {
      id: "rota-1",
      wardId: "ward-1",
      staffId: "staff-1",
      role: "Enhanced/TESO",
      startsAt: "09:00",
      endsAt: "11:00",
      patientId: "patient-1",
      notes: "Eyesight observation"
    },
    {
      id: "rota-2",
      wardId: "ward-1",
      staffId: "staff-2",
      role: "General observations",
      startsAt: "09:00",
      endsAt: "11:00",
      notes: "Room order checks"
    }
  ],
  observations: [
    {
      id: "obs-1",
      patientId: "patient-1",
      observerName: "Alex Nurse",
      source: "General observations",
      type: "Eyesight",
      location: "Day room",
      presentation: "Awake",
      comments: "Settled and engaging with staff.",
      observedAt: tenMinutesAgo
    }
  ],
  incompatibilities: [
    {
      id: "inc-1",
      patientId: "patient-1",
      incompatiblePatientId: "patient-2",
      reason: "Keep separate during ward movement."
    }
  ],
  securityAreas: [
    {
      id: "area-1",
      wardId: "ward-1",
      name: "Garden gate",
      frequencyMinutes: 60,
      requiresCount: false,
      category: "ward_security",
      frequencyType: "per_shift",
      active: true
    },
    {
      id: "area-2",
      wardId: "ward-1",
      name: "Cutlery count",
      frequencyMinutes: 30,
      requiresCount: true,
      category: "cutlery",
      frequencyType: "per_meal",
      active: true
    },
    {
      id: "area-3",
      wardId: "ward-1",
      name: "Level 1 patient checks",
      frequencyMinutes: 7 * 24 * 60,
      requiresCount: false,
      category: "level_1_patient_search",
      frequencyType: "weekly_ad_hoc",
      active: true
    }
  ],
  securityChecks: [
    {
      id: "check-1",
      areaId: "area-1",
      checkName: "Gate check",
      checkedBy: "Morgan Security",
      checkedAt: now,
      notes: "Secure"
    },
    {
      id: "check-2",
      areaId: "area-2",
      checkName: "Cutlery count",
      checkedBy: "Morgan Security",
      checkedAt: now,
      notes: "Complete",
      countedTotal: 24
    }
  ]
};
