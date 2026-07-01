import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { Patient, PatientNote, StaffMember, Ward } from "../types/domain";

type NoteSortOrder = "newest" | "oldest";

type PatientNotesScreenProps = {
  notes: PatientNote[];
  patients: Patient[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  ward?: Ward;
  onBack: () => void;
  onCreateNote: (note: PatientNote) => Promise<void>;
  onSelectPatient: (patientId: string) => void;
};

export function PatientNotesScreen({
  notes,
  patients,
  selectedPatientId,
  selectedStaffId,
  staff,
  ward,
  onBack,
  onCreateNote,
  onSelectPatient
}: PatientNotesScreenProps) {
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient = orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const [noteBody, setNoteBody] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<NoteSortOrder>("newest");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);

  const patientNotes = useMemo(
    () =>
      notes
        .filter((note) => note.patientId === selectedPatient?.id)
        .sort((left, right) =>
          sortOrder === "newest"
            ? right.recordedAt.localeCompare(left.recordedAt)
            : left.recordedAt.localeCompare(right.recordedAt)
        ),
    [notes, selectedPatient?.id, sortOrder]
  );
  const noteAuthors = useMemo(
    () =>
      Array.from(
        new Map(
          patientNotes.map((note) => [
            note.recordedByStaffId,
            { id: note.recordedByStaffId, name: note.recordedByName }
          ])
        ).values()
      ).sort((left, right) => left.name.localeCompare(right.name)),
    [patientNotes]
  );
  const visibleNotes =
    staffFilter === "all"
      ? patientNotes
      : patientNotes.filter((note) => note.recordedByStaffId === staffFilter);
  const selectedNotes = patientNotes.filter((note) => selectedNoteIds.includes(note.id));
  const allVisibleSelected =
    visibleNotes.length > 0 && visibleNotes.every((note) => selectedNoteIds.includes(note.id));

  useEffect(() => {
    setNoteBody("");
    setStaffFilter("all");
    setSelectedNoteIds([]);
  }, [selectedPatient?.id]);

  const selectPatient = (patientId: string) => {
    onSelectPatient(patientId);
  };

  const saveNote = async () => {
    const body = noteBody.trim();
    if (!selectedPatient || !selectedStaff || !ward || !body) {
      Alert.alert("Note details needed", "Select a patient and enter the note before saving.");
      return;
    }

    const note: PatientNote = {
      id: `patient-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patientId: selectedPatient.id,
      wardId: ward.id,
      body,
      recordedByStaffId: selectedStaff.id,
      recordedByName: selectedStaff.name,
      recordedByStaffCode: selectedStaff.staffCode,
      recordedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onCreateNote(note);
      setNoteBody("");
      Alert.alert("Patient note saved", `The note has been added to ${selectedPatient.firstName}'s record.`);
    } catch (error) {
      Alert.alert("Patient note not saved", error instanceof Error ? error.message : "Please sign in and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNote = (noteId: string) => {
    setSelectedNoteIds((currentIds) =>
      currentIds.includes(noteId) ? currentIds.filter((id) => id !== noteId) : [...currentIds, noteId]
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = visibleNotes.map((note) => note.id);
    setSelectedNoteIds((currentIds) =>
      allVisibleSelected
        ? currentIds.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...currentIds, ...visibleIds]))
    );
  };

  const buildSelectedNotesHtml = () => {
    if (!selectedPatient || !selectedStaff || selectedNotes.length === 0) return "";
    return buildPatientNotesHtml({
      exportedBy: selectedStaff.name,
      notes: selectedNotes,
      patient: selectedPatient,
      wardName: ward?.name ?? "Ward"
    });
  };

  const printSelectedNotes = async () => {
    const html = buildSelectedNotesHtml();
    if (!html) {
      Alert.alert("Select notes", "Select at least one patient note to print.");
      return;
    }

    setIsCreatingPdf(true);
    try {
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert("Unable to print", error instanceof Error ? error.message : "The print dialog could not be opened.");
    } finally {
      setIsCreatingPdf(false);
    }
  };

  const shareSelectedNotes = async () => {
    const html = buildSelectedNotesHtml();
    if (!html) {
      Alert.alert("Select notes", "Select at least one patient note to save or share.");
      return;
    }

    setIsCreatingPdf(true);
    try {
      const pdf = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Use Print selected and choose Save as PDF on this device.");
        return;
      }
      await Sharing.shareAsync(pdf.uri, {
        dialogTitle: "Share selected patient notes",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf"
      });
    } catch (error) {
      Alert.alert("Unable to create PDF", error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setIsCreatingPdf(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient notes</Text>
          <Text style={styles.meta}>
            {ward?.name ?? "Ward"} | {selectedStaff?.name ?? "No staff selected"}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.split}>
        <View style={styles.patientPanel}>
          <Text style={styles.panelTitle}>Patients</Text>
          <Text style={styles.panelMeta}>Choose whose notes you want to view or add.</Text>
          {orderedPatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={patient.id}
              onPress={() => selectPatient(patient.id)}
              style={[styles.patientRow, patient.id === selectedPatient?.id && styles.patientRowActive]}
            >
              <Text style={styles.patientName}>
                Room {patient.roomNumber} | {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>{patient.hospitalNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.notesPanel}>
          {selectedPatient ? (
            <>
              <View style={styles.patientHeader}>
                <View>
                  <Text style={styles.patientTitle}>
                    {selectedPatient.firstName} {selectedPatient.surname}
                  </Text>
                  <Text style={styles.meta}>
                    Room {selectedPatient.roomNumber} | {selectedPatient.hospitalNumber}
                  </Text>
                </View>
                <Text style={styles.noteCount}>{patientNotes.length} notes</Text>
              </View>

              <View style={styles.entryPanel}>
                <Text style={styles.sectionTitle}>Add patient note</Text>
                <Text style={styles.panelMeta}>
                  Notes are signed with your staff identity and cannot be edited after saving.
                </Text>
                <TextInput
                  accessibilityLabel="Patient note"
                  maxLength={20_000}
                  multiline
                  onChangeText={setNoteBody}
                  placeholder="Enter the patient note, relevant context, actions and follow-up…"
                  placeholderTextColor="#6f7f87"
                  style={styles.noteInput}
                  textAlignVertical="top"
                  value={noteBody}
                />
                <View style={styles.entryFooter}>
                  <Text style={styles.characterCount}>{noteBody.length.toLocaleString()} / 20,000</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={isSaving || !noteBody.trim()}
                    onPress={() => void saveNote()}
                    style={[styles.saveButton, (isSaving || !noteBody.trim()) && styles.disabledButton]}
                  >
                    <Text style={styles.saveButtonText}>{isSaving ? "Saving…" : "Save patient note"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Note history</Text>
                  <Text style={styles.panelMeta}>Select records to create a printable or shareable PDF.</Text>
                </View>
                <View style={styles.pdfActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={selectedNotes.length === 0 || isCreatingPdf}
                    onPress={() => void printSelectedNotes()}
                    style={[styles.secondaryButton, (selectedNotes.length === 0 || isCreatingPdf) && styles.disabledButton]}
                  >
                    <Text style={styles.secondaryButtonText}>Print selected</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={selectedNotes.length === 0 || isCreatingPdf}
                    onPress={() => void shareSelectedNotes()}
                    style={[styles.pdfButton, (selectedNotes.length === 0 || isCreatingPdf) && styles.disabledButton]}
                  >
                    <Text style={styles.pdfButtonText}>Share / save PDF ({selectedNotes.length})</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filters}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Staff member</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterOptions}>
                      <FilterButton
                        active={staffFilter === "all"}
                        label="All staff"
                        onPress={() => {
                          setStaffFilter("all");
                          setSelectedNoteIds([]);
                        }}
                      />
                      {noteAuthors.map((author) => (
                        <FilterButton
                          active={staffFilter === author.id}
                          key={author.id}
                          label={author.name}
                          onPress={() => {
                            setStaffFilter(author.id);
                            setSelectedNoteIds([]);
                          }}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Date order</Text>
                  <View style={styles.filterOptions}>
                    <FilterButton
                      active={sortOrder === "newest"}
                      label="Newest first"
                      onPress={() => setSortOrder("newest")}
                    />
                    <FilterButton
                      active={sortOrder === "oldest"}
                      label="Oldest first"
                      onPress={() => setSortOrder("oldest")}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.selectBar}>
                <TouchableOpacity accessibilityRole="button" onPress={toggleAllVisible} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>{allVisibleSelected ? "Clear shown" : "Select all shown"}</Text>
                </TouchableOpacity>
                {selectedNoteIds.length > 0 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setSelectedNoteIds([])}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>Clear selection</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView nestedScrollEnabled style={styles.noteHistory}>
                {visibleNotes.length === 0 ? (
                  <View style={styles.emptyPanel}>
                    <Text style={styles.emptyTitle}>No patient notes found</Text>
                    <Text style={styles.panelMeta}>
                      {staffFilter === "all"
                        ? "The first saved note will appear here."
                        : "No notes for this patient match the selected staff member."}
                    </Text>
                  </View>
                ) : (
                  visibleNotes.map((note) => {
                    const selected = selectedNoteIds.includes(note.id);
                    return (
                      <TouchableOpacity
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        key={note.id}
                        onPress={() => toggleNote(note.id)}
                        style={[styles.noteCard, selected && styles.noteCardSelected]}
                      >
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          <Text style={styles.checkboxText}>{selected ? "✓" : ""}</Text>
                        </View>
                        <View style={styles.noteContent}>
                          <View style={styles.noteMetaRow}>
                            <Text style={styles.noteAuthor}>{note.recordedByName}</Text>
                            <Text style={styles.noteDate}>{formatDateTime(note.recordedAt)}</Text>
                          </View>
                          <Text selectable style={styles.noteBody}>{note.body}</Text>
                          <Text style={styles.noteStaffCode}>Staff code: {note.recordedByStaffCode}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No patient selected</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive]}
    >
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function buildPatientNotesHtml({
  exportedBy,
  notes,
  patient,
  wardName
}: {
  exportedBy: string;
  notes: PatientNote[];
  patient: Patient;
  wardName: string;
}) {
  const noteRows = notes
    .map(
      (note, index) => `
        <article class="note">
          <div class="note-heading">
            <strong>${index + 1}. ${escapeHtml(formatDateTime(note.recordedAt))}</strong>
            <span>${escapeHtml(note.recordedByName)} (${escapeHtml(note.recordedByStaffCode)})</span>
          </div>
          <div class="note-body">${escapeHtml(note.body)}</div>
        </article>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 18mm; }
          body { color: #17252b; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.45; }
          h1 { font-size: 20pt; margin: 0 0 4px; }
          .confidential { color: #8a2d2d; font-size: 9pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
          .meta { background: #eef4f4; border: 1px solid #b9c7cb; margin: 16px 0 20px; padding: 10px 12px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
          .note { border: 1px solid #aebdc2; border-radius: 4px; margin: 0 0 12px; padding: 12px; }
          .note-heading { border-bottom: 1px solid #d8e0e3; break-after: avoid; display: flex; justify-content: space-between; margin-bottom: 9px; padding-bottom: 7px; }
          .note-body { overflow-wrap: anywhere; white-space: pre-wrap; }
          .footer { color: #56666d; font-size: 9pt; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="confidential">Confidential clinical record</div>
        <h1>Selected patient notes</h1>
        <div class="meta">
          <div class="meta-grid">
            <div><strong>Patient:</strong> ${escapeHtml(`${patient.firstName} ${patient.surname}`)}</div>
            <div><strong>Hospital number:</strong> ${escapeHtml(patient.hospitalNumber)}</div>
            <div><strong>Ward:</strong> ${escapeHtml(wardName)}</div>
            <div><strong>Room:</strong> ${patient.roomNumber}</div>
            <div><strong>Notes included:</strong> ${notes.length}</div>
            <div><strong>Exported:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
          </div>
        </div>
        ${noteRows}
        <div class="footer">Exported by ${escapeHtml(exportedBy)} from SecureObs.</div>
      </body>
    </html>
  `;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  title: { color: "#18262c", fontSize: 24, fontWeight: "900" },
  meta: { color: "#617078", fontSize: 13, fontWeight: "700", marginTop: 3 },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14
  },
  backButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  split: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  patientPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 270,
    padding: 14,
    width: "30%"
  },
  notesPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden"
  },
  panelTitle: { color: "#18262c", fontSize: 18, fontWeight: "900" },
  panelMeta: { color: "#617078", fontSize: 12, fontWeight: "700", marginTop: 3 },
  patientRow: {
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 10,
    padding: 11
  },
  patientRowActive: { backgroundColor: "#e8f2f5", borderColor: "#1f5262" },
  patientName: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  patientMeta: { color: "#617078", fontSize: 12, fontWeight: "700", marginTop: 3 },
  patientHeader: {
    alignItems: "center",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  patientTitle: { color: "#18262c", fontSize: 22, fontWeight: "900" },
  noteCount: {
    backgroundColor: "#e9f3ef",
    borderRadius: 6,
    color: "#276149",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  entryPanel: {
    backgroundColor: "#f8fafb",
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: 14
  },
  sectionTitle: { color: "#18262c", fontSize: 17, fontWeight: "900" },
  noteInput: {
    backgroundColor: "#ffffff",
    borderColor: "#b9c7cb",
    borderRadius: 7,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    minHeight: 150,
    padding: 12
  },
  entryFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },
  characterCount: { color: "#617078", fontSize: 11, fontWeight: "700" },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16
  },
  saveButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  disabledButton: { opacity: 0.42 },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  pdfActions: { flexDirection: "row", gap: 8 },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12
  },
  secondaryButtonText: { color: "#1f5262", fontSize: 12, fontWeight: "900" },
  pdfButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12
  },
  pdfButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  filters: {
    backgroundColor: "#f2f6f7",
    borderBottomColor: "#d8e0e3",
    borderTopColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    padding: 10
  },
  filterGroup: { flex: 1, gap: 6 },
  filterLabel: { color: "#31454d", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  filterOptions: { flexDirection: "row", gap: 6 },
  filterButton: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 9
  },
  filterButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  filterButtonText: { color: "#31454d", fontSize: 11, fontWeight: "900" },
  filterButtonTextActive: { color: "#ffffff" },
  selectBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  selectAllButton: {
    borderColor: "#8aa0a8",
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  selectAllText: { color: "#31454d", fontSize: 11, fontWeight: "900" },
  clearButton: { padding: 7 },
  clearButtonText: { color: "#8a2d2d", fontSize: 11, fontWeight: "900" },
  noteHistory: { maxHeight: 650, paddingHorizontal: 12 },
  noteCard: {
    alignItems: "flex-start",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 12
  },
  noteCardSelected: { backgroundColor: "#edf6f3", borderColor: "#1f5262" },
  checkbox: {
    alignItems: "center",
    borderColor: "#82949b",
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  checkboxSelected: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  checkboxText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  noteContent: { flex: 1 },
  noteMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  noteAuthor: { color: "#18262c", fontSize: 14, fontWeight: "900" },
  noteDate: { color: "#52646c", fontSize: 11, fontWeight: "800" },
  noteBody: { color: "#25373f", fontSize: 14, lineHeight: 21, marginTop: 9 },
  noteStaffCode: { color: "#708087", fontSize: 10, fontWeight: "700", marginTop: 10 },
  emptyPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16
  },
  emptyTitle: { color: "#18262c", fontSize: 15, fontWeight: "900" }
});
