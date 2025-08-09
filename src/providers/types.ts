import { z } from "zod";

export const AIRequestSchema = z.object({
  prompt: z.string().describe("The prompt or question to send to the AI model"),
  model: z.string().optional().describe("Specific model to use (optional, will use default if not provided)"),
  temperature: z.number().min(0).max(2).optional().default(0.7).describe("Temperature for response generation"),
  maxOutputTokens: z.number().positive().optional().describe("Maximum tokens in response"),
  systemPrompt: z.string().optional().describe("System prompt to set context"),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional().describe("Reasoning effort for O3 models"),
  useSearchGrounding: z.boolean().optional().default(false).describe("Enable Google Search for Gemini models"),
  toolName: z.string().optional().describe("Name of the MCP tool that triggered this request"),
});

export type AIRequest = z.infer<typeof AIRequestSchema>;

export interface AIResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface AIProvider {
  name: string;
  generateText(request: AIRequest): Promise<AIResponse>;
  streamText?(request: AIRequest): AsyncGenerator<string, void, unknown>;
  listModels(): Promise<string[]>;
  getDefaultModel(): Promise<string>;
}