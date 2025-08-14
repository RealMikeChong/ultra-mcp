import { vi, afterEach } from 'vitest';

// Set NODE_ENV using Bun's environment API for Express apps in tests
Bun.env.NODE_ENV = 'test';

// Ensure process and process.env exist globally for Express compatibility
if (!globalThis.process) {
  globalThis.process = {
    env: Bun.env
  } as any;
} else if (!globalThis.process.env) {
  globalThis.process.env = Bun.env;
}

// Also ensure process.env has the value for compatibility
if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_ENV = 'test';
} else if (typeof process !== 'undefined') {
  (process as any).env = { NODE_ENV: 'test', ...Bun.env };
}

// Make vi globally available for mock hoisting
globalThis.vi = vi;

// Mock console.error to avoid cluttering test output
global.console.error = vi.fn();

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});