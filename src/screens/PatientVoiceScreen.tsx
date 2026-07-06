import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type {
  FamilyPortalContact,
  FamilyShareCategory,
  FamilySharingPreferences,
  Patient,
  PatientNote,
  PatientVoiceCheckIn,
  PatientVoiceProfile,
  PatientVoiceRating,
  PatientVoiceReviewFrequency,
  StaffMember,
  Ward
} from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";
import {
  createFamilyPortalInvitation,
  revokeFamilyPortalAccess,
  type FamilyPortalInvitation
} from "../services/api";

type PatientVoiceScreenProps = {
  notes: PatientNote[];
  patients: Patient[];
  selectedPatientId: string;
  selectedStaffId: string;
  staff: StaffMember[];
  ward?: Ward;
  onBack: () => void;
  onOpenFamilyPortal: () => void;
  onSelectPatient: (patientId: string) => void;
  onUpdatePatient: (patient: Patient) => Promise<void>;
};

type VoiceTab = "profile" | "check-ins" | "sharing";

const shareCategories: FamilyShareCategory[] = [
  "Patient voice",
  "Progress summary",
  "Care-plan goals",
  "Approved notes"
];

const emptyProfile = {
  whatMatters: "",
  careGoals: "",
  communicationNeeds: "",
  sensoryNeeds: "",
  culturalSpiritualNeeds: "",
  dietaryNeeds: "",
  accessibilityNeeds: "",
  distressSupport: "",
  preferredInvolvement: ""
};

const defaultSharing: FamilySharingPreferences = {
  patientConsented: false,
  consentNotes: "",
  contacts: [],
  sharedNoteIds: []
};

export function PatientVoiceScreen({
  notes,
  patients,
  selectedPatientId,
  selectedStaffId,
  staff,
  ward,
  onBack,
  onOpenFamilyPortal,
  onSelectPatient,
  onUpdatePatient
}: PatientVoiceScreenProps) {
  const orderedPatients = useMemo(
    () => [...patients].sort((left, right) => left.roomNumber - right.roomNumber),
    [patients]
  );
  const selectedPatient =
    orderedPatients.find((patient) => patient.id === selectedPatientId) ?? orderedPatients[0];
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const canEdit = Boolean(
    selectedStaff &&
      (hasStaffRole(selectedStaff, "nurse") ||
        hasStaffRole(selectedStaff, "doctor") ||
        hasAdminAccess(selectedStaff))
  );
  const [tab, setTab] = useState<VoiceTab>("profile");
  const [profile, setProfile] = useState(emptyProfile);
  const [updatedWithPatient, setUpdatedWithPatient] = useState(true);
  const [frequency, setFrequency] = useState<PatientVoiceReviewFrequency>("Weekly");
  const [ratings, setRatings] = useState<Record<string, PatientVoiceRating>>({
    foodRating: 3,
    staffSupportRating: 3,
    accommodationRating: 3,
    activitiesRating: 3,
    safetyRating: 3,
    overallRating: 3
  });
  const [goingWell, setGoingWell] = useState("");
  const [wouldChange, setWouldChange] = useState("");
  const [needsChanged, setNeedsChanged] = useState("");
  const [concerns, setConcerns] = useState("");
  const [completedBy, setCompletedBy] = useState<PatientVoiceCheckIn["completedBy"]>("Patient");
  const [sharing, setSharing] = useState<FamilySharingPreferences>(defaultSharing);
  const [contactName, setContactName] = useState("");
  const [contactRelationship, setContactRelationship] = useState("");
  const [contactExpiry, setContactExpiry] = useState("");
  const [contactCategories, setContactCategories] = useState<FamilyShareCategory[]>(["Patient voice"]);
  const [contactCanContribute, setContactCanContribute] = useState(true);
  const [staffResponses, setStaffResponses] = useState<Record<string, string>>({});
  const [issuedInvitation, setIssuedInvitation] = useState<
    (FamilyPortalInvitation & { contactName: string }) | undefined
  >();
  const [issuingContactId, setIssuingContactId] = useState("");

  const patientNotes = useMemo(
    () =>
      notes
        .filter((note) => note.patientId === selectedPatient?.id)
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
    [notes, selectedPatient?.id]
  );

  useEffect(() => {
    const savedProfile = selectedPatient?.patientVoiceProfile;
    setProfile(
      savedProfile
        ? {
            whatMatters: savedProfile.whatMatters,
            careGoals: savedProfile.careGoals,
            communicationNeeds: savedProfile.communicationNeeds,
            sensoryNeeds: savedProfile.sensoryNeeds,
            culturalSpiritualNeeds: savedProfile.culturalSpiritualNeeds,
            dietaryNeeds: savedProfile.dietaryNeeds,
            accessibilityNeeds: savedProfile.accessibilityNeeds,
            distressSupport: savedProfile.distressSupport,
            preferredInvolvement: savedProfile.preferredInvolvement
          }
        : emptyProfile
    );
    setUpdatedWithPatient(savedProfile?.updatedWithPatient ?? true);
    setSharing(selectedPatient?.familySharing ?? defaultSharing);
  }, [selectedPatient?.id, selectedPatient?.patientVoiceProfile, selectedPatient?.familySharing]);

  const saveProfile = () => {
    if (!selectedPatient || !selectedStaff || !canEdit) {
      Alert.alert("Clinical access required", "A nurse, doctor or manager must save this patient profile.");
      return;
    }
    const voiceProfile: PatientVoiceProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
      updatedWithPatient,
      recordedByStaffId: selectedStaff.id,
      recordedByName: selectedStaff.name
    };
    onUpdatePatient({ ...selectedPatient, patientVoiceProfile: voiceProfile });
    Alert.alert("Patient voice saved", "The patient’s preferences and needs have been added to their record.");
  };

  const saveCheckIn = () => {
    if (!selectedPatient || !selectedStaff || !canEdit) {
      Alert.alert("Clinical access required", "A nurse, doctor or manager must witness this check-in.");
      return;
    }
    const checkIn: PatientVoiceCheckIn = {
      id: `patient-voice-${Date.now()}`,
      frequency,
      foodRating: ratings.foodRating ?? 3,
      staffSupportRating: ratings.staffSupportRating ?? 3,
      accommodationRating: ratings.accommodationRating ?? 3,
      activitiesRating: ratings.activitiesRating ?? 3,
      safetyRating: ratings.safetyRating ?? 3,
      overallRating: ratings.overallRating ?? 3,
      goingWell: goingWell.trim(),
      wouldChange: wouldChange.trim(),
      needsChanged: needsChanged.trim(),
      concerns: concerns.trim(),
      completedBy,
      submittedAt: new Date().toISOString(),
      witnessedByStaffId: selectedStaff.id,
      witnessedByName: selectedStaff.name
    };
    onUpdatePatient({
      ...selectedPatient,
      patientVoiceCheckIns: [checkIn, ...(selectedPatient.patientVoiceCheckIns ?? [])]
    });
    setGoingWell("");
    setWouldChange("");
    setNeedsChanged("");
    setConcerns("");
    if (checkIn.safetyRating <= 2 || checkIn.concerns) {
      Alert.alert(
        "Check-in saved — review requested",
        "A low safety rating or concern was recorded. Review it with the patient and use the Safety Centre if escalation is needed."
      );
    } else {
      Alert.alert("Check-in saved", "The patient’s feedback has been added to their timeline.");
    }
  };

  const acknowledgeCheckIn = (checkIn: PatientVoiceCheckIn) => {
    if (!selectedPatient || !selectedStaff || !canEdit) return;
    const updatedCheckIn: PatientVoiceCheckIn = {
      ...checkIn,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedByStaffId: selectedStaff.id,
      acknowledgedByName: selectedStaff.name,
      staffResponse:
        staffResponses[checkIn.id]?.trim() ||
        checkIn.staffResponse?.trim() ||
        "Reviewed with the patient."
    };
    onUpdatePatient({
      ...selectedPatient,
      patientVoiceCheckIns: (selectedPatient.patientVoiceCheckIns ?? []).map((item) =>
        item.id === checkIn.id ? updatedCheckIn : item
      )
    });
  };

  const addContact = () => {
    if (!contactName.trim() || !contactRelationship.trim()) {
      Alert.alert("Contact details needed", "Add the person’s name and relationship to the patient.");
      return;
    }
    const contact: FamilyPortalContact = {
      id: `family-contact-${Date.now()}`,
      name: contactName.trim(),
      relationship: contactRelationship.trim(),
      categories: contactCategories,
      active: true,
      canContribute: contactCanContribute,
      accessExpiresAt: contactExpiry.trim() || undefined
    };
    setSharing((current) => ({ ...current, contacts: [...current.contacts, contact] }));
    setContactName("");
    setContactRelationship("");
    setContactExpiry("");
  };

  const saveSharing = async () => {
    if (!selectedPatient || !selectedStaff || !canEdit) {
      Alert.alert("Clinical access required", "A nurse, doctor or manager must record sharing consent.");
      return;
    }
    const nextSharing: FamilySharingPreferences = {
      ...sharing,
      consentRecordedAt: new Date().toISOString(),
      consentRecordedByStaffId: selectedStaff.id,
      consentRecordedByName: selectedStaff.name
    };
    await onUpdatePatient({ ...selectedPatient, familySharing: nextSharing });
    Alert.alert(
      "Sharing preferences saved",
      nextSharing.patientConsented
        ? "Only the approved people and categories will appear in the family view."
        : "Family and advocate access remains closed."
    );
  };

  const updateContact = (contactId: string, updates: Partial<FamilyPortalContact>) => {
    setSharing((current) => ({
      ...current,
      contacts: current.contacts.map((contact) =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      )
    }));
  };

  const issueWebInvitation = async (contact: FamilyPortalContact) => {
    if (!selectedPatient || !canEdit || !sharing.patientConsented || !contact.active) return;
    setIssuingContactId(contact.id);
    try {
      const nextSharing: FamilySharingPreferences = {
        ...sharing,
        consentRecordedAt: new Date().toISOString(),
        consentRecordedByStaffId: selectedStaff?.id,
        consentRecordedByName: selectedStaff?.name
      };
      await onUpdatePatient({ ...selectedPatient, familySharing: nextSharing });
      const result = await createFamilyPortalInvitation(selectedPatient.id, contact.id);
      setIssuedInvitation({ ...result.invitation, contactName: contact.name });
      Alert.alert(
        "Web invitation created",
        "Give these details directly to the approved person. The activation code expires after 48 hours and is only shown here."
      );
    } catch (error) {
      Alert.alert(
        "Invitation could not be created",
        error instanceof Error ? error.message : "Check the connection and try again."
      );
    } finally {
      setIssuingContactId("");
    }
  };

  const withdrawWebAccess = async (contact: FamilyPortalContact) => {
    updateContact(contact.id, { active: false });
    try {
      await revokeFamilyPortalAccess(contact.id);
    } catch {
      // Saving the withdrawn contact still blocks the account on every portal request.
    }
  };

  const toggleSharedNote = (noteId: string) => {
    setSharing((current) => ({
      ...current,
      sharedNoteIds: current.sharedNoteIds.includes(noteId)
        ? current.sharedNoteIds.filter((id) => id !== noteId)
        : [...current.sharedNoteIds, noteId]
    }));
  };

  if (!selectedPatient) {
    return (
      <View style={styles.screen}>
        <Header onBack={onBack} wardName={ward?.name} />
        <View style={styles.panel}>
          <Text style={styles.emptyText}>No patients are available on this ward.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header onBack={onBack} wardName={ward?.name} />
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>The patient’s own voice</Text>
        <Text style={styles.noticeText}>
          Record the patient’s words and choices faithfully. Staff responses are kept separate, and
          family sharing only opens when valid patient consent and named permissions are recorded.
        </Text>
      </View>

      <View style={styles.workspace}>
        <View style={styles.patientRail}>
          <Text style={styles.panelTitle}>Patients</Text>
          {orderedPatients.map((patient) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: patient.id === selectedPatient.id }}
              key={patient.id}
              onPress={() => onSelectPatient(patient.id)}
              style={[styles.patientButton, patient.id === selectedPatient.id && styles.patientButtonActive]}
            >
              <Text style={styles.patientButtonName}>
                Room {patient.roomNumber} · {patient.firstName} {patient.surname}
              </Text>
              <Text style={styles.patientButtonMeta}>
                {(patient.patientVoiceCheckIns ?? []).length} check-ins ·{" "}
                {patient.familySharing?.patientConsented ? "sharing agreed" : "sharing closed"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.content}>
          <View style={styles.patientHeader}>
            <View>
              <Text style={styles.patientName}>
                {selectedPatient.firstName} {selectedPatient.surname}
              </Text>
              <Text style={styles.patientMeta}>
                Room {selectedPatient.roomNumber} · {selectedPatient.hospitalNumber}
              </Text>
            </View>
            <View style={styles.tabs}>
              <TabButton active={tab === "profile"} label="My priorities & needs" onPress={() => setTab("profile")} />
              <TabButton active={tab === "check-ins"} label="Regular check-ins" onPress={() => setTab("check-ins")} />
              <TabButton active={tab === "sharing"} label="Family sharing" onPress={() => setTab("sharing")} />
            </View>
          </View>

          {tab === "profile" ? (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>What matters to me</Text>
              <Text style={styles.sectionMeta}>
                Complete at the beginning of care and update whenever the patient’s wishes or needs change.
              </Text>
              <FormField
                label="What matters most to me"
                onChangeText={(value) => setProfile((current) => ({ ...current, whatMatters: value }))}
                placeholder="Relationships, routines, interests, identity and what makes a good day"
                value={profile.whatMatters}
              />
              <FormField
                label="My goals for treatment or care"
                onChangeText={(value) => setProfile((current) => ({ ...current, careGoals: value }))}
                placeholder="What the patient wants to achieve and how they want to be involved"
                value={profile.careGoals}
              />
              <View style={styles.fieldGrid}>
                <FormField
                  label="Communication needs"
                  onChangeText={(value) => setProfile((current) => ({ ...current, communicationNeeds: value }))}
                  placeholder="Language, communication style, easy-read or interpreter needs"
                  value={profile.communicationNeeds}
                />
                <FormField
                  label="Sensory needs"
                  onChangeText={(value) => setProfile((current) => ({ ...current, sensoryNeeds: value }))}
                  placeholder="Noise, light, touch or environmental preferences"
                  value={profile.sensoryNeeds}
                />
                <FormField
                  label="Cultural, spiritual or identity needs"
                  onChangeText={(value) => setProfile((current) => ({ ...current, culturalSpiritualNeeds: value }))}
                  placeholder="Faith, culture, identity or observance important to the patient"
                  value={profile.culturalSpiritualNeeds}
                />
                <FormField
                  label="Dietary needs and preferences"
                  onChangeText={(value) => setProfile((current) => ({ ...current, dietaryNeeds: value }))}
                  placeholder="Diet, allergies, preferences and support at mealtimes"
                  value={profile.dietaryNeeds}
                />
                <FormField
                  label="Accessibility or mobility needs"
                  onChangeText={(value) => setProfile((current) => ({ ...current, accessibilityNeeds: value }))}
                  placeholder="Mobility, reading, hearing, vision or other adjustments"
                  value={profile.accessibilityNeeds}
                />
                <FormField
                  label="What helps when I am distressed"
                  onChangeText={(value) => setProfile((current) => ({ ...current, distressSupport: value }))}
                  placeholder="Known triggers, calming approaches and things staff should avoid"
                  value={profile.distressSupport}
                />
              </View>
              <FormField
                label="How I want to be involved in decisions"
                onChangeText={(value) => setProfile((current) => ({ ...current, preferredInvolvement: value }))}
                placeholder="Preferred meetings, choices, advocates or decision-making support"
                value={profile.preferredInvolvement}
              />
              <ToggleButton
                active={updatedWithPatient}
                label="Completed or reviewed with the patient"
                onPress={() => setUpdatedWithPatient((current) => !current)}
              />
              <PrimaryButton disabled={!canEdit} label="Save patient voice profile" onPress={saveProfile} />
            </View>
          ) : null}

          {tab === "check-ins" ? (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>How is your care going?</Text>
              <Text style={styles.sectionMeta}>
                A simple patient-reported experience check. Scores support conversation; they are not a clinical assessment.
              </Text>
              <View style={styles.frequencyRow}>
                {(["Initial", "Weekly", "Monthly"] as PatientVoiceReviewFrequency[]).map((item) => (
                  <ToggleButton active={frequency === item} key={item} label={item} onPress={() => setFrequency(item)} />
                ))}
              </View>
              <View style={styles.ratingGrid}>
                <RatingField label="Food" onChange={(value) => setRatings((current) => ({ ...current, foodRating: value }))} value={ratings.foodRating ?? 3} />
                <RatingField label="Staff support" onChange={(value) => setRatings((current) => ({ ...current, staffSupportRating: value }))} value={ratings.staffSupportRating ?? 3} />
                <RatingField label="Accommodation" onChange={(value) => setRatings((current) => ({ ...current, accommodationRating: value }))} value={ratings.accommodationRating ?? 3} />
                <RatingField label="Activities" onChange={(value) => setRatings((current) => ({ ...current, activitiesRating: value }))} value={ratings.activitiesRating ?? 3} />
                <RatingField label="Feeling safe" onChange={(value) => setRatings((current) => ({ ...current, safetyRating: value }))} value={ratings.safetyRating ?? 3} />
                <RatingField label="Overall experience" onChange={(value) => setRatings((current) => ({ ...current, overallRating: value }))} value={ratings.overallRating ?? 3} />
              </View>
              <FormField label="What is going well?" onChangeText={setGoingWell} placeholder="The patient’s own words" value={goingWell} />
              <FormField label="What would you change?" onChangeText={setWouldChange} placeholder="What could make care or daily life better?" value={wouldChange} />
              <FormField label="Have your needs changed?" onChangeText={setNeedsChanged} placeholder="New needs, preferences or support requested" value={needsChanged} />
              <FormField label="Any concerns or anything making you feel unsafe?" onChangeText={setConcerns} placeholder="Review concerns promptly; use Safety Centre when escalation is needed" value={concerns} />
              <View style={styles.frequencyRow}>
                {(["Patient", "Patient with support"] as PatientVoiceCheckIn["completedBy"][]).map((item) => (
                  <ToggleButton active={completedBy === item} key={item} label={item} onPress={() => setCompletedBy(item)} />
                ))}
              </View>
              <PrimaryButton disabled={!canEdit} label="Save patient check-in" onPress={saveCheckIn} />

              <Text style={styles.historyTitle}>Previous check-ins</Text>
              {(selectedPatient.patientVoiceCheckIns ?? []).length === 0 ? (
                <Text style={styles.emptyText}>No patient check-ins recorded yet.</Text>
              ) : (
                (selectedPatient.patientVoiceCheckIns ?? []).map((checkIn) => (
                  <View key={checkIn.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View>
                        <Text style={styles.historyCardTitle}>{checkIn.frequency} check-in</Text>
                        <Text style={styles.historyMeta}>
                          {formatDateTime(checkIn.submittedAt)} · {checkIn.completedBy} · witnessed by{" "}
                          {checkIn.witnessedByName}
                        </Text>
                      </View>
                      <View style={styles.scorePill}>
                        <Text style={styles.scoreValue}>{checkIn.overallRating}/5</Text>
                        <Text style={styles.scoreLabel}>Overall</Text>
                      </View>
                    </View>
                    <Text style={styles.historyText}>Going well: {checkIn.goingWell || "Not recorded"}</Text>
                    <Text style={styles.historyText}>Would change: {checkIn.wouldChange || "Not recorded"}</Text>
                    {checkIn.concerns ? <Text style={styles.concernText}>Concern: {checkIn.concerns}</Text> : null}
                    {checkIn.acknowledgedAt ? (
                      <>
                        <Text style={styles.acknowledgedText}>
                          Reviewed {formatDateTime(checkIn.acknowledgedAt)} by {checkIn.acknowledgedByName}
                        </Text>
                        <Text style={styles.historyText}>Staff response: {checkIn.staffResponse}</Text>
                      </>
                    ) : (
                      <>
                        <TextInput
                          multiline
                          onChangeText={(value) =>
                            setStaffResponses((current) => ({ ...current, [checkIn.id]: value }))
                          }
                          placeholder="Staff response or agreed follow-up (kept separate from the patient’s words)"
                          placeholderTextColor="#75858b"
                          style={styles.responseInput}
                          value={staffResponses[checkIn.id] ?? ""}
                        />
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={!canEdit}
                          onPress={() => acknowledgeCheckIn(checkIn)}
                          style={[styles.secondaryButton, !canEdit && styles.disabled]}
                        >
                          <Text style={styles.secondaryButtonText}>Acknowledge and save response</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === "sharing" ? (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Family and advocate sharing</Text>
              <Text style={styles.sectionMeta}>
                Sharing is closed by default. Record consent, name each person and choose exactly what they may see.
              </Text>
              <ToggleButton
                active={sharing.patientConsented}
                label={sharing.patientConsented ? "Patient consent recorded" : "Family sharing closed"}
                onPress={() => setSharing((current) => ({ ...current, patientConsented: !current.patientConsented }))}
              />
              <FormField
                label="Consent, capacity or best-interest context"
                onChangeText={(value) => setSharing((current) => ({ ...current, consentNotes: value }))}
                placeholder="Record how consent was obtained, any supported decision-making and local governance context"
                value={sharing.consentNotes}
              />
              <SingleLineField
                label="Consent review date"
                onChangeText={(value) => setSharing((current) => ({ ...current, consentReviewDate: value }))}
                placeholder="YYYY-MM-DD"
                value={sharing.consentReviewDate ?? ""}
              />

              <View style={styles.contactBuilder}>
                <Text style={styles.subheading}>Add an approved person</Text>
                <View style={styles.inlineFields}>
                  <SingleLineField label="Name" onChangeText={setContactName} placeholder="Full name" value={contactName} />
                  <SingleLineField label="Relationship" onChangeText={setContactRelationship} placeholder="Family, carer or advocate" value={contactRelationship} />
                  <SingleLineField label="Access expiry" onChangeText={setContactExpiry} placeholder="Optional YYYY-MM-DD" value={contactExpiry} />
                </View>
                <Text style={styles.fieldLabel}>Information this person may see</Text>
                <View style={styles.frequencyRow}>
                  {shareCategories.map((category) => (
                    <ToggleButton
                      active={contactCategories.includes(category)}
                      key={category}
                      label={category}
                      onPress={() =>
                        setContactCategories((current) =>
                          current.includes(category)
                            ? current.filter((item) => item !== category)
                            : [...current, category]
                        )
                      }
                    />
                  ))}
                </View>
                <ToggleButton
                  active={contactCanContribute}
                  label="May send a family or advocate contribution"
                  onPress={() => setContactCanContribute((current) => !current)}
                />
                <TouchableOpacity accessibilityRole="button" onPress={addContact} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Add approved person</Text>
                </TouchableOpacity>
              </View>

              {sharing.contacts.map((contact) => (
                <View key={contact.id} style={styles.contactCard}>
                  <View style={styles.historyHeader}>
                    <View>
                      <Text style={styles.historyCardTitle}>{contact.name}</Text>
                      <Text style={styles.historyMeta}>
                        {contact.relationship} · {contact.categories.join(", ") || "No categories"}
                      </Text>
                    </View>
                    <ToggleButton
                      active={contact.active}
                      label={contact.active ? "Access active" : "Access withdrawn"}
                      onPress={() =>
                        contact.active
                          ? void withdrawWebAccess(contact)
                          : updateContact(contact.id, { active: true })
                      }
                    />
                  </View>
                  {contact.active ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={
                        !canEdit ||
                        !sharing.patientConsented ||
                        issuingContactId === contact.id
                      }
                      onPress={() => void issueWebInvitation(contact)}
                      style={[
                        styles.secondaryButton,
                        (!canEdit ||
                          !sharing.patientConsented ||
                          issuingContactId === contact.id) &&
                          styles.disabled
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {issuingContactId === contact.id
                          ? "Creating secure invitation…"
                          : "Create / reissue web invitation"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              {issuedInvitation ? (
                <View style={styles.invitationCard}>
                  <Text style={styles.invitationTitle}>
                    Invitation for {issuedInvitation.contactName}
                  </Text>
                  <Text style={styles.invitationWarning}>
                    One-time activation details — share privately and do not place them in clinical notes.
                  </Text>
                  <Text selectable style={styles.invitationValue}>
                    Family username: {issuedInvitation.username}
                  </Text>
                  <Text selectable style={styles.invitationValue}>
                    Activation code: {issuedInvitation.activationCode}
                  </Text>
                  <Text style={styles.historyMeta}>
                    Expires {formatDateTime(issuedInvitation.activationExpiresAt)}. The relative
                    creates their own six-digit PIN during activation.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.subheading}>Family and advocate contributions</Text>
              {(selectedPatient.familyContributions ?? []).length === 0 ? (
                <Text style={styles.emptyText}>No family or advocate contributions recorded.</Text>
              ) : (
                (selectedPatient.familyContributions ?? []).map((entry) => (
                  <View key={entry.id} style={styles.contactCard}>
                    <Text style={styles.noteChoiceBody}>{entry.body}</Text>
                    <Text style={styles.historyMeta}>
                      {formatDateTime(entry.submittedAt)} · {entry.contactName}
                      {entry.recordedByName
                        ? ` · witnessed by ${entry.recordedByName}`
                        : " · submitted through the family portal"}
                    </Text>
                    {entry.reviewStatus === "Awaiting staff review" ? (
                      <Text style={styles.awaitingReview}>Awaiting staff review</Text>
                    ) : null}
                  </View>
                ))
              )}

              <Text style={styles.subheading}>Notes approved for sharing</Text>
              {patientNotes.length === 0 ? (
                <Text style={styles.emptyText}>No patient notes are available to select.</Text>
              ) : (
                patientNotes.map((note) => (
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: sharing.sharedNoteIds.includes(note.id) }}
                    key={note.id}
                    onPress={() => toggleSharedNote(note.id)}
                    style={[
                      styles.noteChoice,
                      sharing.sharedNoteIds.includes(note.id) && styles.noteChoiceSelected
                    ]}
                  >
                    <Text style={styles.noteChoiceTitle}>
                      {sharing.sharedNoteIds.includes(note.id) ? "Approved to share" : "Private"}
                    </Text>
                    <Text numberOfLines={2} style={styles.noteChoiceBody}>{note.body}</Text>
                    <Text style={styles.historyMeta}>{formatDateTime(note.recordedAt)} · {note.recordedByName}</Text>
                  </TouchableOpacity>
                ))
              )}

              <View style={styles.actionRow}>
                <PrimaryButton disabled={!canEdit} label="Save consent and permissions" onPress={saveSharing} />
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!sharing.patientConsented || !sharing.contacts.some((contact) => contact.active)}
                  onPress={onOpenFamilyPortal}
                  style={[
                    styles.secondaryButton,
                    (!sharing.patientConsented || !sharing.contacts.some((contact) => contact.active)) && styles.disabled
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Preview family portal</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Header({ onBack, wardName }: { onBack: () => void; wardName?: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>Shared decision-making</Text>
        <Text style={styles.title}>Patient Voice & Shared Care</Text>
        <Text style={styles.meta}>{wardName ?? "Ward"} · Preferences, experience and consent-controlled sharing</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FormField({ label, onChangeText, placeholder, value }: { label: string; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput multiline numberOfLines={3} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#75858b" style={styles.textArea} value={value} />
    </View>
  );
}

function SingleLineField({ label, onChangeText, placeholder, value }: { label: string; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return (
    <View style={styles.singleLineField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#75858b" style={styles.textInput} value={value} />
    </View>
  );
}

function ToggleButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.toggleButton, active && styles.toggleButtonActive]}>
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RatingField({ label, onChange, value }: { label: string; onChange: (value: PatientVoiceRating) => void; value: PatientVoiceRating }) {
  return (
    <View style={styles.ratingField}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {([1, 2, 3, 4, 5] as PatientVoiceRating[]).map((rating) => (
          <TouchableOpacity accessibilityLabel={`${label} ${rating} out of 5`} accessibilityRole="button" accessibilityState={{ selected: rating === value }} key={rating} onPress={() => onChange(rating)} style={[styles.ratingButton, rating === value && styles.ratingButtonActive]}>
            <Text style={[styles.ratingButtonText, rating === value && styles.ratingButtonTextActive]}>{rating}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.ratingScale}>1 Poor · 5 Excellent</Text>
    </View>
  );
}

function PrimaryButton({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  screen: { alignSelf: "center", gap: 14, maxWidth: 1320, padding: 16, width: "100%" },
  header: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 18 },
  eyebrow: { color: "#17677a", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#16282f", fontSize: 28, fontWeight: "900", marginTop: 3 },
  meta: { color: "#64747b", fontSize: 11, fontWeight: "700", marginTop: 4 },
  backButton: { borderColor: "#1c596a", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 },
  backButtonText: { color: "#1c596a", fontSize: 11, fontWeight: "900" },
  notice: { backgroundColor: "#eef6f7", borderColor: "#bed9df", borderRadius: 9, borderWidth: 1, padding: 13 },
  noticeTitle: { color: "#245463", fontSize: 12, fontWeight: "900" },
  noticeText: { color: "#587078", fontSize: 10, lineHeight: 15, marginTop: 3 },
  workspace: { alignItems: "flex-start", flexDirection: "row", gap: 14 },
  patientRail: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, gap: 8, minWidth: 235, padding: 14, width: "24%" },
  panelTitle: { color: "#1c333c", fontSize: 18, fontWeight: "900" },
  patientButton: { borderColor: "#d5dfe2", borderRadius: 8, borderWidth: 1, padding: 11 },
  patientButtonActive: { backgroundColor: "#e8f2f4", borderColor: "#1d6678" },
  patientButtonName: { color: "#233940", fontSize: 11, fontWeight: "900" },
  patientButtonMeta: { color: "#6a7a80", fontSize: 8, fontWeight: "700", marginTop: 4 },
  content: { flex: 1, gap: 12, minWidth: 0 },
  patientHeader: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", padding: 15 },
  patientName: { color: "#17313a", fontSize: 23, fontWeight: "900" },
  patientMeta: { color: "#68787e", fontSize: 10, fontWeight: "800", marginTop: 3 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tabButton: { borderColor: "#cbd6d9", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 10 },
  tabButtonActive: { backgroundColor: "#174f61", borderColor: "#174f61" },
  tabButtonText: { color: "#40575f", fontSize: 9, fontWeight: "900" },
  tabButtonTextActive: { color: "#ffffff" },
  panel: { backgroundColor: "#ffffff", borderColor: "#d8e0e3", borderRadius: 10, borderWidth: 1, padding: 16 },
  sectionTitle: { color: "#1b3038", fontSize: 20, fontWeight: "900" },
  sectionMeta: { color: "#65767d", fontSize: 10, lineHeight: 15, marginBottom: 12, marginTop: 4 },
  formField: { flex: 1, marginTop: 10, minWidth: 260 },
  singleLineField: { flex: 1, minWidth: 180 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fieldLabel: { color: "#405861", fontSize: 9, fontWeight: "900", marginBottom: 5 },
  textArea: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#243940", fontSize: 11, minHeight: 78, padding: 9, textAlignVertical: "top" },
  textInput: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#243940", fontSize: 11, minHeight: 40, paddingHorizontal: 9 },
  frequencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  toggleButton: { borderColor: "#c7d3d6", borderRadius: 7, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: 10 },
  toggleButtonActive: { backgroundColor: "#e3f1ed", borderColor: "#438266" },
  toggleButtonText: { color: "#4d6169", fontSize: 9, fontWeight: "900" },
  toggleButtonTextActive: { color: "#285d48" },
  primaryButton: { alignItems: "center", backgroundColor: "#18596a", borderRadius: 7, justifyContent: "center", marginTop: 14, minHeight: 46, paddingHorizontal: 14 },
  primaryButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  secondaryButton: { alignItems: "center", borderColor: "#1c596a", borderRadius: 7, borderWidth: 1, justifyContent: "center", marginTop: 10, minHeight: 38, paddingHorizontal: 11 },
  secondaryButtonText: { color: "#1c596a", fontSize: 9, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  ratingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 12 },
  ratingField: { backgroundColor: "#f5f8f9", borderRadius: 8, flexBasis: "31%", flexGrow: 1, minWidth: 220, padding: 10 },
  ratingLabel: { color: "#29434d", fontSize: 10, fontWeight: "900" },
  ratingRow: { flexDirection: "row", gap: 5, marginTop: 7 },
  ratingButton: { alignItems: "center", borderColor: "#c9d4d8", borderRadius: 6, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 34 },
  ratingButtonActive: { backgroundColor: "#1b6475", borderColor: "#1b6475" },
  ratingButtonText: { color: "#435860", fontSize: 10, fontWeight: "900" },
  ratingButtonTextActive: { color: "#ffffff" },
  ratingScale: { color: "#75848a", fontSize: 8, marginTop: 5 },
  historyTitle: { color: "#1d333b", fontSize: 16, fontWeight: "900", marginTop: 22 },
  historyCard: { borderColor: "#d6e0e3", borderRadius: 8, borderWidth: 1, marginTop: 9, padding: 12 },
  historyHeader: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 9, justifyContent: "space-between" },
  historyCardTitle: { color: "#213942", fontSize: 12, fontWeight: "900" },
  historyMeta: { color: "#6d7d83", fontSize: 8, fontWeight: "700", marginTop: 3 },
  scorePill: { alignItems: "center", backgroundColor: "#e5f2ed", borderRadius: 7, padding: 7 },
  scoreValue: { color: "#285e49", fontSize: 16, fontWeight: "900" },
  scoreLabel: { color: "#567268", fontSize: 7, fontWeight: "900", textTransform: "uppercase" },
  historyText: { color: "#40555d", fontSize: 10, lineHeight: 15, marginTop: 7 },
  concernText: { backgroundColor: "#fff0ed", borderRadius: 6, color: "#8a382f", fontSize: 10, fontWeight: "800", marginTop: 8, padding: 8 },
  acknowledgedText: { color: "#347057", fontSize: 9, fontWeight: "900", marginTop: 9 },
  responseInput: { borderColor: "#bdcbd0", borderRadius: 7, borderWidth: 1, color: "#243940", fontSize: 10, marginTop: 9, minHeight: 64, padding: 8, textAlignVertical: "top" },
  emptyText: { color: "#6d7d83", fontSize: 10, marginTop: 10 },
  contactBuilder: { backgroundColor: "#f5f8f9", borderRadius: 8, marginTop: 14, padding: 12 },
  subheading: { color: "#263f48", fontSize: 13, fontWeight: "900", marginBottom: 9, marginTop: 14 },
  inlineFields: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  contactCard: { borderColor: "#d6e0e3", borderRadius: 8, borderWidth: 1, marginTop: 9, padding: 11 },
  invitationCard: { backgroundColor: "#fff8df", borderColor: "#dfbf57", borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 12 },
  invitationTitle: { color: "#574616", fontSize: 13, fontWeight: "900" },
  invitationWarning: { color: "#765f20", fontSize: 9, lineHeight: 14, marginBottom: 8, marginTop: 3 },
  invitationValue: { backgroundColor: "#ffffff", borderRadius: 5, color: "#243940", fontSize: 11, fontWeight: "900", marginTop: 5, padding: 8 },
  awaitingReview: { color: "#8a5c13", fontSize: 9, fontWeight: "900", marginTop: 6 },
  noteChoice: { borderColor: "#d4dee1", borderRadius: 7, borderWidth: 1, marginTop: 7, padding: 10 },
  noteChoiceSelected: { backgroundColor: "#eaf5ef", borderColor: "#5c9278" },
  noteChoiceTitle: { color: "#2d5e4a", fontSize: 9, fontWeight: "900" },
  noteChoiceBody: { color: "#465a62", fontSize: 9, lineHeight: 14, marginTop: 4 },
  actionRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 }
});
