import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../src/auth/password';

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
      name: 'auth-masters-test',
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
  await applySql('database/seed/development.sql');

  const hashedAdminPass = await hashPassword('AdminSecurePass123!');
  const hashedOperatorPass = await hashPassword('OperatorPass123!');

  await db
    .prepare("UPDATE users SET active = 1, password_hash = ? WHERE id = 'demo-admin'")
    .bind(hashedAdminPass)
    .run();

  await db
    .prepare("UPDATE users SET active = 1, password_hash = ? WHERE id = 'demo-operator'")
    .bind(hashedOperatorPass)
    .run();

  // Login as admin to get token
  const adminLoginRes = await request('/api/auth/login', undefined, {
    body: { username: 'demo.admin', password: 'AdminSecurePass123!' },
  });
  const adminLoginData = (await adminLoginRes.json()) as { token: string };
  adminToken = adminLoginData.token;

  // Login as operator to get token
  const opLoginRes = await request('/api/auth/login', undefined, {
    body: { username: 'demo.operator', password: 'OperatorPass123!' },
  });
  const opLoginData = (await opLoginRes.json()) as { token: string };
  operatorToken = opLoginData.token;

  // Enable collector
  await db
    .prepare("UPDATE users SET active = 1, password_hash = ? WHERE id = 'demo-collector'")
    .bind(hashedAdminPass)
    .run();
  const colLoginRes = await request('/api/auth/login', undefined, {
    body: { username: 'demo.collector', password: 'AdminSecurePass123!' },
  });
  const colLoginData = (await colLoginRes.json()) as { token: string };
  collectorToken = colLoginData.token;
});

afterAll(async () => {
  await runtime?.dispose();
});

describe('Authentication & Session API', () => {
  it('logs in successfully and sets HttpOnly cookie', async () => {
    const res = await request('/api/auth/login', undefined, {
      body: { username: 'demo.operator', password: 'OperatorPass123!' },
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('__Host-jala_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');

    const body = (await res.json()) as { token: string; user: { role: string; username: string } };
    expect(body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(body.user.role).toBe('OPERATOR');
    expect(body.user.username).toBe('demo.operator');
  });

  it('rejects invalid password and logs failed attempt', async () => {
    const res = await request('/api/auth/login', undefined, {
      body: { username: 'demo.operator', password: 'WrongPassword123!' },
    });
    expect(res.status).toBe(401);
    const err = (await res.json()) as { error: { code: string } };
    expect(err.error.code).toBe('UNAUTHENTICATED');

    const audit = await db
      .prepare(
        "SELECT action FROM audit_logs WHERE action = 'LOGIN_FAILED' AND entity_id = 'demo-operator'",
      )
      .first();
    expect(audit).toBeTruthy();
  });

  it('rejects inactive or disabled user', async () => {
    const res = await request('/api/auth/login', undefined, {
      body: { username: 'demo.technician', password: 'AnyPassword123!' },
    });
    // demo.technician has active = 0 in development seed
    expect(res.status).toBe(401); // inactive with no password hash
  });

  it('returns auth user details and assigned stations at /api/auth/me', async () => {
    const res = await request('/api/auth/me', operatorToken);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      user: { id: string; role: string; username: string };
      assignedStations: string[];
    };
    expect(data.user.id).toBe('demo-operator');
    expect(data.user.role).toBe('OPERATOR');
    expect(data.assignedStations).toEqual(['st-puttaparthi']);
  });

  it('logs out and revokes session', async () => {
    // Temporary login
    const loginRes = await request('/api/auth/login', undefined, {
      body: { username: 'demo.operator', password: 'OperatorPass123!' },
    });
    const { token } = (await loginRes.json()) as { token: string };

    const logoutRes = await request('/api/auth/logout', token, { method: 'POST' });
    expect(logoutRes.status).toBe(200);
    const clearCookie = logoutRes.headers.get('set-cookie');
    expect(clearCookie).toContain('Max-Age=0');

    // Token must now be rejected
    const meRes = await request('/api/auth/me', token);
    expect(meRes.status).toBe(401);
  });
});

describe('Roles endpoint', () => {
  it('returns approved JALA-OPS roles', async () => {
    const res = await request('/api/auth/roles');
    expect(res.status).toBe(200);
    const data = (await res.json()) as { roles: string[] };
    expect(data.roles).toHaveLength(8);
    expect(data.roles).toContain('OPERATOR');
    expect(data.roles).toContain('COLLECTOR');
    expect(data.roles).toContain('SYSTEM_ADMIN');
  });
});

describe('User Administration', () => {
  it('denies non-admin access to /api/users', async () => {
    const res = await request('/api/users', operatorToken);
    expect(res.status).toBe(403);
  });

  it('allows admin to list and create users', async () => {
    const listRes = await request('/api/users', adminToken);
    expect(listRes.status).toBe(200);
    const initial = (await listRes.json()) as { users: unknown[] };
    expect(initial.users.length).toBeGreaterThanOrEqual(5);

    const createRes = await request('/api/users', adminToken, {
      method: 'POST',
      body: {
        username: 'new.engineer',
        displayName: 'New Assistant Engineer',
        password: 'SecurePassword123!',
        role: 'AE',
        active: true,
      },
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      user: { id: string; username: string; role: string; password_hash?: unknown };
    };
    expect(created.user.username).toBe('new.engineer');
    expect(created.user.role).toBe('AE');
    expect(created.user.password_hash).toBeUndefined();

    // Verify duplicate username rejection
    const dupRes = await request('/api/users', adminToken, {
      method: 'POST',
      body: {
        username: 'new.engineer',
        displayName: 'Duplicate',
        password: 'SecurePassword123!',
        role: 'AE',
      },
    });
    expect(dupRes.status).toBe(409);
  });

  it('allows admin to update user', async () => {
    // Cannot activate without password
    const noPassRes = await request('/api/users/demo-technician', adminToken, {
      method: 'PATCH',
      body: { active: true },
    });
    expect(noPassRes.status).toBe(400);

    const updateRes = await request('/api/users/demo-technician', adminToken, {
      method: 'PATCH',
      body: {
        displayName: 'Updated Technician Name',
        password: 'TechNewPassword123!',
        active: true,
      },
    });
    expect(updateRes.status).toBe(200);
    const data = (await updateRes.json()) as { user: { displayName: string; active: boolean } };
    expect(data.user.displayName).toBe('Updated Technician Name');
    expect(data.user.active).toBe(true);
  });
});

describe('Station Assignments', () => {
  it('allows admin to assign and unassign stations', async () => {
    const assignRes = await request('/api/users/demo-operator/assignments', adminToken, {
      method: 'POST',
      body: { stationId: 'st-dharmavaram' },
    });
    expect(assignRes.status).toBe(201);

    // Duplicate assignment rejected
    const dupRes = await request('/api/users/demo-operator/assignments', adminToken, {
      method: 'POST',
      body: { stationId: 'st-dharmavaram' },
    });
    expect(dupRes.status).toBe(409);

    // Delete assignment
    const delRes = await request(
      '/api/users/demo-operator/assignments/st-dharmavaram',
      adminToken,
      { method: 'DELETE' },
    );
    expect(delRes.status).toBe(200);
  });
});

describe('Station Master', () => {
  it('enforces role scoping on stations listing', async () => {
    const opRes = await request('/api/stations', operatorToken);
    const opStations = (await opRes.json()) as { stations: unknown[] };
    expect(opStations.stations).toHaveLength(1);

    const colRes = await request('/api/stations', collectorToken);
    const colStations = (await colRes.json()) as { stations: unknown[] };
    expect(colStations.stations).toHaveLength(5);
  });

  it('allows admin to create and update station', async () => {
    const createRes = await request('/api/stations', adminToken, {
      method: 'POST',
      body: {
        code: 'TEST-STN',
        name: 'Test New Water Station',
        locality: 'Test Locality',
      },
    });
    expect(createRes.status).toBe(201);
    const data = (await createRes.json()) as { station: { id: string; code: string } };
    expect(data.station.code).toBe('TEST-STN');

    const updateRes = await request(`/api/stations/${data.station.id}`, adminToken, {
      method: 'PATCH',
      body: { name: 'Updated Station Name' },
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { station: { name: string } };
    expect(updated.station.name).toBe('Updated Station Name');
  });

  it('prevents non-admin from creating stations', async () => {
    const res = await request('/api/stations', operatorToken, {
      method: 'POST',
      body: { code: 'NO-PERM', name: 'Unauthorized Station', locality: 'None' },
    });
    expect(res.status).toBe(403);
  });
});

describe('Pump Master', () => {
  it('allows admin to create and update pump', async () => {
    const createRes = await request('/api/pumps', adminToken, {
      method: 'POST',
      body: {
        stationId: 'st-puttaparthi',
        code: 'PTP-P03-TEST',
        name: 'Third Pump Test',
        ratedPowerKw: 45,
        capacityM3H: 100,
        status: 'STOPPED',
      },
    });
    expect(createRes.status).toBe(201);
    const data = (await createRes.json()) as {
      pump: { id: string; code: string; version: number };
    };
    expect(data.pump.code).toBe('PTP-P03-TEST');
    expect(data.pump.version).toBe(1);

    // Update pump increments version
    const updateRes = await request(`/api/pumps/${data.pump.id}`, adminToken, {
      method: 'PATCH',
      body: { name: 'Renamed Pump Test', ratedPowerKw: 55 },
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as {
      pump: { name: string; version: number; ratedPowerKw: number };
    };
    expect(updated.pump.name).toBe('Renamed Pump Test');
    expect(updated.pump.version).toBe(2);
    expect(updated.pump.ratedPowerKw).toBe(55);
  });

  it('prevents non-admin from creating pumps', async () => {
    const res = await request('/api/pumps', operatorToken, {
      method: 'POST',
      body: {
        stationId: 'st-puttaparthi',
        code: 'UNAUTH-P',
        name: 'Unauthorized Pump',
        ratedPowerKw: 10,
        capacityM3H: 20,
      },
    });
    expect(res.status).toBe(403);
  });
});
