import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__mocks__/**',
      ],
    },
    setupFiles: ['./src/__tests__/setup.ts'],
    // Enable proper mock hoisting
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});