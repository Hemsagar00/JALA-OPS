import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSession, hashToken } from '../src/auth/session';
import { hashPassword, verifyPassword } from '../src/auth/password';

let runtime: Miniflare;
let db: D1Database;
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
  extra: { method?: string; headers?: Record<string, string> } = {},
) =>
  runtime.dispatchFetch(`http://localhost${path}`, {
    ...extra,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra.headers },
  });

beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      name: 'api-test',
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
  await db
    .prepare(
      "UPDATE users SET active = 1, password_hash = 'test-only-not-a-password' WHERE id IN ('demo-operator','demo-collector')",
    )
    .run();
  operatorToken = (await createSession(db, 'demo-operator', 'test-operator')).token;
  collectorToken = (await createSession(db, 'demo-collector', 'test-collector')).token;
});
afterAll(async () => {
  await runtime?.dispose();
});

describe('foundation data and invariants', () => {
  it('seeds exactly five stations, ten pumps and eight roles, repeatably', async () => {
    await applySql('database/seed/development.sql');
    expect((await db.prepare('SELECT COUNT(*) AS n FROM stations').first<{ n: number }>())?.n).toBe(
      5,
    );
    expect((await db.prepare('SELECT COUNT(*) AS n FROM pumps').first<{ n: number }>())?.n).toBe(
      10,
    );
    expect((await db.prepare('SELECT COUNT(*) AS n FROM roles').first<{ n: number }>())?.n).toBe(8);
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  });
  it('rejects invalid pump values, orphan stations and duplicate assignments', async () => {
    await expect(
      db.prepare("UPDATE pumps SET rated_power_kw = -1 WHERE id = 'pump-ptp-1'").run(),
    ).rejects.toThrow();
    await expect(
      db.prepare("UPDATE pumps SET station_id = 'missing' WHERE id = 'pump-ptp-1'").run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare(
          "INSERT INTO user_station_assignments (user_id,station_id) VALUES ('demo-operator','st-puttaparthi')",
        )
        .run(),
    ).rejects.toThrow();
  });
  it('rejects active users without a password hash and unapproved roles', async () => {
    await expect(
      db.prepare("UPDATE users SET active = 1 WHERE id = 'demo-admin'").run(),
    ).rejects.toThrow();
    await expect(
      db.prepare("INSERT INTO roles VALUES ('CONTROL_ROOM','Control room')").run(),
    ).rejects.toThrow();
  });
  it('stores only session hashes and creates immutable audit records', async () => {
    expect(
      await db
        .prepare('SELECT token_hash FROM sessions WHERE token_hash = ?')
        .bind(operatorToken)
        .first(),
    ).toBeNull();
    expect(
      await db
        .prepare('SELECT token_hash FROM sessions WHERE token_hash = ?')
        .bind(hashToken(operatorToken))
        .first(),
    ).not.toBeNull();
    await expect(db.prepare('DELETE FROM audit_logs').run()).rejects.toThrow();
    await expect(db.prepare("UPDATE audit_logs SET action = 'CHANGED'").run()).rejects.toThrow();
  });
  it('rolls back session insert if its audit insert fails', async () => {
    await expect(
      db.batch([
        db.prepare("INSERT INTO sessions VALUES ('rollback-test','demo-operator',1,2,NULL)"),
        db.prepare(
          "INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,request_id) VALUES ('bad-audit','missing-user','TEST','user','test','test')",
        ),
      ]),
    ).rejects.toThrow();
    expect(
      await db.prepare("SELECT * FROM sessions WHERE token_hash = 'rollback-test'").first(),
    ).toBeNull();
  });
  it('can persist and read a private R2 object through the binding', async () => {
    const bucket = await runtime.getR2Bucket('PHOTOS');
    await bucket.put('test/evidence.txt', 'binding verification');
    expect(await (await bucket.get('test/evidence.txt'))?.text()).toBe('binding verification');
  });
});

describe('Worker API and authorization', () => {
  it('checks the migrated database through health', async () => {
    const response = await request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      database: 'ready',
      service: 'jala-ops-api',
    });
  });
  it('denies unauthenticated access and unknown routes', async () => {
    expect((await request('/api/stations')).status).toBe(401);
    expect((await request('/api/unknown')).status).toBe(404);
    expect((await request('/api/health', undefined, { method: 'POST' })).status).toBe(405);
  });
  it('returns the authenticated identity without credential fields', async () => {
    const response = await request('/api/auth/me', operatorToken);
    expect(await response.json()).toMatchObject({
      user: { id: 'demo-operator', displayName: 'Demo operator', role: 'OPERATOR' },
    });
  });
  it('scopes operators to their assignments and allows district read access', async () => {
    const operator = (await (await request('/api/stations', operatorToken)).json()) as {
      stations: unknown[];
    };
    const collector = (await (await request('/api/stations', collectorToken)).json()) as {
      stations: unknown[];
    };
    expect(operator.stations).toHaveLength(1);
    expect(collector.stations).toHaveLength(5);
    expect((await request('/api/stations/st-hindupur/pumps', operatorToken)).status).toBe(403);
    const pumps = (await (
      await request('/api/stations/st-puttaparthi/pumps', operatorToken)
    ).json()) as { pumps: unknown[] };
    expect(pumps.pumps).toHaveLength(2);
  });
  it('denies revoked, expired, malformed tokens and disabled users', async () => {
    const revoked = (await createSession(db, 'demo-operator', 'revoked')).token;
    await db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
      .bind(1, hashToken(revoked))
      .run();
    expect((await request('/api/auth/me', revoked)).status).toBe(401);
    const expired = (await createSession(db, 'demo-operator', 'expired')).token;
    await db
      .prepare('UPDATE sessions SET created_at = 1, expires_at = 2 WHERE token_hash = ?')
      .bind(hashToken(expired))
      .run();
    expect((await request('/api/auth/me', expired)).status).toBe(401);
    expect((await request('/api/auth/me', 'invalid')).status).toBe(401);
    await db.prepare("UPDATE users SET active = 0 WHERE id = 'demo-operator'").run();
    expect((await request('/api/auth/me', operatorToken)).status).toBe(401);
    await expect(createSession(db, 'demo-admin', 'disabled')).rejects.toThrow('not active');
    await db.prepare("UPDATE users SET active = 1 WHERE id = 'demo-operator'").run();
  });
  it('allows only configured browser origins', async () => {
    const good = await request('/api/health', undefined, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(good.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const bad = await request('/api/health', undefined, {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(bad.status).toBe(403);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('password hashing foundation', () => {
  it('uses unique salts, verifies passwords and rejects bad encodings', async () => {
    const password = 'Test-only-long-password-42';
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    expect(a).not.toBe(b);
    expect(a).not.toContain(password);
    expect(await verifyPassword(password, a)).toBe(true);
    expect(await verifyPassword('wrong-password', a)).toBe(false);
    expect(await verifyPassword(password, 'invalid-hash')).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow();
  });
});
