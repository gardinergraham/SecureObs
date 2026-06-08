import NfcManager, { Ndef, NfcTech, type NdefRecord } from "react-native-nfc-manager";

let hasStartedNfc = false;

export async function readNfcTextPayload() {
  const isSupported = await NfcManager.isSupported();

  if (!isSupported) {
    throw new Error("This tablet does not support NFC.");
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
    const tag = await NfcManager.getTag();
    const payload = tag?.ndefMessage?.map(readNdefRecord).find((value) => value.length > 0);

    if (!payload) {
      throw new Error("No readable text was found on that NFC card.");
    }

    return payload;
  } finally {
    await NfcManager.cancelTechnologyRequest({ throwOnError: false });
  }
}

function readNdefRecord(record: NdefRecord) {
  const payload = record.payload ?? [];

  if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
    return Ndef.text.decodePayload(Uint8Array.from(payload));
  }

  if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) {
    return Ndef.uri.decodePayload(Uint8Array.from(payload));
  }

  return Ndef.util.bytesToString(payload);
}
