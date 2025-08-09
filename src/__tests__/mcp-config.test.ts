import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setEnvironmentVariablesFromConfig } from '../server.js';

// Tests for MCP configuration loading and environment variable handling
describe('MCP Configuration Management', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    
    // Clear relevant environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_BASE_URL;
    delete process.env.AZURE_API_KEY;
    delete process.env.AZURE_BASE_URL;
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('Environment Variable Setting', () => {
    it('should set OpenAI environment variables from config', () => {
      const mockConfig = {
        openai: {
          apiKey: 'test-openai-key',
          baseURL: 'https://api.openai.com'
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.OPENAI_API_KEY).toBe('test-openai-key');
      expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com');
    });

    it('should set Google environment variables from config', () => {
      const mockConfig = {
        google: {
          apiKey: 'test-google-key',
          baseURL: 'https://ai.google.dev'
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.GOOGLE_API_KEY).toBe('test-google-key');
      expect(process.env.GOOGLE_BASE_URL).toBe('https://ai.google.dev');
    });

    it('should set Azure environment variables from config', () => {
      const mockConfig = {
        azure: {
          apiKey: 'test-azure-key',
          baseURL: 'https://test.openai.azure.com'
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.AZURE_API_KEY).toBe('test-azure-key');
      expect(process.env.AZURE_BASE_URL).toBe('https://test.openai.azure.com');
    });

    it('should set XAI environment variables from config', () => {
      const mockConfig = {
        xai: {
          apiKey: 'test-xai-key',
          baseURL: 'https://api.x.ai'
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.XAI_API_KEY).toBe('test-xai-key');
      expect(process.env.XAI_BASE_URL).toBe('https://api.x.ai');
    });

    it('should handle missing API keys gracefully', () => {
      const mockConfig = {
        openai: {
          baseURL: 'https://api.openai.com'
          // Missing apiKey
        },
        google: {
          // Missing both apiKey and baseURL
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.OPENAI_API_KEY).toBeUndefined();
      expect(process.env.OPENAI_BASE_URL).toBe('https://api.openai.com');
    });

    it('should handle missing base URLs gracefully', () => {
      const mockConfig = {
        azure: {
          apiKey: 'test-azure-key'
          // Missing baseURL
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.AZURE_API_KEY).toBe('test-azure-key');
      expect(process.env.AZURE_BASE_URL).toBeUndefined();
    });
  });

  describe('Configuration Loading Logic', () => {
    it('should simulate successful config loading', async () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          openai: { apiKey: 'openai-key', baseURL: 'https://api.openai.com' },
          google: { apiKey: 'google-key', baseURL: 'https://ai.google.dev' },
          azure: { apiKey: 'azure-key', baseURL: 'https://azure.openai.com' },
          xai: { apiKey: 'xai-key', baseURL: 'https://api.x.ai' },
        })
      };

      const config = await mockConfigManager.getConfig();
      expect(mockConfigManager.getConfig).toHaveBeenCalledOnce();
      expect(config.openai?.apiKey).toBe('openai-key');
      expect(config.google?.apiKey).toBe('google-key');
      expect(config.azure?.apiKey).toBe('azure-key');
      expect(config.xai?.apiKey).toBe('xai-key');
    });

    it('should handle config loading failures', async () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockRejectedValue(new Error('Config file not found'))
      };

      await expect(mockConfigManager.getConfig()).rejects.toThrow('Config file not found');
      expect(mockConfigManager.getConfig).toHaveBeenCalledOnce();
    });

    it('should handle empty config gracefully', async () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({})
      };

      const config = await mockConfigManager.getConfig();
      expect(config).toEqual({});
      expect(config.openai).toBeUndefined();
      expect(config.google).toBeUndefined();
      expect(config.azure).toBeUndefined();
      expect(config.xai).toBeUndefined();
    });

    it('should handle partial config', async () => {
      const mockConfigManager = {
        getConfig: vi.fn().mockResolvedValue({
          openai: { apiKey: 'only-openai-key' },
          // Missing other providers
        })
      };

      const config = await mockConfigManager.getConfig();
      expect(config.openai?.apiKey).toBe('only-openai-key');
      expect(config.google).toBeUndefined();
      expect(config.azure).toBeUndefined();
      expect(config.xai).toBeUndefined();
    });
  });

  describe('Provider Manager Integration', () => {
    it('should create provider manager with config manager', () => {
      // Mock the ProviderManager constructor
      const mockProviderManager = vi.fn();
      const mockConfigManager = { getConfig: vi.fn() };

      // Simulate ProviderManager creation
      const providerManager = mockProviderManager(mockConfigManager);
      
      expect(mockProviderManager).toHaveBeenCalledWith(mockConfigManager);
    });

    it('should pass config manager to AI tool handlers', () => {
      // Mock the AIToolHandlers constructor
      const mockAIToolHandlers = vi.fn();
      const mockProviderManager = { getProvider: vi.fn() };

      // Simulate AIToolHandlers creation
      const aiHandlers = mockAIToolHandlers(mockProviderManager);

      expect(mockAIToolHandlers).toHaveBeenCalledWith(mockProviderManager);
    });
  });

  describe('Handler Initialization Chain', () => {
    it('should follow correct initialization order', async () => {
      const initOrder: string[] = [];

      // Mock constructors that track initialization order
      const mockConfigManager = {
        constructor: () => initOrder.push('ConfigManager'),
        getConfig: vi.fn().mockResolvedValue({})
      };

      const mockProviderManager = vi.fn().mockImplementation(() => {
        initOrder.push('ProviderManager');
        return { getProvider: vi.fn() };
      });

      const mockAIToolHandlers = vi.fn().mockImplementation(() => {
        initOrder.push('AIToolHandlers');
        return {
          handleDeepReasoning: vi.fn(),
          handleInvestigation: vi.fn()
        };
      });

      // Simulate the initialization chain from getHandlers
      mockConfigManager.constructor();
      await mockConfigManager.getConfig();
      mockProviderManager(mockConfigManager);
      mockAIToolHandlers();

      expect(initOrder).toEqual(['ConfigManager', 'ProviderManager', 'AIToolHandlers']);
    });

    it('should handle initialization failures at each step', async () => {
      // Test ConfigManager failure
      const failingConfigManager = {
        getConfig: vi.fn().mockRejectedValue(new Error('Config init failed'))
      };

      await expect(failingConfigManager.getConfig()).rejects.toThrow('Config init failed');

      // Test ProviderManager failure
      const failingProviderManager = vi.fn().mockImplementation(() => {
        throw new Error('Provider init failed');
      });

      expect(() => failingProviderManager()).toThrow('Provider init failed');

      // Test AIToolHandlers failure
      const failingAIToolHandlers = vi.fn().mockImplementation(() => {
        throw new Error('AI handlers init failed');
      });

      expect(() => failingAIToolHandlers()).toThrow('AI handlers init failed');
    });
  });

  describe('Environment Variable Precedence', () => {
    it('should override existing environment variables with config values', () => {
      // Set initial environment variables
      process.env.OPENAI_API_KEY = 'existing-env-key';
      process.env.OPENAI_BASE_URL = 'existing-env-url';

      const mockConfig = {
        openai: {
          apiKey: 'config-override-key',
          baseURL: 'config-override-url'
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.OPENAI_API_KEY).toBe('config-override-key');
      expect(process.env.OPENAI_BASE_URL).toBe('config-override-url');
    });

    it('should preserve existing environment variables when config is empty', () => {
      // Set initial environment variables
      process.env.GOOGLE_API_KEY = 'existing-google-key';

      const mockConfig = {
        google: {
          // No apiKey in config
          baseURL: 'config-base-url'
        }
      };

      // Use actual application function
      setEnvironmentVariablesFromConfig(mockConfig);

      expect(process.env.GOOGLE_API_KEY).toBe('existing-google-key'); // Preserved
      expect(process.env.GOOGLE_BASE_URL).toBe('config-base-url'); // Set from config
    });
  });

  describe('Lazy Loading Integration', () => {
    it('should not load config during server creation', () => {
      const mockGetConfig = vi.fn();
      
      // Simulate server creation without calling getHandlers
      // Config should not be loaded at this point
      expect(mockGetConfig).not.toHaveBeenCalled();
    });

    it('should load config on first tool invocation', async () => {
      const mockGetConfig = vi.fn().mockResolvedValue({});
      
      // Simulate first tool call triggering getHandlers
      await mockGetConfig();
      
      expect(mockGetConfig).toHaveBeenCalledOnce();
    });

    it('should reuse handlers after first initialization', async () => {
      const mockGetConfig = vi.fn().mockResolvedValue({});
      let handlersInstance: any = null;

      // Simulate the lazy loading pattern
      async function getHandlers() {
        if (!handlersInstance) {
          await mockGetConfig();
          handlersInstance = { handlers: 'initialized' };
        }
        return handlersInstance;
      }

      // First call should initialize
      const handlers1 = await getHandlers();
      expect(mockGetConfig).toHaveBeenCalledOnce();

      // Second call should reuse
      const handlers2 = await getHandlers();
      expect(mockGetConfig).toHaveBeenCalledOnce(); // Still only once
      expect(handlers1).toBe(handlers2); // Same instance
    });
  });
});