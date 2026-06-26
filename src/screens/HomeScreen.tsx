import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { Site, StaffMember, Ward } from "../types/domain";
import { hasAdminAccess, hasStaffRole } from "../utils/staffRole";

type HomeScreenProps = {
  sites: Site[];
  wards: Ward[];
  staff: StaffMember[];
  selectedStaffId: string;
  selectedSiteId: string;
  selectedWardId: string;
  onSelectStaff: (staffId: string) => void;
  onSelectSite: (siteId: string) => void;
  onSelectWard: (wardId: string) => void;
  onStaffPinLogin: (staffCode: string, loginPin: string) => Promise<string>;
  onChangeStaffPin: (currentPin: string, newPin: string) => Promise<string>;
  onBankStaffPinLogin: (staffCode: string, loginPin: string) => Promise<string>;
  onUnlockStaffAccess: (lockedStaffCode: string, nurseInChargeStaffCode: string) => Promise<string>;
  onScanStaffCard: () => Promise<string>;
  onOpenAdminSettings: () => void;
  onOpenWardSettings: () => void;
  onStart: () => void;
};

export function HomeScreen({
  sites,
  wards,
  staff,
  selectedStaffId,
  selectedSiteId,
  selectedWardId,
  onSelectStaff,
  onSelectSite,
  onSelectWard,
  onStaffPinLogin,
  onChangeStaffPin,
  onBankStaffPinLogin,
  onUnlockStaffAccess,
  onScanStaffCard,
  onOpenAdminSettings,
  onOpenWardSettings,
  onStart
}: HomeScreenProps) {
  const [staffCardMessage, setStaffCardMessage] = useState("");
  const [staffPinCode, setStaffPinCode] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffPinMessage, setStaffPinMessage] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [changePinMessage, setChangePinMessage] = useState("");
  const [bankStaffCode, setBankStaffCode] = useState("");
  const [bankStaffPin, setBankStaffPin] = useState("");
  const [bankStaffMessage, setBankStaffMessage] = useState("");
  const [lockedStaffCode, setLockedStaffCode] = useState("");
  const [nurseInChargeStaffCode, setNurseInChargeStaffCode] = useState("");
  const [unlockMessage, setUnlockMessage] = useState("");
  const [isBankStaffSigningIn, setIsBankStaffSigningIn] = useState(false);
  const [isStaffPinSigningIn, setIsStaffPinSigningIn] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isUnlockingAccess, setIsUnlockingAccess] = useState(false);
  const [isScanningStaffCard, setIsScanningStaffCard] = useState(false);
  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId);
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const hasStaffSession = Boolean(selectedStaff);
  const pinChangeRequired = Boolean(selectedStaff?.loginPinMustChange);
  const canStart = Boolean(selectedStaff && selectedSite && selectedWard && !pinChangeRequired);
  const canOpenAdminSettings = !pinChangeRequired && hasAdminAccess(selectedStaff);
  const canEditWardSettings = !pinChangeRequired && (hasStaffRole(selectedStaff, "manager") || hasAdminAccess(selectedStaff));
  const sessionMeta = useMemo(() => {
    const staffLabel = selectedStaff ? `${selectedStaff.name} (${selectedStaff.staffCode})` : "No staff";
    const siteLabel = selectedSite?.name ?? "No site";
    const wardLabel = selectedWard?.name ?? "No ward";

    return `${staffLabel} | ${siteLabel} | ${wardLabel}`;
  }, [selectedSite, selectedStaff, selectedWard]);

  const scanCard = async () => {
    setIsScanningStaffCard(true);
    setStaffCardMessage("Hold the staff card against the tablet.");

    try {
      setStaffCardMessage(await onScanStaffCard());
    } catch (error) {
      setStaffCardMessage(error instanceof Error ? error.message : "Unable to read that NFC card.");
    } finally {
      setIsScanningStaffCard(false);
    }
  };

  const changeOwnPin = async () => {
    if (!currentPin.trim() || !newPin.trim() || !confirmNewPin.trim()) {
      setChangePinMessage("Enter your current PIN and your new PIN twice.");
      return;
    }

    if (!/^\d{4,6}$/.test(newPin.trim())) {
      setChangePinMessage("Choose a 4 to 6 digit PIN.");
      return;
    }

    if (newPin.trim() !== confirmNewPin.trim()) {
      setChangePinMessage("The new PIN entries do not match.");
      return;
    }

    setIsChangingPin(true);
    try {
      setChangePinMessage(await onChangeStaffPin(currentPin.trim(), newPin.trim()));
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
    } catch (error) {
      setChangePinMessage(error instanceof Error ? error.message : "Unable to update PIN.");
    } finally {
      setIsChangingPin(false);
    }
  };

  const signInBankStaff = async () => {
    if (!bankStaffCode.trim() || !bankStaffPin.trim()) {
      setBankStaffMessage("Enter STAFFCODE and PIN.");
      return;
    }

    setIsBankStaffSigningIn(true);
    try {
      setBankStaffMessage(await onBankStaffPinLogin(bankStaffCode.trim(), bankStaffPin.trim()));
      setBankStaffPin("");
    } catch (error) {
      setBankStaffMessage(error instanceof Error ? error.message : "Bank staff sign-in failed.");
    } finally {
      setIsBankStaffSigningIn(false);
    }
  };

  const signInStaffPin = async () => {
    if (!staffPinCode.trim() || !staffPin.trim()) {
      setStaffPinMessage("Enter STAFFCODE and PIN.");
      return;
    }

    setIsStaffPinSigningIn(true);
    try {
      setStaffPinMessage(await onStaffPinLogin(staffPinCode.trim(), staffPin.trim()));
      setStaffPin("");
    } catch (error) {
      setStaffPinMessage(error instanceof Error ? error.message : "Staff PIN sign-in failed.");
    } finally {
      setIsStaffPinSigningIn(false);
    }
  };

  const unlockAccess = async () => {
    if (!lockedStaffCode.trim() || !nurseInChargeStaffCode.trim()) {
      setUnlockMessage("Enter the locked STAFFCODE and nurse in charge STAFFCODE.");
      return;
    }

    setIsUnlockingAccess(true);
    try {
      setUnlockMessage(await onUnlockStaffAccess(lockedStaffCode.trim(), nurseInChargeStaffCode.trim()));
      setNurseInChargeStaffCode("");
    } catch (error) {
      setUnlockMessage(error instanceof Error ? error.message : "Unable to unlock that sign-in.");
    } finally {
      setIsUnlockingAccess(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.title}>SecureObs</Text>
          <Text style={styles.subtitle}>Ward observation control centre</Text>
        </View>
        <View style={styles.sessionBadge}>
          <Text style={styles.sessionBadgeText}>{selectedWard?.observationIntervalMinutes ?? 0}m</Text>
        </View>
      </View>

      <View style={styles.sessionStrip}>
        <Text style={styles.sessionLabel}>Current session</Text>
        <Text style={styles.sessionText}>{sessionMeta}</Text>
      </View>

      <View style={styles.layout}>
        <View style={styles.column}>
          <SectionHeader title="Staff access" meta={selectedStaff ? selectedStaff.role : "Select or scan staff"} />
          {selectedStaff ? (
            <View style={styles.signedInPanel}>
              <Text style={styles.signedInName}>{selectedStaff.name}</Text>
              <Text style={styles.signedInMeta}>
                {selectedStaff.staffCode} | {selectedStaff.role} | {selectedStaff.employmentType === "bank" ? "Bank/temp" : "Permanent"}
              </Text>
              {pinChangeRequired ? <Text style={styles.pinRequiredText}>PIN change required before continuing.</Text> : null}
              <TouchableOpacity accessibilityRole="button" onPress={() => onSelectStaff("")} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Sign out staff</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noticeText}>No staff session is active. Use NFC or bank/temp PIN sign-in.</Text>
          )}

          <View style={styles.nfcPanel}>
            <View style={styles.nfcHeader}>
              <Text style={styles.nfcTitle}>NFC staff card</Text>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isScanningStaffCard}
                onPress={scanCard}
                style={[styles.scanButton, isScanningStaffCard && styles.disabledButton]}
              >
                <Text style={styles.scanButtonText}>{isScanningStaffCard ? "Scanning" : "Scan card"}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.noticeText}>Use the physical staff card on NFC-enabled tablets. Use Staff PIN sign-in on tablets without NFC.</Text>
            {staffCardMessage ? <Text style={styles.cardMessage}>{staffCardMessage}</Text> : null}
          </View>

          {pinChangeRequired ? (
            <View style={styles.pinChangePanel}>
              <Text style={styles.nfcTitle}>Choose a personal PIN</Text>
              <Text style={styles.noticeText}>Your first login PIN is temporary. Choose a new 4 to 6 digit PIN before opening ward screens.</Text>
              <TextInput placeholderTextColor="#6f7f87"
                autoCapitalize="none"
                keyboardType="number-pad"
                onChangeText={setCurrentPin}
                placeholder="Current PIN"
                secureTextEntry
                style={styles.cardInput}
                value={currentPin}
              />
              <TextInput placeholderTextColor="#6f7f87"
                autoCapitalize="none"
                keyboardType="number-pad"
                onChangeText={setNewPin}
                placeholder="New PIN"
                secureTextEntry
                style={styles.cardInput}
                value={newPin}
              />
              <TextInput placeholderTextColor="#6f7f87"
                autoCapitalize="none"
                keyboardType="number-pad"
                onChangeText={setConfirmNewPin}
                placeholder="Confirm new PIN"
                secureTextEntry
                style={styles.cardInput}
                value={confirmNewPin}
              />
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isChangingPin}
                onPress={changeOwnPin}
                style={[styles.scanButton, isChangingPin && styles.disabledButton]}
              >
                <Text style={styles.scanButtonText}>{isChangingPin ? "Saving" : "Update PIN"}</Text>
              </TouchableOpacity>
              {changePinMessage ? <Text style={styles.cardMessage}>{changePinMessage}</Text> : null}
            </View>
          ) : null}

          <View style={styles.nfcPanel}>
            <View style={styles.nfcHeader}>
              <Text style={styles.nfcTitle}>Staff PIN sign-in</Text>
            </View>
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              onChangeText={setStaffPinCode}
              placeholder="STAFFCODE"
              style={styles.cardInput}
              value={staffPinCode}
            />
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              keyboardType="number-pad"
              onChangeText={setStaffPin}
              placeholder="PIN"
              secureTextEntry
              style={styles.cardInput}
              value={staffPin}
            />
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isStaffPinSigningIn}
              onPress={signInStaffPin}
              style={[styles.secondaryButton, isStaffPinSigningIn && styles.disabledOutline]}
            >
              <Text style={styles.secondaryButtonText}>{isStaffPinSigningIn ? "Checking" : "Sign in with PIN"}</Text>
            </TouchableOpacity>
            {staffPinMessage ? <Text style={styles.cardMessage}>{staffPinMessage}</Text> : null}
          </View>

          <View style={styles.nfcPanel}>
            <View style={styles.nfcHeader}>
              <Text style={styles.nfcTitle}>Bank/temp staff PIN</Text>
            </View>
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              onChangeText={setBankStaffCode}
              placeholder="Virtual NFC code"
              style={styles.cardInput}
              value={bankStaffCode}
            />
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              keyboardType="number-pad"
              onChangeText={setBankStaffPin}
              placeholder="PIN"
              secureTextEntry
              style={styles.cardInput}
              value={bankStaffPin}
            />
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isBankStaffSigningIn}
              onPress={signInBankStaff}
              style={[styles.secondaryButton, isBankStaffSigningIn && styles.disabledOutline]}
            >
              <Text style={styles.secondaryButtonText}>
                {isBankStaffSigningIn ? "Checking" : "Sign in bank/temp staff"}
              </Text>
            </TouchableOpacity>
            {bankStaffMessage ? <Text style={styles.cardMessage}>{bankStaffMessage}</Text> : null}
          </View>

          <View style={styles.nfcPanel}>
            <View style={styles.nfcHeader}>
              <Text style={styles.nfcTitle}>Unlock sign-in</Text>
            </View>
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              onChangeText={setLockedStaffCode}
              placeholder="Locked STAFFCODE or virtual code"
              style={styles.cardInput}
              value={lockedStaffCode}
            />
            <TextInput placeholderTextColor="#6f7f87"
              autoCapitalize="none"
              onChangeText={setNurseInChargeStaffCode}
              placeholder="Nurse in charge STAFFCODE"
              secureTextEntry
              style={styles.cardInput}
              value={nurseInChargeStaffCode}
            />
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isUnlockingAccess}
              onPress={unlockAccess}
              style={[styles.secondaryButton, isUnlockingAccess && styles.disabledOutline]}
            >
              <Text style={styles.secondaryButtonText}>{isUnlockingAccess ? "Checking" : "Unlock sign-in"}</Text>
            </TouchableOpacity>
            {unlockMessage ? <Text style={styles.cardMessage}>{unlockMessage}</Text> : null}
          </View>
        </View>

        <View style={styles.column}>
          <SectionHeader
            title="Location"
            meta={hasStaffSession ? selectedWard?.serviceType ?? "Select site and ward" : "Sign in required"}
          />
          {hasStaffSession ? (
            <>
              <SelectorRow
                label="Site"
                options={sites.map((site) => ({ id: site.id, label: site.name }))}
                selectedId={selectedSiteId}
                onSelect={onSelectSite}
              />
              <SelectorRow
                label="Ward"
                options={wards.map((ward) => ({
                  id: ward.id,
                  label: `${ward.name} (${ward.observationIntervalMinutes}m)`
                }))}
                selectedId={selectedWardId}
                onSelect={onSelectWard}
              />
              <View style={styles.wardSummary}>
                <Text style={styles.summaryTitle}>{selectedWard?.name ?? "No ward selected"}</Text>
                <Text style={styles.summaryMeta}>
                  NEWS2 {selectedWard?.news2Enabled ? "on" : "off"} | Enhanced{" "}
                  {selectedWard?.enhancedObservationsEnabled ? "on" : "off"} | Security{" "}
                  {selectedWard?.securityChecksEnabled ? "on" : "off"} | Meds{" "}
                  {selectedWard?.medicationChartEnabled ? "on" : "off"}
                </Text>
                <Text style={styles.summaryMeta}>
                  {selectedWard?.staffRotaEnabled ? "Staff rota enabled" : "Staff rota hidden"} |{" "}
                  {selectedWard?.rotaShiftCount ?? 0} shifts | Breaks {selectedWard?.breakDurationMinutes ?? 0}m
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.locationLockedPanel}>
              <Text style={styles.locationLockedTitle}>Location hidden</Text>
              <Text style={styles.locationLockedText}>
                Sign in with a staff card or bank/temp PIN to show authorised sites and wards.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.menu}>
        <MenuTile
          disabled={!canStart}
          meta={
            pinChangeRequired
              ? "Update your temporary PIN first"
              : canStart
                ? "General, enhanced, NEWS2, medication and ward workflows"
                : "Select staff, site and ward"
          }
          title="Open ward workspace"
          tone="primary"
          onPress={onStart}
        />
        <MenuTile
          disabled={!selectedWard || !canEditWardSettings}
          meta={canEditWardSettings ? "Intervals, modules, rota and staff setup" : "Manager access required"}
          title="Ward settings"
          onPress={onOpenWardSettings}
        />
        <MenuTile
          disabled={!canOpenAdminSettings}
          meta={canOpenAdminSettings ? "Create sites, wards and ward managers" : "SecureObs admin access"}
          title="SecureObs admin"
          onPress={onOpenAdminSettings}
        />
      </View>
    </View>
  );
}

type SelectorRowProps = {
  label: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
};

function SelectorRow({ label, options, selectedId, onSelect }: SelectorRowProps) {
  return (
    <View style={styles.selectorRow}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorOptions}>
        {options.map((option) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.selectorButton, option.id === selectedId && styles.selectorButtonActive]}
          >
            <Text style={[styles.selectorText, option.id === selectedId && styles.selectorTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionMeta}>{meta}</Text>
    </View>
  );
}

function MenuTile({
  disabled,
  meta,
  title,
  tone,
  onPress
}: {
  disabled: boolean;
  meta: string;
  title: string;
  tone?: "primary";
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.menuTile,
        tone === "primary" && styles.menuTilePrimary,
        disabled && styles.menuTileDisabled
      ]}
    >
      <Text style={[styles.menuTitle, tone === "primary" && styles.menuTitlePrimary]}>{title}</Text>
      <Text style={[styles.menuMeta, tone === "primary" && styles.menuMetaPrimary]}>{meta}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: "center",
    gap: 12,
    maxWidth: 1120,
    padding: 16,
    width: "100%"
  },
  hero: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16
  },
  heroText: { flex: 1, paddingRight: 12 },
  title: {
    color: "#18262c",
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: "#607078",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3
  },
  sessionBadge: {
    alignItems: "center",
    backgroundColor: "#dcead7",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 68,
    paddingHorizontal: 10
  },
  sessionBadgeText: {
    color: "#253e2c",
    fontSize: 17,
    fontWeight: "900"
  },
  sessionStrip: {
    backgroundColor: "#1f5262",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sessionLabel: {
    color: "#cbe5ec",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  sessionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4
  },
  layout: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  column: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 12,
    minWidth: 320,
    padding: 14
  },
  sectionHeader: {
    borderBottomColor: "#d8e0e3",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10
  },
  sectionTitle: {
    color: "#18262c",
    fontSize: 18,
    fontWeight: "900"
  },
  sectionMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  selectorRow: {
    gap: 7
  },
  selectorLabel: {
    color: "#31454d",
    fontSize: 12,
    fontWeight: "900"
  },
  selectorOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorButton: {
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  selectorButtonActive: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  selectorText: {
    color: "#30434a",
    fontSize: 13,
    fontWeight: "800"
  },
  selectorTextActive: {
    color: "#ffffff"
  },
  noticeText: {
    color: "#607078",
    fontSize: 13,
    fontWeight: "800"
  },
  signedInPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12
  },
  signedInName: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900"
  },
  signedInMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800"
  },
  pinRequiredText: {
    color: "#8a5b00",
    fontSize: 12,
    fontWeight: "900"
  },
  nfcPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12
  },
  pinChangePanel: {
    backgroundColor: "#fff7df",
    borderColor: "#e2b857",
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 12
  },
  nfcHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  nfcTitle: {
    color: "#31454d",
    flex: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  scanButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 96,
    paddingHorizontal: 12
  },
  scanButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  disabledButton: {
    backgroundColor: "#97a9b0"
  },
  cardInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 10
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12
  },
  disabledOutline: {
    opacity: 0.5
  },
  secondaryButtonText: {
    color: "#1f5262",
    fontSize: 12,
    fontWeight: "900"
  },
  cardMessage: {
    color: "#315748",
    fontSize: 12,
    fontWeight: "800"
  },
  wardSummary: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  locationLockedPanel: {
    backgroundColor: "#f8fafb",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    minHeight: 120,
    justifyContent: "center",
    padding: 14
  },
  locationLockedTitle: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  locationLockedText: {
    color: "#607078",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  summaryTitle: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "900"
  },
  summaryMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  },
  menu: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  menuTile: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: "center",
    minHeight: 96,
    minWidth: 220,
    padding: 14
  },
  menuTilePrimary: {
    backgroundColor: "#1f5262",
    borderColor: "#1f5262"
  },
  menuTileDisabled: {
    opacity: 0.5
  },
  menuTitle: {
    color: "#18262c",
    fontSize: 16,
    fontWeight: "900"
  },
  menuTitlePrimary: {
    color: "#ffffff"
  },
  menuMeta: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6
  },
  menuMetaPrimary: {
    color: "#d8edf2"
  }
});
