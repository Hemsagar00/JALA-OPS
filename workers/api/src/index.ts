import type { Env } from './env';
import {
  authenticate,
  createSession,
  revokeSession,
  extractToken,
  canReadStation,
  getAssignedStationIds,
} from './auth/session';
import { hashPassword, verifyPassword } from './auth/password';
import { ROLES, SESSION_TTL_SECONDS } from '@jala-ops/constants';
import {
  idSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  createAssignmentSchema,
  createStationSchema,
  updateStationSchema,
  createPumpSchema,
  updatePumpSchema,
} from '@jala-ops/validation';
import type { Station, Pump } from '@jala-ops/types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get('Origin');
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
      Vary: 'Origin',
    });

    if (origin && allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }

    const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) => {
      const respHeaders = new Headers(headers);
      if (extraHeaders) {
        new Headers(extraHeaders).forEach((val, key) => respHeaders.set(key, val));
      }
      return Response.json(body, { status, headers: respHeaders });
    };

    const error = (status: number, code: string, message: string) =>
      json({ error: { code, message, requestId } }, status);

    try {
      if (origin && !allowedOrigins.includes(origin)) {
        return error(403, 'ORIGIN_DENIED', 'Origin is not allowed.');
      }
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // 1. Health check
      if (path === '/api/health') {
        if (method !== 'GET') {
          return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
        }
        await env.DB.prepare('SELECT code FROM roles LIMIT 1').first();
        return json({ status: 'ok', database: 'ready', service: 'jala-ops-api' });
      }

      // Route pattern matchers
      const userMatch = /^\/api\/users\/([^/]+)$/.exec(path);
      const userAssignmentsMatch = /^\/api\/users\/([^/]+)\/assignments$/.exec(path);
      const assignmentDeleteMatch = /^\/api\/users\/([^/]+)\/assignments\/([^/]+)$/.exec(path);
      const stationDetailMatch = /^\/api\/stations\/([^/]+)$/.exec(path);
      const pumpsForStationMatch = /^\/api\/stations\/([^/]+)\/pumps$/.exec(path);
      const pumpDetailMatch = /^\/api\/pumps\/([^/]+)$/.exec(path);

      const isKnownRoute =
        path === '/api/auth/roles' ||
        path === '/api/auth/login' ||
        path === '/api/auth/logout' ||
        path === '/api/auth/me' ||
        path === '/api/users' ||
        Boolean(userMatch) ||
        Boolean(userAssignmentsMatch) ||
        Boolean(assignmentDeleteMatch) ||
        path === '/api/stations' ||
        Boolean(stationDetailMatch) ||
        Boolean(pumpsForStationMatch) ||
        path === '/api/pumps' ||
        Boolean(pumpDetailMatch);

      if (!isKnownRoute) {
        return error(404, 'NOT_FOUND', 'Route not found.');
      }

      // 2. Roles list
      if (path === '/api/auth/roles' && method === 'GET') {
        return json({ roles: ROLES });
      }

      // 3. Login
      if (path === '/api/auth/login' && method === 'POST') {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
        }

        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
          return error(400, 'VALIDATION_FAILED', 'Username and password are required.');
        }

        const { username, password } = parsed.data;
        const user = await env.DB.prepare(
          'SELECT id, username, display_name, password_hash, role_code, active FROM users WHERE username = ? COLLATE NOCASE',
        )
          .bind(username)
          .first<{
            id: string;
            username: string;
            display_name: string;
            password_hash: string | null;
            role_code: string;
            active: number;
          }>();

        if (!user || !user.password_hash) {
          return error(401, 'UNAUTHENTICATED', 'Invalid username or password.');
        }

        if (user.active === 0) {
          return error(
            403,
            'ACCOUNT_DISABLED',
            'Your account is disabled. Contact your administrator.',
          );
        }

        const validPassword = await verifyPassword(password, user.password_hash);
        if (!validPassword) {
          await env.DB.prepare(
            'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id) VALUES (?, ?, ?, ?, ?, ?)',
          )
            .bind(crypto.randomUUID(), user.id, 'LOGIN_FAILED', 'user', user.id, requestId)
            .run();
          return error(401, 'UNAUTHENTICATED', 'Invalid username or password.');
        }

        const session = await createSession(env.DB, user.id, requestId);
        const cookie = `__Host-jala_session=${session.token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;

        return json(
          {
            token: session.token,
            expiresAt: session.expiresAt,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.display_name,
              role: user.role_code,
            },
          },
          200,
          { 'Set-Cookie': cookie },
        );
      }

      // 4. Logout
      if (path === '/api/auth/logout' && method === 'POST') {
        const token = extractToken(request);
        if (token && /^[a-f0-9]{64}$/.test(token)) {
          const user = await authenticate(request, env.DB);
          if (user) {
            await revokeSession(env.DB, token, user.id, requestId);
          }
        }
        const clearCookie =
          '__Host-jala_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
        return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
      }

      // All remaining endpoints require authentication
      const user = await authenticate(request, env.DB);
      if (!user) {
        return error(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      }

      // 5. /api/auth/me
      if (path === '/api/auth/me' && method === 'GET') {
        const assignedStations = await getAssignedStationIds(env.DB, user);
        return json({
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
          },
          assignedStations,
        });
      }

      // 6. User Administration: /api/users, /api/users/:id, /api/users/:id/assignments

      if (path === '/api/users') {
        if (user.role !== 'SYSTEM_ADMIN') {
          return error(403, 'FORBIDDEN', 'Administrative access required.');
        }

        if (method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT id, username, display_name AS displayName, role_code AS role, active, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY created_at DESC',
          ).all();
          return json({
            users: results.map((u) => ({ ...u, active: Boolean(u.active) })),
          });
        }

        if (method === 'POST') {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = createUserSchema.safeParse(body);
          if (!parsed.success) {
            return error(
              400,
              'VALIDATION_FAILED',
              parsed.error.issues[0]?.message ?? 'Invalid user data.',
            );
          }

          const existing = await env.DB.prepare(
            'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
          )
            .bind(parsed.data.username)
            .first();
          if (existing) {
            return error(409, 'USERNAME_EXISTS', 'Username is already in use.');
          }

          const newUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;
          const passwordHash = await hashPassword(parsed.data.password);
          const activeInt = parsed.data.active ? 1 : 0;
          const now = new Date().toISOString();

          await env.DB.batch([
            env.DB.prepare(
              'INSERT INTO users (id, username, display_name, password_hash, role_code, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              newUserId,
              parsed.data.username,
              parsed.data.displayName,
              passwordHash,
              parsed.data.role,
              activeInt,
              now,
              now,
            ),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'USER_CREATED',
              'user',
              newUserId,
              requestId,
              JSON.stringify({
                id: newUserId,
                username: parsed.data.username,
                displayName: parsed.data.displayName,
                role: parsed.data.role,
                active: parsed.data.active,
              }),
            ),
          ]);

          return json(
            {
              user: {
                id: newUserId,
                username: parsed.data.username,
                displayName: parsed.data.displayName,
                role: parsed.data.role,
                active: parsed.data.active,
                createdAt: now,
                updatedAt: now,
              },
            },
            201,
          );
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      if (userMatch) {
        const targetUserId = userMatch[1];
        if (!targetUserId || !idSchema.safeParse(targetUserId).success) {
          return error(400, 'INVALID_ID', 'Invalid user identifier.');
        }

        if (method === 'GET') {
          if (user.role !== 'SYSTEM_ADMIN' && user.id !== targetUserId) {
            return error(403, 'FORBIDDEN', 'Access denied.');
          }
          const target = await env.DB.prepare(
            'SELECT id, username, display_name AS displayName, role_code AS role, active, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?',
          )
            .bind(targetUserId)
            .first();
          if (!target) return error(404, 'NOT_FOUND', 'User not found.');
          return json({ user: { ...target, active: Boolean(target.active) } });
        }

        if (method === 'PATCH') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = updateUserSchema.safeParse(body);
          if (!parsed.success) {
            return error(
              400,
              'VALIDATION_FAILED',
              parsed.error.issues[0]?.message ?? 'Invalid update payload.',
            );
          }

          const current = await env.DB.prepare(
            'SELECT id, username, display_name AS displayName, password_hash AS passwordHash, role_code AS role, active, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?',
          )
            .bind(targetUserId)
            .first<{
              id: string;
              username: string;
              displayName: string;
              passwordHash: string | null;
              role: string;
              active: number;
              createdAt: string;
              updatedAt: string;
            }>();
          if (!current) return error(404, 'NOT_FOUND', 'User not found.');

          if (parsed.data.active === true && !current.passwordHash && !parsed.data.password) {
            return error(400, 'PASSWORD_REQUIRED', 'An active user must have a password set.');
          }

          const updates: string[] = [];
          const bindings: unknown[] = [];

          if (parsed.data.displayName !== undefined) {
            updates.push('display_name = ?');
            bindings.push(parsed.data.displayName);
          }
          if (parsed.data.role !== undefined) {
            updates.push('role_code = ?');
            bindings.push(parsed.data.role);
          }
          if (parsed.data.active !== undefined) {
            updates.push('active = ?');
            bindings.push(parsed.data.active ? 1 : 0);
          }
          if (parsed.data.password !== undefined) {
            const newHash = await hashPassword(parsed.data.password);
            updates.push('password_hash = ?');
            bindings.push(newHash);
          }

          if (updates.length === 0) {
            return json({ user: { ...current, active: Boolean(current.active) } });
          }

          const now = new Date().toISOString();
          updates.push('updated_at = ?');
          bindings.push(now);
          bindings.push(targetUserId);

          const afterObj = {
            id: current.id,
            username: current.username,
            displayName: parsed.data.displayName ?? current.displayName,
            role: parsed.data.role ?? current.role,
            active: parsed.data.active ?? Boolean(current.active),
          };

          await env.DB.batch([
            env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'USER_UPDATED',
              'user',
              targetUserId,
              requestId,
              JSON.stringify({
                displayName: current.displayName,
                role: current.role,
                active: Boolean(current.active),
              }),
              JSON.stringify(afterObj),
            ),
          ]);

          return json({
            user: {
              ...afterObj,
              createdAt: current.createdAt,
              updatedAt: now,
            },
          });
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      // Assignments
      if (userAssignmentsMatch) {
        const targetUserId = userAssignmentsMatch[1];
        if (!targetUserId || !idSchema.safeParse(targetUserId).success) {
          return error(400, 'INVALID_ID', 'Invalid user identifier.');
        }

        if (method === 'GET') {
          if (user.role !== 'SYSTEM_ADMIN' && user.id !== targetUserId) {
            return error(403, 'FORBIDDEN', 'Access denied.');
          }
          const { results } = await env.DB.prepare(
            `SELECT a.user_id AS userId, a.station_id AS stationId, a.created_at AS createdAt, s.name AS stationName, s.code AS stationCode
             FROM user_station_assignments a
             JOIN stations s ON s.id = a.station_id
             WHERE a.user_id = ?
             ORDER BY s.code`,
          )
            .bind(targetUserId)
            .all();
          return json({ assignments: results });
        }

        if (method === 'POST') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = createAssignmentSchema.safeParse(body);
          if (!parsed.success) {
            return error(400, 'VALIDATION_FAILED', 'Valid stationId is required.');
          }

          const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
            .bind(targetUserId)
            .first();
          if (!targetUser) return error(404, 'NOT_FOUND', 'User not found.');

          const station = await env.DB.prepare('SELECT id, name, code FROM stations WHERE id = ?')
            .bind(parsed.data.stationId)
            .first<{ id: string; name: string; code: string }>();
          if (!station) return error(404, 'NOT_FOUND', 'Station not found.');

          const exists = await env.DB.prepare(
            'SELECT 1 FROM user_station_assignments WHERE user_id = ? AND station_id = ?',
          )
            .bind(targetUserId, parsed.data.stationId)
            .first();
          if (exists) {
            return error(409, 'ASSIGNMENT_EXISTS', 'User is already assigned to this station.');
          }

          const now = new Date().toISOString();
          await env.DB.batch([
            env.DB.prepare(
              'INSERT INTO user_station_assignments (user_id, station_id, created_at) VALUES (?, ?, ?)',
            ).bind(targetUserId, parsed.data.stationId, now),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'STATION_ASSIGNED',
              'user_station_assignment',
              `${targetUserId}:${parsed.data.stationId}`,
              requestId,
              JSON.stringify({ userId: targetUserId, stationId: parsed.data.stationId }),
            ),
          ]);

          return json(
            {
              assignment: {
                userId: targetUserId,
                stationId: parsed.data.stationId,
                stationName: station.name,
                stationCode: station.code,
                createdAt: now,
              },
            },
            201,
          );
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      if (assignmentDeleteMatch) {
        const targetUserId = assignmentDeleteMatch[1];
        const stationId = assignmentDeleteMatch[2];
        if (
          !targetUserId ||
          !stationId ||
          !idSchema.safeParse(targetUserId).success ||
          !idSchema.safeParse(stationId).success
        ) {
          return error(400, 'INVALID_ID', 'Invalid identifier.');
        }

        if (method === 'DELETE') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }

          const existing = await env.DB.prepare(
            'SELECT 1 FROM user_station_assignments WHERE user_id = ? AND station_id = ?',
          )
            .bind(targetUserId, stationId)
            .first();
          if (!existing) {
            return error(404, 'NOT_FOUND', 'Assignment not found.');
          }

          await env.DB.batch([
            env.DB.prepare(
              'DELETE FROM user_station_assignments WHERE user_id = ? AND station_id = ?',
            ).bind(targetUserId, stationId),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, before_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'STATION_UNASSIGNED',
              'user_station_assignment',
              `${targetUserId}:${stationId}`,
              requestId,
              JSON.stringify({ userId: targetUserId, stationId }),
            ),
          ]);

          return json({ ok: true });
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      // 7. Stations Master: /api/stations, /api/stations/:id

      if (path === '/api/stations') {
        if (method === 'GET') {
          const districtReader = user.role === 'SYSTEM_ADMIN' || user.role === 'COLLECTOR';
          const query = `SELECT s.id, s.code, s.name, s.locality, s.active, s.is_demo AS isDemo FROM stations s WHERE s.active = 1${districtReader ? '' : ' AND EXISTS (SELECT 1 FROM user_station_assignments a WHERE a.station_id = s.id AND a.user_id = ?)'} ORDER BY s.code`;
          const statement = env.DB.prepare(query);
          const { results } = await (
            districtReader ? statement : statement.bind(user.id)
          ).all<Station>();
          return json({
            stations: results.map((station) => ({
              ...station,
              active: Boolean(station.active),
              isDemo: Boolean(station.isDemo),
            })),
          });
        }

        if (method === 'POST') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = createStationSchema.safeParse(body);
          if (!parsed.success) {
            return error(
              400,
              'VALIDATION_FAILED',
              parsed.error.issues[0]?.message ?? 'Invalid station data.',
            );
          }

          const existing = await env.DB.prepare('SELECT id FROM stations WHERE code = ?')
            .bind(parsed.data.code)
            .first();
          if (existing) {
            return error(409, 'CODE_EXISTS', 'Station code already exists.');
          }

          const stationId = `st-${parsed.data.code.toLowerCase()}`;
          const isDemoInt = parsed.data.isDemo ? 1 : 0;
          const now = new Date().toISOString();

          await env.DB.batch([
            env.DB.prepare(
              'INSERT INTO stations (id, code, name, locality, active, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
            ).bind(
              stationId,
              parsed.data.code,
              parsed.data.name,
              parsed.data.locality,
              isDemoInt,
              now,
              now,
            ),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'STATION_CREATED',
              'station',
              stationId,
              requestId,
              JSON.stringify({
                id: stationId,
                code: parsed.data.code,
                name: parsed.data.name,
                locality: parsed.data.locality,
              }),
            ),
          ]);

          return json(
            {
              station: {
                id: stationId,
                code: parsed.data.code,
                name: parsed.data.name,
                locality: parsed.data.locality,
                active: true,
                isDemo: Boolean(parsed.data.isDemo),
                createdAt: now,
                updatedAt: now,
              },
            },
            201,
          );
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      if (stationDetailMatch) {
        const stationId = stationDetailMatch[1];
        if (!stationId || !idSchema.safeParse(stationId).success) {
          return error(400, 'INVALID_ID', 'Invalid station identifier.');
        }

        if (method === 'GET') {
          if (!(await canReadStation(env.DB, user, stationId))) {
            return error(403, 'FORBIDDEN', 'Station is outside your assignment.');
          }

          const station = await env.DB.prepare(
            'SELECT id, code, name, locality, active, is_demo AS isDemo, created_at AS createdAt, updated_at AS updatedAt FROM stations WHERE id = ?',
          )
            .bind(stationId)
            .first<{
              id: string;
              code: string;
              name: string;
              locality: string;
              active: number;
              isDemo: number;
              createdAt: string;
              updatedAt: string;
            }>();
          if (!station) return error(404, 'NOT_FOUND', 'Station not found.');

          return json({
            station: {
              ...station,
              active: Boolean(station.active),
              isDemo: Boolean(station.isDemo),
            },
          });
        }

        if (method === 'PATCH') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = updateStationSchema.safeParse(body);
          if (!parsed.success) {
            return error(
              400,
              'VALIDATION_FAILED',
              parsed.error.issues[0]?.message ?? 'Invalid update payload.',
            );
          }

          const current = await env.DB.prepare(
            'SELECT id, code, name, locality, active, is_demo AS isDemo, created_at AS createdAt, updated_at AS updatedAt FROM stations WHERE id = ?',
          )
            .bind(stationId)
            .first<{
              id: string;
              code: string;
              name: string;
              locality: string;
              active: number;
              isDemo: number;
              createdAt: string;
              updatedAt: string;
            }>();
          if (!current) return error(404, 'NOT_FOUND', 'Station not found.');

          const updates: string[] = [];
          const bindings: unknown[] = [];

          if (parsed.data.name !== undefined) {
            updates.push('name = ?');
            bindings.push(parsed.data.name);
          }
          if (parsed.data.locality !== undefined) {
            updates.push('locality = ?');
            bindings.push(parsed.data.locality);
          }
          if (parsed.data.active !== undefined) {
            updates.push('active = ?');
            bindings.push(parsed.data.active ? 1 : 0);
          }
          if (parsed.data.isDemo !== undefined) {
            updates.push('is_demo = ?');
            bindings.push(parsed.data.isDemo ? 1 : 0);
          }

          if (updates.length === 0) {
            return json({
              station: {
                ...current,
                active: Boolean(current.active),
                isDemo: Boolean(current.isDemo),
              },
            });
          }

          const now = new Date().toISOString();
          updates.push('updated_at = ?');
          bindings.push(now);
          bindings.push(stationId);

          const afterObj = {
            id: current.id,
            code: current.code,
            name: parsed.data.name ?? current.name,
            locality: parsed.data.locality ?? current.locality,
            active: parsed.data.active ?? Boolean(current.active),
            isDemo: parsed.data.isDemo ?? Boolean(current.isDemo),
          };

          await env.DB.batch([
            env.DB.prepare(`UPDATE stations SET ${updates.join(', ')} WHERE id = ?`).bind(
              ...bindings,
            ),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'STATION_UPDATED',
              'station',
              stationId,
              requestId,
              JSON.stringify({
                name: current.name,
                locality: current.locality,
                active: Boolean(current.active),
                isDemo: Boolean(current.isDemo),
              }),
              JSON.stringify(afterObj),
            ),
          ]);

          return json({
            station: {
              ...afterObj,
              createdAt: current.createdAt,
              updatedAt: now,
            },
          });
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      // 8. Station Pumps: /api/stations/:id/pumps
      if (pumpsForStationMatch) {
        const stationId = pumpsForStationMatch[1];
        if (!stationId || !idSchema.safeParse(stationId).success) {
          return error(400, 'INVALID_ID', 'Invalid station identifier.');
        }

        if (!(await canReadStation(env.DB, user, stationId))) {
          return error(403, 'FORBIDDEN', 'Station is outside your assignment.');
        }

        const station = await env.DB.prepare('SELECT id FROM stations WHERE id = ? AND active = 1')
          .bind(stationId)
          .first();
        if (!station) return error(404, 'NOT_FOUND', 'Station not found.');

        const { results } = await env.DB.prepare(
          `SELECT id, station_id AS stationId, code, name, rated_power_kw AS ratedPowerKw, capacity_m3_h AS capacityM3H, status, active
           FROM pumps WHERE station_id = ? AND active = 1 ORDER BY code`,
        )
          .bind(stationId)
          .all<Pump>();
        return json({
          pumps: results.map((p) => ({ ...p, active: Boolean(p.active) })),
        });
      }

      // 9. Pumps Master: /api/pumps, /api/pumps/:id

      if (path === '/api/pumps') {
        if (method === 'GET') {
          const districtReader = user.role === 'SYSTEM_ADMIN' || user.role === 'COLLECTOR';
          const query = `SELECT p.id, p.station_id AS stationId, p.code, p.name, p.rated_power_kw AS ratedPowerKw, p.capacity_m3_h AS capacityM3H, p.status, p.active
                         FROM pumps p
                         WHERE p.active = 1${districtReader ? '' : ' AND EXISTS (SELECT 1 FROM user_station_assignments a WHERE a.station_id = p.station_id AND a.user_id = ?)'}
                         ORDER BY p.code`;
          const statement = env.DB.prepare(query);
          const { results } = await (
            districtReader ? statement : statement.bind(user.id)
          ).all<Pump>();
          return json({
            pumps: results.map((p) => ({ ...p, active: Boolean(p.active) })),
          });
        }

        if (method === 'POST') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = createPumpSchema.safeParse(body);
          if (!parsed.success) {
            return error(
              400,
              'VALIDATION_FAILED',
              parsed.error.issues[0]?.message ?? 'Invalid pump data.',
            );
          }

          const station = await env.DB.prepare(
            'SELECT id FROM stations WHERE id = ? AND active = 1',
          )
            .bind(parsed.data.stationId)
            .first();
          if (!station)
            return error(404, 'NOT_FOUND', 'Referenced station does not exist or is inactive.');

          const existing = await env.DB.prepare('SELECT id FROM pumps WHERE code = ?')
            .bind(parsed.data.code)
            .first();
          if (existing) {
            return error(409, 'CODE_EXISTS', 'Pump code already exists.');
          }

          const pumpId = `pump-${crypto.randomUUID().slice(0, 8)}`;
          const now = new Date().toISOString();

          await env.DB.batch([
            env.DB.prepare(
              `INSERT INTO pumps (id, station_id, code, name, rated_power_kw, capacity_m3_h, status, active, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
            ).bind(
              pumpId,
              parsed.data.stationId,
              parsed.data.code,
              parsed.data.name,
              parsed.data.ratedPowerKw,
              parsed.data.capacityM3H,
              parsed.data.status,
              now,
              now,
            ),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'PUMP_CREATED',
              'pump',
              pumpId,
              requestId,
              JSON.stringify({
                id: pumpId,
                stationId: parsed.data.stationId,
                code: parsed.data.code,
                name: parsed.data.name,
                ratedPowerKw: parsed.data.ratedPowerKw,
                capacityM3H: parsed.data.capacityM3H,
                status: parsed.data.status,
              }),
            ),
          ]);

          return json(
            {
              pump: {
                id: pumpId,
                stationId: parsed.data.stationId,
                code: parsed.data.code,
                name: parsed.data.name,
                ratedPowerKw: parsed.data.ratedPowerKw,
                capacityM3H: parsed.data.capacityM3H,
                status: parsed.data.status,
                active: true,
                version: 1,
                createdAt: now,
                updatedAt: now,
              },
            },
            201,
          );
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      if (pumpDetailMatch) {
        const pumpId = pumpDetailMatch[1];
        if (!pumpId || !idSchema.safeParse(pumpId).success) {
          return error(400, 'INVALID_ID', 'Invalid pump identifier.');
        }

        if (method === 'GET') {
          const pump = await env.DB.prepare(
            `SELECT id, station_id AS stationId, code, name, rated_power_kw AS ratedPowerKw, capacity_m3_h AS capacityM3H, status, active, version, created_at AS createdAt, updated_at AS updatedAt
             FROM pumps WHERE id = ?`,
          )
            .bind(pumpId)
            .first<{
              id: string;
              stationId: string;
              code: string;
              name: string;
              ratedPowerKw: number;
              capacityM3H: number;
              status: Pump['status'];
              active: number;
              version: number;
              createdAt: string;
              updatedAt: string;
            }>();
          if (!pump) return error(404, 'NOT_FOUND', 'Pump not found.');

          if (!(await canReadStation(env.DB, user, pump.stationId))) {
            return error(403, 'FORBIDDEN', 'Pump station is outside your assignment.');
          }

          return json({
            pump: {
              ...pump,
              active: Boolean(pump.active),
            },
          });
        }

        if (method === 'PATCH') {
          if (user.role !== 'SYSTEM_ADMIN') {
            return error(403, 'FORBIDDEN', 'Administrative access required.');
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return error(400, 'INVALID_BODY', 'Invalid JSON payload.');
          }

          const parsed = updatePumpSchema.safeParse(body);
          if (!parsed.success) {
            return error(
              400,
              'VALIDATION_FAILED',
              parsed.error.issues[0]?.message ?? 'Invalid update payload.',
            );
          }

          const current = await env.DB.prepare(
            `SELECT id, station_id AS stationId, code, name, rated_power_kw AS ratedPowerKw, capacity_m3_h AS capacityM3H, status, active, version, created_at AS createdAt, updated_at AS updatedAt
             FROM pumps WHERE id = ?`,
          )
            .bind(pumpId)
            .first<{
              id: string;
              stationId: string;
              code: string;
              name: string;
              ratedPowerKw: number;
              capacityM3H: number;
              status: Pump['status'];
              active: number;
              version: number;
              createdAt: string;
              updatedAt: string;
            }>();
          if (!current) return error(404, 'NOT_FOUND', 'Pump not found.');

          const updates: string[] = [];
          const bindings: unknown[] = [];

          if (parsed.data.name !== undefined) {
            updates.push('name = ?');
            bindings.push(parsed.data.name);
          }
          if (parsed.data.ratedPowerKw !== undefined) {
            updates.push('rated_power_kw = ?');
            bindings.push(parsed.data.ratedPowerKw);
          }
          if (parsed.data.capacityM3H !== undefined) {
            updates.push('capacity_m3_h = ?');
            bindings.push(parsed.data.capacityM3H);
          }
          if (parsed.data.status !== undefined) {
            updates.push('status = ?');
            bindings.push(parsed.data.status);
          }
          if (parsed.data.active !== undefined) {
            updates.push('active = ?');
            bindings.push(parsed.data.active ? 1 : 0);
          }

          if (updates.length === 0) {
            return json({
              pump: {
                ...current,
                active: Boolean(current.active),
              },
            });
          }

          const now = new Date().toISOString();
          updates.push('version = version + 1');
          updates.push('updated_at = ?');
          bindings.push(now);
          bindings.push(pumpId);

          const afterObj = {
            id: current.id,
            stationId: current.stationId,
            code: current.code,
            name: parsed.data.name ?? current.name,
            ratedPowerKw: parsed.data.ratedPowerKw ?? current.ratedPowerKw,
            capacityM3H: parsed.data.capacityM3H ?? current.capacityM3H,
            status: parsed.data.status ?? current.status,
            active: parsed.data.active ?? Boolean(current.active),
            version: current.version + 1,
          };

          await env.DB.batch([
            env.DB.prepare(`UPDATE pumps SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings),
            env.DB.prepare(
              'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, request_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ).bind(
              crypto.randomUUID(),
              user.id,
              'PUMP_UPDATED',
              'pump',
              pumpId,
              requestId,
              JSON.stringify({
                name: current.name,
                ratedPowerKw: current.ratedPowerKw,
                capacityM3H: current.capacityM3H,
                status: current.status,
                active: Boolean(current.active),
              }),
              JSON.stringify(afterObj),
            ),
          ]);

          return json({
            pump: {
              ...afterObj,
              createdAt: current.createdAt,
              updatedAt: now,
            },
          });
        }

        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      }

      return error(404, 'NOT_FOUND', 'Route not found.');
    } catch {
      console.error(JSON.stringify({ requestId, code: 'INTERNAL_ERROR' }));
      return error(500, 'INTERNAL_ERROR', 'An unexpected error occurred. Please try again.');
    }
  },
} satisfies ExportedHandler<Env>;
