export type StaffCardData = {
  clinician: string;
  score: string;
  staffCode: string;
};

export function parseStaffCardData(rawValue: string): StaffCardData | null {
  const trimmedValue = rawValue.trim();
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

function decodeValue(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}
