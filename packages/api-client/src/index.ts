import type {
  Health,
  AuthMeResponse,
  LoginResponse,
  Role,
  Station,
  StationDetail,
  Pump,
  PumpDetail,
  UserRecord,
  StationAssignment,
} from '@jala-ops/types';
import { healthSchema } from '@jala-ops/validation';

export interface ApiClientOptions {
  fetcher?: typeof fetch;
  token?: string | null;
  getHeaders?: () => Record<string, string>;
}

export function createApiClient(baseUrl: string, options: ApiClientOptions | typeof fetch = {}) {
  const fetcher = typeof options === 'function' ? options : (options.fetcher ?? fetch);
  let authToken = typeof options === 'function' ? null : (options.token ?? null);
  const getCustomHeaders = typeof options === 'function' ? undefined : options.getHeaders;
  const root = baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    if (getCustomHeaders) {
      const extra = getCustomHeaders();
      for (const [k, v] of Object.entries(extra)) {
        headers.set(k, v);
      }
    }

    const response = await fetcher(`${root}${path}`, {
      ...init,
      headers,
      credentials: init.credentials ?? 'include',
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const message = data?.error?.message ?? `Request failed with status ${response.status}`;
      const code = data?.error?.code ?? 'REQUEST_FAILED';
      const error = new Error(message) as Error & {
        status: number;
        code: string;
        details?: unknown;
      };
      error.status = response.status;
      error.code = code;
      error.details = data;
      throw error;
    }

    return data as T;
  }

  return {
    setToken(token: string | null) {
      authToken = token;
    },
    getToken() {
      return authToken;
    },

    async health(): Promise<Health> {
      const response = await fetcher(`${root}/api/health`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error('Service unavailable. Check your connection and try again.');
      return healthSchema.parse(await response.json());
    },

    // Auth
    async login(username: string, password: string): Promise<LoginResponse> {
      const res = await request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.token) {
        authToken = res.token;
      }
      return res;
    },

    async logout(): Promise<{ ok: boolean }> {
      const res = await request<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      });
      authToken = null;
      return res;
    },

    async me(): Promise<AuthMeResponse> {
      return request<AuthMeResponse>('/api/auth/me');
    },

    async roles(): Promise<{ roles: Role[] }> {
      return request<{ roles: Role[] }>('/api/auth/roles');
    },

    // Users (Admin)
    async listUsers(): Promise<{ users: UserRecord[] }> {
      return request<{ users: UserRecord[] }>('/api/users');
    },

    async getUser(id: string): Promise<{ user: UserRecord }> {
      return request<{ user: UserRecord }>(`/api/users/${id}`);
    },

    async createUser(data: {
      username: string;
      displayName: string;
      password: string;
      role: Role;
      active?: boolean;
    }): Promise<{ user: UserRecord }> {
      return request<{ user: UserRecord }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateUser(
      id: string,
      data: { displayName?: string; role?: Role; active?: boolean; password?: string },
    ): Promise<{ user: UserRecord }> {
      return request<{ user: UserRecord }>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Assignments (Admin)
    async getUserAssignments(userId: string): Promise<{ assignments: StationAssignment[] }> {
      return request<{ assignments: StationAssignment[] }>(`/api/users/${userId}/assignments`);
    },

    async assignStation(
      userId: string,
      stationId: string,
    ): Promise<{ assignment: StationAssignment }> {
      return request<{ assignment: StationAssignment }>(`/api/users/${userId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ stationId }),
      });
    },

    async removeAssignment(userId: string, stationId: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/api/users/${userId}/assignments/${stationId}`, {
        method: 'DELETE',
      });
    },

    // Stations
    async listStations(): Promise<{ stations: Station[] }> {
      return request<{ stations: Station[] }>('/api/stations');
    },

    async getStation(id: string): Promise<{ station: StationDetail }> {
      return request<{ station: StationDetail }>(`/api/stations/${id}`);
    },

    async createStation(data: {
      code: string;
      name: string;
      locality: string;
      isDemo?: boolean;
    }): Promise<{ station: StationDetail }> {
      return request<{ station: StationDetail }>('/api/stations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateStation(
      id: string,
      data: { name?: string; locality?: string; active?: boolean; isDemo?: boolean },
    ): Promise<{ station: StationDetail }> {
      return request<{ station: StationDetail }>(`/api/stations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Pumps
    async listPumps(stationId?: string): Promise<{ pumps: Pump[] }> {
      const path = stationId ? `/api/stations/${stationId}/pumps` : '/api/pumps';
      return request<{ pumps: Pump[] }>(path);
    },

    async getPump(id: string): Promise<{ pump: PumpDetail }> {
      return request<{ pump: PumpDetail }>(`/api/pumps/${id}`);
    },

    async createPump(data: {
      stationId: string;
      code: string;
      name: string;
      ratedPowerKw: number;
      capacityM3H: number;
      status?: Pump['status'];
    }): Promise<{ pump: PumpDetail }> {
      return request<{ pump: PumpDetail }>('/api/pumps', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updatePump(
      id: string,
      data: {
        name?: string;
        ratedPowerKw?: number;
        capacityM3H?: number;
        status?: Pump['status'];
        active?: boolean;
      },
    ): Promise<{ pump: PumpDetail }> {
      return request<{ pump: PumpDetail }>(`/api/pumps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  };
}
