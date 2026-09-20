import { z } from 'zod';
import {
  ROLES,
  PUMP_STATUSES,
  GPS_STATUSES,
  READING_SOURCE_TYPES,
  SYNC_SOURCES,
} from '@jala-ops/constants';

export const roleSchema = z.enum(ROLES);
export const idSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const loginSchema = z
  .object({ username: z.string().trim().min(3).max(80), password: z.string().min(1).max(128) })
  .strict();
export const newPasswordSchema = z.string().min(12).max(128);
export const stationSchema = z
  .object({
    id: idSchema,
    code: z.string().min(2).max(30),
    name: z.string().trim().min(2).max(160),
    locality: z.string().trim().min(2).max(120),
    active: z.boolean(),
  })
  .strict();
export const pumpSchema = z
  .object({
    id: idSchema,
    stationId: idSchema,
    code: z.string().min(2).max(30),
    name: z.string().min(2).max(100),
    ratedPowerKw: z.number().positive().finite(),
    capacityM3H: z.number().positive().finite(),
    status: z.enum(PUMP_STATUSES),
  })
  .strict();
export const createUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        'Username must contain only letters, numbers, dots, dashes or underscores',
      ),
    displayName: z.string().trim().min(2).max(120),
    password: newPasswordSchema,
    role: roleSchema,
    active: z.boolean().default(true),
  })
  .strict();

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    role: roleSchema.optional(),
    active: z.boolean().optional(),
    password: newPasswordSchema.optional(),
  })
  .strict();

export const createAssignmentSchema = z
  .object({
    stationId: idSchema,
  })
  .strict();

export const createStationSchema = z
  .object({
    code: z.string().trim().min(2).max(30).toUpperCase(),
    name: z.string().trim().min(2).max(160),
    locality: z.string().trim().min(2).max(120),
    isDemo: z.boolean().default(false),
  })
  .strict();

export const updateStationSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    locality: z.string().trim().min(2).max(120).optional(),
    active: z.boolean().optional(),
    isDemo: z.boolean().optional(),
  })
  .strict();

export const createPumpSchema = z
  .object({
    stationId: idSchema,
    code: z.string().trim().min(2).max(30).toUpperCase(),
    name: z.string().trim().min(2).max(100),
    ratedPowerKw: z.number().positive().finite(),
    capacityM3H: z.number().positive().finite(),
    status: z.enum(PUMP_STATUSES).default('STOPPED'),
  })
  .strict();

export const updatePumpSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    ratedPowerKw: z.number().positive().finite().optional(),
    capacityM3H: z.number().positive().finite().optional(),
    status: z.enum(PUMP_STATUSES).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const healthSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('ready'),
  service: z.literal('jala-ops-api'),
});
export const offlineEnvelopeSchema = z
  .object({
    client_uuid: z.string().uuid(),
    captured_at: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export const sopResponseInputSchema = z
  .object({
    sopItemId: idSchema,
    response: z
      .union([z.boolean(), z.number().int().min(0).max(1)])
      .transform((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export const startPumpSchema = z
  .object({
    clientUuid: z.string().uuid(),
    stationId: idSchema,
    pumpId: idSchema,
    openingFlowMeter: z.number().nonnegative().finite(),
    openingEnergyMeter: z.number().nonnegative().finite(),
    inletPressure: z.number().finite().optional(),
    outletPressure: z.number().finite().optional(),
    tankLevel: z.number().min(0).max(100).finite().optional(),
    sopResponses: z.array(sopResponseInputSchema),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export const stopPumpSchema = z
  .object({
    clientUuid: z.string().uuid(),
    stationId: idSchema,
    pumpId: idSchema,
    closingFlowMeter: z.number().nonnegative().finite(),
    closingEnergyMeter: z.number().nonnegative().finite(),
    inletPressure: z.number().finite().optional(),
    outletPressure: z.number().finite().optional(),
    tankLevel: z.number().min(0).max(100).finite().optional(),
    shutdownReason: z.string().trim().min(2).max(120).optional(),
    sopResponses: z.array(sopResponseInputSchema),
    remarks: z.string().trim().max(500).optional(),
  })
  .strict();

export const createReadingSchema = z
  .object({
    clientUuid: z.string().uuid(),
    stationId: idSchema,
    pumpId: idSchema.optional().nullable(),
    flowMeter: z.number().nonnegative().finite(),
    energyMeter: z.number().nonnegative().finite(),
    inletPressure: z.number().nonnegative().finite(),
    outletPressure: z.number().nonnegative().finite(),
    tankLevelPct: z.number().min(0).max(100).finite(),
    residualChlorine: z.number().nonnegative().finite().optional().nullable(),
    turbidity: z.number().nonnegative().finite().optional().nullable(),
    remarks: z.string().trim().max(500).optional().nullable(),
    latitude: z.number().min(-90).max(90).finite().optional().nullable(),
    longitude: z.number().min(-180).max(180).finite().optional().nullable(),
    gpsAccuracyM: z.number().nonnegative().finite().optional().nullable(),
    gpsStatus: z.enum(GPS_STATUSES).default('NOT_AVAILABLE'),
    photoKey: z.string().trim().min(5).max(300).optional().nullable(),
    sourceType: z.enum(READING_SOURCE_TYPES).default('MANUAL'),
    syncSource: z.enum(SYNC_SOURCES).default('ONLINE'),
    recordedAt: z.string().datetime().optional().nullable(),
  })
  .strict();

export const readingQuerySchema = z
  .object({
    station_id: idSchema.optional(),
    pump_id: idSchema.optional(),
    user_id: idSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    source_type: z.enum(READING_SOURCE_TYPES).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50),
    cursor: z.string().optional(),
  })
  .strict();
