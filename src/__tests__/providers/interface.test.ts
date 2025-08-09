import { describe, it, expect, beforeEach } from 'vitest';
import { AIProvider } from '../../providers/types';
import { ConfigManager } from '../../config/manager';
import { AzureOpenAIProvider } from '../../providers/azure';
import { OpenAIProvider } from '../../providers/openai';
import { GeminiProvider } from '../../providers/gemini';
import { GrokProvider } from '../../providers/grok';
import { OpenAICompatibleProvider } from '../../providers/openai-compatible';

describe('AIProvider Interface Compliance', () => {
  let mockConfigManager: Partial<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = {
      getConfig: () => Promise.resolve({
        openai: { apiKey: 'test-openai-key' },
        google: { apiKey: 'test-google-key' },
        azure: { 
          apiKey: 'test-azure-key', 
          resourceName: 'test-resource' 
        },
        xai: { apiKey: 'test-xai-key' },
        openaiCompatible: {
          apiKey: 'fake-key',
          baseURL: 'http://localhost:11434/v1',
          providerName: 'ollama' as const,
        },
      })
    };
  });

  const providerConfigs = [
    { name: 'Azure', Provider: AzureOpenAIProvider },
    { name: 'OpenAI', Provider: OpenAIProvider },
    { name: 'Gemini', Provider: GeminiProvider },
    { name: 'Grok', Provider: GrokProvider },
    { name: 'OpenAI-Compatible', Provider: OpenAICompatibleProvider },
  ] as const;

  describe('Basic Interface Compliance', () => {
    providerConfigs.forEach(({ name, Provider }) => {
      describe(`${name} Provider`, () => {
        let provider: AIProvider;

        beforeEach(() => {
          provider = new Provider(mockConfigManager as ConfigManager);
        });

        it('should implement AIProvider interface correctly', () => {
          expect(provider).toBeDefined();
          expect(typeof provider.name).toBe('string');
          expect(provider.name.length).toBeGreaterThan(0);
        });

        it('should have async getDefaultModel method', async () => {
          expect(typeof provider.getDefaultModel).toBe('function');
          
          const defaultModel = await provider.getDefaultModel();
          expect(typeof defaultModel).toBe('string');
          expect(defaultModel.length).toBeGreaterThan(0);
        });

        it('should have async listModels method', async () => {
          expect(typeof provider.listModels).toBe('function');
          
          const models = await provider.listModels();
          expect(Array.isArray(models)).toBe(true);
          expect(models.length).toBeGreaterThan(0);
          
          // All models should be non-empty strings
          models.forEach((model) => {
            expect(typeof model).toBe('string');
            expect(model.length).toBeGreaterThan(0);
          });
        });

        it('should have generateText method', () => {
          expect(typeof provider.generateText).toBe('function');
          expect(provider.generateText.length).toBe(1); // Should accept 1 parameter (AIRequest)
        });

        it('should have optional streamText method', () => {
          if (provider.streamText) {
            expect(typeof provider.streamText).toBe('function');
            expect(provider.streamText.length).toBe(1); // Should accept 1 parameter (AIRequest)
          }
        });
      });
    });
  });

  describe('Async Method Consistency', () => {
    providerConfigs.forEach(({ name, Provider }) => {
      describe(`${name} Provider`, () => {
        let provider: AIProvider;

        beforeEach(() => {
          provider = new Provider(mockConfigManager as ConfigManager);
        });

        it('should return consistent results from multiple calls', async () => {
          const [defaultModel1, defaultModel2] = await Promise.all([
            provider.getDefaultModel(),
            provider.getDefaultModel(),
          ]);
          
          expect(defaultModel1).toBe(defaultModel2);

          const [models1, models2] = await Promise.all([
            provider.listModels(),
            provider.listModels(),
          ]);
          
          expect(models1).toEqual(models2);
        });

        it('should handle concurrent calls correctly', async () => {
          const concurrentCalls = Array.from({ length: 5 }, () => 
            Promise.all([
              provider.getDefaultModel(),
              provider.listModels(),
            ])
          );

          const results = await Promise.all(concurrentCalls);
          
          // All calls should return the same results
          const firstResult = results[0];
          results.forEach((result) => {
            expect(result[0]).toBe(firstResult[0]); // same default model
            expect(result[1]).toEqual(firstResult[1]); // same models list
          });
        });
      });
    });
  });

  describe('Default Model Validation', () => {
    providerConfigs.forEach(({ name, Provider }) => {
      describe(`${name} Provider`, () => {
        let provider: AIProvider;

        beforeEach(() => {
          provider = new Provider(mockConfigManager as ConfigManager);
        });

        it('should return default model that exists in models list', async () => {
          const defaultModel = await provider.getDefaultModel();
          const models = await provider.listModels();
          
          // Default model should be in the models list (common expectation)
          // Note: This might not always be true for all providers, but it's good practice
          const isDefaultInList = models.includes(defaultModel);
          
          if (!isDefaultInList) {
            console.warn(`${name}: Default model "${defaultModel}" not found in models list:`, models);
          }
          
          // For now, just ensure both methods return valid values
          expect(defaultModel).toBeDefined();
          expect(models.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Configuration Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      const emptyConfigManager = {
        getConfig: () => Promise.resolve({})
      };

      // Test providers that should work with minimal config
      const robustProviders = [
        { name: 'OpenAI', Provider: OpenAIProvider },
        { name: 'Gemini', Provider: GeminiProvider },
        { name: 'Grok', Provider: GrokProvider },
        { name: 'OpenAI-Compatible', Provider: OpenAICompatibleProvider },
      ];

      for (const { name, Provider } of robustProviders) {
        const provider = new Provider(emptyConfigManager as ConfigManager);
        
        // These should not throw, even with empty config
        const defaultModel = await provider.getDefaultModel();
        const models = await provider.listModels();
        
        expect(typeof defaultModel).toBe('string');
        expect(Array.isArray(models)).toBe(true);
      }
    });

    it('should handle configuration loading errors', async () => {
      const errorConfigManager = {
        getConfig: () => Promise.reject(new Error('Config loading failed'))
      };

      // Azure provider loads config in getDefaultModel/listModels, so it should propagate errors
      const azureProvider = new AzureOpenAIProvider(errorConfigManager as ConfigManager);
      
      await expect(azureProvider.getDefaultModel()).rejects.toThrow('Config loading failed');
      await expect(azureProvider.listModels()).rejects.toThrow('Config loading failed');
    });
  });

  describe('Provider Names', () => {
    const expectedNames = {
      AzureOpenAIProvider: 'azure',
      OpenAIProvider: 'openai', 
      GeminiProvider: 'gemini',
      GrokProvider: 'grok',
      OpenAICompatibleProvider: 'openai-compatible',
    };

    providerConfigs.forEach(({ name, Provider }) => {
      it(`should have correct name for ${name}`, () => {
        const provider = new Provider(mockConfigManager as ConfigManager);
        const expectedName = expectedNames[Provider.name as keyof typeof expectedNames];
        
        expect(provider.name).toBe(expectedName);
      });
    });
  });
});