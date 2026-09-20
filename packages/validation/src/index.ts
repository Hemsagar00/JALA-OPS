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
