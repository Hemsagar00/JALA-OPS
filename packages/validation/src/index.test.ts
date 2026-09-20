import { describe, expect, it } from 'vitest';
import { pumpSchema, offlineEnvelopeSchema, loginSchema } from './index';
describe('shared request validation', () => {
  it('rejects invalid capacities, statuses and unexpected fields', () => {
    const pump = {
      id: 'pump-1',
      stationId: 'st-1',
      code: 'P01',
      name: 'Duty pump',
      ratedPowerKw: 75,
      capacityM3H: 180,
      status: 'STOPPED',
    };
    expect(pumpSchema.safeParse(pump).success).toBe(true);
    expect(pumpSchema.safeParse({ ...pump, capacityM3H: -1 }).success).toBe(false);
    expect(pumpSchema.safeParse({ ...pump, status: 'UNKNOWN' }).success).toBe(false);
    expect(pumpSchema.safeParse({ ...pump, admin: true }).success).toBe(false);
  });
  it('requires UUID idempotency keys and timestamped offline writes', () => {
    expect(
      offlineEnvelopeSchema.safeParse({
        client_uuid: 'not-uuid',
        captured_at: 'yesterday',
        payload: {},
      }).success,
    ).toBe(false);
    expect(
      offlineEnvelopeSchema.safeParse({
        client_uuid: crypto.randomUUID(),
        captured_at: new Date().toISOString(),
        payload: {},
      }).success,
    ).toBe(true);
  });
  it('does not trim a password', () => {
    expect(
      loginSchema.parse({ username: ' operator ', password: ' spaced password ' }).password,
    ).toBe(' spaced password ');
  });
});
