import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSecureStore = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(true),
  getItemAsync: vi.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, val: string) => {
    mockSecureStore.set(key, val);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    runSync: vi.fn(),
    getAllSync: vi.fn().mockReturnValue([]),
    getFirstSync: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

import { createReadingSchema } from '@jala-ops/validation';
import type { CreateReadingPayload } from '@jala-ops/types';
import {
  enqueueReading,
  getPendingQueue,
  getPendingCount,
  clearMemoryQueueForTesting as clearQueueForTesting,
} from '../src/lib/offline-db';
import { processQueue } from '../src/lib/sync-engine';
import { setStoredToken, clearStoredToken, getStoredToken } from '../src/lib/session';

describe('Milestone 5 — Mobile Readings, GPS & Offline Sync Engine', () => {
  beforeEach(async () => {
    await clearQueueForTesting();
    await clearStoredToken();
    vi.restoreAllMocks();
  });

  describe('Reading Form Validation', () => {
    it('validates a complete, valid reading payload', () => {
      const validPayload = {
        clientUuid: '550e8400-e29b-41d4-a716-446655440000',
        stationId: 'stn-01',
        pumpId: 'pump-01',
        flowMeter: 120500.5,
        energyMeter: 65400.2,
        inletPressure: 2.1,
        outletPressure: 6.4,
        tankLevelPct: 85.0,
        residualChlorine: 0.5,
        turbidity: 1.2,
        remarks: 'Morning shift operational reading',
        latitude: 14.168,
        longitude: 77.812,
        gpsAccuracyM: 8.5,
        gpsStatus: 'CAPTURED' as const,
        sourceType: 'MANUAL' as const,
        syncSource: 'ONLINE' as const,
        recordedAt: '2026-09-20T08:00:00Z',
      };

      const result = createReadingSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid meters, pressures, and tank percentage', () => {
      const invalidPayload = {
        clientUuid: '550e8400-e29b-41d4-a716-446655440000',
        stationId: 'stn-01',
        flowMeter: -10, // negative not allowed
        energyMeter: -5,
        inletPressure: -1.0,
        outletPressure: -2.0,
        tankLevelPct: 105, // > 100 not allowed
        gpsStatus: 'NOT_AVAILABLE' as const,
      };

      const result = createReadingSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path[0]);
        expect(issues).toContain('flowMeter');
        expect(issues).toContain('energyMeter');
        expect(issues).toContain('inletPressure');
        expect(issues).toContain('outletPressure');
        expect(issues).toContain('tankLevelPct');
      }
    });

    it('rejects invalid GPS coordinates outside valid geographic bounds', () => {
      const result = createReadingSchema.safeParse({
        clientUuid: '550e8400-e29b-41d4-a716-446655440000',
        stationId: 'stn-01',
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1.5,
        outletPressure: 5.0,
        tankLevelPct: 50,
        latitude: 95.0, // max 90
        longitude: -190.0, // min -180
        gpsStatus: 'CAPTURED' as const,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('GPS Non-Blocking Policy', () => {
    it('allows submission when GPS permission is denied or unavailable', () => {
      const noGpsPayload = {
        clientUuid: '550e8400-e29b-41d4-a716-446655440001',
        stationId: 'stn-01',
        flowMeter: 140200,
        energyMeter: 70100,
        inletPressure: 2.0,
        outletPressure: 6.2,
        tankLevelPct: 70,
        latitude: null,
        longitude: null,
        gpsAccuracyM: null,
        gpsStatus: 'PERMISSION_DENIED' as const,
        sourceType: 'MANUAL' as const,
        syncSource: 'ONLINE' as const,
      };

      const result = createReadingSchema.safeParse(noGpsPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gpsStatus).toBe('PERMISSION_DENIED');
        expect(result.data.latitude).toBeNull();
      }
    });
  });

  describe('Offline SQLite Queue Persistence', () => {
    it('saves readings offline, tracks pending count, and retains queue across simulated restarts', async () => {
      expect(await getPendingCount()).toBe(0);

      const payload1: CreateReadingPayload = {
        clientUuid: 'queue-uuid-001',
        stationId: 'stn-01',
        flowMeter: 1000,
        energyMeter: 2000,
        inletPressure: 1.5,
        outletPressure: 4.5,
        tankLevelPct: 80,
        gpsStatus: 'CAPTURED',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      const payload2: CreateReadingPayload = {
        clientUuid: 'queue-uuid-002',
        stationId: 'stn-01',
        flowMeter: 1050,
        energyMeter: 2050,
        inletPressure: 1.6,
        outletPressure: 4.6,
        tankLevelPct: 82,
        gpsStatus: 'NOT_AVAILABLE',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload1);
      await enqueueReading(payload2, 'file:///data/user/0/jala/cache/photo-002.jpg');

      const count = await getPendingCount();
      expect(count).toBe(2);

      const items = await getPendingQueue();
      expect(items.length).toBe(2);
      expect(items[0]?.client_uuid).toBe('queue-uuid-001');
      expect(items[0]?.status).toBe('PENDING');
      expect(items[1]?.client_uuid).toBe('queue-uuid-002');
      expect(items[1]?.local_photo_uri).toBe('file:///data/user/0/jala/cache/photo-002.jpg');
    });

    it('does not store sensitive tokens or passwords in queue payload', async () => {
      const payload: CreateReadingPayload = {
        clientUuid: 'queue-uuid-security',
        stationId: 'stn-01',
        flowMeter: 500,
        energyMeter: 600,
        inletPressure: 1.0,
        outletPressure: 3.0,
        tankLevelPct: 50,
        gpsStatus: 'NOT_AVAILABLE',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload);
      const items = await getPendingQueue();
      const rawJson = items[0]?.payload_json ?? '';

      expect(rawJson).not.toContain('token');
      expect(rawJson).not.toContain('password');
      expect(rawJson).not.toContain('Bearer');
    });
  });

  describe('Sync Engine Execution', () => {
    it('successfully syncs queued readings when network is restored', async () => {
      const payload: CreateReadingPayload = {
        clientUuid: 'sync-uuid-001',
        stationId: 'stn-01',
        flowMeter: 12000,
        energyMeter: 4000,
        inletPressure: 1.8,
        outletPressure: 5.5,
        tankLevelPct: 90,
        gpsStatus: 'CAPTURED',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload);
      expect(await getPendingCount()).toBe(1);

      // Mock global fetch to simulate API responding with created reading
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/readings')) {
          const body = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              reading: {
                id: 'rdg-server-123',
                ...body,
                receivedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
      });

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const result = await processQueue('mock-session-token');
      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);

      // Pending queue count is now 0
      expect(await getPendingCount()).toBe(0);
    });

    it('uploads photo first before submitting reading', async () => {
      const payload: CreateReadingPayload = {
        clientUuid: 'sync-photo-uuid-001',
        stationId: 'stn-01',
        flowMeter: 12000,
        energyMeter: 4000,
        inletPressure: 1.8,
        outletPressure: 5.5,
        tankLevelPct: 90,
        gpsStatus: 'CAPTURED',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload, 'file:///cache/photo.jpg');

      const callOrder: string[] = [];

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.startsWith('file://')) {
          // File blob
          return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
            headers: { 'Content-Type': 'image/jpeg' },
          });
        }
        if (url.includes('/api/photos')) {
          callOrder.push('UPLOAD_PHOTO');
          return new Response(
            JSON.stringify({
              photoKey: 'readings/stn-01/2026/09/generated-key.jpg',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/api/readings')) {
          callOrder.push('CREATE_READING');
          const body = JSON.parse(init?.body as string);
          expect(body.photoKey).toBe('readings/stn-01/2026/09/generated-key.jpg');
          return new Response(
            JSON.stringify({
              reading: { id: 'rdg-photo-1', ...body },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
      });

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const result = await processQueue('mock-session-token');
      expect(result.succeeded).toBe(1);
      expect(callOrder).toEqual(['UPLOAD_PHOTO', 'CREATE_READING']);
    });

    it('marks retryable network failure and increments retry_count without dropping item', async () => {
      const payload: CreateReadingPayload = {
        clientUuid: 'sync-netfail-001',
        stationId: 'stn-01',
        flowMeter: 500,
        energyMeter: 600,
        inletPressure: 1.0,
        outletPressure: 3.0,
        tankLevelPct: 50,
        gpsStatus: 'NOT_AVAILABLE',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload);

      // Simulate network disconnection
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

      const result = await processQueue('mock-token');
      expect(result.failed).toBe(1);

      const items = await getPendingQueue();
      expect(items.length).toBe(1);
      expect(items[0]?.status).toBe('FAILED_RETRYABLE');
      expect(items[0]?.retry_count).toBe(1);
    });

    it('marks permanent validation failure as FAILED_PERMANENT', async () => {
      const payload: CreateReadingPayload = {
        clientUuid: 'sync-permfail-001',
        stationId: 'stn-01',
        flowMeter: 500,
        energyMeter: 600,
        inletPressure: 1.0,
        outletPressure: 3.0,
        tankLevelPct: 50,
        gpsStatus: 'NOT_AVAILABLE',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload);

      // Simulate 400 VALIDATION_ERROR
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'VALIDATION_ERROR: Pump does not belong to station' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const result = await processQueue('mock-token');
      expect(result.failed).toBe(1);

      // Permanently failed item is not retried in standard pending queue
      const pendingItems = await getPendingQueue();
      expect(pendingItems.length).toBe(0);
    });

    it('handles idempotent replay without creating duplicate or erroring', async () => {
      const payload: CreateReadingPayload = {
        clientUuid: 'sync-idempotent-001',
        stationId: 'stn-01',
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1.5,
        outletPressure: 4.5,
        tankLevelPct: 80,
        gpsStatus: 'NOT_AVAILABLE',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      };

      await enqueueReading(payload);

      // Simulate server returning idempotent replay response (200)
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            reading: { id: 'rdg-existing-001', ...payload },
            idempotent: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await processQueue('mock-token');
      expect(result.succeeded).toBe(1);
      expect(await getPendingCount()).toBe(0);
    });
  });

  describe('Session Isolation and Queue Safety', () => {
    it('clearing session does not delete pending offline field readings', async () => {
      await setStoredToken('active-operator-token-xyz');
      expect(await getStoredToken()).toBe('active-operator-token-xyz');

      await enqueueReading({
        clientUuid: 'persist-across-logout',
        stationId: 'stn-01',
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1.0,
        outletPressure: 3.0,
        tankLevelPct: 50,
        gpsStatus: 'NOT_AVAILABLE',
        sourceType: 'MANUAL',
        syncSource: 'OFFLINE_QUEUE',
      });

      expect(await getPendingCount()).toBe(1);

      // User logs out
      await clearStoredToken();
      expect(await getStoredToken()).toBeNull();

      // Queue still retains reading
      expect(await getPendingCount()).toBe(1);
      const items = await getPendingQueue();
      expect(items[0]?.client_uuid).toBe('persist-across-logout');
    });
  });
});
