import AsyncStorage from "@react-native-async-storage/async-storage";

const storageKey = "secureobs.syncQueue.v1";

export type SyncQueueState = {
  pendingCount: number;
  isReady: boolean;
  isSyncing: boolean;
  lastError?: string;
  lastSyncedAt?: string;
  items: SyncQueueStateItem[];
  oldestItem?: SyncQueueStateItem;
};

export type SyncQueueStateItem = {
  id: string;
  label: string;
  path: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  needsReview?: boolean;
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
  needsReview?: boolean;
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
  const items = queue.map(toStateItem);
  const oldest = items[0];

  return {
    pendingCount: queue.length,
    isReady,
    isSyncing,
    lastError,
    lastSyncedAt,
    items,
    oldestItem: oldest
  };
}

function toStateItem(item: SyncQueueItem): SyncQueueStateItem {
  return {
    id: item.id,
    label: item.label,
    path: item.path,
    createdAt: item.createdAt,
    attempts: item.attempts,
    lastError: item.lastError,
    needsReview: item.needsReview
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

export async function flushSyncQueue(options: { includeNeedsReview?: boolean } = {}) {
  await restoreSyncQueue();

  if (isSyncing || queue.length === 0 || !requestRunner) {
    return;
  }

  isSyncing = true;
  notify();

  let failedCount = 0;

  try {
    const itemIds = queue.map((item) => item.id);

    for (const itemId of itemIds) {
      const item = queue.find((queuedItem) => queuedItem.id === itemId);
      if (!item) continue;
      if (item.needsReview && !options.includeNeedsReview) {
        failedCount += 1;
        continue;
      }

      try {
        item.attempts += 1;
        await persistQueue();
        await requestRunner(item.path, item.init);
        const itemIndex = queue.findIndex((queuedItem) => queuedItem.id === item.id);
        if (itemIndex !== -1) {
          queue.splice(itemIndex, 1);
        }
        lastSyncedAt = new Date().toISOString();
        await persistQueue();
        notify();
      } catch (error) {
        failedCount += 1;
        item.lastError = toErrorMessage(error);
        item.needsReview = isPermanentUploadError(error);
        lastError = `${item.label}: ${item.lastError}`;
        await persistQueue();
        notify();
      }
    }

    if (queue.length === 0) {
      lastError = undefined;
    } else if (queue.some((item) => item.needsReview)) {
      const reviewCount = queue.filter((item) => item.needsReview).length;
      lastError = `${reviewCount} upload${reviewCount === 1 ? "" : "s"} need review before retry`;
    } else if (failedCount > 1) {
      lastError = `${failedCount} uploads still need attention`;
    }
  } finally {
    isSyncing = false;
    notify();
  }
}

export async function removeSyncQueueItem(itemId: string) {
  await restoreSyncQueue();
  const itemIndex = queue.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    return;
  }

  queue.splice(itemIndex, 1);
  if (queue.length === 0) {
    lastError = undefined;
  }
  await persistQueue();
  notify();
}

export async function removeSyncQueueItemsNeedingReview() {
  await restoreSyncQueue();
  const nextQueue = queue.filter((item) => !item.needsReview);
  if (nextQueue.length === queue.length) {
    return 0;
  }

  const removedCount = queue.length - nextQueue.length;
  queue.splice(0, queue.length, ...nextQueue);
  if (queue.length === 0) {
    lastError = undefined;
  } else {
    lastError = `${queue.length} uploads still need attention`;
  }
  await persistQueue();
  notify();
  return removedCount;
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

function isPermanentUploadError(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
  if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
    return true;
  }

  const message = toErrorMessage(error).toLowerCase();
  return message.includes("parse error") || message.includes("invalid input syntax");
}
