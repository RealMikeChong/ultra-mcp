import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { PricingData, PricingDataSchema, CacheFile, CacheMetadata, ModelPricingSchema } from './types';

export class PricingFetcher {
  private static readonly LITELLM_PRICING_URL = 
    'https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json';
  
  private static readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly cacheFilePath: string;
  private readonly ttl: number;

  constructor(ttl: number = PricingFetcher.DEFAULT_TTL) {
    this.ttl = ttl;
    this.cacheFilePath = this.getCacheFilePath();
  }

  private getCacheFilePath(): string {
    const platform = process.platform;
    let configDir: string;

    if (platform === 'win32') {
      // Windows
      configDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ultra-mcp-nodejs');
    } else {
      // macOS and Linux
      configDir = path.join(os.homedir(), '.config', 'ultra-mcp');
    }

    return path.join(configDir, 'litellm-pricing-cache.json');
  }

  private async ensureCacheDirectory(): Promise<void> {
    const dir = path.dirname(this.cacheFilePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async fetchFromRemote(): Promise<PricingData> {
    try {
      const response = await fetch(PricingFetcher.LITELLM_PRICING_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pricing data: ${response.statusText}`);
      }

      const rawData: unknown = await response.json();
      
      // Type guard to ensure rawData is an object
      if (typeof rawData !== 'object' || rawData === null) {
        throw new Error('Invalid pricing data format received from API');
      }
      
      // Filter out non-text models and invalid entries
      const filteredData: PricingData = {};
      
      for (const [modelName, modelData] of Object.entries(rawData)) {
        // Skip image models and other non-text models
        if (modelName.includes('dall-e') || 
            modelName.includes('whisper') || 
            modelName.includes('tts') ||
            modelName.includes('embedding') ||
            modelName.includes('moderation') ||
            modelName.includes('flux') ||
            modelName.includes('stable-diffusion') ||
            modelName.includes('sample_spec')) {
          continue;
        }
        
        // Skip non-object model data
        if (typeof modelData !== 'object' || modelData === null) {
          continue;
        }
        
        // Try to validate this model's data
        try {
          // Convert string numbers to numbers for token limits
          const processedData = {
            ...modelData,
            max_tokens: typeof (modelData as any).max_tokens === 'string' 
              ? parseInt((modelData as any).max_tokens, 10) 
              : (modelData as any).max_tokens,
            max_input_tokens: typeof (modelData as any).max_input_tokens === 'string' 
              ? parseInt((modelData as any).max_input_tokens, 10) 
              : (modelData as any).max_input_tokens,
            max_output_tokens: typeof (modelData as any).max_output_tokens === 'string' 
              ? parseInt((modelData as any).max_output_tokens, 10) 
              : (modelData as any).max_output_tokens,
          };
          
          // Only include if it has valid token pricing
          if (processedData.input_cost_per_token !== undefined && 
              processedData.output_cost_per_token !== undefined) {
            const validated = ModelPricingSchema.parse(processedData);
            filteredData[modelName] = validated;
          }
        } catch {
          // Skip invalid models
          continue;
        }
      }
      
      return filteredData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid pricing data format: ${error.message}`);
      }
      throw error;
    }
  }

  async saveToCache(data: PricingData): Promise<void> {
    await this.ensureCacheDirectory();

    const cacheFile: CacheFile = {
      metadata: {
        timestamp: Date.now(),
        source: PricingFetcher.LITELLM_PRICING_URL,
        ttl: this.ttl,
      },
      data,
    };

    await fs.writeFile(
      this.cacheFilePath,
      JSON.stringify(cacheFile, null, 2),
      'utf-8'
    );
  }

  async loadFromCache(): Promise<CacheFile | null> {
    try {
      const content = await fs.readFile(this.cacheFilePath, 'utf-8');
      const cacheFile = JSON.parse(content) as CacheFile;
      
      // Validate the cached data structure
      PricingDataSchema.parse(cacheFile.data);
      
      return cacheFile;
    } catch (error) {
      // Cache doesn't exist or is invalid
      return null;
    }
  }

  isCacheExpired(metadata: CacheMetadata): boolean {
    const age = Date.now() - metadata.timestamp;
    return age > this.ttl;
  }

  async getLatestPricing(forceRefresh: boolean = false): Promise<PricingData> {
    // Try to load from cache first
    if (!forceRefresh) {
      const cached = await this.loadFromCache();
      
      if (cached && !this.isCacheExpired(cached.metadata)) {
        // Cache is valid, use it
        return cached.data;
      }
    }

    // Cache is expired or doesn't exist, try to fetch new data
    try {
      const freshData = await this.fetchFromRemote();
      
      // Save to cache for next time
      await this.saveToCache(freshData);
      
      return freshData;
    } catch (fetchError) {
      // Network error, fall back to stale cache if available
      const cached = await this.loadFromCache();
      
      if (cached) {
        console.warn('Using stale cache due to network error:', fetchError);
        return cached.data;
      }
      
      // No cache available and network failed
      // Return fallback data or throw
      throw new Error(`Failed to fetch pricing data and no cache available: ${fetchError}`);
    }
  }

  async getCacheInfo(): Promise<{ exists: boolean; age?: number; expired?: boolean } | null> {
    const cached = await this.loadFromCache();
    
    if (!cached) {
      return { exists: false };
    }

    const age = Date.now() - cached.metadata.timestamp;
    
    return {
      exists: true,
      age: Math.floor(age / 1000), // Age in seconds
      expired: this.isCacheExpired(cached.metadata),
    };
  }

  async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cacheFilePath);
    } catch (error) {
      // Cache file doesn't exist, that's ok
    }
  }
}