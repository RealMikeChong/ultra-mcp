import { createXai } from "@ai-sdk/xai";
import { generateText, streamText } from "ai";
import { AIProvider, AIRequest, AIResponse } from "./types";
import { ConfigManager } from "../config/manager";
import { trackLLMRequest, updateLLMCompletion } from "../db/tracking";

export class GrokProvider implements AIProvider {
  name = "grok";
  private configManager: ConfigManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  private async getApiKey(): Promise<{ apiKey: string; baseURL?: string }> {
    const config = await this.configManager.getConfig();
    const apiKey = config.xai?.apiKey || process.env.XAI_API_KEY;
    const baseURL = config.xai?.baseURL || process.env.XAI_BASE_URL;
    
    if (!apiKey) {
      throw new Error("xAI API key not configured. Run 'ultra config' or set XAI_API_KEY environment variable.");
    }
    
    return { apiKey, baseURL };
  }

  async getDefaultModel(): Promise<string> {
    return "grok-4"; // Default to Grok-4 as requested
  }

  async listModels(): Promise<string[]> {
    return [
      "grok-4",
      "grok-3",
      "grok-3-fast",
      "grok-3-mini",
      "grok-beta",
    ];
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const { apiKey, baseURL } = await this.getApiKey();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();
    
    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'grok',
      model: model,
      toolName: request.toolName,
      requestData: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        reasoningEffort: request.reasoningEffort,
      },
      startTime,
    });
    
    const grokClient = createXai({ apiKey, baseURL });
    const modelInstance = grokClient(model);
    
    type GenerateTextOptions = {
      model: typeof modelInstance;
      prompt: string;
      temperature?: number;
      maxOutputTokens?: number;
      system?: string;
      reasoningEffort?: 'low' | 'medium' | 'high';
      onFinish?: (result: {
        text: string;
        usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
        finishReason?: string;
      }) => Promise<void>;
    };

    const options: GenerateTextOptions = {
      model: modelInstance,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      onFinish: async (result) => {
        // Track completion using onFinish callback
        await updateLLMCompletion({
          requestId,
          responseData: { text: result.text },
          usage: result.usage,
          finishReason: result.finishReason,
          endTime: Date.now(),
        });
      },
    };

    // Add system prompt if provided
    if (request.systemPrompt) {
      options.system = request.systemPrompt;
    }

    // Add reasoning effort for Grok models that support it
    if (request.reasoningEffort) {
      options.reasoningEffort = request.reasoningEffort;
    }

    try {
      const result = await generateText(options);

      return {
        text: result.text,
        model: model,
        usage: result.usage ? {
          promptTokens: result.usage.inputTokens || 0,
          completionTokens: result.usage.outputTokens || 0,
          totalTokens: result.usage.totalTokens || 0,
        } : undefined,
        metadata: result.providerMetadata,
      };
    } catch (error) {
      // Track error
      await updateLLMCompletion({
        requestId,
        responseData: null,
        error: error instanceof Error ? error.message : String(error),
        endTime: Date.now(),
      });
      throw error;
    }
  }

  async *streamText(request: AIRequest): AsyncGenerator<string, void, unknown> {
    const { apiKey, baseURL } = await this.getApiKey();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();
    
    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'grok',
      model: model,
      toolName: request.toolName,
      requestData: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        reasoningEffort: request.reasoningEffort,
      },
      startTime,
    });
    
    const grokClient = createXai({ apiKey, baseURL });
    const modelInstance = grokClient(model);
    
    const options: any = {
      model: modelInstance,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      onFinish: async (event: any) => {
        // Track completion using onFinish callback
        const usage = event.totalUsage ? {
          promptTokens: event.totalUsage.inputTokens || 0,
          completionTokens: event.totalUsage.outputTokens || 0,
          totalTokens: event.totalUsage.totalTokens || 0,
        } : undefined;
        
        await updateLLMCompletion({
          requestId,
          responseData: { text: event.text },
          usage,
          finishReason: event.finishReason,
          endTime: Date.now(),
        });
      },
    };

    if (request.systemPrompt) {
      options.system = request.systemPrompt;
    }

    if (request.reasoningEffort) {
      options.reasoningEffort = request.reasoningEffort;
    }

    try {
      const result = await streamText(options);

      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      // Track error
      await updateLLMCompletion({
        requestId,
        responseData: null,
        error: error instanceof Error ? error.message : String(error),
        endTime: Date.now(),
      });
      throw error;
    }
  }
}