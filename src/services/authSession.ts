import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AuthSession } from "../types/domain";

const storageKey = "secureobs.authSession.v1";
let cachedSession: AuthSession | undefined;
let restorePromise: Promise<AuthSession | undefined> | undefined;
let expiryNotificationSent = false;
let sessionGeneration = 0;
let storageMutation = Promise.resolve();
const expiryListeners = new Set<() => void>();

export async function storeAuthSession(session: AuthSession | undefined) {
  const generation = ++sessionGeneration;
  cachedSession = session;
  restorePromise = session ? Promise.resolve(session) : undefined;

  if (session) {
    expiryNotificationSent = false;
  }

  storageMutation = storageMutation.then(async () => {
    if (generation !== sessionGeneration) {
      return;
    }
    if (!session) {
      await AsyncStorage.removeItem(storageKey);
      return;
    }
    await AsyncStorage.setItem(storageKey, JSON.stringify(session));
  });
  await storageMutation;
}

export async function getAuthSession() {
  if (cachedSession) {
    if (isSessionExpired(cachedSession)) {
      await expireAuthSession(cachedSession.token);
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
  await storeAuthSession(undefined);
}

export async function expireAuthSession(expectedToken?: string) {
  if (expectedToken && cachedSession?.token !== expectedToken) {
    return false;
  }
  if (expiryNotificationSent) {
    return false;
  }

  expiryNotificationSent = true;
  await storeAuthSession(undefined);
  expiryListeners.forEach((listener) => listener());
  return true;
}

export function subscribeToAuthSessionExpiry(listener: () => void) {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

async function restoreAuthSession() {
  const restoreGeneration = sessionGeneration;
  const rawSession = await AsyncStorage.getItem(storageKey);
  if (restoreGeneration !== sessionGeneration) {
    return cachedSession;
  }
  const session = rawSession ? (JSON.parse(rawSession) as AuthSession) : undefined;

  if (!session) {
    cachedSession = undefined;
    restorePromise = undefined;
    return undefined;
  }
  if (isSessionExpired(session)) {
    await expireAuthSession();
    return undefined;
  }

  cachedSession = session;
  expiryNotificationSent = false;
  restorePromise = Promise.resolve(session);
  return session;
}

function isSessionExpired(session: AuthSession) {
  const expiresAt = new Date(session.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}
