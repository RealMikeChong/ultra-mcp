import { PricingFetcher } from './fetcher';
import { PricingCalculator } from './calculator';
import { ModelPricing, PricingData, CostCalculation } from './types';

export class PricingService {
  private static instance: PricingService;
  private fetcher: PricingFetcher;
  private calculator: PricingCalculator;
  private pricingDataCache: PricingData | null = null;
  private lastFetchTime: number = 0;
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory cache

  private constructor() {
    this.fetcher = new PricingFetcher();
    this.calculator = new PricingCalculator();
  }

  static getInstance(): PricingService {
    if (!PricingService.instance) {
      PricingService.instance = new PricingService();
    }
    return PricingService.instance;
  }

  /**
   * Get pricing data with in-memory caching for performance
   */
  private async getPricingData(forceRefresh: boolean = false): Promise<PricingData> {
    const now = Date.now();
    
    // Check in-memory cache first
    if (!forceRefresh && 
        this.pricingDataCache && 
        (now - this.lastFetchTime) < this.MEMORY_CACHE_TTL) {
      return this.pricingDataCache;
    }

    // Fetch from file cache or remote
    this.pricingDataCache = await this.fetcher.getLatestPricing(forceRefresh);
    this.lastFetchTime = now;
    
    return this.pricingDataCache;
  }

  /**
   * Get pricing for a specific model
   */
  async getModelPricing(model: string): Promise<ModelPricing | null> {
    try {
      const pricingData = await this.getPricingData();
      const normalizedModel = this.calculator.normalizeModelName(model);
      
      // Try exact match first
      if (pricingData[normalizedModel]) {
        return pricingData[normalizedModel];
      }

      // Try to find by partial match
      for (const [key, value] of Object.entries(pricingData)) {
        if (key.toLowerCase() === normalizedModel.toLowerCase()) {
          return value;
        }
      }

      // Model not found
      console.warn(`Pricing not found for model: ${model} (normalized: ${normalizedModel})`);
      return null;
    } catch (error) {
      console.error('Error getting model pricing:', error);
      return null;
    }
  }

  /**
   * Calculate cost for a model with given token usage
   */
  async calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<CostCalculation | null> {
    const pricing = await this.getModelPricing(model);
    
    if (!pricing) {
      // Return a default calculation with zero cost if pricing not found
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        inputTokens,
        outputTokens,
        model,
        tieredPricingApplied: false,
      };
    }

    return this.calculator.calculateCostFromPricing(
      model,
      pricing,
      inputTokens,
      outputTokens
    );
  }

  /**
   * Refresh the pricing cache
   */
  async refreshCache(): Promise<void> {
    this.pricingDataCache = null;
    this.lastFetchTime = 0;
    await this.getPricingData(true);
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<{
    exists: boolean;
    age?: number;
    expired?: boolean;
    lastInMemoryFetch?: number;
  }> {
    const cacheInfo = await this.fetcher.getCacheInfo();
    
    return {
      exists: cacheInfo?.exists ?? false,
      age: cacheInfo?.age,
      expired: cacheInfo?.expired,
      lastInMemoryFetch: this.lastFetchTime ? Date.now() - this.lastFetchTime : undefined,
    };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    this.pricingDataCache = null;
    this.lastFetchTime = 0;
    await this.fetcher.clearCache();
  }

  /**
   * Get all available models with pricing
   */
  async getAllModels(): Promise<string[]> {
    try {
      const pricingData = await this.getPricingData();
      return Object.keys(pricingData).sort();
    } catch (error) {
      console.error('Error getting all models:', error);
      return [];
    }
  }

  /**
   * Check if a model has pricing information
   */
  async hasModelPricing(model: string): Promise<boolean> {
    const pricing = await this.getModelPricing(model);
    return pricing !== null;
  }

  /**
   * Get a formatted cost estimate
   */
  async getFormattedCostEstimate(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<string | null> {
    const calculation = await this.calculateCost(model, inputTokens, outputTokens);
    
    if (!calculation) {
      return null;
    }

    return this.calculator.getCostEstimateMessage(calculation);
  }

  /**
   * Format a cost value
   */
  formatCost(cost: number): string {
    return this.calculator.formatCost(cost);
  }
}