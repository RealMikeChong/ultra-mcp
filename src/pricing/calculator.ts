import { ModelPricing, SimplifiedPricing, CostCalculation } from './types';

export class PricingCalculator {
  private static readonly TIERED_PRICING_THRESHOLD = 200_000; // 200k tokens

  /**
   * Normalize model names to match LiteLLM's naming convention
   */
  normalizeModelName(model: string): string {
    // Handle common variations
    const normalizations: Record<string, string> = {
      // OpenAI models
      'gpt-5': 'gpt-5',
      'o3': 'o3',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-4': 'gpt-4',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
      
      // Gemini models
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.0-flash': 'gemini-2.0-flash',
      'gemini-2.0-flash-exp': 'gemini-2.0-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-pro': 'gemini-1.5-pro', // Map old name to new
      
      // Anthropic models
      'claude-3-5-sonnet': 'claude-3.5-sonnet',
      'claude-3-5-sonnet-20241022': 'claude-3.5-sonnet',
      'claude-3-opus': 'claude-3-opus',
      'claude-3-sonnet': 'claude-3-sonnet',
      'claude-3-haiku': 'claude-3-haiku',
      
      // xAI Grok models
      'grok-4': 'grok-4',
      'grok-3': 'grok-3',
      'grok-2': 'grok-2',
      'grok-1': 'grok-1',
      
      // Add Azure-specific mappings if needed
      'gpt-5-azure': 'gpt-5',
      'o3-azure': 'o3',
    };

    // Check if we have a direct mapping
    const normalized = normalizations[model.toLowerCase()];
    if (normalized) {
      return normalized;
    }

    // Handle Azure deployment names (e.g., "my-gpt-5-deployment" -> "gpt-5")
    for (const [pattern, replacement] of Object.entries(normalizations)) {
      if (model.toLowerCase().includes(pattern.toLowerCase())) {
        return replacement;
      }
    }

    // Return as-is if no normalization found
    return model;
  }

  /**
   * Convert ModelPricing to SimplifiedPricing for easier calculation
   */
  simplifyPricing(model: string, pricing: ModelPricing): SimplifiedPricing {
    return {
      model,
      inputCostPerToken: pricing.input_cost_per_token ?? 0,
      outputCostPerToken: pricing.output_cost_per_token ?? 0,
      inputCostPerTokenAbove200k: pricing.input_cost_per_token_above_200k_tokens,
      outputCostPerTokenAbove200k: pricing.output_cost_per_token_above_200k_tokens,
      maxInputTokens: typeof pricing.max_input_tokens === 'number' 
        ? pricing.max_input_tokens 
        : typeof pricing.max_tokens === 'number' 
          ? pricing.max_tokens 
          : undefined,
      maxOutputTokens: typeof pricing.max_output_tokens === 'number' 
        ? pricing.max_output_tokens 
        : typeof pricing.max_tokens === 'number' 
          ? pricing.max_tokens 
          : undefined,
    };
  }

  /**
   * Calculate cost with support for tiered pricing
   */
  calculateCost(
    pricing: SimplifiedPricing,
    inputTokens: number,
    outputTokens: number
  ): CostCalculation {
    let inputCost = 0;
    let outputCost = 0;
    let tieredPricingApplied = false;

    // Calculate input cost
    if (pricing.inputCostPerTokenAbove200k && inputTokens > PricingCalculator.TIERED_PRICING_THRESHOLD) {
      // Tiered pricing for input
      const baseTokens = PricingCalculator.TIERED_PRICING_THRESHOLD;
      const excessTokens = inputTokens - baseTokens;
      
      inputCost = (baseTokens * pricing.inputCostPerToken) + 
                  (excessTokens * pricing.inputCostPerTokenAbove200k);
      tieredPricingApplied = true;
    } else {
      // Flat pricing for input
      inputCost = inputTokens * pricing.inputCostPerToken;
    }

    // Calculate output cost
    if (pricing.outputCostPerTokenAbove200k && outputTokens > PricingCalculator.TIERED_PRICING_THRESHOLD) {
      // Tiered pricing for output
      const baseTokens = PricingCalculator.TIERED_PRICING_THRESHOLD;
      const excessTokens = outputTokens - baseTokens;
      
      outputCost = (baseTokens * pricing.outputCostPerToken) + 
                   (excessTokens * pricing.outputCostPerTokenAbove200k);
      tieredPricingApplied = true;
    } else {
      // Flat pricing for output
      outputCost = outputTokens * pricing.outputCostPerToken;
    }

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      inputTokens,
      outputTokens,
      model: pricing.model,
      tieredPricingApplied,
    };
  }

  /**
   * Calculate cost directly from ModelPricing
   */
  calculateCostFromPricing(
    model: string,
    pricing: ModelPricing,
    inputTokens: number,
    outputTokens: number
  ): CostCalculation {
    const simplified = this.simplifyPricing(model, pricing);
    return this.calculateCost(simplified, inputTokens, outputTokens);
  }

  /**
   * Format cost as a readable string
   */
  formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    } else if (cost < 1) {
      return `$${cost.toFixed(4)}`;
    } else {
      return `$${cost.toFixed(2)}`;
    }
  }

  /**
   * Get a cost estimate message
   */
  getCostEstimateMessage(calculation: CostCalculation): string {
    const parts = [
      `Model: ${calculation.model}`,
      `Input: ${calculation.inputTokens.toLocaleString()} tokens (${this.formatCost(calculation.inputCost)})`,
      `Output: ${calculation.outputTokens.toLocaleString()} tokens (${this.formatCost(calculation.outputCost)})`,
      `Total: ${this.formatCost(calculation.totalCost)}`,
    ];

    if (calculation.tieredPricingApplied) {
      parts.push('(Tiered pricing applied for tokens above 200k)');
    }

    return parts.join(' | ');
  }
}