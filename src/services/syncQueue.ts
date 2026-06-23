import AsyncStorage from "@react-native-async-storage/async-storage";

const storageKey = "secureobs.syncQueue.v1";

export type SyncQueueState = {
  pendingCount: number;
  isReady: boolean;
  isSyncing: boolean;
  lastError?: string;
  lastSyncedAt?: string;
  oldestItem?: {
    label: string;
    path: string;
    createdAt: string;
    attempts: number;
    lastError?: string;
  };
};

type SerializableRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type SyncQueueItem = {
  id: string;
  label: string;
  path: string;
  init?: SerializableRequestInit;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

type SyncQueueListener = (state: SyncQueueState) => void;
type RequestRunner = (path: string, init?: SerializableRequestInit) => Promise<unknown>;

export class QueuedSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueuedSyncError";
  }
}

const queue: SyncQueueItem[] = [];
const listeners = new Set<SyncQueueListener>();
let isReady = false;
let isSyncing = false;
let lastError: string | undefined;
let lastSyncedAt: string | undefined;
let requestRunner: RequestRunner | undefined;
let restorePromise: Promise<void> | undefined;

export function configureSyncQueue(runner: RequestRunner) {
  requestRunner = runner;
}

export function subscribeToSyncQueue(listener: SyncQueueListener) {
  listeners.add(listener);
  listener(getSyncQueueState());

  return () => {
    listeners.delete(listener);
  };
}

export function getSyncQueueState(): SyncQueueState {
  const oldest = queue[0];

  return {
    pendingCount: queue.length,
    isReady,
    isSyncing,
    lastError,
    lastSyncedAt,
    oldestItem: oldest
      ? {
          label: oldest.label,
          path: oldest.path,
          createdAt: oldest.createdAt,
          attempts: oldest.attempts,
          lastError: oldest.lastError
        }
      : undefined
  };
}

export function isQueuedSyncError(error: unknown) {
  return error instanceof QueuedSyncError;
}

export async function restoreSyncQueue() {
  if (restorePromise) {
    return restorePromise;
  }

  restorePromise = loadQueueFromStorage();
  return restorePromise;
}

export async function enqueueFailedRequest(label: string, path: string, init: RequestInit | undefined, error: unknown) {
  await restoreSyncQueue();

  queue.push({
    id: `sync-${Date.now()}-${queue.length}`,
    label,
    path,
    init: serialiseRequestInit(init),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: toErrorMessage(error)
  });
  lastError = `${label}: ${toErrorMessage(error)}`;
  await persistQueue();
  notify();
}

export async function flushSyncQueue() {
  await restoreSyncQueue();

  if (isSyncing || queue.length === 0 || !requestRunner) {
    return;
  }

  isSyncing = true;
  notify();

  try {
    while (queue.length > 0) {
      const item = queue[0];
      if (!item) {
        break;
      }

      try {
        item.attempts += 1;
        await persistQueue();
        await requestRunner(item.path, item.init);
        queue.shift();
        lastError = undefined;
        lastSyncedAt = new Date().toISOString();
        await persistQueue();
        notify();
      } catch (error) {
        item.lastError = toErrorMessage(error);
        lastError = `${item.label}: ${item.lastError}`;
        await persistQueue();
        break;
      }
    }
  } finally {
    isSyncing = false;
    notify();
  }
}

export async function clearSyncQueue() {
  await restoreSyncQueue();
  queue.splice(0, queue.length);
  lastError = undefined;
  await persistQueue();
  notify();
}

async function loadQueueFromStorage() {
  try {
    const rawQueue = await AsyncStorage.getItem(storageKey);
    const storedQueue = rawQueue ? (JSON.parse(rawQueue) as SyncQueueItem[]) : [];
    queue.splice(0, queue.length, ...storedQueue);
  } catch (error) {
    lastError = `offline queue: ${toErrorMessage(error)}`;
  } finally {
    isReady = true;
    notify();
  }
}

async function persistQueue() {
  await AsyncStorage.setItem(storageKey, JSON.stringify(queue));
}

function notify() {
  const state = getSyncQueueState();
  listeners.forEach((listener) => listener(state));
}

function serialiseRequestInit(init?: RequestInit): SerializableRequestInit | undefined {
  if (!init) {
    return undefined;
  }

  return {
    method: init.method,
    headers: normaliseHeaders(init.headers),
    body: typeof init.body === "string" ? init.body : undefined
  };
}

function normaliseHeaders(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to reach backend";
}
