import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  FamilyPortalContact,
  FamilyPortalContribution,
  Patient,
  PatientCarePlan,
  PatientNote,
  StaffMember,
  Ward
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

type FamilyPortalScreenProps = {
  carePlans: PatientCarePlan[];
  notes: PatientNote[];
  patient?: Patient;
  selectedStaff?: StaffMember;
  ward?: Ward;
  onBack: () => void;
  onUpdatePatient: (patient: Patient) => void;
};

export function FamilyPortalScreen({
  carePlans,
  notes,
  patient,
  selectedStaff,
  ward,
  onBack,
  onUpdatePatient
}: FamilyPortalScreenProps) {
  const activeContacts = useMemo(
    () =>
      (patient?.familySharing?.contacts ?? []).filter(
        (contact) => contact.active && !isExpired(contact.accessExpiresAt)
      ),
    [patient?.familySharing?.contacts]
  );
  const [selectedContactId, setSelectedContactId] = useState(activeContacts[0]?.id ?? "");
  const [contribution, setContribution] = useState("");
  const canRecordContribution = Boolean(
    selectedStaff &&
      (hasStaffRole(selectedStaff, "nurse") ||
        hasStaffRole(selectedStaff, "doctor") ||
        hasAdminAccess(selectedStaff))
  );
  const selectedContact =
    activeContacts.find((contact) => contact.id === selectedContactId) ?? activeContacts[0];
  const patientPlans = carePlans
    .filter((plan) => plan.patientId === patient?.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const approvedNotes = notes
    .filter(
      (note) =>
        note.patientId === patient?.id &&
        (patient?.familySharing?.sharedNoteIds ?? []).includes(note.id)
    )
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));

  const saveContribution = () => {
    if (
      !patient ||
      !selectedContact ||
      !selectedStaff ||
      !canRecordContribution ||
      !contribution.trim()
    ) {
      return;
    }
    const entry: FamilyPortalContribution = {
      id: `family-contribution-${Date.now()}`,
      contactId: selectedContact.id,
      contactName: selectedContact.name,
      body: contribution.trim(),
      submittedAt: new Date().toISOString(),
      recordedByStaffId: selectedStaff.id,
      recordedByName: selectedStaff.name,
      source: "Ward tablet",
      reviewStatus: "Reviewed",
      reviewedAt: new Date().toISOString(),
      reviewedByStaffId: selectedStaff.id,
      reviewedByName: selectedStaff.name
    };
    onUpdatePatient({
      ...patient,
      familyContributions: [entry, ...(patient.familyContributions ?? [])]
    });
    setContribution("");
    Alert.alert(
      "Contribution saved",
      "This has been labelled as family or advocate input. Clinical staff should review it before acting on it."
    );
  };

  if (!patient?.familySharing?.patientConsented || activeContacts.length === 0) {
    return (
      <View style={styles.screen}>
        <PortalHeader onBack={onBack} wardName={ward?.name} />
        <View style={styles.closedPanel}>
          <Text style={styles.closedTitle}>Shared view is closed</Text>
          <Text style={styles.closedText}>
            Patient consent and at least one active named contact are required. Return to Patient Voice
            to record or review the sharing permissions.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PortalHeader onBack={onBack} wardName={ward?.name} />
      <View style={styles.privacyNotice}>
        <Text style={styles.privacyTitle}>A patient-approved shared view</Text>
        <Text style={styles.privacyText}>
          This is not the clinical record. It only shows the categories approved for the named person
          selected below. Access can be withdrawn or changed at any time.
        </Text>
      </View>

      <View style={styles.contactSelector}>
        <Text style={styles.selectorLabel}>Viewing as</Text>
        <View style={styles.contactRow}>
          {activeContacts.map((contact) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: contact.id === selectedContact?.id }}
              key={contact.id}
              onPress={() => setSelectedContactId(contact.id)}
              style={[styles.contactButton, contact.id === selectedContact?.id && styles.contactButtonActive]}
            >
              <Text style={[styles.contactButtonName, contact.id === selectedContact?.id && styles.contactButtonNameActive]}>
                {contact.name}
              </Text>
              <Text style={styles.contactButtonMeta}>{contact.relationship}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selectedContact ? (
        <>
          <View style={styles.welcome}>
            <View>
              <Text style={styles.eyebrow}>Family & advocate portal</Text>
              <Text style={styles.patientName}>
                {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientMeta}>
                Shared with {selectedContact.name} · {selectedContact.relationship}
              </Text>
            </View>
            <View style={styles.permissionList}>
              {selectedContact.categories.map((category) => (
                <View key={category} style={styles.permissionPill}>
                  <Text style={styles.permissionText}>{category}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.cardGrid}>
            {canSee(selectedContact, "Progress summary") ? (
              <PortalCard title="Current progress summary">
                <PortalRow label="Current ward status" value={patient.onOffWard} />
                <PortalRow label="Latest recorded location" value={patient.latestObservationPlace} />
                <PortalRow label="Latest recorded presentation" value={patient.latestPresentation} />
                <PortalRow label="Observation support" value={patient.observationLevel} />
                <Text style={styles.caveat}>
                  These are the latest recorded checks and do not represent continuous monitoring.
                </Text>
              </PortalCard>
            ) : null}

            {canSee(selectedContact, "Patient voice") ? (
              <PortalCard title="What matters to the patient">
                <PortalRow label="What matters" value={patient.patientVoiceProfile?.whatMatters || "Not yet recorded"} />
                <PortalRow label="Care goals" value={patient.patientVoiceProfile?.careGoals || "Not yet recorded"} />
                <PortalRow label="Decision-making preferences" value={patient.patientVoiceProfile?.preferredInvolvement || "Not yet recorded"} />
                {patient.patientVoiceCheckIns?.[0] ? (
                  <View style={styles.checkInSummary}>
                    <Text style={styles.checkInScore}>
                      Latest experience rating {patient.patientVoiceCheckIns[0].overallRating}/5
                    </Text>
                    <Text style={styles.checkInText}>
                      Going well: {patient.patientVoiceCheckIns[0].goingWell || "Not recorded"}
                    </Text>
                    <Text style={styles.checkInText}>
                      Would change: {patient.patientVoiceCheckIns[0].wouldChange || "Not recorded"}
                    </Text>
                  </View>
                ) : null}
              </PortalCard>
            ) : null}

            {canSee(selectedContact, "Care-plan goals") ? (
              <PortalCard title="Agreed care-plan goals">
                {patientPlans[0] ? (
                  <>
                    <Text style={styles.planTitle}>{patientPlans[0].title}</Text>
                    <PortalRow label="Goals" value={patientPlans[0].goals} />
                    <PortalRow label="Patient views" value={patientPlans[0].patientViews || "Not recorded"} />
                    <Text style={styles.caveat}>Review date: {patientPlans[0].reviewDate}</Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No shareable care-plan goals are available.</Text>
                )}
              </PortalCard>
            ) : null}

            {canSee(selectedContact, "Approved notes") ? (
              <PortalCard title="Notes approved for sharing">
                {approvedNotes.length === 0 ? (
                  <Text style={styles.emptyText}>No notes have been approved for this shared view.</Text>
                ) : (
                  approvedNotes.map((note) => (
                    <View key={note.id} style={styles.noteCard}>
                      <Text style={styles.noteBody}>{note.body}</Text>
                      <Text style={styles.noteMeta}>
                        {formatDateTime(note.recordedAt)} · {note.recordedByName}
                      </Text>
                    </View>
                  ))
                )}
              </PortalCard>
            ) : null}
          </View>

          {selectedContact.canContribute ? (
            <View style={styles.contributionPanel}>
              <Text style={styles.sectionTitle}>Have your say</Text>
              <Text style={styles.sectionMeta}>
                Add an observation, question or information that may help the care team. This is labelled
                as family or advocate input and does not replace urgent or emergency contact routes.
              </Text>
              <TextInput
                multiline
                numberOfLines={5}
                onChangeText={setContribution}
                placeholder="What would you like the care team to know?"
                placeholderTextColor="#74848a"
                style={styles.contributionInput}
                value={contribution}
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!contribution.trim() || !canRecordContribution}
                onPress={saveContribution}
                style={[
                  styles.primaryButton,
                  (!contribution.trim() || !canRecordContribution) && styles.disabled
                ]}
              >
                <Text style={styles.primaryButtonText}>Submit family or advocate contribution</Text>
              </TouchableOpacity>
              {!canRecordContribution ? (
                <Text style={styles.caveat}>
                  A nurse, doctor or manager must witness and save a contribution on this ward tablet.
                </Text>
              ) : null}
              {(patient.familyContributions ?? [])
                .filter((entry) => entry.contactId === selectedContact.id)
                .map((entry) => (
                  <View key={entry.id} style={styles.contributionHistory}>
                    <Text style={styles.noteBody}>{entry.body}</Text>
                    <Text style={styles.noteMeta}>
                      {formatDateTime(entry.submittedAt)} · {entry.contactName}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function PortalHeader({ onBack, wardName }: { onBack: () => void; wardName?: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>SecureObs shared care</Text>
        <Text style={styles.headerMeta}>{wardName ?? "Ward"} · Family and advocate view</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to permissions</Text>
      </TouchableOpacity>
    </View>
  );
}

function PortalCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.portalCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function PortalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.portalRow}>
      <Text style={styles.portalLabel}>{label}</Text>
      <Text style={styles.portalValue}>{value}</Text>
    </View>
  );
}

function canSee(contact: FamilyPortalContact, category: FamilyPortalContact["categories"][number]) {
  return contact.categories.includes(category);
}

function isExpired(value?: string) {
  if (!value) return false;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return false;
  expiry.setHours(23, 59, 59, 999);
  return expiry.getTime() < Date.now();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  screen: { alignSelf: "center", gap: 14, maxWidth: 1180, padding: 16, width: "100%" },
  header: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 18 },
  headerTitle: { color: "#17313a", fontSize: 24, fontWeight: "900" },
  headerMeta: { color: "#68787e", fontSize: 10, fontWeight: "800", marginTop: 4 },
  backButton: { borderColor: "#1c596a", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 },
  backButtonText: { color: "#1c596a", fontSize: 10, fontWeight: "900" },
  privacyNotice: { backgroundColor: "#eef6f7", borderColor: "#bed9df", borderRadius: 9, borderWidth: 1, padding: 13 },
  privacyTitle: { color: "#245463", fontSize: 12, fontWeight: "900" },
  privacyText: { color: "#587078", fontSize: 10, lineHeight: 15, marginTop: 3 },
  contactSelector: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 9, borderWidth: 1, padding: 12 },
  selectorLabel: { color: "#5d7077", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 7 },
  contactButton: { borderColor: "#cad6d9", borderRadius: 7, borderWidth: 1, minWidth: 150, padding: 9 },
  contactButtonActive: { backgroundColor: "#e8f3ef", borderColor: "#4b846b" },
  contactButtonName: { color: "#304850", fontSize: 10, fontWeight: "900" },
  contactButtonNameActive: { color: "#275d48" },
  contactButtonMeta: { color: "#6d7d83", fontSize: 8, marginTop: 2 },
  welcome: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", padding: 17 },
  eyebrow: { color: "#17677a", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  patientName: { color: "#172d35", fontSize: 27, fontWeight: "900", marginTop: 3 },
  patientMeta: { color: "#64757c", fontSize: 10, fontWeight: "800", marginTop: 4 },
  permissionList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  permissionPill: { backgroundColor: "#e7f1f3", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  permissionText: { color: "#295866", fontSize: 8, fontWeight: "900" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  portalCard: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexBasis: "47%", flexGrow: 1, minWidth: 330, padding: 15 },
  sectionTitle: { color: "#1d333b", fontSize: 17, fontWeight: "900" },
  sectionMeta: { color: "#617279", fontSize: 10, lineHeight: 15, marginTop: 4 },
  cardBody: { marginTop: 10 },
  portalRow: { borderTopColor: "#e2e8ea", borderTopWidth: 1, paddingVertical: 8 },
  portalLabel: { color: "#687980", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  portalValue: { color: "#344a52", fontSize: 10, lineHeight: 15, marginTop: 3 },
  caveat: { color: "#6d7d83", fontSize: 8, fontStyle: "italic", lineHeight: 13, marginTop: 9 },
  checkInSummary: { backgroundColor: "#f1f7f4", borderRadius: 7, marginTop: 10, padding: 10 },
  checkInScore: { color: "#285e49", fontSize: 11, fontWeight: "900" },
  checkInText: { color: "#50636a", fontSize: 9, marginTop: 5 },
  planTitle: { color: "#285565", fontSize: 11, fontWeight: "900", marginBottom: 5 },
  noteCard: { borderColor: "#dce4e6", borderRadius: 7, borderWidth: 1, marginTop: 7, padding: 10 },
  noteBody: { color: "#3e535b", fontSize: 10, lineHeight: 15 },
  noteMeta: { color: "#6d7d83", fontSize: 8, fontWeight: "700", marginTop: 5 },
  emptyText: { color: "#6d7d83", fontSize: 10, paddingVertical: 10 },
  contributionPanel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, padding: 16 },
  contributionInput: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#243940", fontSize: 11, marginTop: 10, minHeight: 100, padding: 10, textAlignVertical: "top" },
  primaryButton: { alignItems: "center", backgroundColor: "#18596a", borderRadius: 7, justifyContent: "center", marginTop: 10, minHeight: 44, paddingHorizontal: 13 },
  primaryButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  contributionHistory: { backgroundColor: "#f5f8f9", borderRadius: 7, marginTop: 9, padding: 10 },
  closedPanel: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, padding: 32 },
  closedTitle: { color: "#263a42", fontSize: 18, fontWeight: "900" },
  closedText: { color: "#687980", fontSize: 10, lineHeight: 16, marginTop: 7, maxWidth: 520, textAlign: "center" }
});
