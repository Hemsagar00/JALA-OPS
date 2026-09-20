import type { ROLES, PUMP_STATUSES } from '@jala-ops/constants';
export type Role = (typeof ROLES)[number];
export type PumpStatus = (typeof PUMP_STATUSES)[number];
export type OperationType = 'START' | 'STOP';
export type OperationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

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

// SOP Types
export interface SopTemplate {
  id: string;
  name: string;
  operationType: OperationType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SopItem {
  id: string;
  templateId: string;
  sequenceNo: number;
  label: string;
  required: boolean;
  active: boolean;
}
export interface SopTemplateWithItems extends SopTemplate {
  items: SopItem[];
}
export interface SopResponseInput {
  sopItemId: string;
  response: number; // 1 for Yes / Checked, 0 for No
  remarks?: string;
}
export interface SopResponse {
  id: string;
  operationId: string;
  sopItemId: string;
  response: number;
  remarks: string | null;
  createdAt: string;
}

// Pump Operations
export interface PumpOperation {
  id: string;
  clientUuid: string;
  stationId: string;
  pumpId: string;
  userId: string;
  operationType: OperationType;
  status: OperationStatus;
  startedAt: string;
  stoppedAt: string | null;
  openingFlowMeter: number;
  closingFlowMeter: number | null;
  openingEnergyMeter: number;
  closingEnergyMeter: number | null;
  inletPressureStart: number | null;
  inletPressureStop: number | null;
  outletPressureStart: number | null;
  outletPressureStop: number | null;
  tankLevelStart: number | null;
  tankLevelStop: number | null;
  shutdownReason: string | null;
  remarks: string | null;
  runningDurationSeconds: number | null;
  waterPumped: number | null;
  energyUsedKwh: number | null;
  energyPerUnit: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PumpOperationDetail extends PumpOperation {
  sopResponses?: SopResponse[];
  pumpCode?: string;
  pumpName?: string;
  stationName?: string;
  operatorName?: string;
}

export interface StartPumpPayload {
  clientUuid: string;
  stationId: string;
  pumpId: string;
  openingFlowMeter: number;
  openingEnergyMeter: number;
  inletPressure?: number;
  outletPressure?: number;
  tankLevel?: number;
  sopResponses: SopResponseInput[];
  remarks?: string;
}

export interface StopPumpPayload {
  clientUuid: string;
  stationId: string;
  pumpId: string;
  closingFlowMeter: number;
  closingEnergyMeter: number;
  inletPressure?: number;
  outletPressure?: number;
  tankLevel?: number;
  shutdownReason?: string;
  sopResponses: SopResponseInput[];
  remarks?: string;
}

export interface OperationCalculations {
  runningDurationSeconds: number;
  waterPumped: number;
  energyUsedKwh: number;
  energyPerUnit: number;
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
