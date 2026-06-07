import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { StaffMember, StaffShiftAssignment, Ward } from "../types/domain";

type StaffCoverScreenProps = {
  assignments: StaffShiftAssignment[];
  selectedStaffId: string;
  selectedWardId: string;
  staff: StaffMember[];
  wards: Ward[];
  onAssignStaff: (assignment: StaffShiftAssignment) => void;
  onBack: () => void;
  onRemoveAssignment: (assignmentId: string) => void;
};

export function StaffCoverScreen({
  assignments,
  selectedStaffId,
  selectedWardId,
  staff,
  wards,
  onAssignStaff,
  onBack,
  onRemoveAssignment
}: StaffCoverScreenProps) {
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const ward = wards.find((item) => item.id === selectedWardId);
  const wardStaff = staff.filter((member) => member.allowedWardIds.includes(selectedWardId));
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const weekDays = useMemo(() => buildWeekDays(new Date()), []);
  const shifts = ward?.rotaShifts.slice(0, ward.rotaShiftCount) ?? [];
  const activeShiftId = selectedShiftId || shifts[0]?.id || "";
  const activeShift = shifts.find((shift) => shift.id === activeShiftId) ?? shifts[0];
  const selectedStaffAssignments = assignments.filter(
    (assignment) =>
      assignment.date === selectedDate &&
      assignment.staffId === selectedStaffId &&
      assignment.wardId === selectedWardId
  );

  const addStaffToShift = (staffId: string) => {
    if (!ward || !activeShift) {
      return;
    }

    const duplicate = assignments.find(
      (assignment) =>
        assignment.date === selectedDate &&
        assignment.wardId === ward.id &&
        assignment.shiftId === activeShift.id &&
        assignment.staffId === staffId
    );

    if (duplicate) {
      return;
    }

    onAssignStaff({
      id: `cover-${Date.now()}`,
      date: selectedDate,
      wardId: ward.id,
      shiftId: activeShift.id,
      staffId
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Staff cover</Text>
          <Text style={styles.meta}>{ward?.name ?? "Ward"} | Shift allocation</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to staff rota</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calendarPanel}>
        <View>
          <Text style={styles.panelTitle}>Calendar</Text>
          <Text style={styles.dateText}>{formatLongDate(selectedDate)}</Text>
        </View>
        <View style={styles.dayRow}>
          {weekDays.map((day) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={day.date}
              onPress={() => {
                setSelectedDate(day.date);
                setSelectedShiftId("");
              }}
              style={[styles.dayButton, day.date === selectedDate && styles.dayButtonActive]}
            >
              <Text style={[styles.dayName, day.date === selectedDate && styles.dayTextActive]}>{day.dayName}</Text>
              <Text style={[styles.dayNumber, day.date === selectedDate && styles.dayTextActive]}>{day.dayNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.split}>
        <View style={styles.coverPanel}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.panelScroller}
          >
            <Text style={styles.panelTitle}>Ward shifts</Text>
            <Text style={styles.coverMeta}>
              {selectedStaff?.name ?? "Selected staff"} is{" "}
              {selectedStaffAssignments.length > 0 ? "working this ward today" : "not assigned to this ward today"}
            </Text>

            {shifts.map((shift, index) => {
              const shiftAssignments = assignments.filter(
                (assignment) =>
                  assignment.date === selectedDate &&
                  assignment.wardId === selectedWardId &&
                  assignment.shiftId === shift.id
              );

              return (
                <View
                  key={shift.id}
                  style={[styles.shiftCard, shift.id === activeShift?.id && styles.shiftCardActive]}
                >
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setSelectedShiftId(shift.id)}
                    style={styles.shiftHeader}
                  >
                    <View>
                      <Text style={styles.shiftTitle}>Shift {index + 1}</Text>
                      <Text style={styles.shiftTime}>{shift.startsAt} - {shift.endsAt}</Text>
                    </View>
                    <View style={[styles.coverBadge, shiftAssignments.length === 0 && styles.coverBadgeGap]}>
                      <Text style={styles.coverBadgeText}>{shiftAssignments.length}</Text>
                    </View>
                  </TouchableOpacity>

                  {shiftAssignments.length === 0 ? (
                    <Text style={styles.gapText}>No staff assigned</Text>
                  ) : (
                    <View style={styles.assignedList}>
                      {shiftAssignments.map((assignment) => {
                        const assignedStaff = staff.find((member) => member.id === assignment.staffId);

                        return (
                          <View key={assignment.id} style={styles.assignedRow}>
                            <View>
                              <Text style={styles.staffName}>{assignedStaff?.name ?? "Unknown staff"}</Text>
                              <Text style={styles.staffMeta}>{assignedStaff?.role ?? "staff"}</Text>
                            </View>
                            <TouchableOpacity
                              accessibilityRole="button"
                              onPress={() => onRemoveAssignment(assignment.id)}
                              style={styles.removeButton}
                            >
                              <Text style={styles.removeButtonText}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.assignPanel}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.panelScroller}
          >
            <Text style={styles.panelTitle}>Assign staff</Text>
            <Text style={styles.coverMeta}>
              {activeShift ? `${activeShift.startsAt} - ${activeShift.endsAt}` : "Select a shift"}
            </Text>

            <View style={styles.staffGrid}>
              {wardStaff.map((member) => {
                const alreadyAssigned = assignments.some(
                  (assignment) =>
                    assignment.date === selectedDate &&
                    assignment.wardId === selectedWardId &&
                    assignment.shiftId === activeShift?.id &&
                    assignment.staffId === member.id
                );

                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={alreadyAssigned || !activeShift}
                    key={member.id}
                    onPress={() => addStaffToShift(member.id)}
                    style={[
                      styles.staffButton,
                      alreadyAssigned && styles.staffButtonAssigned,
                      !activeShift && styles.staffButtonDisabled
                    ]}
                  >
                    <Text style={[styles.staffButtonText, alreadyAssigned && styles.staffButtonTextAssigned]}>
                      {member.name}
                    </Text>
                    <Text style={[styles.staffButtonMeta, alreadyAssigned && styles.staffButtonTextAssigned]}>
                      {alreadyAssigned ? "Assigned" : `${member.role} | ${member.keyNumber}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function buildWeekDays(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - 3);

  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(start);
    item.setDate(start.getDate() + index);

    return {
      date: formatDateKey(item),
      dayName: item.toLocaleDateString([], { weekday: "short" }),
      dayNumber: item.toLocaleDateString([], { day: "2-digit" })
    };
  });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLongDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
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
  calendarPanel: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  panelTitle: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "900"
  },
  dateText: {
    color: "#607078",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3
  },
  dayRow: {
    flexDirection: "row",
    gap: 8
  },
  dayButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 48,
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  dayButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  dayName: {
    color: "#607078",
    fontSize: 11,
    fontWeight: "900"
  },
  dayNumber: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2
  },
  dayTextActive: {
    color: "#ffffff"
  },
  split: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  coverPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 0.58,
    height: 460,
    minWidth: 500,
    overflow: "hidden",
    padding: 12
  },
  assignPanel: {
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
  coverMeta: {
    color: "#607078",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: 3
  },
  shiftCard: {
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  shiftCardActive: {
    backgroundColor: "#edf7f4",
    borderColor: "#1f5262"
  },
  shiftHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  shiftTitle: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  shiftTime: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  coverBadge: {
    alignItems: "center",
    backgroundColor: "#ddebd6",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 42
  },
  coverBadgeGap: {
    backgroundColor: "#fff4d7"
  },
  coverBadgeText: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  gapText: {
    color: "#8a5a00",
    fontSize: 13,
    fontWeight: "900"
  },
  assignedList: {
    gap: 8
  },
  assignedRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 9
  },
  staffName: {
    color: "#18262c",
    fontSize: 14,
    fontWeight: "900"
  },
  staffMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "capitalize"
  },
  removeButton: {
    borderColor: "#b3261e",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  removeButtonText: {
    color: "#b3261e",
    fontSize: 12,
    fontWeight: "900"
  },
  staffGrid: {
    gap: 8
  },
  staffButton: {
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 54,
    padding: 10
  },
  staffButtonAssigned: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  staffButtonDisabled: {
    opacity: 0.45
  },
  staffButtonText: {
    color: "#18262c",
    fontSize: 14,
    fontWeight: "900"
  },
  staffButtonMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "capitalize"
  },
  staffButtonTextAssigned: {
    color: "#ffffff"
  }
});
