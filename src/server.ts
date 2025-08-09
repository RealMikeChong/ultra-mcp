import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CodeReviewSchema, CodeAnalysisSchema, DebugSchema, PlanSchema, DocsSchema } from './handlers/advanced-tools';

import { version } from '../package.json';

// Testable environment variable setting functions
export const setEnvironmentVariablesFromConfig = (config: any) => {
  if (config.openai?.apiKey) {
    process.env.OPENAI_API_KEY = config.openai.apiKey;
  }
  if (config.openai?.baseURL) {
    process.env.OPENAI_BASE_URL = config.openai.baseURL;
  }
  if (config.google?.apiKey) {
    process.env.GOOGLE_API_KEY = config.google.apiKey;
  }
  if (config.google?.baseURL) {
    process.env.GOOGLE_BASE_URL = config.google.baseURL;
  }
  if (config.azure?.apiKey) {
    process.env.AZURE_API_KEY = config.azure.apiKey;
  }
  if (config.azure?.baseURL) {
    process.env.AZURE_BASE_URL = config.azure.baseURL;
  }
  if (config.xai?.apiKey) {
    process.env.XAI_API_KEY = config.xai.apiKey;
  }
  if (config.xai?.baseURL) {
    process.env.XAI_BASE_URL = config.xai.baseURL;
  }
};

// Import Zod schemas from ai-tools
const DeepReasoningSchema = z.object({
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().describe("AI provider to use (defaults to Azure if configured, otherwise OpenAI)"),
  prompt: z.string().describe("The complex question or problem requiring deep reasoning"),
  model: z.string().optional().describe("Specific model to use (optional, will use provider default)"),
  temperature: z.number().min(0).max(2).optional().default(0.7).describe("Temperature for response generation"),
  maxOutputTokens: z.number().positive().optional().describe("Maximum tokens in response"),
  systemPrompt: z.string().optional().describe("System prompt to set context for reasoning"),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional().default("high").describe("Reasoning effort level (for O3 models)"),
  enableSearch: z.boolean().optional().default(true).describe("Enable Google Search for Gemini models"),
});

const InvestigationSchema = z.object({
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().describe("AI provider to use (defaults to Azure if configured, otherwise best available)"),
  topic: z.string().describe("The topic or question to investigate"),
  depth: z.enum(["shallow", "medium", "deep"]).default("deep").describe("Investigation depth"),
  model: z.string().optional().describe("Specific model to use"),
  enableSearch: z.boolean().optional().default(true).describe("Enable web search for investigation (Gemini only)"),
});

const ResearchSchema = z.object({
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().describe("AI provider to use (defaults to Azure if configured, otherwise best available)"),
  query: z.string().describe("Research query or topic"),
  sources: z.array(z.string()).optional().describe("Specific sources or contexts to consider"),
  model: z.string().optional().describe("Specific model to use"),
  outputFormat: z.enum(["summary", "detailed", "academic"]).default("detailed").describe("Output format for research"),
});

const AnalyzeCodeSchema = z.object({
  task: z.string().describe("What to analyze (e.g., 'analyze performance of user authentication', 'review database queries')"),
  files: z.array(z.string()).optional().describe("File paths to analyze (optional)"),
  focus: z.enum(["architecture", "performance", "security", "quality", "all"]).default("all").describe("Analysis focus area"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const ReviewCodeSchema = z.object({
  task: z.string().describe("What to review (e.g., 'review pull request changes', 'check for security issues')"),
  files: z.array(z.string()).optional().describe("File paths to review (optional)"),
  focus: z.enum(["bugs", "security", "performance", "style", "all"]).default("all").describe("Review focus area"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const DebugIssueSchema = z.object({
  task: z.string().describe("What to debug (e.g., 'fix login error', 'investigate memory leak')"),
  files: z.array(z.string()).optional().describe("Relevant file paths (optional)"),
  symptoms: z.string().optional().describe("Error symptoms or behavior observed"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const PlanFeatureSchema = z.object({
  task: z.string().describe("What to plan (e.g., 'add user profiles', 'implement payment system')"),
  requirements: z.string().optional().describe("Specific requirements or constraints"),
  scope: z.enum(["minimal", "standard", "comprehensive"]).default("standard").describe("Planning scope"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const GenerateDocsSchema = z.object({
  task: z.string().describe("What to document (e.g., 'API endpoints', 'setup instructions', 'code comments')"),
  files: z.array(z.string()).optional().describe("File paths to document (optional)"),
  format: z.enum(["markdown", "comments", "api-docs", "readme"]).default("markdown").describe("Documentation format"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const ChallengeSchema = z.object({
  prompt: z.string().describe("The user's message or statement to analyze critically. When manually invoked with 'challenge', exclude that prefix - just pass the actual content. For automatic invocations, pass the user's complete message unchanged."),
});

const ConsensusSchema = z.object({
  proposal: z.string().describe("The proposal, idea, or decision to analyze from multiple perspectives"),
  models: z.array(z.object({
    model: z.string().describe("Model name to consult (e.g., 'gemini-pro', 'gpt-4', 'o3')"),
    stance: z.enum(["for", "against", "neutral"]).default("neutral").describe("Perspective stance for this model"),
    provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().describe("AI provider for this model")
  })).min(1).describe("List of models to consult with their stances"),
  files: z.array(z.string()).optional().describe("Relevant file paths for context (optional)"),
});

const PlannerSchema = z.object({
  task: z.string().describe("The task or problem to plan. For the first step, describe the complete planning challenge in detail. For subsequent steps, provide the specific planning step content, revisions, or branch explorations."),
  stepNumber: z.number().min(1).describe("Current step number in the planning sequence (starts at 1)"),
  totalSteps: z.number().min(1).describe("Current estimate of total steps needed (can be adjusted as planning progresses)"),
  scope: z.enum(["minimal", "standard", "comprehensive"]).default("standard").describe("Planning scope and depth"),
  requirements: z.string().optional().describe("Specific requirements, constraints, or success criteria"),
  isRevision: z.boolean().optional().default(false).describe("True if this step revises a previous step"),
  revisingStep: z.number().optional().describe("If isRevision is true, which step number is being revised"),
  isBranching: z.boolean().optional().default(false).describe("True if exploring an alternative approach from a previous step"),
  branchingFrom: z.number().optional().describe("If isBranching is true, which step number to branch from"),
  branchId: z.string().optional().describe("Identifier for this planning branch (e.g., 'approach-A', 'microservices-path')"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use for planning assistance"),
});

const PrecommitSchema = z.object({
  task: z.string().describe("What to validate for pre-commit (e.g., 'review changes before commit', 'validate security implications', 'check for breaking changes')"),
  files: z.array(z.string()).optional().describe("Specific files to validate (optional - will analyze git changes if not provided)"),
  focus: z.enum(["security", "performance", "quality", "tests", "breaking-changes", "all"]).default("all").describe("Validation focus area"),
  includeStaged: z.boolean().optional().default(true).describe("Include staged changes in validation"),
  includeUnstaged: z.boolean().optional().default(false).describe("Include unstaged changes in validation"),
  compareTo: z.string().optional().describe("Git ref to compare against (e.g., 'main', 'HEAD~1'). If not provided, analyzes current changes"),
  severity: z.enum(["critical", "high", "medium", "low", "all"]).default("medium").describe("Minimum severity level to report"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const SecauditSchema = z.object({
  task: z.string().describe("What to audit for security (e.g., 'comprehensive security audit', 'OWASP Top 10 review', 'authentication security analysis')"),
  files: z.array(z.string()).optional().describe("Specific files to audit (optional - will analyze all relevant security files)"),
  focus: z.enum(["owasp", "compliance", "infrastructure", "dependencies", "comprehensive"]).default("comprehensive").describe("Security audit focus area"),
  threatLevel: z.enum(["low", "medium", "high", "critical"]).default("medium").describe("Threat level assessment based on application context"),
  complianceRequirements: z.array(z.string()).optional().describe("Compliance frameworks to check (e.g., SOC2, PCI DSS, HIPAA, GDPR)"),
  securityScope: z.string().optional().describe("Application context (web app, mobile app, API, enterprise system)"),
  severity: z.enum(["critical", "high", "medium", "low", "all"]).default("all").describe("Minimum severity level to report"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

const TracerSchema = z.object({
  task: z.string().describe("What to trace and WHY you need this analysis (e.g., 'trace User.login() execution flow', 'map UserService dependencies', 'understand payment processing call chain')"),
  traceMode: z.enum(["precision", "dependencies", "ask"]).default("ask").describe("Type of tracing: 'ask' (prompts user to choose), 'precision' (execution flow), 'dependencies' (structural relationships)"),
  targetDescription: z.string().optional().describe("Detailed description of what to trace - method, function, class, or module name and context"),
  files: z.array(z.string()).optional().describe("Relevant files to focus tracing on (optional)"),
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().default("gemini").describe("AI provider to use"),
});

// Vector indexing schemas
const IndexVectorsSchema = z.object({
  path: z.string().default(process.cwd()).describe("Project path to index (defaults to current directory)"),
  provider: z.enum(["openai", "azure", "gemini"]).optional().describe("Embedding provider to use (defaults to configured provider)"),
  force: z.boolean().default(false).describe("Force re-indexing of all files"),
});

const SearchVectorsSchema = z.object({
  query: z.string().describe("Natural language search query"),
  path: z.string().default(process.cwd()).describe("Project path to search (defaults to current directory)"),
  provider: z.enum(["openai", "azure", "gemini"]).optional().describe("Embedding provider to use (defaults to configured provider)"),
  limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
  similarityThreshold: z.number().min(0).max(1).default(0.7).describe("Minimum similarity score (0-1)"),
  filesOnly: z.boolean().default(false).describe("Return only file paths without chunks"),
});

const ClearVectorsSchema = z.object({
  path: z.string().default(process.cwd()).describe("Project path to clear vectors from (defaults to current directory)"),
});

export function createServer() {
  const server = new McpServer(
    {
      name: "ultra-mcp",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Lazy loading of handlers
  let handlers: any = null;
  
  async function getHandlers() {
    if (!handlers) {
      const { ConfigManager } = require("./config/manager");
      const { ProviderManager } = require("./providers/manager");
      const { AIToolHandlers } = require("./handlers/ai-tools");
      
      const configManager = new ConfigManager();
      
      // Load config and set environment variables
      const config = await configManager.getConfig();
      setEnvironmentVariablesFromConfig(config);
      
      const providerManager = new ProviderManager(configManager);
      handlers = new AIToolHandlers(providerManager);
    }
    
    return handlers;
  }

  // Register deep-reasoning tool
  server.registerTool("deep-reasoning", {
    title: "Deep Reasoning",
    description: "Use advanced AI models for deep reasoning and complex problem-solving. Supports O3 models for OpenAI/Azure and Gemini 2.5 Pro with Google Search.",
    inputSchema: DeepReasoningSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleDeepReasoning(args);
  });

  // Register investigate tool
  server.registerTool("investigate", {
    title: "Investigate",
    description: "Investigate topics thoroughly with configurable depth",
    inputSchema: InvestigationSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleInvestigation(args);
  });

  // Register research tool
  server.registerTool("research", {
    title: "Research",
    description: "Conduct comprehensive research with multiple output formats",
    inputSchema: ResearchSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleResearch(args);
  });

  // Register list-ai-models tool
  server.registerTool("list-ai-models", {
    title: "List AI Models",
    description: "List all available AI models and their configuration status",
    inputSchema: {},
  }, async () => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleListModels();
  });

  // Register analyze-code tool
  server.registerTool("analyze-code", {
    title: "Analyze Code",
    description: "Analyze code for architecture, performance, security, or quality issues",
    inputSchema: AnalyzeCodeSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleAnalyzeCode(args);
  });

  // Register review-code tool
  server.registerTool("review-code", {
    title: "Review Code",
    description: "Review code for bugs, security issues, performance, or style problems",
    inputSchema: ReviewCodeSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleReviewCode(args);
  });

  // Register debug-issue tool
  server.registerTool("debug-issue", {
    title: "Debug Issue",
    description: "Debug technical issues with systematic problem-solving approach",
    inputSchema: DebugIssueSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleDebugIssue(args);
  });

  // Register plan-feature tool
  server.registerTool("plan-feature", {
    title: "Plan Feature",
    description: "Plan feature implementation with step-by-step approach",
    inputSchema: PlanFeatureSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handlePlanFeature(args);
  });

  // Register generate-docs tool
  server.registerTool("generate-docs", {
    title: "Generate Documentation",
    description: "Generate documentation in various formats",
    inputSchema: GenerateDocsSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleGenerateDocs(args);
  });

  // Register challenge tool
  server.registerTool("challenge", {
    title: "Challenge",
    description: "Challenge a statement or assumption with critical thinking",
    inputSchema: ChallengeSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleChallenge(args);
  });

  // Register consensus tool
  server.registerTool("consensus", {
    title: "Consensus",
    description: "Get consensus from multiple AI models on a proposal",
    inputSchema: ConsensusSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleConsensus(args);
  });

  // Register planner tool
  server.registerTool("planner", {
    title: "Planner",
    description: "Multi-step planning with revisions and branches",
    inputSchema: PlannerSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handlePlanner(args);
  });

  // Register precommit tool
  server.registerTool("precommit", {
    title: "Pre-commit Validation",
    description: "Pre-commit validation for code changes",
    inputSchema: PrecommitSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handlePrecommit(args);
  });

  // Register secaudit tool
  server.registerTool("secaudit", {
    title: "Security Audit",
    description: "Security audit for code and configurations",
    inputSchema: SecauditSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleSecaudit(args);
  });

  // Register tracer tool
  server.registerTool("tracer", {
    title: "Tracer",
    description: "Trace execution flow and debug complex issues",
    inputSchema: TracerSchema.shape,
  }, async (args) => {
    const aiHandlers = await getHandlers();
    return await aiHandlers.handleTracer(args);
  });

  // Register advanced workflow tools
  server.registerTool("ultra-review", {
    title: "Ultra Review", 
    description: "Comprehensive code review with step-by-step workflow analysis",
    inputSchema: CodeReviewSchema.shape,
  }, async (args) => {
    const { AdvancedToolsHandler } = await import("./handlers/advanced-tools");
    const handler = new AdvancedToolsHandler();
    return await handler.handleCodeReview(args);
  });

  server.registerTool("ultra-analyze", {
    title: "Ultra Analyze",
    description: "Comprehensive code analysis with step-by-step workflow",
    inputSchema: CodeAnalysisSchema.shape,
  }, async (args) => {
    const { AdvancedToolsHandler } = await import("./handlers/advanced-tools");
    const handler = new AdvancedToolsHandler();
    return await handler.handleCodeAnalysis(args);
  });

  server.registerTool("ultra-debug", {
    title: "Ultra Debug",
    description: "Systematic debugging with step-by-step root cause analysis",
    inputSchema: DebugSchema.shape,
  }, async (args) => {
    const { AdvancedToolsHandler } = await import("./handlers/advanced-tools");
    const handler = new AdvancedToolsHandler();
    return await handler.handleDebug(args);
  });

  server.registerTool("ultra-plan", {
    title: "Ultra Plan",
    description: "Multi-step feature planning with revisions and branches",
    inputSchema: PlanSchema.shape,
  }, async (args) => {
    const { AdvancedToolsHandler } = await import("./handlers/advanced-tools");
    const handler = new AdvancedToolsHandler();
    return await handler.handlePlan(args);
  });

  server.registerTool("ultra-docs", {
    title: "Ultra Docs",
    description: "Generate comprehensive documentation with step-by-step workflow",
    inputSchema: DocsSchema.shape,
  }, async (args) => {
    const { AdvancedToolsHandler } = await import("./handlers/advanced-tools");
    const handler = new AdvancedToolsHandler();
    return await handler.handleDocs(args);
  });

  // Register vector indexing tools
  server.registerTool("index-vectors", {
    title: "Index Vectors",
    description: "Index project files for semantic search using vector embeddings",
    inputSchema: IndexVectorsSchema.shape,
  }, async (args) => {
    const { handleIndexVectors } = await import("./handlers/vector");
    const result = await handleIndexVectors(args);
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  });

  server.registerTool("search-vectors", {
    title: "Search Vectors",
    description: "Search for files and code snippets using natural language queries",
    inputSchema: SearchVectorsSchema.shape,
  }, async (args) => {
    const { handleSearchVectors } = await import("./handlers/vector");
    const result = await handleSearchVectors(args);
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  });

  server.registerTool("clear-vectors", {
    title: "Clear Vectors",
    description: "Clear all indexed vectors for a project",
    inputSchema: ClearVectorsSchema.shape,
  }, async (args) => {
    const { handleClearVectors } = await import("./handlers/vector");
    const result = await handleClearVectors(args);
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  });

  return server;
}