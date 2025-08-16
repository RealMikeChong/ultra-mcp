import { getDatabase } from './connection';
import { llmRequests, type LlmRequest } from './schema';
import { ensureDatabaseReady } from './migrate';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { pricingService } from '../pricing';

// Legacy pricing data for fallback (per 1K tokens)
// This is used only if the pricing service fails
const FALLBACK_PRICING = {
  // OpenAI Models
  'gpt-5': { input: 0.00125, output: 0.01 },
  'o3': { input: 0.015, output: 0.06 },
  'o3-mini': { input: 0.0015, output: 0.002 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  
  // Gemini Models  
  'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-2.0-flash': { input: 0.000075, output: 0.0003 },
  'gemini-pro': { input: 0.00025, output: 0.0005 },
  
  // Azure OpenAI (same as OpenAI but may have different pricing)
  'azure-gpt-4': { input: 0.03, output: 0.06 },
  'azure-gpt-35-turbo': { input: 0.0015, output: 0.002 },
  
  // xAI Grok Models
  'grok-4': { input: 0.015, output: 0.015 },
  'grok-3': { input: 0.01, output: 0.01 },
  'grok-3-fast': { input: 0.005, output: 0.005 },
  'grok-3-mini': { input: 0.002, output: 0.002 },
  'grok-beta': { input: 0.005, output: 0.005 },
} as const;

async function estimateCost(model: string, inputTokens: number, outputTokens: number): Promise<number> {
  try {
    // Try to get cost from pricing service first
    const calculation = await pricingService.calculateCost(model, inputTokens, outputTokens);
    
    if (calculation && calculation.totalCost > 0) {
      return calculation.totalCost;
    }
  } catch (error) {
    logger.warn(`Failed to get pricing from service for model ${model}:`, error);
  }
  
  // Fallback to hardcoded pricing
  const pricing = FALLBACK_PRICING[model as keyof typeof FALLBACK_PRICING];
  if (!pricing) {
    // Default fallback pricing if model not found
    return (inputTokens * 0.001 + outputTokens * 0.002) / 1000;
  }
  
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
}

export interface RequestData {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: string;
  useSearchGrounding?: boolean;
  providerName?: string; // For openai-compatible provider name
  baseURL?: string;      // For openai-compatible custom base URL
}

export interface TrackingData {
  provider: 'openai' | 'gemini' | 'azure' | 'grok' | 'openai-compatible';
  model: string;
  toolName?: string;
  requestData: RequestData;
  startTime: number;
}

export async function trackLLMRequest(data: TrackingData): Promise<string> {
  const requestId = crypto.randomUUID();
  try {
    await ensureDatabaseReady();
    const db = await getDatabase();
    await db.insert(llmRequests).values({
      id: requestId,
      timestamp: new Date(data.startTime),
      provider: data.provider,
      model: data.model,
      toolName: data.toolName,
      requestData: data.requestData,
      status: 'success', // Will update when completed
      durationMs: 0, // Will update when completed
    }).execute();
  } catch (error) {
    logger.warn('Failed to track LLM request:', error instanceof Error ? error.message : String(error));
  }
  return requestId;
}

export interface ResponseData {
  text: string;
}

export interface CompletionData {
  requestId: string;
  responseData: ResponseData | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  error?: string;
  endTime: number;
}

export async function updateLLMCompletion(data: CompletionData): Promise<void> {
  try {
    await ensureDatabaseReady();
    const db = await getDatabase();
    
    const startTime = await getRequestStartTime(data.requestId);
    const updateData: Partial<LlmRequest> = {
      responseData: data.responseData,
      status: data.error ? 'error' : 'success',
      errorMessage: data.error,
      finishReason: data.finishReason,
      durationMs: data.endTime - startTime,
    };
    
    if (data.usage) {
      updateData.inputTokens = data.usage.promptTokens;
      updateData.outputTokens = data.usage.completionTokens;
      updateData.totalTokens = data.usage.totalTokens;
      
      // Get model name for cost estimation
      const request = await db.select({ model: llmRequests.model })
        .from(llmRequests)
        .where(eq(llmRequests.id, data.requestId))
        .limit(1)
        .execute();
        
      if (request.length > 0 && request[0].model) {
        updateData.estimatedCost = await estimateCost(
          request[0].model,
          data.usage.promptTokens,
          data.usage.completionTokens
        );
      }
    }
    
    await db.update(llmRequests)
      .set(updateData)
      .where(eq(llmRequests.id, data.requestId))
      .execute();
  } catch (error) {
    logger.warn('Failed to update LLM completion:', error instanceof Error ? error.message : String(error));
  }
}

async function getRequestStartTime(requestId: string): Promise<number> {
  try {
    const db = await getDatabase();
    const result = await db.select({ timestamp: llmRequests.timestamp })
      .from(llmRequests)
      .where(eq(llmRequests.id, requestId))
      .limit(1)
      .execute();
      
    return result.length > 0 && result[0].timestamp ? result[0].timestamp.getTime() : Date.now();
  } catch {
    return Date.now();
  }
}

// Utility function to get usage statistics
export async function getUsageStats(_days: number = 30) {
  try {
    await ensureDatabaseReady();
    const db = await getDatabase();
    
    // This is a simplified query - in a real implementation you'd want more sophisticated aggregations
    const stats = await db.select()
      .from(llmRequests)
      .where(eq(llmRequests.status, 'success'))
      .execute();
      
    return {
      totalRequests: stats.length,
      totalTokens: stats.reduce((sum, req) => sum + (req.totalTokens || 0), 0),
      totalCost: stats.reduce((sum, req) => sum + (req.estimatedCost || 0), 0),
      byProvider: stats.reduce((acc, req) => {
        acc[req.provider] = (acc[req.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  } catch (error) {
    console.warn('Failed to get usage stats:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
