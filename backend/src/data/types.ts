export type StaffRole = "nurse" | "hcf" | "ot" | "security" | "manager" | "doctor";
export type EmploymentType = "permanent" | "bank";

export type StaffMemberRecord = {
  id?: string;
  organisationId: string;
  keyNumber?: number | null;
  staffCode: string;
  name: string;
  role: StaffRole;
  designation?: string | null;
  canPrescribe: boolean;
  employmentType: EmploymentType;
  accessStartsAt?: string | null;
  accessExpiresAt?: string | null;
  loginPin?: string | null;
  loginPinHash?: string | null;
  wardId: string;
  allowedSiteIds: string[];
  allowedWardIds: string[];
  active: boolean;
};

export type StaffRepository = {
  list(organisationId: string): Promise<StaffMemberRecord[]>;
  upsert(staff: StaffMemberRecord): Promise<StaffMemberRecord>;
  findActiveById(id: string, organisationId: string): Promise<StaffMemberRecord | null>;
  findActiveByCode(staffCode: string, organisationId?: string): Promise<StaffMemberRecord | null>;
};

export type DataProvider = {
  staff: StaffRepository;
};

export class StaffLookupAmbiguousError extends Error {
  constructor() {
    super("Staff code matches more than one organisation");
  }
}

export class DuplicateStaffCodeError extends Error {
  constructor() {
    super("A staff member with that STAFFCODE already exists for this organisation");
  }
}
