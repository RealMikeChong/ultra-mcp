import { AIProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { AzureOpenAIProvider } from "./azure";
import { GrokProvider } from "./grok";
import { ConfigManager } from "../config/manager";

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize all providers
    this.providers.set("openai", new OpenAIProvider(this.configManager));
    this.providers.set("gemini", new GeminiProvider(this.configManager));
    this.providers.set("azure", new AzureOpenAIProvider(this.configManager));
    this.providers.set("grok", new GrokProvider(this.configManager));
  }

  getProvider(name: string): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unknown provider: ${name}. Available providers: ${Array.from(this.providers.keys()).join(", ")}`);
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getAvailableModels(): Record<string, string[]> {
    const models: Record<string, string[]> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        models[name] = provider.listModels();
      } catch (error) {
        // Provider might not be configured, skip it
        models[name] = [];
      }
    }
    
    return models;
  }

  async getConfiguredProviders(): Promise<string[]> {
    const config = await this.configManager.getConfig();
    const configured: string[] = [];

    if (config.openai?.apiKey || process.env.OPENAI_API_KEY) {
      configured.push("openai");
    }

    if (config.google?.apiKey || process.env.GOOGLE_API_KEY) {
      configured.push("gemini");
    }

    if ((config.azure?.apiKey || process.env.AZURE_API_KEY) && 
        (config.azure?.baseURL || process.env.AZURE_BASE_URL)) {
      configured.push("azure");
    }

    if (config.xai?.apiKey || process.env.XAI_API_KEY) {
      configured.push("grok");
    }

    return configured;
  }

  async getPreferredProvider(preferredProviders?: string[]): Promise<string> {
    const configured = await this.getConfiguredProviders();
    
    // If Azure is configured, always prefer it
    if (configured.includes("azure")) {
      return "azure";
    }
    
    // If preferred providers are specified, use the first configured one
    if (preferredProviders) {
      for (const provider of preferredProviders) {
        if (configured.includes(provider)) {
          return provider;
        }
      }
    }
    
    // Otherwise, return the first configured provider
    if (configured.length > 0) {
      return configured[0];
    }
    
    throw new Error("No AI providers configured. Run 'ultra-mcp config' to set up API keys.");
  }
}