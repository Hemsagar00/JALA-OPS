import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../src/auth/password';
import { createSession } from '../src/auth/session';

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
      name: 'pump-operations-test',
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
  await runtime?.dispose();
});

describe('Milestone 4: Pump Operations API', () => {
  let startTemplateItems: Array<{ id: string; required: boolean }>;
  let stopTemplateItems: Array<{ id: string; required: boolean }>;

  it('fetches active SOP templates with required items', async () => {
    const res = await request('/api/sop/templates', operatorToken);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      templates: Array<{ operationType: string; items: Array<{ id: string; required: boolean }> }>;
    };
    expect(data.templates.length).toBeGreaterThanOrEqual(2);

    const startTpl = data.templates.find((t) => t.operationType === 'START');
    const stopTpl = data.templates.find((t) => t.operationType === 'STOP');

    expect(startTpl).toBeDefined();
    expect(stopTpl).toBeDefined();
    expect(startTpl!.items.length).toBe(8);
    expect(stopTpl!.items.length).toBe(4);

    startTemplateItems = startTpl!.items;
    stopTemplateItems = stopTpl!.items;
  });

  describe('START PUMP (/api/operations/start)', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request('/api/operations/start', undefined, {
        body: { clientUuid: crypto.randomUUID() },
      });
      expect(res.status).toBe(401);
    });

    it('rejects collector attempting to start a pump (role permission)', async () => {
      const res = await request('/api/operations/start', collectorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          openingFlowMeter: 1000,
          openingEnergyMeter: 500,
          inletPressure: 2.1,
          outletPressure: 6.5,
          tankLevel: 75,
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('rejects operator for station they are not assigned to', async () => {
      const res = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-dharmavaram', // not assigned to demo-operator
          pumpId: 'pump-dmm-1',
          openingFlowMeter: 1000,
          openingEnergyMeter: 500,
          inletPressure: 2.1,
          outletPressure: 6.5,
          tankLevel: 75,
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('rejects incomplete SOP checklist (missing required items)', async () => {
      const res = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          openingFlowMeter: 1000,
          openingEnergyMeter: 500,
          inletPressure: 2.1,
          outletPressure: 6.5,
          tankLevel: 75,
          sopResponses: [
            // Only 1 item provided instead of all 8 required
            { sopItemId: startTemplateItems[0]!.id, response: true },
          ],
        },
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INCOMPLETE_SOP');
    });

    it('successfully starts an idle pump with complete readings and SOP', async () => {
      const clientUuid = crypto.randomUUID();
      const res = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid,
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          openingFlowMeter: 1000.5,
          openingEnergyMeter: 500.25,
          inletPressure: 2.2,
          outletPressure: 6.8,
          tankLevel: 80,
          remarks: 'Morning shift start',
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        operation: {
          id: string;
          status: string;
          operationType: string;
          openingFlowMeter: number;
          openingEnergyMeter: number;
          startedAt: string;
        };
        pump: { id: string; status: string };
      };

      expect(data.operation.status).toBe('ACTIVE');
      expect(data.operation.operationType).toBe('START');
      expect(data.operation.openingFlowMeter).toBe(1000.5);
      expect(data.operation.openingEnergyMeter).toBe(500.25);
      expect(data.pump.status).toBe('RUNNING');

      // Verify pump status in DB
      const pump = await db
        .prepare('SELECT status FROM pumps WHERE id = "pump-ptp-1"')
        .first<{ status: string }>();
      expect(pump?.status).toBe('RUNNING');

      // Verify active operation endpoint
      const activeOpRes = await request('/api/pumps/pump-ptp-1/active-operation', operatorToken);
      expect(activeOpRes.status).toBe(200);
      const activeData = (await activeOpRes.json()) as {
        operation: { id: string; status: string };
      };
      expect(activeData.operation.id).toBe(data.operation.id);
      expect(activeData.operation.status).toBe('ACTIVE');

      // Verify audit log entry exists
      const audit = await db
        .prepare('SELECT action, entity_type, entity_id FROM audit_logs WHERE entity_id = ?')
        .bind(data.operation.id)
        .first<{ action: string; entity_type: string; entity_id: string }>();
      expect(audit?.action).toBe('START_PUMP');
      expect(audit?.entity_type).toBe('pump_operation');
    });

    it('handles idempotent replay of duplicate client_uuid for start', async () => {
      // Re-fetch the operation created above
      const op = await db
        .prepare(
          'SELECT client_uuid FROM pump_operations WHERE pump_id = "pump-ptp-1" AND status = "ACTIVE"',
        )
        .first<{ client_uuid: string }>();
      expect(op?.client_uuid).toBeDefined();

      const replayRes = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid: op!.client_uuid,
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          openingFlowMeter: 1000.5,
          openingEnergyMeter: 500.25,
          inletPressure: 2.2,
          outletPressure: 6.8,
          tankLevel: 80,
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(replayRes.status).toBe(200);
      const replayData = (await replayRes.json()) as { operation: { status: string } };
      expect(replayData.operation.status).toBe('ACTIVE');
    });

    it('rejects starting a pump that is already RUNNING (with a new client_uuid)', async () => {
      const res = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1', // already RUNNING
          openingFlowMeter: 1010,
          openingEnergyMeter: 510,
          inletPressure: 2.2,
          outletPressure: 6.8,
          tankLevel: 80,
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('PUMP_ALREADY_RUNNING');
    });

    it('rejects starting a pump in BREAKDOWN status', async () => {
      // Set pump-ptp-2 to BREAKDOWN
      await db.prepare('UPDATE pumps SET status = "BREAKDOWN" WHERE id = "pump-ptp-2"').run();

      const res = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-2',
          openingFlowMeter: 500,
          openingEnergyMeter: 200,
          inletPressure: 1.5,
          outletPressure: 4.0,
          tankLevel: 50,
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('PUMP_IN_BREAKDOWN');

      // Restore pump-ptp-2
      await db.prepare('UPDATE pumps SET status = "STOPPED" WHERE id = "pump-ptp-2"').run();
    });
  });

  describe('STOP PUMP (/api/operations/stop)', () => {
    it('rejects stop when pump is not RUNNING', async () => {
      const res = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-2', // pump-ptp-2 is STOPPED
          closingFlowMeter: 600,
          closingEnergyMeter: 250,
          inletPressure: 1.5,
          outletPressure: 4.0,
          tankLevel: 50,
          sopResponses: stopTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('PUMP_NOT_RUNNING');
    });

    it('rejects stop when closing flow meter is less than opening flow meter', async () => {
      const res = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1', // opening is 1000.5
          closingFlowMeter: 999.0, // Less than opening!
          closingEnergyMeter: 600,
          inletPressure: 2.0,
          outletPressure: 6.5,
          tankLevel: 85,
          sopResponses: stopTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INVALID_METER_READING');
    });

    it('rejects stop when closing energy meter is less than opening energy meter', async () => {
      const res = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1', // opening energy is 500.25
          closingFlowMeter: 1200,
          closingEnergyMeter: 499.0, // Less than opening!
          inletPressure: 2.0,
          outletPressure: 6.5,
          tankLevel: 85,
          sopResponses: stopTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INVALID_METER_READING');
    });

    it('rejects stop with incomplete SOP checklist', async () => {
      const res = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          closingFlowMeter: 1200,
          closingEnergyMeter: 600,
          inletPressure: 2.0,
          outletPressure: 6.5,
          tankLevel: 85,
          sopResponses: [
            // Only 1 item instead of required 4
            { sopItemId: stopTemplateItems[0]!.id, response: true },
          ],
        },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('INCOMPLETE_SOP');
    });

    it('successfully stops a running pump and computes authoritative calculations', async () => {
      // Fast-forward started_at by 2 hours (7200 seconds) in DB to test duration calculation
      const twoHoursAgo = new Date(Date.now() - 7200 * 1000).toISOString();
      await db
        .prepare(
          'UPDATE pump_operations SET started_at = ? WHERE pump_id = "pump-ptp-1" AND status = "ACTIVE"',
        )
        .bind(twoHoursAgo)
        .run();

      const stopClientUuid = crypto.randomUUID();
      const res = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: stopClientUuid,
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          closingFlowMeter: 1360.5, // 1360.5 - 1000.5 = 360 m3
          closingEnergyMeter: 650.25, // 650.25 - 500.25 = 150 kWh
          inletPressure: 2.1,
          outletPressure: 6.4,
          tankLevel: 90,
          shutdownReason: 'PLANNED_SCHEDULE',
          remarks: 'Completed 2hr planned pumping run',
          sopResponses: stopTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        operation: {
          id: string;
          status: string;
          closingFlowMeter: number;
          closingEnergyMeter: number;
          stoppedAt: string;
          shutdownReason: string;
        };
        pump: { id: string; status: string };
        calculations: {
          runningDurationSeconds: number;
          waterPumpedM3: number;
          energyUsedKwh: number;
          specificEnergyKwhPerM3: number | null;
        };
      };

      expect(data.operation.status).toBe('COMPLETED');
      expect(data.pump.status).toBe('STOPPED');

      // Verify deterministic calculations
      expect(data.calculations.waterPumpedM3).toBeCloseTo(360.0, 2);
      expect(data.calculations.energyUsedKwh).toBeCloseTo(150.0, 2);
      expect(data.calculations.runningDurationSeconds).toBeGreaterThanOrEqual(7190);
      expect(data.calculations.runningDurationSeconds).toBeLessThanOrEqual(7210);

      // specificEnergyKwhPerM3 = 150 / 360 = 0.41666...
      expect(data.calculations.specificEnergyKwhPerM3).toBeCloseTo(150 / 360, 3);

      // Verify pump status in DB is now STOPPED
      const pumpDb = await db
        .prepare('SELECT status FROM pumps WHERE id = "pump-ptp-1"')
        .first<{ status: string }>();
      expect(pumpDb?.status).toBe('STOPPED');

      // Verify active operation endpoint returns null now
      const activeOpRes = await request('/api/pumps/pump-ptp-1/active-operation', operatorToken);
      expect(activeOpRes.status).toBe(200);
      const activeData = (await activeOpRes.json()) as { operation: unknown };
      expect(activeData.operation).toBeNull();

      // Verify audit log for stop
      const audit = await db
        .prepare('SELECT action FROM audit_logs WHERE entity_id = ? AND action = "STOP_PUMP"')
        .bind(data.operation.id)
        .first<{ action: string }>();
      expect(audit?.action).toBe('STOP_PUMP');
    });

    it('handles idempotent replay of duplicate client_uuid for stop', async () => {
      // Find the completed operation
      const op = await db
        .prepare(
          'SELECT client_uuid FROM pump_operations WHERE pump_id = "pump-ptp-1" ORDER BY updated_at DESC LIMIT 1',
        )
        .first<{ client_uuid: string }>();

      const replayRes = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: op!.client_uuid,
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-1',
          closingFlowMeter: 1360.5,
          closingEnergyMeter: 650.25,
          inletPressure: 2.1,
          outletPressure: 6.4,
          tankLevel: 90,
          shutdownReason: 'PLANNED_SCHEDULE',
          sopResponses: stopTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });

      expect(replayRes.status).toBe(200);
      const replayData = (await replayRes.json()) as { operation: { status: string } };
      expect(replayData.operation.status).toBe('COMPLETED');
    });

    it('safely handles zero water pumped without division by zero', async () => {
      // Start pump-ptp-2
      const startRes = await request('/api/operations/start', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-2',
          openingFlowMeter: 200,
          openingEnergyMeter: 100,
          inletPressure: 2.0,
          outletPressure: 6.0,
          tankLevel: 70,
          sopResponses: startTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });
      expect(startRes.status).toBe(201);

      // Stop with identical flow meter (0 water pumped)
      const stopRes = await request('/api/operations/stop', operatorToken, {
        body: {
          clientUuid: crypto.randomUUID(),
          stationId: 'st-puttaparthi',
          pumpId: 'pump-ptp-2',
          closingFlowMeter: 200, // 0 water pumped
          closingEnergyMeter: 105, // 5 kWh energy used
          inletPressure: 2.0,
          outletPressure: 6.0,
          tankLevel: 70,
          sopResponses: stopTemplateItems.map((i) => ({ sopItemId: i.id, response: true })),
        },
      });
      expect(stopRes.status).toBe(200);
      const data = (await stopRes.json()) as {
        calculations: {
          waterPumpedM3: number;
          energyUsedKwh: number;
          specificEnergyKwhPerM3: number | null;
        };
      };
      expect(data.calculations.waterPumpedM3).toBe(0);
      expect(data.calculations.energyUsedKwh).toBe(5);
      expect(data.calculations.specificEnergyKwhPerM3).toBeNull();
    });
  });

  describe('GET OPERATIONS (/api/operations & /api/operations/:id)', () => {
    it('allows operator to list operations for their assigned station', async () => {
      const res = await request('/api/operations?station_id=st-puttaparthi', operatorToken);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        operations: Array<{ id: string; stationId: string; pumpCode: string }>;
      };
      expect(data.operations.length).toBeGreaterThanOrEqual(2);
      expect(data.operations.every((o) => o.stationId === 'st-puttaparthi')).toBe(true);
    });

    it('rejects operator listing operations for an unassigned station', async () => {
      const res = await request('/api/operations?station_id=st-dharmavaram', operatorToken);
      expect(res.status).toBe(403);
    });

    it('allows collector to read operations across stations (monitoring scope)', async () => {
      const res = await request('/api/operations?station_id=st-puttaparthi', collectorToken);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { operations: Array<{ id: string }> };
      expect(data.operations.length).toBeGreaterThanOrEqual(2);
    });

    it('allows system admin to list all operations across stations', async () => {
      const res = await request('/api/operations', adminToken);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { operations: Array<{ id: string }> };
      expect(data.operations.length).toBeGreaterThanOrEqual(2);
    });

    it('fetches single operation detail including SOP responses', async () => {
      const listRes = await request('/api/operations?station_id=st-puttaparthi', operatorToken);
      const listData = (await listRes.json()) as { operations: Array<{ id: string }> };
      const opId = listData.operations[0]!.id;

      const res = await request(`/api/operations/${opId}`, operatorToken);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        operation: {
          id: string;
          sopResponses: Array<{ id: string; sopItemId: string; response: number }>;
        };
      };
      expect(data.operation.id).toBe(opId);
      expect(data.operation.sopResponses.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent operation ID', async () => {
      const res = await request('/api/operations/non-existent-op-id', operatorToken);
      expect(res.status).toBe(404);
    });
  });
});
