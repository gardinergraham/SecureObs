import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

let hasStartedNfc = false;

export async function writeNfcTextPayload(payload: string) {
  const trimmedPayload = payload.trim();

  if (!trimmedPayload) {
    throw new Error("There is no SecureObs identifier to write to the NFC tag.");
  }

  const isSupported = await NfcManager.isSupported();

  if (!isSupported) {
    throw new Error("This tablet does not support NFC writing.");
  }

  const isEnabled = await NfcManager.isEnabled();

  if (!isEnabled) {
    throw new Error("NFC is switched off in Android settings.");
  }

  if (!hasStartedNfc) {
    await NfcManager.start();
    hasStartedNfc = true;
  }

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const message = Ndef.encodeMessage([Ndef.textRecord(trimmedPayload)]);
    await NfcManager.ndefHandler.writeNdefMessage(message, { reconnectAfterWrite: true });
  } finally {
    await NfcManager.cancelTechnologyRequest({ throwOnError: false });
  }
}
