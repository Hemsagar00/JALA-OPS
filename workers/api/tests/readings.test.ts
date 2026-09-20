import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../src/auth/password';
import { createSession } from '../src/auth/session';
import type { StationReading, StationReadingDetail, PhotoUploadResponse } from '@jala-ops/types';

let runtime: Miniflare;
let db: D1Database;
let adminToken: string;
let operatorToken: string;
let collectorToken: string;

async function applySql(path: string) {
  const statements = readFileSync(path, 'utf8')
    .replace(/^--.*$/gm, '')
    .trim()
    .split(/;\s*(?:\r?\n|$)/)
    .filter((sql) => sql.trim());
  await db.batch(statements.map((sql) => db.prepare(sql)));
}

const request = (
  path: string,
  token?: string,
  extra: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) => {
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra.body ? { 'Content-Type': 'application/json' } : {}),
    ...extra.headers,
  };
  return runtime.dispatchFetch(`http://localhost${path}`, {
    method: extra.method ?? (extra.body ? 'POST' : 'GET'),
    headers,
    body: extra.body ? JSON.stringify(extra.body) : undefined,
  });
};

beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      name: 'readings-test',
      modules: true,
      scriptPath: resolve('.artifacts/api/index.js'),
      compatibilityDate: '2026-09-20',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      r2Buckets: ['PHOTOS'],
      bindings: { APP_ENV: 'test', ALLOWED_ORIGINS: 'http://localhost:5173' },
    }),
  );
  db = (await runtime.getD1Database('DB')) as unknown as D1Database;
  await applySql('database/migrations/0001_foundation.sql');
  await applySql('database/migrations/0002_pump_operations.sql');
  await applySql('database/migrations/0003_station_readings.sql');
  await applySql('database/seed/development.sql');

  const hashedAdminPass = await hashPassword('AdminPass123!');
  const hashedOperatorPass = await hashPassword('OperatorPass123!');
  const hashedCollectorPass = await hashPassword('CollectorPass123!');

  await db
    .prepare("UPDATE users SET active = 1, password_hash = ? WHERE id = 'demo-admin'")
    .bind(hashedAdminPass)
    .run();
  await db
    .prepare("UPDATE users SET active = 1, password_hash = ? WHERE id = 'demo-operator'")
    .bind(hashedOperatorPass)
    .run();
  await db
    .prepare("UPDATE users SET active = 1, password_hash = ? WHERE id = 'demo-collector'")
    .bind(hashedCollectorPass)
    .run();

  adminToken = (await createSession(db, 'demo-admin', 'test-req-admin')).token;
  operatorToken = (await createSession(db, 'demo-operator', 'test-req-operator')).token;
  collectorToken = (await createSession(db, 'demo-collector', 'test-req-collector')).token;
});

afterAll(async () => {
  await runtime.dispose();
});

describe('Photo Upload & Retrieval Pipeline', () => {
  it('rejects unauthenticated upload', async () => {
    const res = await runtime.dispatchFetch('http://localhost/api/photos', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Station-Id': 'st-puttaparthi',
      },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unsupported MIME type', async () => {
    const res = await runtime.dispatchFetch('http://localhost/api/photos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/pdf',
        'X-Station-Id': 'st-puttaparthi',
      },
      body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects oversized file', async () => {
    // 11 MB dummy buffer
    const largeData = new Uint8Array(11 * 1024 * 1024);
    const res = await runtime.dispatchFetch('http://localhost/api/photos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'image/jpeg',
        'X-Station-Id': 'st-puttaparthi',
      },
      body: largeData,
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects upload for unauthorized station', async () => {
    const res = await runtime.dispatchFetch('http://localhost/api/photos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'image/jpeg',
        'X-Station-Id': 'st-dharmavaram', // not assigned to operator
      },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    });
    expect(res.status).toBe(403);
  });

  it('uploads valid JPEG and allows authenticated retrieval', async () => {
    const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const uploadRes = await runtime.dispatchFetch('http://localhost/api/photos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'image/jpeg',
        'X-Station-Id': 'st-puttaparthi',
      },
      body: dummyJpeg,
    });
    expect(uploadRes.status).toBe(201);
    const uploadBody = (await uploadRes.json()) as PhotoUploadResponse;
    expect(uploadBody.photoKey).toMatch(/^readings\/st-puttaparthi\/\d{4}\/\d{2}\/.+\.jpg$/);

    // Retrieve photo
    const getRes = await runtime.dispatchFetch(
      `http://localhost/api/photos/${encodeURIComponent(uploadBody.photoKey)}`,
      {
        headers: {
          Authorization: `Bearer ${operatorToken}`,
        },
      },
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('Content-Type')).toBe('image/jpeg');
    const bytes = new Uint8Array(await getRes.arrayBuffer());
    expect(bytes.length).toBe(dummyJpeg.length);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });
});

describe('Station Readings API', () => {
  it('creates valid reading and returns correct structure', async () => {
    const clientUuid = crypto.randomUUID();
    const res = await request('/api/readings', operatorToken, {
      body: {
        clientUuid,
        stationId: 'st-puttaparthi',
        pumpId: 'pump-ptp-1',
        flowMeter: 125430.5,
        energyMeter: 84320.0,
        inletPressure: 2.1,
        outletPressure: 6.5,
        tankLevelPct: 82.5,
        residualChlorine: 0.5,
        turbidity: 1.1,
        remarks: 'Normal morning shift reading',
        latitude: 14.168,
        longitude: 77.812,
        gpsAccuracyM: 12.0,
        gpsStatus: 'CAPTURED',
        sourceType: 'MANUAL',
        syncSource: 'ONLINE',
      },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { reading: StationReading };
    expect(body.reading).toBeDefined();
    expect(body.reading.clientUuid).toBe(clientUuid);
    expect(body.reading.stationId).toBe('st-puttaparthi');
    expect(body.reading.flowMeter).toBe(125430.5);
    expect(body.reading.tankLevelPct).toBe(82.5);
    expect(body.reading.gpsStatus).toBe('CAPTURED');
  });

  it('rejects unauthorized station reading for operator', async () => {
    const res = await request('/api/readings', operatorToken, {
      body: {
        clientUuid: crypto.randomUUID(),
        stationId: 'st-dharmavaram',
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1,
        outletPressure: 2,
        tankLevelPct: 50,
        gpsStatus: 'NOT_AVAILABLE',
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects pump that does not belong to station', async () => {
    const res = await request('/api/readings', adminToken, {
      body: {
        clientUuid: crypto.randomUUID(),
        stationId: 'st-puttaparthi',
        pumpId: 'pump-dmm-1', // belongs to st-dharmavaram
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1,
        outletPressure: 2,
        tankLevelPct: 50,
        gpsStatus: 'NOT_AVAILABLE',
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INVALID_STATION_PUMP');
  });

  it('rejects invalid tank level percentage', async () => {
    const res = await request('/api/readings', operatorToken, {
      body: {
        clientUuid: crypto.randomUUID(),
        stationId: 'st-puttaparthi',
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1,
        outletPressure: 2,
        tankLevelPct: 150, // exceeds 100
        gpsStatus: 'NOT_AVAILABLE',
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid GPS coordinates', async () => {
    const res = await request('/api/readings', operatorToken, {
      body: {
        clientUuid: crypto.randomUUID(),
        stationId: 'st-puttaparthi',
        flowMeter: 100,
        energyMeter: 200,
        inletPressure: 1,
        outletPressure: 2,
        tankLevelPct: 50,
        latitude: 95.0, // > 90
        longitude: 77.0,
        gpsStatus: 'CAPTURED',
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows reading submission when GPS is unavailable (non-blocking policy)', async () => {
    const clientUuid = crypto.randomUUID();
    const res = await request('/api/readings', operatorToken, {
      body: {
        clientUuid,
        stationId: 'st-puttaparthi',
        flowMeter: 126000,
        energyMeter: 85000,
        inletPressure: 2.0,
        outletPressure: 5.5,
        tankLevelPct: 65,
        gpsStatus: 'PERMISSION_DENIED',
        latitude: null,
        longitude: null,
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { reading: StationReading };
    expect(body.reading.gpsStatus).toBe('PERMISSION_DENIED');
    expect(body.reading.latitude).toBeNull();
  });

  it('idempotently replays reading when client_uuid is submitted again', async () => {
    const clientUuid = crypto.randomUUID();
    const payload = {
      clientUuid,
      stationId: 'st-puttaparthi',
      flowMeter: 127000,
      energyMeter: 86000,
      inletPressure: 2.2,
      outletPressure: 6.0,
      tankLevelPct: 75,
      gpsStatus: 'NOT_AVAILABLE',
    };

    // First submission
    const res1 = await request('/api/readings', operatorToken, { body: payload });
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { reading: StationReading };

    // Duplicate submission
    const res2 = await request('/api/readings', operatorToken, { body: payload });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { reading: StationReading; idempotent?: boolean };
    expect(body2.idempotent).toBe(true);
    expect(body2.reading.id).toBe(body1.reading.id);

    // Verify only one row exists in station_readings for this client_uuid
    const dbRows = await db
      .prepare('SELECT count(*) as count FROM station_readings WHERE client_uuid = ?')
      .bind(clientUuid)
      .first<{ count: number }>();
    expect(dbRows?.count).toBe(1);

    // Verify only one audit log entry for this client_uuid
    const auditRows = await db
      .prepare(
        "SELECT count(*) as count FROM audit_logs WHERE entity_id = ? AND action = 'CREATE_READING'",
      )
      .bind(body1.reading.id)
      .first<{ count: number }>();
    expect(auditRows?.count).toBe(1);
  });

  it('lists readings with filters and cursor', async () => {
    const res = await request('/api/readings?stationId=st-puttaparthi&limit=10', operatorToken);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { readings: StationReadingDetail[] };
    expect(body.readings).toBeDefined();
    expect(Array.isArray(body.readings)).toBe(true);
    expect(body.readings.length).toBeGreaterThan(0);
    for (const r of body.readings) {
      expect(r.stationId).toBe('st-puttaparthi');
    }
  });

  it('allows collector to read all readings across stations', async () => {
    const res = await request('/api/readings?limit=20', collectorToken);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { readings: StationReadingDetail[] };
    expect(Array.isArray(body.readings)).toBe(true);
  });

  it('denies operator cross-station reading detail access', async () => {
    // Insert a reading for st-dharmavaram by admin
    const clientUuid = crypto.randomUUID();
    const createRes = await request('/api/readings', adminToken, {
      body: {
        clientUuid,
        stationId: 'st-dharmavaram',
        flowMeter: 5000,
        energyMeter: 10000,
        inletPressure: 1.5,
        outletPressure: 4.5,
        tankLevelPct: 90,
        gpsStatus: 'NOT_AVAILABLE',
      },
    });
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as { reading: StationReading };
    const readingId = createBody.reading.id;

    // Operator attempts to fetch reading for st-dharmavaram (operator is only assigned to st-puttaparthi)
    const opRes = await request(`/api/readings/${readingId}`, operatorToken);
    expect(opRes.status).toBe(403);

    // Collector can fetch it
    const colRes = await request(`/api/readings/${readingId}`, collectorToken);
    expect(colRes.status).toBe(200);
    const colBody = (await colRes.json()) as { reading: StationReadingDetail };
    expect(colBody.reading.id).toBe(readingId);
  });
});
