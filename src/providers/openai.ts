import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { AIProvider, AIRequest, AIResponse } from "./types";
import { ConfigManager } from "../config/manager";
import { trackLLMRequest, updateLLMCompletion } from "../db/tracking";

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private configManager: ConfigManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  private async getCredentials(): Promise<{ apiKey: string; baseURL?: string }> {
    const config = await this.configManager.getConfig();
    const apiKey = config.openai?.apiKey || process.env.OPENAI_API_KEY;
    const baseURL = config.openai?.baseURL || process.env.OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Run 'ultra config' or set OPENAI_API_KEY environment variable.");
    }

    return { apiKey, baseURL };
  }

  async getDefaultModel(): Promise<string> {
    return "o3"; // Default to O3 as requested
  }

  async listModels(): Promise<string[]> {
    // Only list O3 model as per requirements
    return [
      "o3",
    ];
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const { apiKey, baseURL } = await this.getCredentials();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();

    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'openai',
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

    const openai = createOpenAI({ apiKey, baseURL });
    const modelInstance = openai(model);
    
    const options = {
      model: modelInstance,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      ...(request.systemPrompt && { system: request.systemPrompt }),
      ...((model.startsWith("o3") || model.startsWith("o1")) && { 
        reasoningEffort: request.reasoningEffort || "medium" 
      }),
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
      provider: 'openai',
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

    const openai = createOpenAI({ apiKey, baseURL });
    const modelInstance = openai(model);
    
    const options = {
      model: modelInstance,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      ...(request.systemPrompt && { system: request.systemPrompt }),
      ...((model.startsWith("o3") || model.startsWith("o1")) && { 
        reasoningEffort: request.reasoningEffort || "medium" 
      }),
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