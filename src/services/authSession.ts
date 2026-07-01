import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AuthSession } from "../types/domain";

const storageKey = "secureobs.authSession.v1";
let cachedSession: AuthSession | undefined;
let restorePromise: Promise<AuthSession | undefined> | undefined;
let expiryNotificationSent = false;
const expiryListeners = new Set<() => void>();

export async function storeAuthSession(session: AuthSession | undefined) {
  cachedSession = session;
  if (!session) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }

  expiryNotificationSent = false;
  await AsyncStorage.setItem(storageKey, JSON.stringify(session));
}

export async function getAuthSession() {
  if (cachedSession) {
    if (isSessionExpired(cachedSession)) {
      await expireAuthSession();
      return undefined;
    }
    return cachedSession;
  }

  if (!restorePromise) {
    restorePromise = restoreAuthSession();
  }

  return restorePromise;
}

export async function clearAuthSession() {
  restorePromise = undefined;
  await storeAuthSession(undefined);
}

export async function expireAuthSession() {
  if (expiryNotificationSent) {
    return;
  }

  expiryNotificationSent = true;
  restorePromise = undefined;
  await storeAuthSession(undefined);
  expiryListeners.forEach((listener) => listener());
}

export function subscribeToAuthSessionExpiry(listener: () => void) {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

async function restoreAuthSession() {
  const rawSession = await AsyncStorage.getItem(storageKey);
  const session = rawSession ? (JSON.parse(rawSession) as AuthSession) : undefined;

  if (!session) {
    await storeAuthSession(undefined);
    return undefined;
  }
  if (isSessionExpired(session)) {
    await expireAuthSession();
    return undefined;
  }

  cachedSession = session;
  return session;
}

function isSessionExpired(session: AuthSession) {
  return new Date(session.expiresAt).getTime() <= Date.now();
}
