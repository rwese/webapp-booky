import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Add globals for test environment
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    // Only run tests in these locations
    include: [
      'src/**/*.test.{ts,tsx,js,jsx}',
      'src/__tests__/**/*.{ts,tsx,js,jsx}',
      '*.test.{ts,tsx,js,jsx}',
      'regression-tests.test.ts',
      'tests/unit/**/*.test.{ts,tsx,js,jsx}',
    ],
    // Exclude e2e tests and setup files (they use @playwright/test)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{祖,node_modules}/**',
      'src/__tests__/setup.ts', // Exclude setup file from test discovery
    ],
    // Coverage configuration for CI
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/types/**',
        'src/vite-env.d.ts',
      ],
    },
  },
});