import type { ROLES, PUMP_STATUSES } from '@jala-ops/constants';
export type Role = (typeof ROLES)[number];
export type PumpStatus = (typeof PUMP_STATUSES)[number];
export interface AuthUser {
  id: string;
  displayName: string;
  role: Role;
}
export interface Station {
  id: string;
  code: string;
  name: string;
  locality: string;
  active: boolean;
}
export interface Pump {
  id: string;
  stationId: string;
  code: string;
  name: string;
  ratedPowerKw: number;
  capacityM3H: number;
  status: PumpStatus;
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
