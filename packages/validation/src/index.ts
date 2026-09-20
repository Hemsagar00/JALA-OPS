import { z } from 'zod';
import { ROLES, PUMP_STATUSES } from '@jala-ops/constants';

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
    client_uuid: z.uuid(),
    captured_at: z.iso.datetime(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
