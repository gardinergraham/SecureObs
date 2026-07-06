import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Ward } from "../types/domain";
import { getDisabledWardFeatures } from "../utils/wardFeatures";

type FeatureAvailabilityNoticeProps = {
  ward?: Ward;
};

export function FeatureAvailabilityNotice({ ward }: FeatureAvailabilityNoticeProps) {
  const disabledFeatures = getDisabledWardFeatures(ward);
  if (!ward || disabledFeatures.length === 0) return null;

  return (
    <View style={styles.notice}>
      <View style={styles.copy}>
        <Text style={styles.title}>Some ward modules are not enabled</Text>
        <Text style={styles.text}>
          Recording and navigation are unavailable for these modules. Existing historical records
          remain visible for continuity of care.
        </Text>
      </View>
      <View style={styles.chips}>
        {disabledFeatures.map((feature) => (
          <View key={feature.key} style={styles.chip}>
            <Text style={styles.chipText}>{feature.label} · Not enabled</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "flex-start",
    backgroundColor: "#fff8e8",
    borderColor: "#e4cf99",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 12
  },
  copy: { flex: 1, minWidth: 260 },
  title: { color: "#624b1f", fontSize: 12, fontWeight: "900" },
  text: { color: "#735f36", fontSize: 9, lineHeight: 14, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#ffffff", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  chipText: { color: "#775929", fontSize: 8, fontWeight: "900" }
});
