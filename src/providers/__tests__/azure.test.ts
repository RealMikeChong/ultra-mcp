import { describe, it, expect, beforeEach } from 'vitest';
import { AzureOpenAIProvider } from '../azure';
import { ConfigManager } from '../../config/manager';

describe('AzureOpenAIProvider', () => {
  let provider: AzureOpenAIProvider;
  let mockConfigManager: Partial<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = {
      getConfig: () => Promise.resolve({
        azure: {
          apiKey: 'test-azure-key',
          resourceName: 'test-resource',
        }
      })
    };

    provider = new AzureOpenAIProvider(mockConfigManager as ConfigManager);
  });

  describe('constructor', () => {
    it('should initialize with config manager', () => {
      expect(provider.name).toBe('azure');
    });
  });

  describe('getDefaultModel', () => {
    it('should return configured default model when provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          defaultModel: 'gpt-4o',
          models: ['gpt-4o', 'gpt-4o-mini'],
        }
      });

      const defaultModel = await provider.getDefaultModel();
      expect(defaultModel).toBe('gpt-4o');
    });

    it('should return fallback default when no config provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
        }
      });

      const defaultModel = await provider.getDefaultModel();
      expect(defaultModel).toBe('o3');
    });

    it('should return fallback default when defaultModel is undefined', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          defaultModel: undefined,
          models: ['gpt-4o'],
        }
      });

      const defaultModel = await provider.getDefaultModel();
      expect(defaultModel).toBe('o3');
    });
  });

  describe('listModels', () => {
    it('should return configured models when provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-35-turbo'],
        }
      });

      const models = await provider.listModels();
      expect(models).toEqual(['gpt-4o', 'gpt-4o-mini', 'gpt-35-turbo']);
    });

    it('should return fallback models when no config provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
        }
      });

      const models = await provider.listModels();
      expect(models).toEqual(['o3']);
    });

    it('should return empty array when models array is empty', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          models: [],
        }
      });

      const models = await provider.listModels();
      expect(models).toEqual([]);
    });

    it('should return fallback models when models is undefined', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          models: undefined,
        }
      });

      const models = await provider.listModels();
      expect(models).toEqual(['o3']);
    });
  });

  describe('getCredentials', () => {
    it('should prefer resourceName over baseURL', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'preferred-resource',
          baseURL: 'https://fallback.openai.azure.com',
        }
      });

      const credentials = await provider['getCredentials']();
      expect(credentials.resourceName).toBe('preferred-resource');
      expect(credentials.baseURL).toBeUndefined();
    });

    it('should extract resourceName from baseURL when resourceName not provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          baseURL: 'https://extracted-resource.openai.azure.com',
        }
      });

      const credentials = await provider['getCredentials']();
      expect(credentials.resourceName).toBe('extracted-resource');
    });

    it('should throw error when no API key provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          resourceName: 'test-resource',
        }
      });

      await expect(provider['getCredentials']()).rejects.toThrow(
        'Azure OpenAI API key not configured'
      );
    });

    it('should throw error when neither resourceName nor baseURL provided', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
        }
      });

      await expect(provider['getCredentials']()).rejects.toThrow(
        'Azure resource name or base URL required'
      );
    });

    it('should use environment variables as fallback', async () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env.AZURE_API_KEY = 'env-api-key';
      process.env.AZURE_RESOURCE_NAME = 'env-resource';

      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {}
      });

      try {
        const credentials = await provider['getCredentials']();
        expect(credentials.apiKey).toBe('env-api-key');
        expect(credentials.resourceName).toBe('env-resource');
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('configuration edge cases', () => {
    it('should handle null config values gracefully', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          models: null as any,
          defaultModel: null as any,
        }
      });

      const models = await provider.listModels();
      const defaultModel = await provider.getDefaultModel();

      expect(models).toEqual(['o3']);
      expect(defaultModel).toBe('o3');
    });

    it('should handle config with mixed valid/invalid models', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          models: ['gpt-4o', '', null, 'gpt-4o-mini'] as any,
        }
      });

      const models = await provider.listModels();
      // Should return the configured array as-is (validation happens at schema level)
      expect(models).toEqual(['gpt-4o', '', null, 'gpt-4o-mini']);
    });
  });

  describe('async behavior', () => {
    it('should handle concurrent calls to getDefaultModel', async () => {
      let configCallCount = 0;
      mockConfigManager.getConfig = () => {
        configCallCount++;
        return Promise.resolve({
          azure: {
            apiKey: 'test-key',
            resourceName: 'test-resource',
            defaultModel: 'gpt-4o',
          }
        });
      };

      const promises = [
        provider.getDefaultModel(),
        provider.getDefaultModel(),
        provider.getDefaultModel()
      ];

      const results = await Promise.all(promises);
      
      expect(results).toEqual(['gpt-4o', 'gpt-4o', 'gpt-4o']);
      expect(configCallCount).toBe(3); // Each call should load config independently
    });

    it('should handle concurrent calls to listModels', async () => {
      mockConfigManager.getConfig = () => Promise.resolve({
        azure: {
          apiKey: 'test-key',
          resourceName: 'test-resource',
          models: ['gpt-4o', 'gpt-4o-mini'],
        }
      });

      const promises = [
        provider.listModels(),
        provider.listModels()
      ];

      const results = await Promise.all(promises);
      
      expect(results[0]).toEqual(['gpt-4o', 'gpt-4o-mini']);
      expect(results[1]).toEqual(['gpt-4o', 'gpt-4o-mini']);
    });
  });
});