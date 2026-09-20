import type { Env } from './env';
import { authenticate, canReadStation } from './auth/session';
import { idSchema } from '@jala-ops/validation';

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
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
    const error = (status: number, code: string, message: string) =>
      json({ error: { code, message, requestId } }, status);
    try {
      if (origin && !allowedOrigins.includes(origin))
        return error(403, 'ORIGIN_DENIED', 'Origin is not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'GET')
        return error(405, 'METHOD_NOT_ALLOWED', 'Method is not supported.');
      const path = new URL(request.url).pathname;
      if (path === '/api/health') {
        // Reading the schema ensures migrations have actually been applied.
        await env.DB.prepare('SELECT code FROM roles LIMIT 1').first();
        return json({ status: 'ok', database: 'ready', service: 'jala-ops-api' });
      }
      const pumpsMatch = /^\/api\/stations\/([^/]+)\/pumps$/.exec(path);
      if (!['/api/auth/me', '/api/stations'].includes(path) && !pumpsMatch)
        return error(404, 'NOT_FOUND', 'Route not found.');
      const user = await authenticate(request, env.DB);
      if (!user) return error(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      if (path === '/api/auth/me') return json({ user });
      if (path === '/api/stations') {
        const districtReader = user.role === 'SYSTEM_ADMIN' || user.role === 'COLLECTOR';
        const query = `SELECT s.id,s.code,s.name,s.locality,s.active FROM stations s WHERE s.active = 1${districtReader ? '' : ' AND EXISTS (SELECT 1 FROM user_station_assignments a WHERE a.station_id = s.id AND a.user_id = ?)'} ORDER BY s.code`;
        const statement = env.DB.prepare(query);
        const { results } = await (districtReader ? statement : statement.bind(user.id)).all();
        return json({
          stations: results.map((station) => ({ ...station, active: Boolean(station.active) })),
        });
      }
      const stationId = pumpsMatch?.[1];
      if (!idSchema.safeParse(stationId).success || !stationId)
        return error(400, 'INVALID_ID', 'Invalid station identifier.');
      if (!(await canReadStation(env.DB, user, stationId)))
        return error(403, 'FORBIDDEN', 'Station is outside your assignment.');
      const station = await env.DB.prepare('SELECT id FROM stations WHERE id = ? AND active = 1')
        .bind(stationId)
        .first();
      if (!station) return error(404, 'NOT_FOUND', 'Station not found.');
      const { results } = await env.DB.prepare(
        `SELECT id,station_id AS stationId,code,name,rated_power_kw AS ratedPowerKw,capacity_m3_h AS capacityM3H,status FROM pumps WHERE station_id = ? AND active = 1 ORDER BY code`,
      )
        .bind(stationId)
        .all();
      return json({ pumps: results });
    } catch {
      console.error(JSON.stringify({ requestId, code: 'SERVICE_UNAVAILABLE' }));
      return error(503, 'SERVICE_UNAVAILABLE', 'Service unavailable. Please try again.');
    }
  },
} satisfies ExportedHandler<Env>;
