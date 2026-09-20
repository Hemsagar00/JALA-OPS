import { expect, it } from 'vitest';
import { createApiClient } from './index';
it('rejects unavailable services and malformed successful responses', async () => {
  const unavailable = createApiClient(
    'https://test.example',
    async () => new Response('', { status: 503 }),
  );
  await expect(unavailable.health()).rejects.toThrow('Service unavailable');
  const malformed = createApiClient('https://test.example', async () =>
    Response.json({ status: 'fake' }),
  );
  await expect(malformed.health()).rejects.toThrow();
});
