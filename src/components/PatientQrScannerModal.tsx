import React, { useEffect, useRef } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";

type PatientQrScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (payload: string) => void;
};

export function PatientQrScannerModal({ visible, onClose, onScanned }: PatientQrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const handledRef = useRef(false);

  useEffect(() => {
    if (visible) handledRef.current = false;
  }, [visible]);

  const handleScan = (result: BarcodeScanningResult) => {
    if (handledRef.current) return;
    handledRef.current = true;
    onScanned(result.data);
  };

  const close = () => {
    handledRef.current = false;
    onClose();
  };

  return (
    <Modal animationType="slide" onRequestClose={close} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Scan SecureObs QR tag</Text>
          {!permission?.granted ? (
            <View style={styles.permissionPanel}>
              <Text style={styles.body}>Camera access is required only while scanning the room or patient QR code.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => void requestPermission()} style={styles.button}>
                <Text style={styles.buttonText}>Allow camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleScan}
              style={styles.camera}
            >
              <View style={styles.guide}><Text style={styles.guideText}>Place the QR code inside the frame</Text></View>
            </CameraView>
          )}
          <TouchableOpacity accessibilityRole="button" onPress={close} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(4,22,31,0.82)", flex: 1, justifyContent: "center", padding: 24 },
  panel: { backgroundColor: "#fff", borderRadius: 12, gap: 12, maxWidth: 620, padding: 16, width: "100%" },
  title: { color: "#142b35", fontSize: 20, fontWeight: "900" }, body: { color: "#43565e", lineHeight: 20 },
  permissionPanel: { gap: 12, paddingVertical: 30 }, camera: { borderRadius: 9, height: 430, overflow: "hidden" },
  guide: { alignItems: "center", borderColor: "#4ee0d0", borderRadius: 12, borderWidth: 4, flex: 1, justifyContent: "flex-end", margin: 55, padding: 12 },
  guideText: { backgroundColor: "rgba(0,0,0,0.65)", color: "#fff", fontWeight: "900", padding: 8 },
  button: { alignItems: "center", backgroundColor: "#087f92", borderRadius: 7, minHeight: 46, justifyContent: "center" }, buttonText: { color: "#fff", fontWeight: "900" },
  cancel: { alignItems: "center", borderColor: "#47616b", borderRadius: 7, borderWidth: 1, minHeight: 44, justifyContent: "center" }, cancelText: { color: "#304b55", fontWeight: "900" }
});
