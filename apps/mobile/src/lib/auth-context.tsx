import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createApiClient } from '@jala-ops/api-client';
import type { AuthMeResponse, Station, Pump } from '@jala-ops/types';
import { getStoredToken, setStoredToken, clearStoredToken } from './session';
import { subscribeSyncState, initSyncEngine } from './sync-engine';

export type SyncState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'PENDING' | 'SYNCED' | 'ERROR';

export interface AuthContextValue {
  session: AuthMeResponse | null;
  authState: 'loading' | 'unauthenticated' | 'authenticated';
  assignedStations: Station[];
  activeStation: Station | null;
  setActiveStationId: (id: string) => void;
  pumps: Pump[];
  pumpsLoading: boolean;
  pumpsError: string | null;
  syncState: SyncState;
  pendingCount: number;
  setSyncState: (state: SyncState) => void;
  login: (me: AuthMeResponse, token?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshStations: () => Promise<void>;
  refreshPumps: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>(
    'loading',
  );
  const [session, setSession] = useState<AuthMeResponse | null>(null);
  const [assignedStations, setAssignedStations] = useState<Station[]>([]);
  const [activeStationId, setActiveStationIdState] = useState<string | null>(null);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [pumpsLoading, setPumpsLoading] = useState(false);
  const [pumpsError, setPumpsError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('ONLINE');
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    initSyncEngine();
    const unsubscribe = subscribeSyncState((info) => {
      setSyncState(info.status);
      setPendingCount(info.pendingCount);
    });
    return unsubscribe;
  }, []);

  const fetchStationsForSession = useCallback(async (token: string, stationIds: string[]) => {
    try {
      const client = createApiClient(BASE_URL, { token });
      const res = await client.listStations();
      const allStations: Station[] = res.stations;
      // Filter if operator has explicit assignment, or take all if officer/admin
      const filtered =
        stationIds.length > 0
          ? allStations.filter((s: Station) => stationIds.includes(s.id))
          : allStations;
      setAssignedStations(filtered);
      if (filtered.length > 0) {
        const firstId = filtered[0]?.id ?? null;
        setActiveStationIdState((prev) =>
          prev && filtered.some((s: Station) => s.id === prev) ? prev : firstId,
        );
      } else {
        setActiveStationIdState(null);
        setPumps([]);
      }
    } catch {
      setAssignedStations([]);
      setActiveStationIdState(null);
      setPumps([]);
    }
  }, []);

  const fetchPumpsForStation = useCallback(async (stationId: string) => {
    setPumpsLoading(true);
    setPumpsError(null);
    try {
      const token = await getStoredToken();
      if (!token) return;
      const client = createApiClient(BASE_URL, { token });
      const res = await client.listPumps(stationId);
      setPumps(res.pumps);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load station pumps';
      setPumpsError(msg);
      setPumps([]);
    } finally {
      setPumpsLoading(false);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (!token) {
        setAuthState('unauthenticated');
        setSession(null);
        setAssignedStations([]);
        setPumps([]);
        return;
      }

      const client = createApiClient(BASE_URL, { token });
      const me = await client.me();
      setSession(me);
      setAuthState('authenticated');
      setSyncState('ONLINE');

      await fetchStationsForSession(token, me.assignedStations);
    } catch {
      await clearStoredToken();
      setSession(null);
      setAssignedStations([]);
      setPumps([]);
      setAuthState('unauthenticated');
    }
  }, [fetchStationsForSession]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (activeStationId) {
      fetchPumpsForStation(activeStationId);
    } else {
      setPumps([]);
    }
  }, [activeStationId, fetchPumpsForStation]);

  const login = useCallback(
    async (me: AuthMeResponse, token?: string) => {
      if (token) {
        await setStoredToken(token);
      }
      setSession(me);
      setAuthState('authenticated');
      setSyncState('ONLINE');
      const activeToken = token ?? (await getStoredToken());
      if (activeToken) {
        await fetchStationsForSession(activeToken, me.assignedStations);
      }
    },
    [fetchStationsForSession],
  );

  const logout = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const client = createApiClient(BASE_URL, { token });
        await client.logout();
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      await clearStoredToken();
      setSession(null);
      setAssignedStations([]);
      setActiveStationIdState(null);
      setPumps([]);
      setAuthState('unauthenticated');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    await restoreSession();
  }, [restoreSession]);

  const refreshStations = useCallback(async () => {
    const token = await getStoredToken();
    if (token && session) {
      await fetchStationsForSession(token, session.assignedStations);
    }
  }, [fetchStationsForSession, session]);

  const refreshPumps = useCallback(async () => {
    if (activeStationId) {
      await fetchPumpsForStation(activeStationId);
    }
  }, [activeStationId, fetchPumpsForStation]);

  const setActiveStationId = useCallback((id: string) => {
    setActiveStationIdState(id);
  }, []);

  const activeStation =
    assignedStations.find((s) => s.id === activeStationId) ?? assignedStations[0] ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        authState,
        assignedStations,
        activeStation,
        setActiveStationId,
        pumps,
        pumpsLoading,
        pumpsError,
        syncState,
        pendingCount,
        setSyncState,
        login,
        logout,
        refreshSession,
        refreshStations,
        refreshPumps,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
