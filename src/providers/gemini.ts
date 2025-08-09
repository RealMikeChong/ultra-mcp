import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, streamText } from "ai";
import { AIProvider, AIRequest, AIResponse } from "./types";
import { ConfigManager } from "../config/manager";
import { trackLLMRequest, updateLLMCompletion } from "../db/tracking";

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private configManager: ConfigManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  private async getApiKey(): Promise<{ apiKey: string; baseURL?: string }> {
    const config = await this.configManager.getConfig();
    const apiKey = config.google?.apiKey || process.env.GOOGLE_API_KEY;
    const baseURL = config.google?.baseURL || process.env.GOOGLE_BASE_URL;
    if (!apiKey) {
      throw new Error("Google API key not configured. Run 'ultra config' or set GOOGLE_API_KEY environment variable.");
    }
    
    return { apiKey, baseURL };
  }

  async getDefaultModel(): Promise<string> {
    return "gemini-2.5-pro"; // Default to Gemini 2.5 Pro as requested
  }

  async listModels(): Promise<string[]> {
    // Only list Gemini 2.5 Pro as per requirements
    return [
      "gemini-2.5-pro",
    ];
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const { apiKey, baseURL } = await this.getApiKey();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();
    
    // Enable Google Search by default for Gemini 2.5 Pro
    const useSearchGrounding = request.useSearchGrounding !== undefined 
      ? request.useSearchGrounding 
      : model === "gemini-2.5-pro";

    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'gemini',
      model: model,
      toolName: request.toolName,
      requestData: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        useSearchGrounding,
      },
      startTime,
    });

    const google = createGoogleGenerativeAI({ apiKey, baseURL });
    const modelInstance = google(model);
    
    type GenerateTextOptions = {
      model: typeof modelInstance;
      prompt: string;
      temperature?: number;
      maxOutputTokens?: number;
      system?: string;
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
        metadata: {
          ...result.providerMetadata,
          searchGroundingEnabled: useSearchGrounding,
        },
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
    
    const useSearchGrounding = request.useSearchGrounding !== undefined 
      ? request.useSearchGrounding 
      : model === "gemini-2.5-pro";

    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'gemini',
      model: model,
      toolName: request.toolName,
      requestData: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        useSearchGrounding,
      },
      startTime,
    });

    const google = createGoogleGenerativeAI({ apiKey, baseURL });
    const modelInstance = google(model);
    
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