import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AuthSession } from "../types/domain";

const storageKey = "secureobs.authSession.v1";
let cachedSession: AuthSession | undefined;
let restorePromise: Promise<AuthSession | undefined> | undefined;

export async function storeAuthSession(session: AuthSession | undefined) {
  cachedSession = session;
  if (!session) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }

  await AsyncStorage.setItem(storageKey, JSON.stringify(session));
}

export async function getAuthSession() {
  if (cachedSession && !isSessionExpired(cachedSession)) {
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

async function restoreAuthSession() {
  const rawSession = await AsyncStorage.getItem(storageKey);
  const session = rawSession ? (JSON.parse(rawSession) as AuthSession) : undefined;

  if (!session || isSessionExpired(session)) {
    await storeAuthSession(undefined);
    return undefined;
  }

  cachedSession = session;
  return session;
}

function isSessionExpired(session: AuthSession) {
  return new Date(session.expiresAt).getTime() <= Date.now();
}
