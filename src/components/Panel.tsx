import React from "react";
import { StyleSheet, Text, View } from "react-native";

type PanelProps = {
  title: string;
  children: React.ReactNode;
};

export function Panel({ title, children }: PanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    padding: 14
  },
  title: {
    color: "#18262c",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10
  }
});
