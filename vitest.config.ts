import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: 'true',
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'workers/**/*.test.ts', 'apps/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
