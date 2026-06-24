import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { loadAuditEvents } from "../services/api";
import type { AuditEvent, StaffMember } from "../types/domain";
import { hasStaffRole } from "../utils/staffRole";

const eventFilters = [
  { label: "All", value: "" },
  { label: "Staff", value: "staff" },
  { label: "Obs", value: "observation" },
  { label: "Meds", value: "medication" },
  { label: "Settings", value: "settings" },
  { label: "Rota", value: "rota" },
  { label: "Access fails", value: "access-failure" }
];

type AuditLogScreenProps = {
  organisationId?: string;
  selectedStaff?: StaffMember;
  backLabel?: string;
  onBack: () => void;
};

export function AuditLogScreen({ organisationId, selectedStaff, backLabel = "Back", onBack }: AuditLogScreenProps) {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [outcome, setOutcome] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const canViewAudit =
    selectedStaff?.staffCode === "GardinerG" ||
    hasStaffRole(selectedStaff, "manager");
  const filteredEvents = useMemo(() => {
    if (eventFilter !== "access-failure") {
      return auditEvents;
    }

    return auditEvents.filter((event) => event.outcome === "failure");
  }, [auditEvents, eventFilter]);

  const loadEvents = async () => {
    if (!canViewAudit) {
      setMessage("Audit logs are restricted to SecureObs admin and managers.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const result = await loadAuditEvents({
        organisationId,
        search,
        eventType: eventFilter && eventFilter !== "access-failure" ? eventFilter : undefined,
        outcome: outcome || (eventFilter === "access-failure" ? "failure" : undefined)
      });
      setAuditEvents(result.auditEvents);
      setMessage(`${result.auditEvents.length} audit events loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load audit events.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [organisationId, canViewAudit]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Audit log</Text>
          <Text style={styles.meta}>Immutable governance record for access, settings, observations and medication.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{backLabel}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterPanel}>
        <TextInput placeholderTextColor="#6f7f87"
          autoCapitalize="none"
          onChangeText={setSearch}
          placeholder="Search staff code, patient, event, entity or details"
          style={styles.searchInput}
          value={search}
        />
        <View style={styles.optionRow}>
          {eventFilters.map((filter) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={filter.value || "all"}
              onPress={() => setEventFilter(filter.value)}
              style={[styles.filterButton, eventFilter === filter.value && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, eventFilter === filter.value && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.optionRow}>
          {[
            { label: "Any outcome", value: "" },
            { label: "Success", value: "success" },
            { label: "Failure", value: "failure" }
          ].map((filter) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={filter.value || "any"}
              onPress={() => setOutcome(filter.value)}
              style={[styles.filterButton, outcome === filter.value && styles.filterButtonActive]}
            >
              <Text style={[styles.filterText, outcome === filter.value && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity accessibilityRole="button" disabled={isLoading} onPress={loadEvents} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>{isLoading ? "Loading" : "Refresh audit log"}</Text>
        </TouchableOpacity>
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.eventList} showsVerticalScrollIndicator>
        {filteredEvents.length === 0 ? (
          <Text style={styles.emptyText}>No audit events match the current filters.</Text>
        ) : (
          filteredEvents.map((event) => <AuditEventRow event={event} key={event.id} />)
        )}
      </ScrollView>
    </View>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <View style={styles.eventRow}>
      <View style={[styles.outcomeStripe, event.outcome === "failure" && styles.failureStripe]} />
      <View style={styles.eventBody}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{formatEventType(event.eventType)}</Text>
          <Text style={styles.eventTime}>{formatDateTime(event.occurredAt)}</Text>
        </View>
        <Text style={styles.eventMeta}>
          {event.actorStaffCode || "System"} | {event.entityType}
          {event.entityId ? ` | ${event.entityId}` : ""}
        </Text>
        <Text style={styles.eventDetails}>{formatDetails(event.details)}</Text>
      </View>
    </View>
  );
}

function formatEventType(value: string) {
  return value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ");
}

function formatDetails(details: Record<string, unknown>) {
  const entries = Object.entries(details ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length === 0) {
    return "No details recorded.";
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  title: { color: "#18262c", fontSize: 20, fontWeight: "900" },
  meta: { color: "#607078", fontSize: 13, marginTop: 3 },
  backButton: {
    alignItems: "center",
    borderColor: "#1f5262",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  backButtonText: { color: "#1f5262", fontSize: 13, fontWeight: "900" },
  filterPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 12
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    color: "#18262c",
    fontSize: 14,
    fontWeight: "800",
    minHeight: 44,
    paddingHorizontal: 10
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterButton: {
    alignItems: "center",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  filterButtonActive: { backgroundColor: "#1f5262", borderColor: "#1f5262" },
  filterText: { color: "#30434a", fontSize: 12, fontWeight: "900" },
  filterTextActive: { color: "#ffffff" },
  refreshButton: {
    alignItems: "center",
    backgroundColor: "#1f5262",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 44
  },
  refreshButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  messageText: { color: "#607078", fontSize: 12, fontWeight: "800" },
  eventList: { gap: 8, paddingBottom: 120 },
  emptyText: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: 1,
    color: "#607078",
    fontSize: 14,
    fontWeight: "800",
    padding: 18,
    textAlign: "center"
  },
  eventRow: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e3",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden"
  },
  outcomeStripe: { backgroundColor: "#2d7a52", width: 6 },
  failureStripe: { backgroundColor: "#a33b3b" },
  eventBody: { flex: 1, padding: 10 },
  eventHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 8 },
  eventTitle: { color: "#18262c", flex: 1, fontSize: 14, fontWeight: "900" },
  eventTime: { color: "#607078", fontSize: 12, fontWeight: "800" },
  eventMeta: { color: "#1f5262", fontSize: 12, fontWeight: "900", marginTop: 4 },
  eventDetails: { color: "#52656e", fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 5 }
});
