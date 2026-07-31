import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";

import { SecureDateTimeField } from "../components/SecureDateTimeField";
import type {
  IncidentSeverity,
  Patient,
  PatientTask,
  PatientTaskCategory,
  PatientTaskRecurrence,
  PatientTaskStatus,
  StaffMember,
  Ward
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

const categories: PatientTaskCategory[] = [
  "Physical health",
  "Mental health",
  "Medication",
  "Nutrition and hydration",
  "Care plan",
  "Incident follow-up",
  "Appointment",
  "Family or advocate",
  "Other"
];

const priorities: Array<{ label: string; value: IncidentSeverity; description: string }> = [
  { label: "Red", value: "red", description: "Urgent / safety critical" },
  { label: "Amber", value: "amber", description: "Prompt action required" },
  { label: "Green", value: "green", description: "Routine planned action" }
];

type TaskDraft = {
  title: string;
  details: string;
  category: PatientTaskCategory;
  priority: IncidentSeverity;
  dueDate: string;
  dueTime: string;
  recurrence: PatientTaskRecurrence;
  assignedToStaffId: string;
  assignedRole: StaffMember["role"] | "";
};

type PatientTasksScreenProps = {
  patients: Patient[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  tasks: PatientTask[];
  ward?: Ward;
  onBack: () => void;
  onSaveTask: (task: PatientTask) => Promise<void>;
  onSelectPatient: (patientId: string) => void;
};

export function PatientTasksScreen({
  patients,
  selectedPatientId,
  selectedStaffId,
  staff,
  tasks,
  ward,
  onBack,
  onSaveTask,
  onSelectPatient
}: PatientTasksScreenProps) {
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient =
    orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const wardStaff = useMemo(() => {
    const members = staff
      .filter(
        (member) =>
          member.active !== false &&
          (member.wardId === ward?.id || member.allowedWardIds.includes(ward?.id ?? ""))
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    return Array.from(new Map(members.map((member) => [member.staffCode.toLowerCase(), member])).values());
  }, [staff, ward?.id]);
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft());
  const [statusFilter, setStatusFilter] = useState<PatientTaskStatus | "active" | "all">("active");
  const [scope, setScope] = useState<"patient" | "ward">("patient");
  const [isSaving, setIsSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState("");
  const [completingTaskId, setCompletingTaskId] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const wardTasks = useMemo(
    () => tasks.filter((task) => task.wardId === ward?.id).sort((left, right) => compareTasks(left, right, now)),
    [now, tasks, ward?.id]
  );
  const visibleTasks = wardTasks.filter((task) => {
    const scopeMatches = scope === "ward" || task.patientId === selectedPatient?.id;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active"
        ? task.status === "open" || task.status === "accepted"
        : task.status === statusFilter);
    return scopeMatches && statusMatches;
  });
  const activeTasks = wardTasks.filter((task) => task.status === "open" || task.status === "accepted");
  const overdueCount = activeTasks.filter((task) => new Date(task.dueAt).getTime() < now).length;
  const redCount = activeTasks.filter((task) => task.priority === "red").length;
  const acceptedCount = activeTasks.filter((task) => task.status === "accepted").length;
  const canCancel = Boolean(
    hasStaffRole(selectedStaff, "nurse") ||
      hasStaffRole(selectedStaff, "manager") ||
      hasStaffRole(selectedStaff, "doctor") ||
      hasAdminAccess(selectedStaff)
  );

  const closeCompletionModal = () => {
    Keyboard.dismiss();
    setCompletingTaskId("");
    setCompletionNotes("");
  };

  const saveNewTask = async () => {
    const dueAt = parseLocalDateTime(draft.dueDate, draft.dueTime);
    if (!selectedPatient || !selectedStaff || !ward || !draft.title.trim() || !dueAt) {
      Alert.alert(
        "Task details needed",
        "Select a patient, enter a task title and provide a valid due date and time."
      );
      return;
    }
    const assignee = wardStaff.find((member) => member.id === draft.assignedToStaffId);
    const task: PatientTask = {
      id: `patient-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: selectedPatient.id,
      wardId: ward.id,
      title: draft.title.trim(),
      details: draft.details.trim(),
      category: draft.category,
      priority: draft.priority,
      status: "open",
      dueAt,
      recurrence: draft.recurrence,
      assignedToStaffId: assignee?.id,
      assignedToName: assignee?.name,
      assignedRole: assignee ? undefined : draft.assignedRole || undefined,
      sourceType: "manual",
      createdByStaffId: selectedStaff.id,
      createdByName: selectedStaff.name,
      createdByStaffCode: selectedStaff.staffCode,
      createdAt: new Date().toISOString()
    };
    setIsSaving(true);
    try {
      await onSaveTask(task);
      setDraft(emptyDraft());
      Alert.alert("Patient task created", `${task.title} has been added for ${selectedPatient.firstName}.`);
    } catch (error) {
      Alert.alert("Task not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const acceptTask = async (task: PatientTask) => {
    if (!selectedStaff) return;
    setUpdatingTaskId(task.id);
    try {
      await onSaveTask({
        ...task,
        status: "accepted",
        assignedToStaffId: task.assignedToStaffId ?? selectedStaff.id,
        assignedToName: task.assignedToName ?? selectedStaff.name,
        acceptedByStaffId: selectedStaff.id,
        acceptedByName: selectedStaff.name,
        acceptedAt: new Date().toISOString()
      });
    } catch (error) {
      Alert.alert("Unable to accept task", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingTaskId("");
    }
  };

  const completeTask = async (task: PatientTask) => {
    if (!selectedStaff || !completionNotes.trim()) {
      Alert.alert("Completion evidence needed", "Record what was done and the outcome before completing the task.");
      return;
    }
    setUpdatingTaskId(task.id);
    try {
      const completedAt = new Date().toISOString();
      await onSaveTask({
        ...task,
        status: "completed",
        acceptedByStaffId: task.acceptedByStaffId ?? selectedStaff.id,
        acceptedByName: task.acceptedByName ?? selectedStaff.name,
        acceptedAt: task.acceptedAt ?? new Date().toISOString(),
        completionNotes: completionNotes.trim(),
        completedByStaffId: selectedStaff.id,
        completedByName: selectedStaff.name,
        completedAt
      });
      if (task.recurrence !== "none") {
        const nextDueAt = nextRecurrenceDueAt(task.dueAt, task.recurrence, ward);
        await onSaveTask({
          ...task,
          id: `patient-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: "open",
          dueAt: nextDueAt,
          createdByStaffId: selectedStaff.id,
          createdByName: selectedStaff.name,
          createdByStaffCode: selectedStaff.staffCode,
          createdAt: completedAt,
          acceptedByStaffId: undefined,
          acceptedByName: undefined,
          acceptedAt: undefined,
          completionNotes: undefined,
          completedByStaffId: undefined,
          completedByName: undefined,
          completedAt: undefined,
          cancelledByStaffId: undefined,
          cancelledByName: undefined,
          cancelledAt: undefined
        });
      }
      closeCompletionModal();
    } catch (error) {
      Alert.alert("Unable to complete task", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingTaskId("");
    }
  };

  const cancelTask = (task: PatientTask) => {
    if (!selectedStaff || !canCancel) return;
    Alert.alert("Cancel this patient task?", task.title, [
      { text: "Keep task", style: "cancel" },
      {
        text: "Cancel task",
        style: "destructive",
        onPress: () => {
          void onSaveTask({
            ...task,
            status: "cancelled",
            cancelledByStaffId: selectedStaff.id,
            cancelledByName: selectedStaff.name,
            cancelledAt: new Date().toISOString()
          }).catch((error) => {
            Alert.alert("Unable to cancel task", error instanceof Error ? error.message : "Please try again.");
          });
        }
      }
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Patient actions</Text>
          <Text style={styles.title}>Patient tasks</Text>
          <Text style={styles.meta}>{ward?.name ?? "Ward"} · Assign, accept and evidence clinical actions</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryGrid}>
        <Metric label="Active tasks" value={activeTasks.length} tone="neutral" />
        <Metric label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "red" : "neutral"} />
        <Metric label="Red priority" value={redCount} tone={redCount > 0 ? "red" : "neutral"} />
        <Metric label="Accepted" value={acceptedCount} tone={acceptedCount > 0 ? "amber" : "neutral"} />
      </View>

      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        <View style={[styles.patientPanel, compact && styles.patientPanelCompact]}>
          <Text style={styles.panelTitle}>Patients</Text>
          <Text style={styles.panelMeta}>Select a patient to create or review their tasks.</Text>
          {orderedPatients.map((patient) => {
            const patientActiveCount = activeTasks.filter((task) => task.patientId === patient.id).length;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={patient.id}
                onPress={() => {
                  onSelectPatient(patient.id);
                  setScope("patient");
                }}
                style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
              >
                <View style={styles.patientRowHeading}>
                  <Text style={[styles.patientName, patient.id === selectedPatient?.id && styles.patientNameActive]}>
                    Room {patient.roomNumber} · {patient.firstName} {patient.surname}
                  </Text>
                  {patientActiveCount > 0 ? <Text style={styles.taskCount}>{patientActiveCount}</Text> : null}
                </View>
                <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mainPanel}>
          <View style={styles.formPanel}>
            <View style={styles.formHeading}>
              <View>
                <Text style={styles.sectionTitle}>Create patient task</Text>
                <Text style={styles.selectedPatientName}>
                  {selectedPatient
                    ? `${selectedPatient.firstName} ${selectedPatient.surname} · Room ${selectedPatient.roomNumber}`
                    : "Select a patient"}
                </Text>
              </View>
              <PriorityBadge priority={draft.priority} />
            </View>

            <TaskField
              label="Task title *"
              maxLength={200}
              onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
              placeholder="For example: Repeat physical observations"
              value={draft.title}
            />
            <TaskField
              label="Instructions and expected outcome"
              multiline
              onChangeText={(details) => setDraft((current) => ({ ...current, details }))}
              placeholder="Describe what must be done and what should be recorded."
              value={draft.details}
            />

            <Text style={styles.fieldLabel}>Priority *</Text>
            <View style={styles.optionRow}>
              {priorities.map((priority) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.priority === priority.value }}
                  key={priority.value}
                  onPress={() => setDraft((current) => ({ ...current, priority: priority.value }))}
                  style={[
                    styles.priorityOption,
                    priorityBackground(priority.value),
                    draft.priority === priority.value && styles.optionSelected
                  ]}
                >
                  <Text style={styles.optionTitle}>{priority.label}</Text>
                  <Text style={styles.optionDescription}>{priority.description}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.chipRow}>
              {categories.map((category) => (
                <ChoiceChip
                  key={category}
                  active={draft.category === category}
                  label={category}
                  onPress={() => setDraft((current) => ({ ...current, category }))}
                />
              ))}
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <SecureDateTimeField
                  label="Due date *"
                  minimumDate={new Date()}
                  mode="date"
                  onChange={(dueDate) => setDraft((current) => ({ ...current, dueDate }))}
                  value={draft.dueDate}
                />
              </View>
              <View style={styles.timeField}>
                <SecureDateTimeField
                  label="Due time *"
                  mode="time"
                  onChange={(dueTime) => setDraft((current) => ({ ...current, dueTime }))}
                  value={draft.dueTime}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Assign to a staff member</Text>
            <View style={styles.chipRow}>
              <ChoiceChip
                active={!draft.assignedToStaffId}
                label="No named assignee"
                onPress={() => setDraft((current) => ({ ...current, assignedToStaffId: "" }))}
              />
              {wardStaff.map((member) => (
                <ChoiceChip
                  key={member.id}
                  active={draft.assignedToStaffId === member.id}
                  label={member.name}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      assignedRole: "",
                      assignedToStaffId: member.id
                    }))
                  }
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Or assign to a role</Text>
            <View style={styles.chipRow}>
              {(["nurse", "hcf", "ot", "doctor", "security"] as const).map((role) => (
                <ChoiceChip
                  key={role}
                  active={draft.assignedRole === role && !draft.assignedToStaffId}
                  label={role === "hcf" ? "HCF" : role.toUpperCase()}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      assignedRole: role,
                      assignedToStaffId: ""
                    }))
                  }
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Repeat</Text>
            <View style={styles.chipRow}>
              {(["none", "every_shift", "daily"] as const).map((recurrence) => (
                <ChoiceChip
                  key={recurrence}
                  active={draft.recurrence === recurrence}
                  label={
                    recurrence === "none"
                      ? "One-off"
                      : recurrence === "every_shift"
                        ? "Every shift"
                        : "Daily"
                  }
                  onPress={() => setDraft((current) => ({ ...current, recurrence }))}
                />
              ))}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              disabled={isSaving || !draft.title.trim()}
              onPress={() => void saveNewTask()}
              style={[styles.primaryButton, (isSaving || !draft.title.trim()) && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? "Saving…" : "Create patient task"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listPanel}>
            <View style={styles.listHeading}>
              <View>
                <Text style={styles.sectionTitle}>Task list</Text>
                <Text style={styles.panelMeta}>Overdue first, then red, amber and green priority.</Text>
              </View>
            </View>
            <View style={styles.filters}>
              <View>
                <Text style={styles.filterLabel}>View</Text>
                <View style={styles.chipRow}>
                  <ChoiceChip active={scope === "patient"} label="Selected patient" onPress={() => setScope("patient")} />
                  <ChoiceChip active={scope === "ward"} label="Whole ward" onPress={() => setScope("ward")} />
                </View>
              </View>
              <View>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.chipRow}>
                  {(["active", "open", "accepted", "completed", "cancelled", "all"] as const).map((status) => (
                    <ChoiceChip
                      key={status}
                      active={statusFilter === status}
                      label={capitalise(status)}
                      onPress={() => setStatusFilter(status)}
                    />
                  ))}
                </View>
              </View>
            </View>

            {visibleTasks.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyTitle}>No tasks in this view</Text>
                <Text style={styles.panelMeta}>Create a task above or change the filters.</Text>
              </View>
            ) : (
              visibleTasks.map((task) => {
                const patient = patients.find((item) => item.id === task.patientId);
                const overdue = isTaskOverdue(task, now);
                const updating = updatingTaskId === task.id;
                return (
                  <View key={task.id} style={[styles.taskCard, taskBorder(task.priority, overdue)]}>
                    <View style={styles.taskHeader}>
                      <View style={styles.taskHeading}>
                        <View style={styles.taskTitleRow}>
                          <View style={[styles.ragDot, priorityDot(task.priority)]} />
                          <Text style={styles.taskTitle}>{task.title}</Text>
                        </View>
                        <Text style={styles.taskMeta}>
                          {patient
                            ? `Room ${patient.roomNumber} · ${patient.firstName} ${patient.surname}`
                            : "Patient unavailable"}{" "}
                          · {task.category} · due {formatDateTime(task.dueAt)}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, overdue && styles.overdueBadge]}>
                        <Text style={[styles.statusBadgeText, overdue && styles.overdueBadgeText]}>
                          {overdue ? "Overdue" : capitalise(task.status)}
                        </Text>
                      </View>
                    </View>
                    {task.details ? <Text style={styles.taskDetails}>{task.details}</Text> : null}
                    <View style={styles.taskAssignment}>
                      <Text style={styles.assignmentText}>
                        Assigned to {task.assignedToName ?? formatRole(task.assignedRole) ?? "ward team"}
                        {task.recurrence !== "none" ? ` · ${formatRecurrence(task.recurrence)}` : ""}
                      </Text>
                      <Text style={styles.assignmentText}>Created by {task.createdByName}</Text>
                    </View>
                    {task.completionNotes ? (
                      <View style={styles.completionBlock}>
                        <Text style={styles.completionLabel}>Completion evidence</Text>
                        <Text style={styles.completionText}>{task.completionNotes}</Text>
                        <Text style={styles.assignmentText}>
                          Completed by {task.completedByName} · {formatDateTime(task.completedAt ?? "")}
                        </Text>
                      </View>
                    ) : null}
                    {task.status === "open" || task.status === "accepted" ? (
                      <View style={styles.actionRow}>
                        {task.status === "open" ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={updating}
                            onPress={() => void acceptTask(task)}
                            style={[styles.outlineButton, updating && styles.disabledButton]}
                          >
                            <Text style={styles.outlineButtonText}>Accept task</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={updating}
                          onPress={() => {
                            setCompletingTaskId(task.id);
                            setCompletionNotes("");
                          }}
                          style={[styles.completeButton, updating && styles.disabledButton]}
                        >
                          <Text style={styles.completeButtonText}>Complete with evidence</Text>
                        </TouchableOpacity>
                        {canCancel ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            disabled={updating}
                            onPress={() => cancelTask(task)}
                            style={styles.cancelButton}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>

      <Modal
        accessibilityViewIsModal
        animationType="fade"
        onRequestClose={closeCompletionModal}
        transparent
        visible={Boolean(completingTaskId)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.completionModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.sectionTitle}>Complete patient task</Text>
                <Text style={styles.panelMeta}>
                  {wardTasks.find((task) => task.id === completingTaskId)?.title ?? "Record completion evidence"}
                </Text>
              </View>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.keyboardButton}>
                  <Text style={styles.keyboardButtonText}>Hide keyboard</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={closeCompletionModal} style={styles.outlineButton}>
                  <Text style={styles.outlineButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TaskField
              label="What was completed and what was the outcome? *"
              multiline
              onChangeText={setCompletionNotes}
              placeholder="Record the action taken, findings, outcome and any follow-up required."
              value={completionNotes}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" onPress={closeCompletionModal} style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!completionNotes.trim() || Boolean(updatingTaskId)}
                onPress={() => {
                  const task = wardTasks.find((item) => item.id === completingTaskId);
                  if (task) void completeTask(task);
                }}
                style={[
                  styles.primaryButton,
                  (!completionNotes.trim() || Boolean(updatingTaskId)) && styles.disabledButton
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {updatingTaskId ? "Saving…" : "Confirm completion"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function TaskField({
  label,
  maxLength = 10_000,
  multiline = false,
  onChangeText,
  placeholder,
  value
}: {
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#77868c"
        style={[styles.input, multiline && styles.multilineInput]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function ChoiceChip({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.choiceChip, active && styles.choiceChipActive]}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Metric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "neutral" | "amber" | "red";
  value: number;
}) {
  return (
    <View style={[styles.metric, tone === "red" && styles.metricRed, tone === "amber" && styles.metricAmber]}>
      <Text style={[styles.metricValue, tone === "red" && styles.metricValueRed]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: IncidentSeverity }) {
  return (
    <View style={[styles.priorityBadge, priorityDot(priority)]}>
      <Text style={styles.priorityBadgeText}>{priority.toUpperCase()}</Text>
    </View>
  );
}

function emptyDraft(): TaskDraft {
  const due = new Date(Date.now() + 60 * 60 * 1000);
  return {
    title: "",
    details: "",
    category: "Physical health",
    priority: "amber",
    dueDate: formatDateInput(due),
    dueTime: formatTimeInput(due),
    recurrence: "none",
    assignedToStaffId: "",
    assignedRole: ""
  };
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) return undefined;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function compareTasks(left: PatientTask, right: PatientTask, now: number) {
  const leftOverdue = isTaskOverdue(left, now);
  const rightOverdue = isTaskOverdue(right, now);
  const statusOrder = { open: 0, accepted: 1, completed: 2, cancelled: 3 };
  const priorityOrder = { red: 0, amber: 1, green: 2 };
  return (
    Number(rightOverdue) - Number(leftOverdue) ||
    statusOrder[left.status] - statusOrder[right.status] ||
    priorityOrder[left.priority] - priorityOrder[right.priority] ||
    left.dueAt.localeCompare(right.dueAt)
  );
}

function isTaskOverdue(task: PatientTask, now: number) {
  return (
    (task.status === "open" || task.status === "accepted") &&
    new Date(task.dueAt).getTime() < now
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function capitalise(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replace("_", " ")}`;
}

function formatRole(role?: StaffMember["role"]) {
  if (!role) return undefined;
  return role === "hcf" ? "HCF role" : `${role.replace("_", " ")} role`;
}

function formatRecurrence(recurrence: PatientTaskRecurrence) {
  return recurrence === "every_shift" ? "every shift" : recurrence;
}

function nextRecurrenceDueAt(
  currentDueAt: string,
  recurrence: PatientTaskRecurrence,
  ward?: Ward
) {
  const parsedDueAt = new Date(currentDueAt).getTime();
  const current = new Date(Math.max(Number.isNaN(parsedDueAt) ? 0 : parsedDueAt, Date.now()));
  const fallback = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  if (recurrence === "daily" || !ward || recurrence === "none") return fallback.toISOString();

  const candidates: number[] = [];
  for (let dayOffset = 0; dayOffset <= 3; dayOffset += 1) {
    for (const shift of ward.rotaShifts.slice(0, ward.rotaShiftCount)) {
      const [hours = "0", minutes = "0"] = shift.startsAt.split(":");
      const candidate = new Date(current);
      candidate.setDate(current.getDate() + dayOffset);
      candidate.setHours(Number(hours), Number(minutes), 0, 0);
      if (candidate.getTime() > current.getTime()) candidates.push(candidate.getTime());
    }
  }
  const nextStart = candidates.sort((left, right) => left - right)[0];
  return new Date(nextStart ?? fallback.getTime()).toISOString();
}

function priorityBackground(priority: IncidentSeverity) {
  if (priority === "red") return styles.priorityRedBackground;
  if (priority === "amber") return styles.priorityAmberBackground;
  return styles.priorityGreenBackground;
}

function priorityDot(priority: IncidentSeverity) {
  if (priority === "red") return styles.priorityRed;
  if (priority === "amber") return styles.priorityAmber;
  return styles.priorityGreen;
}

function taskBorder(priority: IncidentSeverity, overdue: boolean) {
  if (overdue || priority === "red") return styles.taskRed;
  if (priority === "amber") return styles.taskAmber;
  return styles.taskGreen;
}

const styles = StyleSheet.create({
  screen: { alignSelf: "center", gap: 14, maxWidth: 1320, padding: 16, width: "100%" },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
  },
  eyebrow: { color: "#17677a", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#16282f", fontSize: 28, fontWeight: "900", marginTop: 3 },
  meta: { color: "#64747b", fontSize: 11, fontWeight: "700", marginTop: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 9,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 160,
    padding: 12
  },
  metricRed: { backgroundColor: "#fff0ed", borderColor: "#e6aaa0" },
  metricAmber: { backgroundColor: "#fff8df", borderColor: "#e4cb81" },
  metricValue: { color: "#173e4b", fontSize: 23, fontWeight: "900" },
  metricValueRed: { color: "#a4372d" },
  metricLabel: { color: "#64757b", fontSize: 9, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  workspace: { alignItems: "flex-start", flexDirection: "row", flexWrap: "nowrap", gap: 14 },
  workspaceCompact: { flexDirection: "column" },
  patientPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 10,
    borderWidth: 1,
    flexBasis: 230,
    flexGrow: 0,
    flexShrink: 0,
    gap: 8,
    minWidth: 210,
    padding: 14
  },
  patientPanelCompact: { flexBasis: "auto", width: "100%" },
  panelTitle: { color: "#1c3038", fontSize: 18, fontWeight: "900" },
  panelMeta: { color: "#68787f", fontSize: 10, fontWeight: "700", marginTop: 3 },
  patientRow: { borderColor: "#dce3e5", borderRadius: 7, borderWidth: 1, padding: 10 },
  patientRowActive: { backgroundColor: "#e8f2f4", borderColor: "#236879" },
  patientRowHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  patientName: { color: "#21353d", flex: 1, fontSize: 11, fontWeight: "900" },
  patientNameActive: { color: "#173f4d", fontSize: 13 },
  patientMeta: { color: "#6c7a80", fontSize: 9, fontWeight: "800", marginTop: 4 },
  taskCount: {
    backgroundColor: "#1c6173",
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 5,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  mainPanel: { flexBasis: 0, flexGrow: 1, flexShrink: 1, gap: 14, minWidth: 0 },
  formPanel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, gap: 11, padding: 16 },
  formHeading: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: "#172b33", fontSize: 20, fontWeight: "900" },
  selectedPatientName: { color: "#31515d", fontSize: 14, fontWeight: "900", marginTop: 5 },
  field: { gap: 5 },
  fieldLabel: { color: "#344c55", fontSize: 10, fontWeight: "900" },
  input: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#20343c", fontSize: 12, minHeight: 43, paddingHorizontal: 10, paddingVertical: 8 },
  multilineInput: { minHeight: 88 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priorityOption: { borderRadius: 8, borderWidth: 1, flexGrow: 1, minWidth: 160, padding: 10 },
  priorityRedBackground: { backgroundColor: "#fff0ed", borderColor: "#e2aaa2" },
  priorityAmberBackground: { backgroundColor: "#fff8df", borderColor: "#e4cb81" },
  priorityGreenBackground: { backgroundColor: "#edf7f1", borderColor: "#bad9c8" },
  optionSelected: { borderColor: "#173f4d", borderWidth: 2 },
  optionTitle: { color: "#263c44", fontSize: 11, fontWeight: "900" },
  optionDescription: { color: "#67777d", fontSize: 8, fontWeight: "700", marginTop: 3 },
  priorityBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  priorityBadgeText: { color: "#ffffff", fontSize: 9, fontWeight: "900" },
  priorityRed: { backgroundColor: "#c63d32" },
  priorityAmber: { backgroundColor: "#df9f22" },
  priorityGreen: { backgroundColor: "#37855d" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  choiceChip: { borderColor: "#cbd6d9", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 35, paddingHorizontal: 9 },
  choiceChipActive: { backgroundColor: "#1b6173", borderColor: "#1b6173" },
  choiceChipText: { color: "#3f535b", fontSize: 9, fontWeight: "900" },
  choiceChipTextActive: { color: "#ffffff" },
  dateRow: { flexDirection: "row", gap: 9 },
  dateField: { flex: 2 },
  timeField: { flex: 1 },
  primaryButton: { alignItems: "center", backgroundColor: "#18596a", borderRadius: 7, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  primaryButtonText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  outlineButton: { borderColor: "#1c596a", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 39, paddingHorizontal: 11 },
  outlineButtonText: { color: "#1c596a", fontSize: 10, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  listPanel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, gap: 10, padding: 16 },
  listHeading: { flexDirection: "row", justifyContent: "space-between" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  filterLabel: { color: "#68787f", fontSize: 8, fontWeight: "900", marginBottom: 5, textTransform: "uppercase" },
  emptyPanel: { backgroundColor: "#f5f8f9", borderRadius: 8, padding: 14 },
  emptyTitle: { color: "#405861", fontSize: 13, fontWeight: "900" },
  taskCard: { borderColor: "#d8e0e3", borderLeftWidth: 6, borderRadius: 8, borderWidth: 1, gap: 8, padding: 12 },
  taskRed: { backgroundColor: "#fff6f4", borderLeftColor: "#c63d32" },
  taskAmber: { backgroundColor: "#fffaf0", borderLeftColor: "#df9f22" },
  taskGreen: { backgroundColor: "#f4faf6", borderLeftColor: "#37855d" },
  taskHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  taskHeading: { flex: 1, paddingRight: 8 },
  taskTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  ragDot: { borderRadius: 999, height: 13, width: 13 },
  taskTitle: { color: "#20353d", flex: 1, fontSize: 14, fontWeight: "900" },
  taskMeta: { color: "#66767d", fontSize: 9, fontWeight: "800", marginTop: 4 },
  statusBadge: { backgroundColor: "#e8eef0", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusBadgeText: { color: "#40565f", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  overdueBadge: { backgroundColor: "#f5b8ae" },
  overdueBadgeText: { color: "#812d25" },
  taskDetails: { color: "#344b54", fontSize: 10, lineHeight: 15 },
  taskAssignment: { gap: 3 },
  assignmentText: { color: "#64757b", fontSize: 9, fontWeight: "800" },
  completionBlock: { backgroundColor: "#ffffff", borderRadius: 7, gap: 3, padding: 9 },
  completionLabel: { color: "#547078", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  completionText: { color: "#2f454d", fontSize: 10, lineHeight: 15 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  completeButton: { backgroundColor: "#1c5c6d", borderRadius: 7, justifyContent: "center", minHeight: 39, paddingHorizontal: 11 },
  completeButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  cancelButton: { justifyContent: "center", minHeight: 39, paddingHorizontal: 8 },
  cancelButtonText: { color: "#a03930", fontSize: 9, fontWeight: "900" },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(11,31,38,.58)", flex: 1, justifyContent: "center", padding: 18 },
  completionModal: { backgroundColor: "#ffffff", borderRadius: 11, elevation: 8, gap: 12, maxWidth: 620, padding: 20, shadowColor: "#000000", shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.2, shadowRadius: 12, width: "100%" },
  modalHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  modalHeaderActions: { flexDirection: "row", gap: 7 },
  keyboardButton: { backgroundColor: "#eef4f5", borderRadius: 7, justifyContent: "center", minHeight: 36, paddingHorizontal: 10 },
  keyboardButtonText: { color: "#315663", fontSize: 9, fontWeight: "900" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 }
});
