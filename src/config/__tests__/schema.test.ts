import { describe, it, expect } from 'vitest';
import { ConfigSchema, defaultConfig, type Config } from '../schema';

describe('Config Schema', () => {
  describe('defaultConfig', () => {
    it('should have all provider API keys undefined by default', () => {
      expect(defaultConfig.openai?.apiKey).toBeUndefined();
      expect(defaultConfig.openai?.baseURL).toBeUndefined();
      expect(defaultConfig.google?.apiKey).toBeUndefined();
      expect(defaultConfig.google?.baseURL).toBeUndefined();
      expect(defaultConfig.azure?.apiKey).toBeUndefined();
      expect(defaultConfig.azure?.baseURL).toBeUndefined();
      expect(defaultConfig.xai?.apiKey).toBeUndefined();
      expect(defaultConfig.xai?.baseURL).toBeUndefined();
    });
  });

  describe('ConfigSchema validation', () => {
    it('should accept valid OpenAI configuration', () => {
      const config: Config = {
        openai: { apiKey: 'sk-test-key' },
      };
      
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept valid Google configuration', () => {
      const config: Config = {
        google: { apiKey: 'AIza-test-key' },
      };
      
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept valid Azure configuration with baseURL', () => {
      const config: Config = {
        azure: {
          apiKey: 'test-azure-key',
          baseURL: 'https://test.openai.azure.com',
        },
      };
      
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept valid Azure configuration with resourceName', () => {
      const config: Config = {
        azure: {
          apiKey: 'test-azure-key',
          resourceName: 'test-resource',
        },
      };
      
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });


    it('should accept configuration with all providers', () => {
      const config: Config = {
        openai: { apiKey: 'sk-test', baseURL: undefined },
        google: { apiKey: 'AIza-test', baseURL: undefined },
        azure: {
          apiKey: 'azure-test',
          baseURL: 'https://test.openai.azure.com',
        },
        xai: { apiKey: undefined, baseURL: undefined },
      };
      
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept empty configuration', () => {
      const config: Config = {};
      
      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid configuration structure', () => {
      const invalidConfig = {
        openai: 'not-an-object',
      };
      
      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should handle configuration with extra fields', () => {
      const configWithExtra = {
        openai: { apiKey: 'sk-test' },
        unknownProvider: { apiKey: 'test' },
      };
      
      const result = ConfigSchema.safeParse(configWithExtra);
      // Zod by default strips unknown keys unless .strict() is used
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          openai: { apiKey: 'sk-test' },
        });
      }
    });
  });
});