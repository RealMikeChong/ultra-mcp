import { describe, it, expect } from 'vitest';

describe('GrokProvider', () => {
  it('should be able to import GrokProvider module', async () => {
    // Just test that the module can be imported without errors
    const { GrokProvider } = await import('../../providers/grok');
    expect(GrokProvider).toBeDefined();
    expect(typeof GrokProvider).toBe('function');
  });

  it('should have correct name and models', async () => {
    const { GrokProvider } = await import('../../providers/grok');
    
    // Create a mock config manager
    const mockConfigManager = {
      getConfig: async () => ({ xai: { apiKey: 'test-key' } })
    };
    
    const provider = new GrokProvider(mockConfigManager as any);
    expect(provider.name).toBe('grok');
    expect(await provider.getDefaultModel()).toBe('grok-4');
    
    const models = await provider.listModels();
    expect(models).toContain('grok-4');
    expect(models.length).toBeGreaterThan(0);
  });
});