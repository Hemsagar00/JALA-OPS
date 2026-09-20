import type { ROLES, PUMP_STATUSES } from '@jala-ops/constants';
export type Role = (typeof ROLES)[number];
export type PumpStatus = (typeof PUMP_STATUSES)[number];
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}
export interface AuthMeResponse {
  user: AuthUser;
  assignedStations: string[];
}
export interface LoginResponse {
  token: string;
  expiresAt: number;
  user: AuthUser;
}
export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface StationAssignment {
  userId: string;
  stationId: string;
  createdAt: string;
  stationName?: string;
  stationCode?: string;
}
export interface Station {
  id: string;
  code: string;
  name: string;
  locality: string;
  active: boolean;
  isDemo?: boolean;
}
export interface StationDetail extends Station {
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Pump {
  id: string;
  stationId: string;
  code: string;
  name: string;
  ratedPowerKw: number;
  capacityM3H: number;
  status: PumpStatus;
  active?: boolean;
}
export interface PumpDetail extends Pump {
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Health {
  status: 'ok';
  database: 'ready';
  service: 'jala-ops-api';
}
export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}
export interface OfflineWrite<T> {
  client_uuid: string;
  captured_at: string;
  payload: T;
}
