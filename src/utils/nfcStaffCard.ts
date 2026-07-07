export type StaffCardData = {
  clinician: string;
  score: string;
  staffCode: string;
};

const fallbackFormats = ["passcode={STAFFCODE}", "STAFFCODE={STAFFCODE}", "staffCode={STAFFCODE}"];

export function buildStaffCardPayload(staffCode: string, configuredFormat?: string) {
  const cleanStaffCode = staffCode.trim();
  const format = configuredFormat?.includes("{STAFFCODE}") ? configuredFormat : "passcode={STAFFCODE}";
  return format.replaceAll("{STAFFCODE}", cleanStaffCode);
}

export function parseStaffCardData(rawValue: string, configuredFormat?: string): StaffCardData | null {
  const trimmedValue = rawValue.trim();
  const formattedStaffCode = parseConfiguredStaffCode(trimmedValue, configuredFormat);

  if (formattedStaffCode) {
    return {
      clinician: "",
      score: "",
      staffCode: formattedStaffCode
    };
  }

  if (/^[a-z0-9_-]+$/i.test(trimmedValue)) {
    return {
      clinician: "",
      score: "",
      staffCode: trimmedValue
    };
  }

  const queryText = trimmedValue.includes("?") ? trimmedValue.slice(trimmedValue.indexOf("?") + 1) : trimmedValue;
  const values = new Map<string, string>();

  queryText.split("&").forEach((part) => {
    const [rawKey = "", rawValuePart = ""] = part.split("=");
    const key = decodeValue(rawKey).trim().toUpperCase();
    const value = decodeValue(rawValuePart).trim();

    if (key) {
      values.set(key, value);
    }
  });

  const staffCode = values.get("STAFFCODE") ?? "";

  if (!staffCode) {
    return null;
  }

  return {
    clinician: values.get("CLINICIAN") ?? "",
    score: values.get("SCORE") ?? "",
    staffCode
  };
}

function parseConfiguredStaffCode(rawValue: string, configuredFormat?: string) {
  const formats = [configuredFormat, ...fallbackFormats].filter((format): format is string =>
    Boolean(format?.includes("{STAFFCODE}"))
  );

  for (const format of formats) {
    const staffCode = matchStaffCodeFormat(rawValue, format);
    if (staffCode) {
      return staffCode;
    }
  }

  return "";
}

function matchStaffCodeFormat(rawValue: string, format: string) {
  const escapedFormat = escapeRegExp(format).replace("\\{STAFFCODE\\}", "([A-Za-z0-9_-]+)");
  const match = rawValue.match(new RegExp(escapedFormat, "i"));
  return match?.[1]?.trim() ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeValue(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}
