import type { Health } from '@jala-ops/types';
import { healthSchema } from '@jala-ops/validation';

export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch) {
  return {
    async health(): Promise<Health> {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/health`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error('Service unavailable. Check your connection and try again.');
      return healthSchema.parse(await response.json());
    },
  };
}
