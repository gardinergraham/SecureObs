import React, { useState } from "react";
import { Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

type SecureDateTimeFieldProps = {
  dateFormat?: "iso" | "uk";
  disabled?: boolean;
  label: string;
  maximumDate?: Date;
  minimumDate?: Date;
  mode: "date" | "time" | "datetime";
  onChange: (value: string) => void;
  optional?: boolean;
  style?: StyleProp<ViewStyle>;
  value: string;
};

export function SecureDateTimeField({
  dateFormat = "iso",
  disabled = false,
  label,
  maximumDate,
  minimumDate,
  mode,
  onChange,
  optional = false,
  style,
  value
}: SecureDateTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState<"date" | "time">("date");
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const pickerValue = parsePickerValue(value, mode, dateFormat) ?? new Date();
  const displayValue = value
    ? mode === "date"
      ? formatUkDate(pickerValue)
      : mode === "datetime"
        ? `${formatUkDate(pickerValue)} ${formatTime(pickerValue)}`
        : formatTime(pickerValue)
    : optional
      ? "Not set"
      : mode === "date"
        ? "Choose date"
        : "Choose time";

  const selectValue = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") {
      setShowPicker(false);
      setPendingDate(null);
      setAndroidPickerMode("date");
      return;
    }
    if (!selected) return;
    if (mode === "datetime") {
      if (Platform.OS === "android" && androidPickerMode === "date") {
        const merged = new Date(selected);
        merged.setHours(pickerValue.getHours(), pickerValue.getMinutes(), 0, 0);
        setPendingDate(merged);
        setAndroidPickerMode("time");
        return;
      }
      const merged = pendingDate ? new Date(pendingDate) : new Date(selected);
      if (pendingDate) merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(merged.toISOString());
      if (Platform.OS !== "ios") {
        setShowPicker(false);
        setPendingDate(null);
        setAndroidPickerMode("date");
      }
      return;
    }
    if (Platform.OS !== "ios") setShowPicker(false);
    onChange(mode === "time" ? formatTime(selected) : dateFormat === "uk" ? formatUkDate(selected) : formatIsoDate(selected));
  };

  if (Platform.OS === "web") {
    const inputValue = value
      ? mode === "date"
        ? formatIsoDate(pickerValue)
        : mode === "datetime"
          ? formatLocalDateTime(pickerValue)
          : formatTime(pickerValue)
      : "";
    return (
      <View style={[styles.field, style]}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement("input", {
          "aria-label": label,
          disabled,
          max: maximumDate ? formatIsoDate(maximumDate) : undefined,
          min: minimumDate ? formatIsoDate(minimumDate) : undefined,
          onChange: (event: { target: { value: string } }) => {
            const next = event.target.value;
            if (!next) {
              if (optional) onChange("");
              return;
            }
            if (mode === "time") {
              onChange(next);
              return;
            }
            if (mode === "datetime") {
              const selected = new Date(next);
              if (!Number.isNaN(selected.getTime())) onChange(selected.toISOString());
              return;
            }
            const selected = parsePickerValue(next, "date", "iso");
            if (selected) onChange(dateFormat === "uk" ? formatUkDate(selected) : next);
          },
          style: webInputStyle(disabled),
          type: mode === "datetime" ? "datetime-local" : mode,
          value: inputValue
        })}
      </View>
    );
  }

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controlRow}>
        <TouchableOpacity
          accessibilityLabel={`${label}: ${displayValue}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => setShowPicker(true)}
          style={[styles.button, disabled && styles.disabled]}
        >
          <Text style={[styles.buttonText, !value && styles.placeholder]}>{displayValue}</Text>
          <Text style={styles.icon}>{mode === "date" ? "▣" : mode === "time" ? "◷" : "▣ ◷"}</Text>
        </TouchableOpacity>
        {optional && value ? (
          <TouchableOpacity
            accessibilityLabel={`Clear ${label}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onChange("")}
            style={[styles.clearButton, disabled && styles.disabled]}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {showPicker ? (
        <View style={styles.pickerPanel}>
          <DateTimePicker
            display={Platform.OS === "ios" ? "spinner" : "default"}
            is24Hour
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode={mode === "datetime" ? Platform.OS === "ios" ? "datetime" : androidPickerMode : mode}
            onChange={selectValue}
            value={pickerValue}
          />
          {Platform.OS === "ios" ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => setShowPicker(false)} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function parsePickerValue(value: string, mode: "date" | "time" | "datetime", dateFormat: "iso" | "uk") {
  if (mode === "datetime") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (mode === "time") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return undefined;
    const date = new Date();
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const match = dateFormat === "uk"
    ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    : /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(dateFormat === "uk" ? match[3] : match[1]);
  const month = Number(match[2]);
  const day = Number(dateFormat === "uk" ? match[1] : match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatUkDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatLocalDateTime(date: Date) {
  return `${formatIsoDate(date)}T${formatTime(date)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function webInputStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#eef2f3" : "#ffffff",
    border: "1px solid #c7d2d6",
    borderRadius: 6,
    boxSizing: "border-box",
    color: "#18262c",
    fontFamily: "inherit",
    fontSize: 15,
    minHeight: 44,
    opacity: disabled ? 0.55 : 1,
    padding: "8px 10px",
    width: "100%"
  };
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: "#31454d", fontSize: 12, fontWeight: "900" },
  controlRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  button: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#c7d2d6",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 10
  },
  buttonText: { color: "#18262c", fontSize: 15, fontWeight: "700" },
  placeholder: { color: "#718087" },
  icon: { color: "#1f5262", fontSize: 18, fontWeight: "900" },
  clearButton: { borderColor: "#9f2d28", borderRadius: 6, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 9 },
  clearText: { color: "#9f2d28", fontSize: 12, fontWeight: "900" },
  pickerPanel: { backgroundColor: "#f8fafb", borderColor: "#d8e0e3", borderRadius: 7, borderWidth: 1, padding: 6 },
  doneButton: { alignItems: "center", backgroundColor: "#1f5262", borderRadius: 6, minHeight: 38, justifyContent: "center" },
  doneText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 }
});
