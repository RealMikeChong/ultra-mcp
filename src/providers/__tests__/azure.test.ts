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