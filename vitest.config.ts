import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'workers/**/*.test.ts', 'apps/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
