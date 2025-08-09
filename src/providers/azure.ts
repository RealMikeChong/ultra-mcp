import { createAzure } from "@ai-sdk/azure";
import { generateText, streamText } from "ai";
import { AIProvider, AIRequest, AIResponse } from "./types";
import { ConfigManager } from "../config/manager";
import { trackLLMRequest, updateLLMCompletion } from "../db/tracking";

export class AzureOpenAIProvider implements AIProvider {
  name = "azure";
  private configManager: ConfigManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  private async getCredentials(): Promise<{ apiKey: string; baseURL: string }> {
    const config = await this.configManager.getConfig();
    const apiKey = config.azure?.apiKey || process.env.AZURE_API_KEY;
    
    // Construct baseURL from resourceName or use environment variables for backward compatibility
    let baseURL: string;
    if (config.azure?.resourceName) {
      baseURL = `https://${config.azure.resourceName}.openai.azure.com/`;
    } else {
      // Support legacy environment variables
      baseURL = process.env.AZURE_BASE_URL || process.env.AZURE_ENDPOINT || '';
    }

    if (!apiKey || !baseURL) {
      throw new Error("Azure OpenAI credentials not configured. Run 'ultra config' or set AZURE_API_KEY and AZURE_RESOURCE_NAME/AZURE_BASE_URL environment variables.");
    }

    return { apiKey, baseURL };
  }

  async getDefaultModel(): Promise<string> {
    const config = await this.configManager.getConfig();
    return config.azure?.defaultModel || "o3"; // Default to O3 as requested
  }

  async listModels(): Promise<string[]> {
    const config = await this.configManager.getConfig();
    return config.azure?.models || ["o3"]; // Default to O3 model as per requirements
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const { apiKey, baseURL } = await this.getCredentials();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();
    
    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'azure',
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
    
    const azure = createAzure({ 
      apiKey,
      baseURL,
    });
    const modelInstance = azure(model);
    
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

    // Add reasoning effort for O3 models
    if (model.startsWith("o3") || model.startsWith("o1")) {
      options.reasoningEffort = request.reasoningEffort || "medium";
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
    const { apiKey, baseURL } = await this.getCredentials();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();
    
    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'azure',
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
    
    const azure = createAzure({ 
      apiKey,
      baseURL,
    });
    const modelInstance = azure(model);
    
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

    if (model.startsWith("o3") || model.startsWith("o1")) {
      options.reasoningEffort = request.reasoningEffort || "medium";
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