import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run tests in these locations
    include: [
      'src/**/*.test.{ts,tsx,js,jsx}',
      'src/__tests__/**/*.{ts,tsx,js,jsx}',
      '*.test.{ts,tsx,js,jsx}',
      'regression-tests.test.ts',
    ],
    // Exclude e2e tests (they use @playwright/test)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{祖,node_modules}/**',
    ],
  },
});