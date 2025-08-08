import { z } from 'zod';

// API key validation schema
const ApiKeySchema = z.string().min(1).optional();

// Vector configuration schema
export const VectorConfigSchema = z.object({
  defaultProvider: z.enum(['openai', 'azure', 'gemini', 'openai-compatible']).default('openai'),
  chunkSize: z.number().min(500).max(4000).default(1500),
  chunkOverlap: z.number().min(0).max(500).default(200),
  batchSize: z.number().min(1).max(50).default(10),
  filePatterns: z.array(z.string()).default([
    '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
    '**/*.md', '**/*.mdx', '**/*.txt', '**/*.json',
    '**/*.yaml', '**/*.yml'
  ]),
  embeddingModel: z.object({
    openai: z.string().default('text-embedding-3-small'),
    azure: z.string().default('text-embedding-3-small'),
    gemini: z.string().default('text-embedding-004'),
    'openai-compatible': z.string().default('text-embedding-3-small'),
  }).optional(),
});

// Main configuration schema
export const ConfigSchema = z.object({
  openai: z.object({
    apiKey: ApiKeySchema,
    baseURL: z.string().url().optional(),
  }).optional(),
  google: z.object({
    apiKey: ApiKeySchema,
    baseURL: z.string().url().optional(),
  }).optional(),
  // Room for future expansion
  azure: z.object({
    apiKey: ApiKeySchema,
    resourceName: z.string().optional(),
    baseURL: z.string().url().optional(),
    models: z.array(z.string()).optional(),
    defaultModel: z.string().optional(),
  }).optional(),
  xai: z.object({
    apiKey: ApiKeySchema,
    baseURL: z.string().url().optional(),
  }).optional(),
  openaiCompatible: z.object({
    apiKey: ApiKeySchema,
    baseURL: z.string().url(),
    providerName: z.enum(['ollama', 'openrouter']).default('ollama'),
    models: z.array(z.string()).optional(),
    preferredModel: z.string().optional(),
  }).optional(),
  vectorConfig: VectorConfigSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type VectorConfig = z.infer<typeof VectorConfigSchema>;

// Default configuration
export const defaultConfig: Config = {
  openai: {
    apiKey: undefined,
    baseURL: undefined,
  },
  google: {
    apiKey: undefined,
    baseURL: undefined,
  },
  azure: {
    apiKey: undefined,
    resourceName: undefined,
    baseURL: undefined,
    models: undefined,
    defaultModel: undefined,
  },
  xai: {
    apiKey: undefined,
    baseURL: undefined,
  },
  openaiCompatible: {
    apiKey: undefined,
    baseURL: 'http://localhost:11434/v1',
    providerName: 'ollama' as const,
    models: undefined,
    preferredModel: undefined,
  },
  vectorConfig: VectorConfigSchema.parse({}),
};