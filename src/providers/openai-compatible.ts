import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import { AIProvider, AIRequest, AIResponse } from "./types";
import { ConfigManager } from "../config/manager";
import { trackLLMRequest, updateLLMCompletion } from "../db/tracking";

export class OpenAICompatibleProvider implements AIProvider {
  name = "openai-compatible";
  private configManager: ConfigManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  // Helper function to get models filtered by provider type
  static getModelsByProvider(providerType: 'ollama' | 'openrouter'): string[] {
    const ollamaModels = [
      // DeepSeek R1 series (latest reasoning models)
      "deepseek-r1:1.5b",
      "deepseek-r1:7b", 
      "deepseek-r1:8b",
      "deepseek-r1:14b",
      "deepseek-r1:32b",
      // Latest Llama models
      "llama3.2:1b",
      "llama3.2:3b", 
      "llama3.1:8b",
      "llama3.1:70b",
      // Qwen series (including QwQ reasoning model)
      "qwen2.5:7b",
      "qwen2.5:14b",
      "qwen2.5:32b",
      "qwq:32b",
      // Mistral series
      "mistral:7b",
      "mistral-nemo:12b",
      "mistral-small:22b",
      // Specialized models
      "deepseek-coder:6.7b",
      "codellama:7b",
      "codellama:13b",
      "llava:7b",
      "llava:13b",
      // Gemma 2 series
      "gemma2:9b",
      "gemma2:27b",
    ];

    const openrouterModels = [
      // Latest open source models
      "gpt-oss-20b",
      "gpt-oss-120b", 
      "llama-4-400b",
      "llama-4-109b",
      // DeepSeek R1 series (latest reasoning models)
      "deepseek-r1-70b",
      "deepseek-r1-32b", 
      "deepseek-r1-14b",
      "deepseek-r1-7b",
      "deepseek-r1-1.5b",
      "deepseek-chat",
      // Latest proprietary models
      "gpt-4o",
      "gpt-4o-mini",
      "o3-mini",
      "claude-3.5-sonnet",
      "claude-3.5-haiku",
      // Meta Llama series
      "llama-3.1-405b",
      "llama-3.1-70b",
      "llama-3.1-8b",
      // Google models
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      // Mistral models
      "mistral-small-24b",
      "mistral-large",
      "mixtral-8x7b",
      // Qwen models
      "qwen-2.5-coder-32b",
      "qwen-2.5-72b",
      "qwq-32b",
    ];

    return providerType === 'ollama' ? ollamaModels : openrouterModels;
  }

  // Helper function to get popular models by category and provider
  static getPopularModelsByCategory(providerType: 'ollama' | 'openrouter'): { [category: string]: string[] } {
    if (providerType === 'ollama') {
      return {
        "Reasoning Models": ["deepseek-r1:7b", "deepseek-r1:14b", "qwq:32b"],
        "Coding Models": ["deepseek-coder:6.7b", "codellama:7b", "codellama:13b"],
        "General Purpose": ["llama3.1:8b", "llama3.2:3b", "mistral:7b", "gemma2:9b"],
        "Multimodal": ["llava:7b", "llava:13b"],
      };
    } else {
      return {
        "Latest Open Source": ["gpt-oss-20b", "gpt-oss-120b", "llama-4-400b"],
        "Reasoning Models": ["deepseek-r1-70b", "deepseek-r1-32b", "o3-mini"],
        "Proprietary Models": ["gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"],
        "Coding Models": ["qwen-2.5-coder-32b", "deepseek-chat"],
      };
    }
  }

  private async getCredentials(): Promise<{ 
    apiKey: string; 
    baseURL: string; 
    providerName: 'ollama' | 'openrouter';
    models?: string[] 
  }> {
    const config = await this.configManager.getConfig();
    const apiKey = config.openaiCompatible?.apiKey || "fake-key"; // Ollama doesn't need real key
    const baseURL = config.openaiCompatible?.baseURL || "http://localhost:11434/v1";
    const providerName = config.openaiCompatible?.providerName || 'ollama';
    const models = config.openaiCompatible?.models;

    if (!baseURL) {
      throw new Error("OpenAI-Compatible base URL not configured. Run 'ultra config' to set up the provider.");
    }

    // For OpenRouter, require real API key
    if (providerName === 'openrouter' && (!apiKey || apiKey === "fake-key")) {
      throw new Error("OpenRouter API key required. Run 'ultra config' or set OPENROUTER_API_KEY environment variable.");
    }

    return { apiKey, baseURL, providerName, models };
  }

  async getDefaultModel(): Promise<string> {
    return "gpt-oss-20b"; // Default to popular open source model
  }

  async listModels(): Promise<string[]> {
    // Latest Ollama models - top models for 2025
    const ollamaModels = [
      // DeepSeek R1 series (latest reasoning models)
      "deepseek-r1:1.5b",
      "deepseek-r1:7b", 
      "deepseek-r1:8b",
      "deepseek-r1:14b",
      "deepseek-r1:32b",
      // Latest Llama models
      "llama3.2:1b",
      "llama3.2:3b", 
      "llama3.1:8b",
      "llama3.1:70b",
      // Qwen series (including QwQ reasoning model)
      "qwen2.5:7b",
      "qwen2.5:14b",
      "qwen2.5:32b",
      "qwq:32b",
      // Mistral series
      "mistral:7b",
      "mistral-nemo:12b",
      "mistral-small:22b",
      // Specialized models
      "deepseek-coder:6.7b",
      "codellama:7b",
      "codellama:13b",
      "llava:7b",
      "llava:13b",
      // Gemma 2 series
      "gemma2:9b",
      "gemma2:27b",
    ];

    // Latest OpenRouter models - simplified names for 2025
    const openrouterModels = [
      // Latest open source models
      "gpt-oss-20b",
      "gpt-oss-120b", 
      "llama-4-400b",
      "llama-4-109b",
      // DeepSeek R1 series (latest reasoning models)
      "deepseek-r1-70b",
      "deepseek-r1-32b", 
      "deepseek-r1-14b",
      "deepseek-r1-7b",
      "deepseek-r1-1.5b",
      "deepseek-chat",
      // Latest proprietary models
      "gpt-4o",
      "gpt-4o-mini",
      "o3-mini",
      "claude-3.5-sonnet",
      "claude-3.5-haiku",
      // Meta Llama series
      "llama-3.1-405b",
      "llama-3.1-70b",
      "llama-3.1-8b",
      // Google models
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      // Mistral models
      "mistral-small-24b",
      "mistral-large",
      "mixtral-8x7b",
      // Qwen models
      "qwen-2.5-coder-32b",
      "qwen-2.5-72b",
      "qwq-32b",
    ];

    // Try to get configuration to determine provider
    try {
      // This is sync, so we can't await here. Return both lists for now.
      // The actual provider type will be determined at runtime.
      return [...ollamaModels, ...openrouterModels];
    } catch {
      return ollamaModels; // Default to Ollama models
    }
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const { apiKey, baseURL, providerName } = await this.getCredentials();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();

    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'openai-compatible',
      model: model,
      toolName: request.toolName,
      requestData: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        providerName,
        baseURL,
      },
      startTime,
    });

    const openaiCompatible = createOpenAICompatible({ 
      name: providerName,
      apiKey, 
      baseURL 
    });
    const modelInstance = openaiCompatible(model);
    
    const options = {
      model: modelInstance,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      ...(request.systemPrompt && { system: request.systemPrompt }),
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
        metadata: {
          ...result.providerMetadata,
          providerName,
          baseURL,
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
    const { apiKey, baseURL, providerName } = await this.getCredentials();
    const model = request.model || await this.getDefaultModel();
    const startTime = Date.now();

    // Track the request
    const requestId = await trackLLMRequest({
      provider: 'openai-compatible',
      model: model,
      toolName: request.toolName,
      requestData: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        providerName,
        baseURL,
      },
      startTime,
    });

    const openaiCompatible = createOpenAICompatible({ 
      name: providerName,
      apiKey, 
      baseURL 
    });
    const modelInstance = openaiCompatible(model);
    
    const options = {
      model: modelInstance,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      ...(request.systemPrompt && { system: request.systemPrompt }),
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