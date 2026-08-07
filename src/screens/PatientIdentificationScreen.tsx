import React, { useRef, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "qrcode";
import QRCodeSvg from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";

import type { OrganisationSettings, Patient, PatientIdentificationProfile, StaffMember, Ward } from "../types/domain";
import { formatDateOfBirth } from "../utils/patientDemographics";
import {
  buildPatientTagPayload,
  createPatientTagToken,
  defaultIdentificationProfile,
  type PatientTagType
} from "../utils/patientIdentification";
import { writeNfcTextPayload } from "../utils/nfcWriter";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

type PatientIdentificationScreenProps = {
  patientId: string;
  organisationSettings: OrganisationSettings;
  patients: Patient[];
  selectedStaffId: string;
  staff: StaffMember[];
  wards: Ward[];
  onBack: () => void;
  onSavePatient: (patient: Patient) => Promise<void>;
};

const consentOptions: Array<{ value: PatientIdentificationProfile["consentStatus"]; label: string }> = [
  { value: "not_recorded", label: "Not recorded" },
  { value: "consented", label: "Patient consented" },
  { value: "best_interests", label: "Best-interests decision" },
  { value: "declined", label: "Declined / not appropriate" }
];

export function PatientIdentificationScreen({
  patientId,
  organisationSettings,
  patients,
  selectedStaffId,
  staff,
  wards,
  onBack,
  onSavePatient
}: PatientIdentificationScreenProps) {
  const patient = patients.find((record) => record.id === patientId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const ward = wards.find((record) => record.id === patient?.wardId);
  const canManage = hasStaffRole(selectedStaff, "manager") || hasAdminAccess(selectedStaff);
  const [profile, setProfile] = useState<PatientIdentificationProfile>(() => ({
    ...defaultIdentificationProfile(),
    ...patient?.identificationProfile
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [isWriting, setIsWriting] = useState<PatientTagType | "">("");
  const [isCreatingPng, setIsCreatingPng] = useState(false);
  const badgeRef = useRef<View>(null);
  const roomPayload = safeTagPayload("room", profile.roomTagToken);
  const personalPayload = safeTagPayload("personal", profile.personalTagToken);

  if (!patient) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Patient not found</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryText}>Back</Text></TouchableOpacity>
      </View>
    );
  }

  const saveProfile = async (nextProfile = profile) => {
    if (!canManage) return;
    setIsSaving(true);
    try {
      const savedProfile = {
        ...nextProfile,
        updatedAt: new Date().toISOString(),
        updatedBy: selectedStaff?.name ?? "Manager"
      };
      await onSavePatient({ ...patient, identificationProfile: savedProfile });
      setProfile(savedProfile);
      Alert.alert("Identification settings saved", "The room tag and personal badge settings are now stored securely.");
    } catch (error) {
      Alert.alert("Settings not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const generateTag = (type: PatientTagType) => {
    const key = type === "room" ? "roomTagToken" : "personalTagToken";
    if (type === "personal" && !personalTagAuthorised(profile)) {
      Alert.alert("Consent decision needed", "Record patient consent or an authorised best-interests decision before creating a personal tag.");
      return;
    }
    Alert.alert(
      profile[key] ? "Replace existing tag?" : `Create ${type} tag?`,
      profile[key]
        ? "The previous NFC tag and QR code will stop matching this patient once the new token is saved."
        : "SecureObs will create a random identifier containing no patient details.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: profile[key] ? "Replace tag" : "Create tag",
          onPress: () => {
            const next = { ...profile, [key]: createPatientTagToken() };
            setProfile(next);
            void saveProfile(next);
          }
        }
      ]
    );
  };

  const writeTag = async (type: PatientTagType) => {
    const payload = type === "room" ? roomPayload : personalPayload;
    if (!payload) {
      Alert.alert("Create tag first", `Create and save the ${type} tag before writing NFC.`);
      return;
    }
    setIsWriting(type);
    try {
      await writeNfcTextPayload(payload);
      Alert.alert("NFC tag written", `The ${type} NFC tag is ready. No patient details were written to the chip.`);
    } catch (error) {
      Alert.alert("NFC tag not written", error instanceof Error ? error.message : "Please try another NFC tag.");
    } finally {
      setIsWriting("");
    }
  };

  const removeTag = (type: PatientTagType) => {
    const key = type === "room" ? "roomTagToken" : "personalTagToken";
    Alert.alert("Deactivate tag?", `The current ${type} NFC tag and QR code will no longer verify observations.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: () => {
          const next = { ...profile, [key]: undefined };
          setProfile(next);
          void saveProfile(next);
        }
      }
    ]);
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to select an authorised patient photograph.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const resized = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 480, height: 480 } }], {
      compress: 0.72,
      format: SaveFormat.JPEG,
      base64: true
    });
    if (!resized.base64) return;
    const photoDataUri = `data:image/jpeg;base64,${resized.base64}`;
    if (photoDataUri.length > 450_000) {
      Alert.alert("Photo is too large", "Please choose a simpler or lower-resolution photograph.");
      return;
    }
    setProfile((current) => ({ ...current, photoDataUri }));
  };

  const printItem = async (type: PatientTagType) => {
    const payload = type === "room" ? roomPayload : personalPayload;
    if (!payload) {
      Alert.alert("Create tag first", `Create and save the ${type} tag before printing.`);
      return;
    }
    const qrSvg = await QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 260 });
    const html = type === "room"
      ? roomSignHtml(patient, ward, qrSvg)
      : personalBadgeHtml(patient, ward, profile, qrSvg, organisationSettings.logoDataUri);
    const result = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: `SecureObs ${type} tag` });
    } else {
      await Print.printAsync({ uri: result.uri });
    }
  };

  const saveBadgePng = async () => {
    if (!personalPayload || !personalTagAuthorised(profile)) {
      Alert.alert("Personal tag needed", "Create an authorised personal tag before saving the ID card image.");
      return;
    }
    if (!badgeRef.current) return;
    setIsCreatingPng(true);
    try {
      const uri = await captureRef(badgeRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Save ${patient.firstName} ${patient.surname} SecureObs ID card`,
          UTI: "public.png"
        });
      } else {
        Alert.alert("ID card created", `The PNG image was created at ${uri}`);
      }
    } catch (error) {
      Alert.alert("ID card not created", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsCreatingPng(false);
    }
  };

  const toggle = (key: "showPhoto" | "showDateOfBirth" | "showHospitalNumber" | "showWardAndRoom" | "showAllergies") =>
    setProfile((current) => ({ ...current, [key]: !current[key] }));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Patient NFC & QR identification</Text>
          <Text style={styles.meta}>{patient.firstName} {patient.surname} · {ward?.name ?? "Ward"} · Room {patient.roomNumber}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryText}>Back to patient management</Text></TouchableOpacity>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Privacy-protecting design</Text>
        <Text style={styles.noticeText}>NFC and QR codes contain only a random SecureObs identifier. Names, DOB, hospital numbers and photographs are never encoded into the tag.</Text>
      </View>

      <View style={styles.columns}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Room tag</Text>
          <Text style={styles.body}>Place beside the bedroom door. It verifies the location but staff must still confirm that they visually observed the patient.</Text>
          <Text style={styles.token}>{profile.roomTagToken ? `Identifier: …${profile.roomTagToken.slice(-8)}` : "No room tag created"}</Text>
          <View style={styles.actionRow}>
            <Action label={profile.roomTagToken ? "Replace" : "Create"} onPress={() => generateTag("room")} />
            <Action disabled={!profile.roomTagToken || isWriting !== ""} label={isWriting === "room" ? "Writing…" : "Write NFC"} onPress={() => void writeTag("room")} />
            <Action disabled={!profile.roomTagToken} label="Create QR/PDF" onPress={() => void printItem("room")} />
            <Action disabled={!profile.roomTagToken} label="Deactivate" onPress={() => removeTag("room")} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Personal ID badge</Text>
          <Text style={styles.body}>Optional patient badge or card for identification away from their room. Record the appropriate consent or best-interests decision first.</Text>
          <Text style={styles.label}>Decision / consent record</Text>
          <View style={styles.optionRow}>{consentOptions.map((option) => <Option key={option.value} active={profile.consentStatus === option.value} label={option.label} onPress={() => setProfile((current) => ({ ...current, consentStatus: option.value }))} />)}</View>
          <Text style={styles.token}>{profile.personalTagToken ? `Identifier: …${profile.personalTagToken.slice(-8)}` : "No personal tag created"}</Text>
          <View style={styles.actionRow}>
            <Action disabled={!personalTagAuthorised(profile)} label={profile.personalTagToken ? "Replace" : "Create"} onPress={() => generateTag("personal")} />
            <Action disabled={!profile.personalTagToken || !personalTagAuthorised(profile) || isWriting !== ""} label={isWriting === "personal" ? "Writing…" : "Write NFC"} onPress={() => void writeTag("personal")} />
            <Action disabled={!profile.personalTagToken || !personalTagAuthorised(profile)} label="Create badge PDF" onPress={() => void printItem("personal")} />
            <Action disabled={!profile.personalTagToken} label="Deactivate" onPress={() => removeTag("personal")} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal badge appearance</Text>
        <View style={styles.badgeRow}>
          <View style={styles.photoBox}>
            {profile.photoDataUri ? <Image source={{ uri: profile.photoDataUri }} style={styles.photo} /> : <Text style={styles.photoEmpty}>No photo</Text>}
            <Action label="Choose photo" onPress={() => void choosePhoto()} />
            <Action disabled={!profile.photoDataUri} label="Remove photo" onPress={() => setProfile((current) => ({ ...current, photoDataUri: undefined }))} />
          </View>
          <View style={styles.previewShell}>
            <View collapsable={false} ref={badgeRef} style={styles.idCard}>
              <View style={styles.idCardHeader}>
                {organisationSettings.logoDataUri ? (
                  <Image resizeMode="contain" source={{ uri: organisationSettings.logoDataUri }} style={styles.badgeLogo} />
                ) : (
                  <Image resizeMode="contain" source={require("../../assets/SecureObs.png")} style={styles.badgeLogo} />
                )}
                <View style={styles.badgeHeaderCopy}>
                  <Text style={styles.badgeBrand}>SecureObs Patient Identification</Text>
                  <Text style={styles.badgeWard}>{ward?.name ?? "Ward"}</Text>
                </View>
              </View>
              <View style={styles.idCardBody}>
                {profile.showPhoto && profile.photoDataUri ? (
                  <Image source={{ uri: profile.photoDataUri }} style={styles.badgePhoto} />
                ) : (
                  <View style={styles.badgePhotoPlaceholder}><Text style={styles.badgePhotoPlaceholderText}>PHOTO</Text></View>
                )}
                <View style={styles.badgeDetails}>
                  <Text numberOfLines={1} style={styles.badgeName}>{patient.firstName} {patient.surname}</Text>
                  {profile.showHospitalNumber ? <Text style={styles.badgeDetail}>Hospital / NHS no: {patient.hospitalNumber}</Text> : null}
                  {profile.showDateOfBirth ? <Text style={styles.badgeDetail}>DOB: {formatDateOfBirth(patient.dateOfBirth)}</Text> : null}
                  {profile.showWardAndRoom ? <Text style={styles.badgeDetail}>Ward: {ward?.name ?? "Ward"} · Room: {patient.roomNumber}</Text> : null}
                  {profile.showAllergies ? (
                    <View style={styles.allergyBanner}><Text numberOfLines={2} style={styles.allergyText}>ALLERGIES: {patient.allergies?.trim() || "None recorded"}</Text></View>
                  ) : null}
                </View>
                <View style={styles.badgeQr}>
                  {personalPayload ? <QRCodeSvg backgroundColor="#ffffff" color="#082456" quietZone={4} size={122} value={personalPayload} /> : <Text style={styles.qrPlaceholder}>Create personal tag to add QR</Text>}
                  <Text style={styles.qrCaption}>SCAN WITH SECUREOBS</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.displayOptions}>
            <Option active={profile.showPhoto} label="Show photo" onPress={() => toggle("showPhoto")} />
            <Option active={profile.showDateOfBirth} label="Show DOB" onPress={() => toggle("showDateOfBirth")} />
            <Option active={profile.showHospitalNumber} label="Show hospital number" onPress={() => toggle("showHospitalNumber")} />
            <Option active={profile.showWardAndRoom} label="Show ward & room" onPress={() => toggle("showWardAndRoom")} />
            <Option active={profile.showAllergies} label="Show allergies" onPress={() => toggle("showAllergies")} />
          </View>
        </View>
        <Text style={styles.privacyHelper}>The displayed details are printed into the PNG card. The QR code itself still contains only the random SecureObs identifier.</Text>
        <Action
          disabled={!profile.personalTagToken || !personalTagAuthorised(profile) || isCreatingPng}
          label={isCreatingPng ? "Creating PNG…" : "Save / share ID card as PNG"}
          onPress={() => void saveBadgePng()}
        />
        <TouchableOpacity accessibilityRole="button" disabled={!canManage || isSaving} onPress={() => void saveProfile()} style={[styles.saveButton, (!canManage || isSaving) && styles.disabled]}>
          <Text style={styles.saveText}>{isSaving ? "Saving…" : "Save identification settings"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.actionButton, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>;
}

function Option({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.option, active && styles.optionActive]}><Text style={[styles.optionText, active && styles.optionTextActive]}>{active ? "✓ " : ""}{label}</Text></TouchableOpacity>;
}

function safeTagPayload(type: PatientTagType, token?: string) {
  if (!token) return "";
  try {
    return buildPatientTagPayload(type, token);
  } catch {
    return "";
  }
}

function personalTagAuthorised(profile: PatientIdentificationProfile) {
  return profile.consentStatus === "consented" || profile.consentStatus === "best_interests";
}

function escapeHtml(value: string | undefined) {
  return (value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function documentHtml(content: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial;color:#082456}.item{border:3px solid #087f92;border-radius:18px;padding:28px;max-width:680px}.brand{font-size:20px;font-weight:700;color:#07879b}.name{font-size:34px;font-weight:800;margin:12px 0}.details{font-size:19px;line-height:1.55}.qr{width:260px;margin:20px auto;text-align:center}.notice{font-size:14px;color:#43556c;margin-top:16px}.layout{display:flex;gap:24px;align-items:center}.photo{width:180px;height:180px;object-fit:cover;border-radius:12px}.room{font-size:70px;font-weight:900}.ward{font-size:30px;font-weight:700}</style></head><body>${content}</body></html>`;
}

function roomSignHtml(patient: Patient, ward: Ward | undefined, qrSvg: string) {
  return documentHtml(`<div class="item"><div class="brand">SecureObs verified observation location</div><div class="ward">${escapeHtml(ward?.name ?? "Ward")}</div><div class="room">Room ${patient.roomNumber}</div><div class="qr">${qrSvg}</div><div class="notice">Scan with SecureObs. This tag verifies the room location; staff must still visually observe the correct patient.</div></div>`);
}

function personalBadgeHtml(
  patient: Patient,
  ward: Ward | undefined,
  profile: PatientIdentificationProfile,
  qrSvg: string,
  logoDataUri?: string | null
) {
  const photo = profile.showPhoto && profile.photoDataUri ? `<img class="photo" src="${profile.photoDataUri}">` : "";
  const logo = logoDataUri ? `<img style="max-width:150px;max-height:70px;object-fit:contain" src="${logoDataUri}">` : "";
  const allergies = profile.showAllergies
    ? `<div style="margin-top:12px;padding:9px;background:#fff0f0;border:2px solid #b42318;color:#8f1d15;font-weight:800">ALLERGIES: ${escapeHtml(patient.allergies?.trim() || "None recorded")}</div>`
    : "";
  return documentHtml(`<div class="item"><div style="display:flex;justify-content:space-between;align-items:center">${logo}<div><div class="brand">SecureObs patient identification</div><div class="ward">${escapeHtml(ward?.name ?? "Ward")}</div></div></div><div class="layout">${photo}<div><div class="name">${escapeHtml(patient.firstName)} ${escapeHtml(patient.surname)}</div><div class="details">${profile.showHospitalNumber ? `Hospital / NHS no: ${escapeHtml(patient.hospitalNumber)}<br>` : ""}${profile.showDateOfBirth ? `DOB: ${escapeHtml(formatDateOfBirth(patient.dateOfBirth))}<br>` : ""}${profile.showWardAndRoom ? `${escapeHtml(ward?.name ?? "Ward")} · Room ${patient.roomNumber}` : ""}</div>${allergies}</div><div class="qr">${qrSvg}<strong>SCAN WITH SECUREOBS</strong></div></div><div class="notice">If found, return this badge to the issuing care provider. The QR code contains no visible clinical information.</div></div>`);
}

const styles = StyleSheet.create({
  screen: { gap: 12 }, header: { alignItems: "center", backgroundColor: "#fff", borderRadius: 8, flexDirection: "row", justifyContent: "space-between", padding: 14 },
  title: { color: "#142b35", fontSize: 22, fontWeight: "900" }, meta: { color: "#61737b", fontWeight: "700", marginTop: 4 },
  secondaryButton: { borderColor: "#1f5262", borderRadius: 6, borderWidth: 1, padding: 11 }, secondaryText: { color: "#1f5262", fontWeight: "900" },
  notice: { backgroundColor: "#eaf8fa", borderColor: "#78c5d0", borderRadius: 8, borderWidth: 1, padding: 13 }, noticeTitle: { color: "#07566a", fontWeight: "900" }, noticeText: { color: "#28454f", lineHeight: 20, marginTop: 3 },
  columns: { flexDirection: "row", gap: 12 }, card: { backgroundColor: "#fff", borderColor: "#d6e0e3", borderRadius: 8, borderWidth: 1, flex: 1, gap: 10, padding: 14 },
  cardTitle: { color: "#142b35", fontSize: 18, fontWeight: "900" }, body: { color: "#42545c", lineHeight: 20 }, label: { color: "#243b45", fontWeight: "900" }, token: { backgroundColor: "#f1f5f6", color: "#34515c", fontFamily: "monospace", padding: 9 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, actionButton: { backgroundColor: "#087f92", borderRadius: 6, minHeight: 40, justifyContent: "center", paddingHorizontal: 12 }, actionText: { color: "#fff", fontWeight: "900" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, option: { borderColor: "#b7c7cc", borderRadius: 6, borderWidth: 1, padding: 8 }, optionActive: { backgroundColor: "#def4ed", borderColor: "#168264" }, optionText: { color: "#4d6169", fontWeight: "800" }, optionTextActive: { color: "#0a604b" },
  badgeRow: { alignItems: "stretch", flexDirection: "row", gap: 14 }, photoBox: { alignItems: "center", gap: 8, width: 150 }, photo: { borderRadius: 8, height: 130, width: 130 }, photoEmpty: { backgroundColor: "#eef2f3", color: "#718087", paddingHorizontal: 38, paddingVertical: 56 },
  previewShell: { alignItems: "center", flex: 1, justifyContent: "center" },
  idCard: { backgroundColor: "#fff", borderColor: "#087f92", borderRadius: 18, borderWidth: 4, height: 454, overflow: "hidden", padding: 22, width: 720 },
  idCardHeader: { alignItems: "center", borderBottomColor: "#9bc9d2", borderBottomWidth: 2, flexDirection: "row", minHeight: 86, paddingBottom: 12 },
  badgeLogo: { height: 72, width: 130 }, badgeHeaderCopy: { alignItems: "flex-end", flex: 1 }, badgeBrand: { color: "#087f92", fontSize: 20, fontWeight: "900" }, badgeWard: { color: "#082456", fontSize: 26, fontWeight: "900", marginTop: 4 },
  idCardBody: { alignItems: "center", flex: 1, flexDirection: "row", gap: 18, paddingTop: 18 }, badgePhoto: { borderColor: "#c4d4d9", borderRadius: 12, borderWidth: 2, height: 210, width: 165 },
  badgePhotoPlaceholder: { alignItems: "center", backgroundColor: "#eef3f4", borderColor: "#c4d4d9", borderRadius: 12, borderWidth: 2, height: 210, justifyContent: "center", width: 165 }, badgePhotoPlaceholderText: { color: "#84959c", fontWeight: "900" },
  badgeDetails: { flex: 1, gap: 9 }, badgeName: { color: "#082456", fontSize: 31, fontWeight: "900" }, badgeDetail: { color: "#253e49", fontSize: 17, fontWeight: "800" },
  allergyBanner: { backgroundColor: "#fff0f0", borderColor: "#b42318", borderRadius: 6, borderWidth: 2, marginTop: 4, padding: 8 }, allergyText: { color: "#941f18", fontSize: 15, fontWeight: "900" },
  badgeQr: { alignItems: "center", width: 135 }, qrCaption: { color: "#082456", fontSize: 10, fontWeight: "900", marginTop: 6, textAlign: "center" }, qrPlaceholder: { color: "#6a7c84", fontSize: 12, textAlign: "center" },
  displayOptions: { flex: 0.55, gap: 7 }, privacyHelper: { color: "#526970", fontSize: 12, fontWeight: "700" },
  saveButton: { alignItems: "center", backgroundColor: "#0c5363", borderRadius: 7, minHeight: 46, justifyContent: "center" }, saveText: { color: "#fff", fontWeight: "900" }, disabled: { opacity: 0.45 }
});
