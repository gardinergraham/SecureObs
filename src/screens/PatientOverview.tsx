import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Panel } from "../components/Panel";
import type { Observation, Patient, PatientIncompatibility, Ward } from "../types/domain";

type PatientOverviewProps = {
  patient: Patient;
  ward?: Ward;
  observations: Observation[];
  incompatibilities: PatientIncompatibility[];
};

export function PatientOverview({
  patient,
  ward,
  observations,
  incompatibilities
}: PatientOverviewProps) {
  const patientObservations = observations.filter((observation) => observation.patientId === patient.id);
  const patientIncompatibilities = incompatibilities.filter((item) => item.patientId === patient.id);

  return (
    <View>
      <Panel title={`${patient.firstName} ${patient.surname}`}>
        <Text style={styles.line}>Ward: {ward?.name ?? "Unassigned"}</Text>
        <Text style={styles.line}>Patient number: {patient.patientNumber}</Text>
        <Text style={styles.line}>Hospital number: {patient.hospitalNumber}</Text>
        <Text style={styles.line}>Room: {patient.roomNumber}</Text>
        <Text style={styles.line}>Observation: {patient.observationLevel}</Text>
        <Text style={styles.line}>Latest place: {patient.latestObservationPlace}</Text>
        <Text style={styles.line}>Status: {patient.onOffWard}</Text>
        <Text style={styles.line}>Seclusion: {patient.seclusion ? "Yes" : "No"}</Text>
        <Text style={styles.line}>Long-term seclusion: {patient.longTermSeclusion ? "Yes" : "No"}</Text>
      </Panel>

      <Panel title="Observation history">
        {patientObservations.length === 0 ? (
          <Text style={styles.empty}>No observations recorded in the prototype data.</Text>
        ) : (
          patientObservations.map((observation) => (
            <View key={observation.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{observation.location}</Text>
              <Text style={styles.line}>
                {observation.type} - {observation.presentation}
              </Text>
              <Text style={styles.line}>{observation.comments}</Text>
              <Text style={styles.meta}>By {observation.observerName}</Text>
            </View>
          ))
        )}
      </Panel>

      <Panel title="Incompatibilities">
        {patientIncompatibilities.length === 0 ? (
          <Text style={styles.empty}>None recorded.</Text>
        ) : (
          patientIncompatibilities.map((item) => (
            <Text key={item.id} style={styles.line}>
              {item.reason}
            </Text>
          ))
        )}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    color: "#30434a",
    fontSize: 14,
    lineHeight: 22
  },
  empty: {
    color: "#69777d",
    fontSize: 14
  },
  historyRow: {
    borderTopColor: "#edf1f2",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10
  },
  historyTitle: {
    color: "#18262c",
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    color: "#69777d",
    fontSize: 12,
    marginTop: 4
  }
});
