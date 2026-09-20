import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import type { CreateReadingPayload } from '@jala-ops/types';

export type QueueStatus =
  'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED_RETRYABLE' | 'FAILED_PERMANENT';

export interface QueueItem {
  id: string;
  client_uuid: string;
  entity_type: string;
  endpoint: string;
  method: string;
  payload_json: string;
  local_photo_uri: string | null;
  status: QueueStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

let dbInstance: SQLiteDatabase | null = null;

// In-memory fallback for environments where native SQLite is unavailable (e.g. Node tests / web without OPFS)
const memoryQueue = new Map<string, QueueItem>();

export function getDatabase(): SQLiteDatabase | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!dbInstance) {
    try {
      dbInstance = openDatabaseSync('jala_ops.db');
      dbInstance.execSync(`
        CREATE TABLE IF NOT EXISTS offline_queue (
          id TEXT PRIMARY KEY,
          client_uuid TEXT NOT NULL UNIQUE,
          entity_type TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          local_photo_uri TEXT,
          status TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
        CREATE INDEX IF NOT EXISTS idx_offline_queue_client_uuid ON offline_queue(client_uuid);
      `);
    } catch {
      // Fall back to in-memory store if native DB fails to initialize
      return null;
    }
  }
  return dbInstance;
}

export async function enqueueReading(
  payload: CreateReadingPayload,
  localPhotoUri?: string | null,
): Promise<QueueItem> {
  const db = getDatabase();
  const id = 'q_' + crypto.randomUUID();
  const now = new Date().toISOString();
  const item: QueueItem = {
    id,
    client_uuid: payload.clientUuid,
    entity_type: 'STATION_READING',
    endpoint: '/api/readings',
    method: 'POST',
    payload_json: JSON.stringify(payload),
    local_photo_uri: localPhotoUri ?? null,
    status: 'PENDING',
    retry_count: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
    synced_at: null,
  };

  if (db) {
    db.runSync(
      `INSERT OR REPLACE INTO offline_queue (
        id, client_uuid, entity_type, endpoint, method,
        payload_json, local_photo_uri, status, retry_count,
        last_error, created_at, updated_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.client_uuid,
        item.entity_type,
        item.endpoint,
        item.method,
        item.payload_json,
        item.local_photo_uri,
        item.status,
        item.retry_count,
        item.last_error,
        item.created_at,
        item.updated_at,
        item.synced_at,
      ],
    );
  } else {
    memoryQueue.set(item.client_uuid, item);
  }

  return item;
}

export async function getPendingQueue(): Promise<QueueItem[]> {
  const db = getDatabase();
  if (db) {
    const rows = db.getAllSync<QueueItem>(
      `SELECT * FROM offline_queue
       WHERE status IN ('PENDING', 'FAILED_RETRYABLE')
       ORDER BY created_at ASC`,
    );
    return rows;
  }

  return Array.from(memoryQueue.values())
    .filter((i) => i.status === 'PENDING' || i.status === 'FAILED_RETRYABLE')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getPendingCount(): Promise<number> {
  const db = getDatabase();
  if (db) {
    const row = db.getFirstSync<{ count: number }>(
      `SELECT count(*) as count FROM offline_queue WHERE status IN ('PENDING', 'FAILED_RETRYABLE')`,
    );
    return row?.count ?? 0;
  }

  return Array.from(memoryQueue.values()).filter(
    (i) => i.status === 'PENDING' || i.status === 'FAILED_RETRYABLE',
  ).length;
}

export async function updateQueueStatus(
  id: string,
  status: QueueStatus,
  options?: {
    lastError?: string | null;
    incrementRetry?: boolean;
    syncedAt?: string | null;
    updatedPayload?: Record<string, unknown>;
  },
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  if (db) {
    let query = `UPDATE offline_queue SET status = ?, updated_at = ?`;
    const params: (string | number | null)[] = [status, now];

    if (options?.lastError !== undefined) {
      query += `, last_error = ?`;
      params.push(options.lastError);
    }
    if (options?.incrementRetry) {
      query += `, retry_count = retry_count + 1`;
    }
    if (options?.syncedAt !== undefined) {
      query += `, synced_at = ?`;
      params.push(options.syncedAt);
    }
    if (options?.updatedPayload) {
      query += `, payload_json = ?`;
      params.push(JSON.stringify(options.updatedPayload));
    }

    query += ` WHERE id = ?`;
    params.push(id);

    db.runSync(query, params);
  } else {
    for (const [key, item] of memoryQueue.entries()) {
      if (item.id === id) {
        item.status = status;
        item.updated_at = now;
        if (options?.lastError !== undefined) item.last_error = options.lastError;
        if (options?.incrementRetry) item.retry_count += 1;
        if (options?.syncedAt !== undefined) item.synced_at = options.syncedAt;
        if (options?.updatedPayload) item.payload_json = JSON.stringify(options.updatedPayload);
        memoryQueue.set(key, item);
        break;
      }
    }
  }
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const db = getDatabase();
  if (db) {
    return db.getAllSync<QueueItem>(
      `SELECT * FROM offline_queue ORDER BY created_at DESC LIMIT 50`,
    );
  }
  return Array.from(memoryQueue.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function clearMemoryQueueForTesting() {
  memoryQueue.clear();
}
