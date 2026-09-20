import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { SESSION_TTL_SECONDS } from '@jala-ops/constants';
import { roleSchema } from '@jala-ops/validation';
import type { AuthUser } from '@jala-ops/types';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Called only after password authentication is implemented in Milestone 2.
// No HTTP endpoint issues sessions in Milestone 1.
export async function createSession(db: D1Database, userId: string, requestId: string) {
  const active = await db
    .prepare('SELECT id FROM users WHERE id = ? AND active = 1')
    .bind(userId)
    .first();
  if (!active) throw new Error('User is not active');
  const token = Buffer.from(randomBytes(32)).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const digest = hashToken(token);
  await db.batch([
    db
      .prepare('INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)')
      .bind(digest, userId, now, expiresAt),
    db
      .prepare(
        'INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,request_id) VALUES (?,?,?,?,?,?)',
      )
      .bind(crypto.randomUUID(), userId, 'SESSION_CREATED', 'user', userId, requestId),
  ]);
  return { token, expiresAt };
}

export function extractToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  const bearer = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const cookie = request.headers
    .get('Cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('__Host-jala_session='))
    ?.split('=')[1];
  return authorization ? (bearer ?? null) : (cookie ?? null);
}

export async function revokeSession(
  db: D1Database,
  token: string,
  userId: string,
  requestId: string,
): Promise<void> {
  const digest = hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
      .bind(now, digest),
    db
      .prepare(
        'INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,request_id) VALUES (?,?,?,?,?,?)',
      )
      .bind(crypto.randomUUID(), userId, 'SESSION_REVOKED', 'user', userId, requestId),
  ]);
}

export async function authenticate(request: Request, db: D1Database): Promise<AuthUser | null> {
  const token = extractToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const user = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.role_code AS role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.active = 1`,
    )
    .bind(hashToken(token), Math.floor(Date.now() / 1000))
    .first<AuthUser>();
  if (!user || !roleSchema.safeParse(user.role).success) return null;
  return user;
}

export function requireRole(user: AuthUser, allowedRoles: readonly string[]): boolean {
  return allowedRoles.includes(user.role);
}

export async function canReadStation(
  db: D1Database,
  user: AuthUser,
  stationId: string,
): Promise<boolean> {
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'COLLECTOR') return true;
  return Boolean(
    await db
      .prepare('SELECT 1 FROM user_station_assignments WHERE user_id = ? AND station_id = ?')
      .bind(user.id, stationId)
      .first(),
  );
}

export async function getAssignedStationIds(db: D1Database, user: AuthUser): Promise<string[]> {
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'COLLECTOR') {
    const { results } = await db
      .prepare('SELECT id FROM stations WHERE active = 1 ORDER BY code')
      .all<{ id: string }>();
    return results.map((r) => r.id);
  }
  const { results } = await db
    .prepare(
      'SELECT station_id AS id FROM user_station_assignments WHERE user_id = ? ORDER BY station_id',
    )
    .bind(user.id)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}
