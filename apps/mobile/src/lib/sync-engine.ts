import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { getPendingQueue, updateQueueStatus, getPendingCount } from './offline-db';
import { createApiClient } from '@jala-ops/api-client';
import { API_URL, getStoredToken } from './session';
import type { CreateReadingPayload } from '@jala-ops/types';

export type SyncState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'PENDING' | 'SYNCED' | 'ERROR';

type SyncListener = (state: {
  status: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
}) => void;

let isSyncing = false;
let currentStatus: SyncState = 'ONLINE';
let lastSyncedAt: string | null = null;
const listeners = new Set<SyncListener>();

function notifyListeners(pendingCount: number) {
  for (const listener of listeners) {
    listener({
      status: currentStatus,
      pendingCount,
      lastSyncedAt,
    });
  }
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  getPendingCount().then((count) => {
    listener({ status: currentStatus, pendingCount: count, lastSyncedAt });
  });
  return () => {
    listeners.delete(listener);
  };
}

export async function processQueue(token?: string | null): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (isSyncing) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const items = await getPendingQueue();
  if (items.length === 0) {
    currentStatus = 'SYNCED';
    notifyListeners(0);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  isSyncing = true;
  currentStatus = 'SYNCING';
  notifyListeners(items.length);

  const activeToken = token ?? (await getStoredToken());
  const client = createApiClient(API_URL, { token: activeToken ?? undefined });
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await updateQueueStatus(item.id, 'SYNCING');

      const payload: CreateReadingPayload = JSON.parse(item.payload_json);

      // If item has local photo and no photoKey yet, upload photo first
      if (item.local_photo_uri && !payload.photoKey) {
        try {
          const fileResp = await fetch(item.local_photo_uri);
          const blob = await fileResp.blob();
          const photoUpload = await client.uploadPhoto(payload.stationId, blob);
          payload.photoKey = photoUpload.photoKey;
          await updateQueueStatus(item.id, 'SYNCING', {
            updatedPayload: payload as unknown as Record<string, unknown>,
          });
        } catch (photoErr: unknown) {
          // Photo upload failure should not permanently block reading if optional,
          // but if network failed, mark retryable
          const isNetError =
            photoErr instanceof Error &&
            (photoErr.message.includes('Network') ||
              photoErr.message.includes('Failed to fetch') ||
              photoErr.message.includes('50'));
          if (isNetError) {
            throw photoErr;
          }
          console.warn('Optional photo upload skipped due to error:', photoErr);
        }
      }

      // Ensure syncSource is marked OFFLINE_QUEUE
      payload.syncSource = 'OFFLINE_QUEUE';

      // Submit reading using authoritative client
      await client.createReading(payload);

      const now = new Date().toISOString();
      await updateQueueStatus(item.id, 'SYNCED', { syncedAt: now });
      lastSyncedAt = now;
      succeeded++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      const isPermanent =
        msg.includes('VALIDATION_ERROR') ||
        msg.includes('FORBIDDEN') ||
        msg.includes('INVALID_STATION_PUMP') ||
        msg.includes('400') ||
        msg.includes('403');

      if (isPermanent) {
        await updateQueueStatus(item.id, 'FAILED_PERMANENT', { lastError: msg });
      } else {
        await updateQueueStatus(item.id, 'FAILED_RETRYABLE', {
          lastError: msg,
          incrementRetry: true,
        });
      }
    }
  }

  isSyncing = false;
  const remaining = await getPendingCount();
  if (remaining > 0) {
    currentStatus = failed > 0 ? 'ERROR' : 'PENDING';
  } else {
    currentStatus = 'SYNCED';
  }
  notifyListeners(remaining);

  return { processed: items.length, succeeded, failed };
}

let syncInitialized = false;

export function initSyncEngine(getToken?: () => string | null | undefined) {
  if (syncInitialized) return;
  syncInitialized = true;

  // Listen for network connectivity change
  NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (isOnline) {
      currentStatus = 'ONLINE';
      processQueue(getToken ? getToken() : undefined).catch(console.error);
    } else {
      currentStatus = 'OFFLINE';
      getPendingCount().then((count) => notifyListeners(count));
    }
  });

  // Listen for app coming to foreground
  AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      processQueue(getToken ? getToken() : undefined).catch(console.error);
    }
  });

  // Initial trigger
  processQueue(getToken ? getToken() : undefined).catch(console.error);
}
