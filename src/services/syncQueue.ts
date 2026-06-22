export type SyncQueueState = {
  pendingCount: number;
  isSyncing: boolean;
  lastError?: string;
  lastSyncedAt?: string;
};

type SyncQueueItem = {
  id: string;
  label: string;
  createdAt: string;
  attempts: number;
  run: () => Promise<unknown>;
  lastError?: string;
};

type SyncQueueListener = (state: SyncQueueState) => void;

const queue: SyncQueueItem[] = [];
const listeners = new Set<SyncQueueListener>();
let isSyncing = false;
let lastError: string | undefined;
let lastSyncedAt: string | undefined;

export function subscribeToSyncQueue(listener: SyncQueueListener) {
  listeners.add(listener);
  listener(getSyncQueueState());

  return () => {
    listeners.delete(listener);
  };
}

export function getSyncQueueState(): SyncQueueState {
  return {
    pendingCount: queue.length,
    isSyncing,
    lastError,
    lastSyncedAt
  };
}

export function enqueueFailedSave(label: string, run: () => Promise<unknown>, error: unknown) {
  queue.push({
    id: `sync-${Date.now()}-${queue.length}`,
    label,
    createdAt: new Date().toISOString(),
    attempts: 0,
    run,
    lastError: toErrorMessage(error)
  });
  lastError = `${label}: ${toErrorMessage(error)}`;
  notify();
}

export async function flushSyncQueue() {
  if (isSyncing || queue.length === 0) {
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
        await item.run();
        queue.shift();
        lastError = undefined;
        lastSyncedAt = new Date().toISOString();
        notify();
      } catch (error) {
        item.lastError = toErrorMessage(error);
        lastError = `${item.label}: ${item.lastError}`;
        break;
      }
    }
  } finally {
    isSyncing = false;
    notify();
  }
}

function notify() {
  const state = getSyncQueueState();
  listeners.forEach((listener) => listener(state));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to reach backend";
}
