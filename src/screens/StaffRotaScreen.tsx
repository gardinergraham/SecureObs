import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { Patient, RotaAssignment, RotaRole, StaffMember, StaffShiftAssignment, Ward } from "../types/domain";

const defaultRoles: RotaRole[] = ["General observations", "Enhanced/TESO", "Security checks", "Break"];
type TimeSlot = {
  startsAt: string;
  endsAt: string;
};

type CoveredStaffOption = {
  member: StaffMember;
  shiftLabels: string[];
  nurseInCharge: boolean;
  medicationNurse: boolean;
};

const fallbackTimeSlot: TimeSlot = { startsAt: "07:00", endsAt: "15:00" };
const observationSlotMinutes = 60;
const medicationRoundTimes = ["08:00", "12:00", "18:00", "22:00"];

type StaffRotaScreenProps = {
  assignments: RotaAssignment[];
  patients: Patient[];
  selectedWardId: string;
  staff: StaffMember[];
  staffShiftAssignments: StaffShiftAssignment[];
  wards: Ward[];
  onBack: () => void;
  onCreateAssignment: (assignment: RotaAssignment) => void;
  onOpenStaffCover: () => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onUpdateAssignment: (assignment: RotaAssignment) => void;
};

export function StaffRotaScreen({
  assignments,
  patients,
  selectedWardId,
  staff,
  staffShiftAssignments,
  wards,
  onBack,
  onCreateAssignment,
  onOpenStaffCover,
  onRemoveAssignment,
  onUpdateAssignment
}: StaffRotaScreenProps) {
  const ward = wards.find((item) => item.id === selectedWardId);
  const todayKey = formatDateKey(new Date());
  const shiftSlots = useMemo(() => buildShiftSlots(ward), [ward]);
  const observationSlots = useMemo(() => buildObservationSlots(ward), [ward]);
  const breakSlots = useMemo(() => buildBreakSlots(ward), [ward]);
  const availableRoles = useMemo(() => {
    return defaultRoles.filter((role) => {
      if (role === "Enhanced/TESO") {
        return ward?.enhancedObservationsEnabled;
      }

      if (role === "Security checks") {
        return ward?.securityChecksEnabled;
      }

      return true;
    });
  }, [ward?.enhancedObservationsEnabled, ward?.securityChecksEnabled]);
  const wardAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.wardId === selectedWardId),
    [assignments, selectedWardId]
  );
  const enhancedPatients = patients.filter((patient) => patient.observationLevel !== "Intermittent");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedRole, setSelectedRole] = useState<RotaRole>("General observations");
  const [selectedPatientId, setSelectedPatientId] = useState(enhancedPatients[0]?.id ?? "");
  const [selectedSlot, setSelectedSlot] = useState(observationSlots[0] ?? fallbackTimeSlot);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const selectableTimeSlots = selectedRole === "Break" ? breakSlots : observationSlots;
  const coveredStaffOptions = useMemo(
    () => getCoveredStaffOptions(staffShiftAssignments, staff, ward, selectedWardId, todayKey, selectedSlot),
    [selectedSlot, selectedWardId, staff, staffShiftAssignments, todayKey, ward]
  );
  const wardStaff = coveredStaffOptions.map((option) => option.member);
  const conflictMessage = getAssignmentConflict({
    assignments: wardAssignments,
    editingAssignmentId,
    patientId: selectedPatientId,
    role: selectedRole,
    slot: selectedSlot,
    staffId: selectedStaffId
  });

  useEffect(() => {
    if (!availableRoles.includes(selectedRole)) {
      setSelectedRole("General observations");
    }
  }, [availableRoles, selectedRole]);

  useEffect(() => {
    if (selectableTimeSlots.length === 0) {
      return;
    }

    const slotStillAvailable = selectableTimeSlots.some(
      (slot) => slot.startsAt === selectedSlot.startsAt && slot.endsAt === selectedSlot.endsAt
    );

    if (!slotStillAvailable) {
      const nextSlot = selectableTimeSlots[0];
      if (nextSlot) {
        setSelectedSlot(nextSlot);
      }
    }
  }, [selectableTimeSlots, selectedSlot.endsAt, selectedSlot.startsAt]);

  useEffect(() => {
    if (wardStaff.length === 0) {
      setSelectedStaffId("");
      return;
    }

    if (!wardStaff.some((member) => member.id === selectedStaffId)) {
      setSelectedStaffId(wardStaff[0]?.id ?? "");
    }
  }, [selectedStaffId, wardStaff]);

  useEffect(() => {
    if (enhancedPatients.length === 0) {
      setSelectedPatientId("");
      if (selectedRole === "Enhanced/TESO") {
        setSelectedRole("General observations");
      }
      return;
    }

    if (!enhancedPatients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId(enhancedPatients[0]?.id ?? "");
    }
  }, [enhancedPatients, selectedPatientId, selectedRole]);

  const addAssignment = () => {
    if (!selectedStaffId || !ward || (selectedRole === "Enhanced/TESO" && !selectedPatientId) || conflictMessage) {
      return;
    }

    const assignment = {
      id: editingAssignmentId ?? `rota-${Date.now()}`,
      wardId: ward.id,
      staffId: selectedStaffId,
      role: selectedRole,
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      patientId: selectedRole === "Enhanced/TESO" ? selectedPatientId : undefined,
      notes
    };

    if (editingAssignmentId) {
      onUpdateAssignment(assignment);
      setEditingAssignmentId(null);
    } else {
      onCreateAssignment(assignment);
    }

    setNotes("");
  };

  const editAssignment = (assignment: RotaAssignment) => {
    const roleSlots = assignment.role === "Break" ? breakSlots : observationSlots;
    const slot = roleSlots.find(
      (item) => item.startsAt === assignment.startsAt && item.endsAt === assignment.endsAt
    );

    setEditingAssignmentId(assignment.id);
    setSelectedStaffId(assignment.staffId);
    setSelectedRole(assignment.role);
    setSelectedPatientId(assignment.patientId ?? enhancedPatients[0]?.id ?? "");
    setSelectedSlot(slot ?? roleSlots[0] ?? fallbackTimeSlot);
    setNotes(assignment.notes);
  };

  const autoAssignSelectedSlot = () => {
    if (!ward || coveredStaffOptions.length === 0) {
      return;
    }

    const newAssignments = buildAutoAssignments({
      availableRoles,
      coveredStaffOptions,
      enhancedPatients,
      existingAssignments: wardAssignments,
      patients,
      selectedSlot,
      wardId: ward.id
    });

    newAssignments.forEach(onCreateAssignment);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Staff rota</Text>
          <Text style={styles.meta}>{ward?.name ?? "Ward"} | Optional ward feature</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity accessibilityRole="button" onPress={onOpenStaffCover} style={styles.backButton}>
            <Text style={styles.backButtonText}>Staff cover</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to observations</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.split}>
        <View style={styles.rotaGrid}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.panelScroller}
          >
            <Text style={styles.panelTitle}>Today</Text>
            <Text style={styles.dateTitle}>{formatRotaDate(new Date())}</Text>
            <Text style={styles.rotaMeta}>
              {ward?.rotaShiftCount ?? shiftSlots.length} shifts | Observations 1h | Breaks{" "}
              {ward?.breakDurationMinutes ?? 30}m
            </Text>
            <View style={styles.assignmentList}>
              {observationSlots.map((coverageSlot) => {
                const slotAssignments = getAssignmentsForSlot(wardAssignments, coverageSlot);
                const coveringStaff = getCoveredStaffOptions(
                  staffShiftAssignments,
                  staff,
                  ward,
                  selectedWardId,
                  todayKey,
                  coverageSlot
                );

                return (
                  <View
                    key={`${coverageSlot.startsAt}-${coverageSlot.endsAt}`}
                    style={[styles.coverageRow, slotAssignments.length === 0 && styles.coverageGapRow]}
                  >
                    <Text style={styles.coverageTime}>
                      {coverageSlot.startsAt} - {coverageSlot.endsAt}
                    </Text>
                    <View style={styles.coverageAssignments}>
                      {coveringStaff.length > 0 ? (
                        <View style={styles.coveringStaffBox}>
                          <Text style={styles.coveringStaffLabel}>Covering staff</Text>
                          <Text style={styles.coveringStaffText}>
                            {coveringStaff
                              .map((option) => `${option.member.name}${formatCoverFlags(option)} (${option.shiftLabels.join(", ")})`)
                              .join("  |  ")}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.coverWarningText}>No staff cover set for this time</Text>
                      )}
                      {slotAssignments.length === 0 ? (
                        <Text style={styles.gapText}>Gap</Text>
                      ) : (
                        slotAssignments.map((assignment) => (
                          <View key={assignment.id} style={styles.assignmentCard}>
                            <Text style={styles.assignmentTitle}>
                              {staff.find((member) => member.id === assignment.staffId)?.name ?? "Unknown staff"}
                            </Text>
                            <Text style={styles.assignmentMeta}>
                              {assignment.startsAt} - {assignment.endsAt} | {assignment.role}
                              {assignment.patientId
                                ? ` | ${patients.find((patient) => patient.id === assignment.patientId)?.firstName ?? ""}`
                                : ""}
                            </Text>
                            <View style={styles.assignmentActions}>
                              <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => editAssignment(assignment)}
                                style={styles.smallButton}
                              >
                                <Text style={styles.smallButtonText}>Change</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => onRemoveAssignment(assignment.id)}
                                style={[styles.smallButton, styles.removeButton]}
                              >
                                <Text style={[styles.smallButtonText, styles.removeButtonText]}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.editor}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.panelScroller}
          >
            <Text style={styles.panelTitle}>{editingAssignmentId ? "Change assignment" : "Assign role"}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={coveredStaffOptions.length === 0}
              onPress={autoAssignSelectedSlot}
              style={[styles.autoAssignButton, coveredStaffOptions.length === 0 && styles.saveButtonDisabled]}
            >
              <Text style={styles.autoAssignButtonText}>Auto assign selected time</Text>
            </TouchableOpacity>
            <Text style={styles.autoAssignMeta}>
              Enhanced first, then general observations, then security. Medication nurses are protected during medicine rounds.
            </Text>

            {ward?.enhancedObservationsEnabled ? (
              <>
                <Text style={styles.label}>Enhanced patient need</Text>
                <OptionRow
                  options={enhancedPatients.map((patient) => {
                    const required = getRequiredStaffCount(patient);
                    const assigned = getEnhancedAssignmentCount(wardAssignments, patient.id, selectedSlot);
                    const status = required > 0 && assigned >= required ? "Met" : "Needs";

                    return {
                      id: patient.id,
                      label: `${status} ${assigned}/${required} | Room ${patient.roomNumber} ${patient.firstName}`
                    };
                  })}
                  selectedId={selectedPatientId}
                  onSelect={(patientId) => {
                    setSelectedPatientId(patientId);
                    setSelectedRole("Enhanced/TESO");
                  }}
                />
              </>
            ) : null}

            <Text style={styles.label}>Time</Text>
            <OptionRow
              options={selectableTimeSlots.map((slot) => ({
                id: `${slot.startsAt}-${slot.endsAt}`,
                label: `${slot.startsAt} - ${slot.endsAt}`
              }))}
              selectedId={`${selectedSlot.startsAt}-${selectedSlot.endsAt}`}
              onSelect={(id) => {
                const slot = selectableTimeSlots.find((item) => `${item.startsAt}-${item.endsAt}` === id);
                if (slot) {
                  setSelectedSlot(slot);
                }
              }}
            />

            <Text style={styles.label}>Staff</Text>
            {wardStaff.length === 0 ? (
              <Text style={styles.warningText}>No staff cover is assigned for this ward at this time.</Text>
            ) : null}
            <OptionRow
              options={coveredStaffOptions.map((option) => {
                const { member } = option;
                const enhancedAssignment = getStaffEnhancedAssignment(
                  wardAssignments,
                  member.id,
                  selectedSlot,
                  editingAssignmentId
                );
                const patient = patients.find((item) => item.id === enhancedAssignment?.patientId);

                return {
                  id: member.id,
                  label: enhancedAssignment
                    ? `${member.name} (${option.shiftLabels.join(", ")}) - enhanced ${
                        patient ? `Room ${patient.roomNumber}` : "assigned"
                      }`
                    : `${member.name} (${option.shiftLabels.join(", ")})`
                };
              })}
              selectedId={selectedStaffId}
              onSelect={setSelectedStaffId}
            />

            <Text style={styles.label}>Role</Text>
            <OptionRow
              options={availableRoles.map((role) => ({ id: role, label: role }))}
              selectedId={selectedRole}
              onSelect={(role) => setSelectedRole(role as RotaRole)}
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              onChangeText={setNotes}
              placeholder="Optional rota notes"
              style={styles.input}
              value={notes}
            />

            {conflictMessage ? <Text style={styles.warningText}>{conflictMessage}</Text> : null}

            <TouchableOpacity
              accessibilityRole="button"
              disabled={Boolean(conflictMessage)}
              onPress={addAssignment}
              style={[styles.saveButton, conflictMessage && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>{editingAssignmentId ? "Save changes" : "Add assignment"}</Text>
            </TouchableOpacity>
            {editingAssignmentId ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setEditingAssignmentId(null);
                  setNotes("");
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel change</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

type OptionRowProps = {
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
};

function buildShiftSlots(ward: Ward | undefined): TimeSlot[] {
  if (!ward || ward.rotaShifts.length === 0) {
    return [fallbackTimeSlot];
  }

  return ward.rotaShifts.slice(0, ward.rotaShiftCount).map((shift) => ({
    startsAt: shift.startsAt,
    endsAt: shift.endsAt
  }));
}

function buildBreakSlots(ward: Ward | undefined): TimeSlot[] {
  const breakDurationMinutes = ward?.breakDurationMinutes ?? 30;

  return buildTimeSlots(ward, breakDurationMinutes);
}

function buildObservationSlots(ward: Ward | undefined): TimeSlot[] {
  return buildTimeSlots(ward, observationSlotMinutes);
}

function buildTimeSlots(ward: Ward | undefined, durationMinutes: number): TimeSlot[] {
  const shifts = buildShiftSlots(ward);

  if (shifts.length === 0) {
    return [fallbackTimeSlot];
  }

  const timelineStart = timeToMinutes(shifts[0]?.startsAt ?? fallbackTimeSlot.startsAt);
  let timelineEnd = timeToMinutes(shifts[shifts.length - 1]?.endsAt ?? fallbackTimeSlot.endsAt);

  while (timelineEnd <= timelineStart) {
    timelineEnd += 24 * 60;
  }

  const slots: TimeSlot[] = [];
  for (let start = timelineStart; start < timelineEnd; start += durationMinutes) {
    const end = Math.min(start + durationMinutes, timelineEnd);

    slots.push({
      startsAt: formatMinutesAsTime(start),
      endsAt: formatMinutesAsTime(end)
    });
  }

  return slots;
}

function getAssignmentsForSlot(assignments: RotaAssignment[], slot: TimeSlot) {
  return assignments
    .filter((assignment) => slotsOverlap({ startsAt: assignment.startsAt, endsAt: assignment.endsAt }, slot))
    .sort((left, right) => {
      const timeDifference = timeToMinutes(left.startsAt) - timeToMinutes(right.startsAt);
      if (timeDifference !== 0) {
        return timeDifference;
      }

      return left.role.localeCompare(right.role);
    });
}

function getCoveredStaffOptions(
  staffShiftAssignments: StaffShiftAssignment[],
  staff: StaffMember[],
  ward: Ward | undefined,
  selectedWardId: string,
  dateKey: string,
  slot: TimeSlot
): CoveredStaffOption[] {
  const coveredByStaffId = new Map<string, CoveredStaffOption>();
  const wardShifts = ward?.rotaShifts.slice(0, ward.rotaShiftCount) ?? [];

  staffShiftAssignments
    .filter((assignment) => assignment.wardId === selectedWardId && assignment.date === dateKey)
    .forEach((assignment) => {
      const shiftIndex = wardShifts.findIndex((shift) => shift.id === assignment.shiftId);
      const coverShift = wardShifts[shiftIndex];

      if (!coverShift || !slotsOverlap({ startsAt: coverShift.startsAt, endsAt: coverShift.endsAt }, slot)) {
        return;
      }

      const member = staff.find((staffMember) => staffMember.id === assignment.staffId);
      if (!member) {
        return;
      }

      const shiftLabel = `Shift ${shiftIndex + 1}`;
      const existing = coveredByStaffId.get(member.id);

      if (existing) {
        if (!existing.shiftLabels.includes(shiftLabel)) {
          existing.shiftLabels.push(shiftLabel);
        }
        existing.nurseInCharge = existing.nurseInCharge || Boolean(assignment.nurseInCharge);
        existing.medicationNurse = existing.medicationNurse || Boolean(assignment.medicationNurse);
        return;
      }

      coveredByStaffId.set(member.id, {
        member,
        shiftLabels: [shiftLabel],
        nurseInCharge: Boolean(assignment.nurseInCharge),
        medicationNurse: Boolean(assignment.medicationNurse)
      });
    });

  return Array.from(coveredByStaffId.values()).sort((left, right) => left.member.name.localeCompare(right.member.name));
}

type BuildAutoAssignmentsInput = {
  availableRoles: RotaRole[];
  coveredStaffOptions: CoveredStaffOption[];
  enhancedPatients: Patient[];
  existingAssignments: RotaAssignment[];
  patients: Patient[];
  selectedSlot: TimeSlot;
  wardId: string;
};

function buildAutoAssignments({
  availableRoles,
  coveredStaffOptions,
  enhancedPatients,
  existingAssignments,
  patients,
  selectedSlot,
  wardId
}: BuildAutoAssignmentsInput) {
  const createdAssignments: RotaAssignment[] = [];
  const assignedStaffIds = new Set(
    getAssignmentsForSlot(existingAssignments, selectedSlot).map((assignment) => assignment.staffId)
  );
  const medicineRound = medicationRoundTimes.some((time) => timeFallsInSlot(time, selectedSlot));
  const staffPool = [...coveredStaffOptions].sort((left, right) => {
    if (left.nurseInCharge !== right.nurseInCharge) {
      return Number(left.nurseInCharge) - Number(right.nurseInCharge);
    }
    return left.member.name.localeCompare(right.member.name);
  });

  const takeStaff = (protectMedicationNurse: boolean) => {
    const option = staffPool.find(
      (item) =>
        !assignedStaffIds.has(item.member.id) &&
        !(protectMedicationNurse && medicineRound && item.medicationNurse)
    );

    if (!option) return undefined;
    assignedStaffIds.add(option.member.id);
    return option.member;
  };

  if (availableRoles.includes("Enhanced/TESO")) {
    enhancedPatients.forEach((patient) => {
      const required = getRequiredStaffCount(patient);
      const existingCount = getEnhancedAssignmentCount(existingAssignments, patient.id, selectedSlot);
      const needed = Math.max(0, required - existingCount);

      Array.from({ length: needed }).forEach(() => {
        const member = takeStaff(true);
        if (!member) return;
        createdAssignments.push(createAutoAssignment(wardId, member.id, "Enhanced/TESO", selectedSlot, patient.id));
      });
    });
  }

  if (availableRoles.includes("General observations") && !roleCovered(existingAssignments, createdAssignments, "General observations", selectedSlot)) {
    const member = takeStaff(true);
    if (member) {
      createdAssignments.push(createAutoAssignment(wardId, member.id, "General observations", selectedSlot));
    }
  }

  if (availableRoles.includes("Security checks") && !roleCovered(existingAssignments, createdAssignments, "Security checks", selectedSlot)) {
    const member = takeStaff(false);
    if (member) {
      createdAssignments.push(createAutoAssignment(wardId, member.id, "Security checks", selectedSlot));
    }
  }

  return createdAssignments.map((assignment) => ({
    ...assignment,
    notes: `${assignment.notes}${formatAutoAssignNote(assignment, coveredStaffOptions, patients)}`
  }));
}

function createAutoAssignment(
  wardId: string,
  staffId: string,
  role: RotaRole,
  slot: TimeSlot,
  patientId?: string
): RotaAssignment {
  return {
    id: `rota-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wardId,
    staffId,
    role,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    patientId,
    notes: "Auto assigned"
  };
}

function roleCovered(existingAssignments: RotaAssignment[], createdAssignments: RotaAssignment[], role: RotaRole, slot: TimeSlot) {
  return [...existingAssignments, ...createdAssignments].some(
    (assignment) => assignment.role === role && slotsOverlap({ startsAt: assignment.startsAt, endsAt: assignment.endsAt }, slot)
  );
}

function formatCoverFlags(option: CoveredStaffOption) {
  const flags = [option.nurseInCharge ? "NIC" : "", option.medicationNurse ? "Meds" : ""].filter(Boolean);
  return flags.length > 0 ? ` [${flags.join(", ")}]` : "";
}

function formatAutoAssignNote(
  assignment: RotaAssignment,
  coveredStaffOptions: CoveredStaffOption[],
  patients: Patient[]
) {
  const cover = coveredStaffOptions.find((option) => option.member.id === assignment.staffId);
  const patient = assignment.patientId ? patients.find((item) => item.id === assignment.patientId) : undefined;
  const flags = cover ? formatCoverFlags(cover) : "";
  const patientText = patient ? ` | Room ${patient.roomNumber}` : "";
  return `${flags}${patientText}`;
}

function formatRotaDate(date: Date) {
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function timeFallsInSlot(time: string, slot: TimeSlot) {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(slot.startsAt);
  const endMinutes = timeToMinutes(slot.endsAt);

  if (endMinutes <= startMinutes) {
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }

  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

function slotsOverlap(left: TimeSlot, right: TimeSlot) {
  const leftRange = normaliseSlotRange(left);
  const rightRange = normaliseSlotRange(right);

  return [-24 * 60, 0, 24 * 60].some((offset) => {
    const shiftedRight = {
      start: rightRange.start + offset,
      end: rightRange.end + offset
    };

    return leftRange.start < shiftedRight.end && shiftedRight.start < leftRange.end;
  });
}

function normaliseSlotRange(slot: TimeSlot) {
  let start = timeToMinutes(slot.startsAt);
  let end = timeToMinutes(slot.endsAt);

  if (end <= start) {
    end += 24 * 60;
  }

  return { start, end };
}

function timeToMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatMinutesAsTime(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const wrappedMinutes = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(wrappedMinutes / 60);
  const minutes = wrappedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getRequiredStaffCount(patient: Patient) {
  const ratio = patient.enhancedObservation?.staffRatio ?? "1:1";
  return Number.parseInt(ratio.split(":")[0] ?? "1", 10);
}

function getEnhancedAssignmentCount(assignments: RotaAssignment[], patientId: string, slot: TimeSlot) {
  return assignments.filter(
    (assignment) =>
      assignment.role === "Enhanced/TESO" &&
      assignment.patientId === patientId &&
      slotsOverlap({ startsAt: assignment.startsAt, endsAt: assignment.endsAt }, slot)
  ).length;
}

type AssignmentConflictInput = {
  assignments: RotaAssignment[];
  editingAssignmentId: string | null;
  patientId: string;
  role: RotaRole;
  slot: TimeSlot;
  staffId: string;
};

function getAssignmentConflict({
  assignments,
  editingAssignmentId,
  patientId,
  role,
  slot,
  staffId
}: AssignmentConflictInput) {
  if (!staffId) {
    return "";
  }

  const sameSlotAssignments = assignments.filter(
    (assignment) =>
      assignment.id !== editingAssignmentId &&
      slotsOverlap(
        {
          startsAt: assignment.startsAt,
          endsAt: assignment.endsAt
        },
        slot
      )
  );

  const overlappingStaffAssignment = sameSlotAssignments.find((assignment) => assignment.staffId === staffId);

  if (overlappingStaffAssignment) {
    return "This staff member already has an assignment that overlaps this time.";
  }

  const duplicateAssignment = sameSlotAssignments.find(
    (assignment) =>
      assignment.staffId === staffId &&
      assignment.role === role &&
      assignment.patientId === (role === "Enhanced/TESO" ? patientId : undefined)
  );

  if (duplicateAssignment) {
    return "This staff member is already assigned to this role in this time slot.";
  }

  if (role !== "Enhanced/TESO") {
    return "";
  }

  const existingEnhancedAssignment = sameSlotAssignments.find(
    (assignment) => assignment.staffId === staffId && assignment.role === "Enhanced/TESO"
  );

  if (!existingEnhancedAssignment) {
    return "";
  }

  if (existingEnhancedAssignment.patientId === patientId) {
    return "This staff member is already assigned to this enhanced patient for this time slot.";
  }

  return "This staff member is already on enhanced observations for another patient in this time slot.";
}

function getStaffEnhancedAssignment(
  assignments: RotaAssignment[],
  staffId: string,
  slot: TimeSlot,
  editingAssignmentId: string | null
) {
  return assignments.find(
    (assignment) =>
      assignment.id !== editingAssignmentId &&
      assignment.staffId === staffId &&
      assignment.role === "Enhanced/TESO" &&
      slotsOverlap({ startsAt: assignment.startsAt, endsAt: assignment.endsAt }, slot)
  );
}

function OptionRow({ options, selectedId, onSelect }: OptionRowProps) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => (
        <TouchableOpacity
          accessibilityRole="button"
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={[styles.optionButton, option.id === selectedId && styles.optionButtonActive]}
        >
          <Text style={[styles.optionText, option.id === selectedId && styles.optionTextActive]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 12
  },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  title: {
    color: "#18262c",
    fontSize: 20,
    fontWeight: "900"
  },
  meta: {
    color: "#607078",
    fontSize: 13,
    marginTop: 3
  },
  rotaMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  backButtonText: {
    color: "#1f5262",
    fontSize: 13,
    fontWeight: "900"
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  split: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  rotaGrid: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.58,
    height: 460,
    minWidth: 480,
    overflow: "hidden",
    padding: 12
  },
  editor: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.42,
    height: 460,
    minWidth: 360,
    overflow: "hidden",
    padding: 12
  },
  panelScroller: {
    flex: 1,
    minHeight: 0
  },
  scrollContent: {
    paddingBottom: 6
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900"
  },
  dateTitle: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
    marginBottom: 6
  },
  slotRow: {
    borderTopColor: "#edf1f2",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 72,
    paddingVertical: 10
  },
  slotTime: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "900",
    width: 100
  },
  assignmentList: {
    flex: 1,
    gap: 8
  },
  coverageRow: {
    alignItems: "stretch",
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 8
  },
  coverageGapRow: {
    backgroundColor: "#fff8e8",
    borderColor: "#e2bf72"
  },
  coverageTime: {
    color: "#31454d",
    fontSize: 12,
    fontWeight: "900",
    width: 92
  },
  coverageAssignments: {
    flex: 1,
    gap: 6
  },
  coveringStaffBox: {
    backgroundColor: "#edf7f2",
    borderColor: "#b9d8ca",
    borderRadius: 6,
    borderWidth: 1,
    padding: 7
  },
  coveringStaffLabel: {
    color: "#315748",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 2,
    textTransform: "uppercase"
  },
  coveringStaffText: {
    color: "#203c32",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  coverWarningText: {
    backgroundColor: "#fff4d7",
    borderColor: "#e4b85b",
    borderRadius: 6,
    borderWidth: 1,
    color: "#7a4b00",
    fontSize: 12,
    fontWeight: "900",
    padding: 7
  },
  gapText: {
    color: "#8a5a00",
    fontSize: 13,
    fontWeight: "900",
    paddingVertical: 2
  },
  assignmentCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    padding: 9
  },
  assignmentTitle: {
    color: "#18262c",
    fontSize: 14,
    fontWeight: "900"
  },
  assignmentMeta: {
    color: "#607078",
    fontSize: 12,
    marginTop: 2
  },
  assignmentActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  smallButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 10
  },
  smallButtonText: {
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900"
  },
  removeButton: {
    borderColor: "#b3261e"
  },
  removeButtonText: {
    color: "#b3261e"
  },
  label: {
    color: "#31454d",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 10
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  optionButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  optionText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "800"
  },
  optionTextActive: {
    color: "#ffffff"
  },
  input: {
    backgroundColor: "#f8fafb",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 10
  },
  warningText: {
    backgroundColor: "#fff4d7",
    borderColor: "#e4b85b",
    borderRadius: 6,
    borderWidth: 1,
    color: "#7a4b00",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 12,
    padding: 10
  },
  autoAssignButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 42
  },
  autoAssignButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  autoAssignMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    marginTop: 6
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 50
  },
  saveButtonDisabled: {
    backgroundColor: "#97a9b0"
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 44
  },
  cancelButtonText: {
    color: "#30434a",
    fontSize: 14,
    fontWeight: "900"
  },
  empty: {
    color: "#607078",
    fontSize: 13
  }
});
