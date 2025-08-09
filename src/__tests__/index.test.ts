import { describe, it, expect } from 'vitest';

describe('Server Startup', () => {
  it('should be able to import start-server module', async () => {
    // Just test that the module can be imported without errors
    const { createServer } = await import('../server');
    expect(createServer).toBeDefined();
    expect(typeof createServer).toBe('function');
  });

  it('should be able to import config manager', async () => {
    // Test that ConfigManager can be imported
    const { ConfigManager } = await import('../config/manager');
    expect(ConfigManager).toBeDefined();
    expect(typeof ConfigManager).toBe('function');
  });
});