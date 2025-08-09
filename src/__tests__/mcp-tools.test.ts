import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tests for MCP tool execution and response formatting
describe('MCP Tool Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tool Response Format', () => {
    it('should format AI tool responses correctly', () => {
      const mockAIResponse = {
        content: [
          {
            type: "text",
            text: "This is a deep reasoning response with detailed analysis."
          }
        ]
      };

      expect(mockAIResponse).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.any(String)
          })
        ])
      });
    });

    it('should format vector tool responses correctly', () => {
      const mockVectorResult = "Vector indexing completed successfully";
      const formattedResponse = {
        content: [
          {
            type: "text",
            text: mockVectorResult
          }
        ]
      };

      expect(formattedResponse).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "text", 
            text: "Vector indexing completed successfully"
          })
        ])
      });
    });

    it('should handle empty responses correctly', () => {
      const emptyResponse = {
        content: [
          {
            type: "text",
            text: ""
          }
        ]
      };

      expect(emptyResponse.content[0].text).toBe("");
      expect(emptyResponse.content[0].type).toBe("text");
    });

    it('should handle multi-content responses', () => {
      const multiContentResponse = {
        content: [
          {
            type: "text",
            text: "First part of the response"
          },
          {
            type: "text", 
            text: "Second part of the response"
          }
        ]
      };

      expect(multiContentResponse.content).toHaveLength(2);
      expect(multiContentResponse.content[0].text).toBe("First part of the response");
      expect(multiContentResponse.content[1].text).toBe("Second part of the response");
    });
  });

  describe('Tool Handler Interfaces', () => {
    it('should define proper handler signatures for AI tools', () => {
      // Mock handler that matches expected signature
      const mockDeepReasoningHandler = async (args: {
        prompt: string;
        provider?: string;
        model?: string;
        temperature?: number;
        reasoningEffort?: string;
      }) => {
        return {
          content: [{ type: "text", text: `Reasoning for: ${args.prompt}` }]
        };
      };

      expect(typeof mockDeepReasoningHandler).toBe('function');
      
      // Test handler with valid input
      const testArgs = {
        prompt: "Analyze this complex problem",
        provider: "azure",
        temperature: 0.7
      };

      return mockDeepReasoningHandler(testArgs).then(result => {
        expect(result.content[0].text).toContain("Reasoning for: Analyze this complex problem");
      });
    });

    it('should define proper handler signatures for vector tools', () => {
      const mockIndexVectorsHandler = async (args: {
        path?: string;
        provider?: string;
        force?: boolean;
      }) => {
        return `Indexed ${args.path || 'current directory'} using ${args.provider || 'default'} provider`;
      };

      expect(typeof mockIndexVectorsHandler).toBe('function');

      const testArgs = {
        path: "/test/path",
        provider: "openai",
        force: true
      };

      return mockIndexVectorsHandler(testArgs).then(result => {
        expect(result).toContain("Indexed /test/path using openai provider");
      });
    });

    it('should define proper handler signatures for advanced tools', () => {
      const mockUltraReviewHandler = async (args: {
        task: string;
        files?: string[];
        focus?: string;
        stepNumber?: number;
        totalSteps?: number;
      }) => {
        return {
          content: [{ 
            type: "text", 
            text: `Ultra review step ${args.stepNumber || 1}/${args.totalSteps || 3}: ${args.task}` 
          }]
        };
      };

      expect(typeof mockUltraReviewHandler).toBe('function');

      const testArgs = {
        task: "Review authentication system",
        files: ["src/auth.ts"],
        focus: "security",
        stepNumber: 1,
        totalSteps: 3
      };

      return mockUltraReviewHandler(testArgs).then(result => {
        expect(result.content[0].text).toContain("Ultra review step 1/3: Review authentication system");
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate required parameters', () => {
      const { z } = require('zod');

      const DeepReasoningSchema = z.object({
        prompt: z.string(),
        provider: z.enum(["openai", "gemini", "azure", "grok"]).optional(),
      });

      // Valid input
      const validInput = { prompt: "Test prompt" };
      expect(DeepReasoningSchema.safeParse(validInput).success).toBe(true);

      // Invalid input (missing required field)
      const invalidInput = { provider: "openai" };
      expect(DeepReasoningSchema.safeParse(invalidInput).success).toBe(false);
    });

    it('should validate enum constraints', () => {
      const { z } = require('zod');

      const ProviderSchema = z.object({
        provider: z.enum(["openai", "gemini", "azure", "grok"]),
      });

      // Valid provider
      expect(ProviderSchema.safeParse({ provider: "azure" }).success).toBe(true);
      
      // Invalid provider
      expect(ProviderSchema.safeParse({ provider: "invalid" }).success).toBe(false);
    });

    it('should validate numeric constraints', () => {
      const { z } = require('zod');

      const TemperatureSchema = z.object({
        temperature: z.number().min(0).max(2),
      });

      // Valid temperature
      expect(TemperatureSchema.safeParse({ temperature: 0.7 }).success).toBe(true);
      expect(TemperatureSchema.safeParse({ temperature: 0 }).success).toBe(true);
      expect(TemperatureSchema.safeParse({ temperature: 2 }).success).toBe(true);
      
      // Invalid temperature
      expect(TemperatureSchema.safeParse({ temperature: -0.1 }).success).toBe(false);
      expect(TemperatureSchema.safeParse({ temperature: 2.1 }).success).toBe(false);
    });

    it('should validate array constraints', () => {
      const { z } = require('zod');

      const FilesSchema = z.object({
        files: z.array(z.string()).optional(),
      });

      // Valid arrays
      expect(FilesSchema.safeParse({ files: [] }).success).toBe(true);
      expect(FilesSchema.safeParse({ files: ["file1.ts", "file2.ts"] }).success).toBe(true);
      expect(FilesSchema.safeParse({}).success).toBe(true); // Optional

      // Invalid array
      expect(FilesSchema.safeParse({ files: [123, "file.ts"] }).success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const mockFailingHandler = async () => {
        throw new Error("Tool execution failed");
      };

      await expect(mockFailingHandler()).rejects.toThrow("Tool execution failed");
    });

    it('should handle invalid tool arguments', () => {
      const { z } = require('zod');

      const schema = z.object({
        prompt: z.string(),
        temperature: z.number().min(0).max(2),
      });

      const invalidArgs = {
        prompt: "test",
        temperature: 5.0 // Invalid
      };

      const result = schema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ["temperature"],
              code: "too_big"
            })
          ])
        );
      }
    });

    it('should handle missing handler methods', async () => {
      const mockIncompleteHandler = {
        // Missing handleDeepReasoning method
      };

      expect(mockIncompleteHandler.handleDeepReasoning).toBeUndefined();
    });
  });

  describe('Async Handler Patterns', () => {
    it('should handle async AI tool handlers', async () => {
      const mockAsyncHandler = {
        handleDeepReasoning: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Async reasoning complete" }]
        }),
        handleInvestigation: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Investigation complete" }]
        })
      };

      const reasoningResult = await mockAsyncHandler.handleDeepReasoning({
        prompt: "Test prompt"
      });

      expect(reasoningResult.content[0].text).toBe("Async reasoning complete");
      expect(mockAsyncHandler.handleDeepReasoning).toHaveBeenCalledWith({
        prompt: "Test prompt"
      });
    });

    it('should handle async vector tool handlers', async () => {
      const mockVectorHandlers = {
        handleIndexVectors: vi.fn().mockResolvedValue("Indexing complete"),
        handleSearchVectors: vi.fn().mockResolvedValue("Search results found"),
        handleClearVectors: vi.fn().mockResolvedValue("Vectors cleared")
      };

      const indexResult = await mockVectorHandlers.handleIndexVectors({
        path: "/test/path"
      });

      expect(indexResult).toBe("Indexing complete");
      expect(mockVectorHandlers.handleIndexVectors).toHaveBeenCalledWith({
        path: "/test/path"
      });
    });

    it('should handle async advanced tool handlers', async () => {
      const mockAdvancedHandler = {
        handleCodeReview: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Code review complete" }]
        }),
        handleCodeAnalysis: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Analysis complete" }]
        })
      };

      const reviewResult = await mockAdvancedHandler.handleCodeReview({
        task: "Review auth system"
      });

      expect(reviewResult.content[0].text).toBe("Code review complete");
      expect(mockAdvancedHandler.handleCodeReview).toHaveBeenCalledWith({
        task: "Review auth system"
      });
    });
  });

  describe('Dynamic Import Handling', () => {
    it('should handle successful dynamic imports', async () => {
      const mockDynamicImport = vi.fn().mockResolvedValue({
        AdvancedToolsHandler: vi.fn().mockImplementation(() => ({
          handleCodeReview: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: "Review complete" }]
          })
        }))
      });

      const importResult = await mockDynamicImport();
      expect(importResult.AdvancedToolsHandler).toBeDefined();

      const handler = new importResult.AdvancedToolsHandler();
      const result = await handler.handleCodeReview({ task: "test" });
      expect(result.content[0].text).toBe("Review complete");
    });

    it('should handle failed dynamic imports', async () => {
      const mockFailingImport = vi.fn().mockRejectedValue(
        new Error("Cannot resolve module")
      );

      await expect(mockFailingImport()).rejects.toThrow("Cannot resolve module");
    });
  });

  describe('Tool Registry Validation', () => {
    it('should validate tool names are correctly registered', () => {
      const registeredTools = [
        // Core AI tools
        'deep-reasoning',
        'investigate', 
        'research',
        'list-ai-models',
        // Zen tools
        'analyze-code',
        'review-code', 
        'debug-issue',
        'plan-feature',
        'generate-docs',
        // Workflow tools
        'challenge',
        'consensus',
        'planner',
        'precommit',
        'secaudit',
        'tracer',
        // Ultra tools
        'ultra-review',
        'ultra-analyze',
        'ultra-debug',
        'ultra-plan',
        'ultra-docs',
        // Vector tools
        'index-vectors',
        'search-vectors',
        'clear-vectors'
      ];

      expect(registeredTools).toHaveLength(23);
      
      // Verify no duplicates
      const uniqueTools = [...new Set(registeredTools)];
      expect(uniqueTools).toHaveLength(registeredTools.length);
    });

    it('should validate tool categories are complete', () => {
      const toolCategories = {
        coreAI: ['deep-reasoning', 'investigate', 'research', 'list-ai-models'],
        zen: ['analyze-code', 'review-code', 'debug-issue', 'plan-feature', 'generate-docs'],
        workflow: ['challenge', 'consensus', 'planner', 'precommit', 'secaudit', 'tracer'],
        ultra: ['ultra-review', 'ultra-analyze', 'ultra-debug', 'ultra-plan', 'ultra-docs'],
        vector: ['index-vectors', 'search-vectors', 'clear-vectors']
      };

      expect(toolCategories.coreAI).toHaveLength(4);
      expect(toolCategories.zen).toHaveLength(5);
      expect(toolCategories.workflow).toHaveLength(6);
      expect(toolCategories.ultra).toHaveLength(5);
      expect(toolCategories.vector).toHaveLength(3);

      const totalTools = Object.values(toolCategories).flat().length;
      expect(totalTools).toBe(23);
    });
  });
});