import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdvancedToolsHandler, CodeReviewSchema, CodeAnalysisSchema, DebugSchema, PlanSchema, DocsSchema } from './handlers/advanced-tools';
import { ultraTools, handleChallenge, handleContinuation, handleSession, handleBudget } from './handlers/ultra-tools.js';

// Import Zod schemas from ai-tools
const DeepReasoningSchema = z.object({
  provider: z.enum(["openai", "gemini", "azure", "grok"]).optional().describe("AI provider to use (defaults to Azure if configured, otherwise OpenAI)"),
  prompt: z.string().describe("The complex question or problem requiring deep reasoning"),
  model: z.string().optional().describe("Specific model to use (optional, will use provider default)"),
  temperature: z.number().min(0).max(2).optional().default(0.7).describe("Temperature for response generation"),
  maxOutputTokens: z.number().positive().optional().describe("Maximum tokens in response"),
  systemPrompt: z.string().optional().describe("System prompt to set context for reasoning"),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional().default("high").describe("Reasoning effort level (for certain reasoning models)"),
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
    model: z.string().describe("Model name to consult (e.g., 'gemini-pro', 'gpt-4', 'gpt-5')"),
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
  path: z.string().optional().describe("Project path to index (defaults to current directory)"),
  provider: z.enum(["openai", "azure", "gemini"]).optional().describe("Embedding provider to use (defaults to configured provider)"),
  force: z.boolean().optional().describe("Force re-indexing of all files"),
});

const SearchVectorsSchema = z.object({
  query: z.string().describe("Natural language search query"),
  path: z.string().optional().describe("Project path to search (defaults to current directory)"),
  provider: z.enum(["openai", "azure", "gemini"]).optional().describe("Embedding provider to use (defaults to configured provider)"),
  limit: z.number().min(1).max(50).optional().describe("Maximum number of results"),
  similarityThreshold: z.number().min(0).max(1).optional().describe("Minimum similarity score (0-1)"),
  filesOnly: z.boolean().optional().describe("Return only file paths without chunks"),
});

const ClearVectorsSchema = z.object({
  path: z.string().optional().describe("Project path to clear vectors from (defaults to current directory)"),
});

// Zen-inspired tool schemas
const ZenChallengeSchema = z.object({
  prompt: z.string().describe("The statement, assumption, or proposal to analyze critically"),
  provider: z.enum(["openai", "gemini", "azure", "grok", "openai-compatible"]).optional().describe("AI provider to use for critical analysis (optional, defaults to best available)"),
  model: z.string().optional().describe("Specific model to use (optional)"),
  sessionId: z.string().optional().describe("Session ID for conversation context (optional)"),
});

const ZenContinuationSchema = z.object({
  sessionId: z.string().describe("Session ID to continue from"),
  prompt: z.string().describe("New prompt or question to continue the conversation"),
  provider: z.enum(["openai", "gemini", "azure", "grok", "openai-compatible"]).optional().describe("AI provider to use (optional, defaults to best available)"),
  model: z.string().optional().describe("Specific model to use (optional)"),
  includeFiles: z.boolean().optional().describe("Whether to include file context from the session (default: true)"),
});

const ZenSessionSchema = z.object({
  action: z.enum(["create", "list", "get", "archive", "delete"]).describe("Action to perform"),
  sessionId: z.string().optional().describe("Session ID (required for get, archive, delete actions)"),
  name: z.string().optional().describe("Session name (optional for create action)"),
  status: z.enum(["active", "archived", "deleted"]).optional().describe("Session status filter for list action (default: active)"),
});

const ZenBudgetSchema = z.object({
  action: z.enum(["set", "get", "check"]).describe("Action to perform"),
  sessionId: z.string().describe("Session ID to manage budget for"),
  maxTokens: z.number().optional().describe("Maximum tokens allowed for the session"),
  maxCostUsd: z.number().optional().describe("Maximum cost in USD allowed for the session"),
  maxDurationMs: z.number().optional().describe("Maximum duration in milliseconds allowed for the session"),
});

export function createServer() {
  const server = new McpServer(
    {
      name: "ultra-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Lazy loading of handlers
  let handlers: any = null;
  let providerManager: any = null;
  
  async function getHandlers() {
    if (!handlers) {
      const { ConfigManager } = require("./config/manager");
      const { ProviderManager } = require("./providers/manager");
      const { AIToolHandlers } = require("./handlers/ai-tools");
      
      const configManager = new ConfigManager();
      
      // Load config and set environment variables
      const config = await configManager.getConfig();
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
      
      providerManager = new ProviderManager(configManager);
      handlers = new AIToolHandlers(providerManager);
    }
    
    return handlers;
  }
  
  async function getProviderManager() {
    if (!providerManager) {
      await getHandlers(); // This will initialize providerManager
    }
    return providerManager;
  }

  // Register deep-reasoning tool
  server.registerTool("deep-reasoning", {
    title: "Deep Reasoning",
    description: "Use advanced AI models for deep reasoning and complex problem-solving. Supports GPT-5 for OpenAI/Azure and Gemini 2.5 Pro with Google Search.",
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
    const result = await handleIndexVectors({
      path: args.path || process.cwd(),
      provider: args.provider,
      force: args.force || false,
    });
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
    const result = await handleSearchVectors({
      query: args.query,
      path: args.path || process.cwd(),
      provider: args.provider,
      limit: args.limit || 10,
      similarityThreshold: args.similarityThreshold || 0.7,
      filesOnly: args.filesOnly || false,
    });
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
    const result = await handleClearVectors({
      path: args.path || process.cwd(),
    });
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  });

  // Register prompts for all tools

  // Core AI tool prompts (using string-only schemas for MCP compatibility)
  server.registerPrompt("deep-reasoning", {
    title: "Deep Reasoning", 
    description: "Use advanced AI reasoning to solve complex problems requiring deep analysis",
    argsSchema: {
      prompt: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      systemPrompt: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Use advanced AI reasoning to solve this complex problem: ${args.prompt}${args.provider ? ` (using ${args.provider} provider)` : ''}${args.systemPrompt ? `\n\nSystem context: ${args.systemPrompt}` : ''}`
      }
    }]
  }));

  server.registerPrompt("investigate", {
    title: "Investigate Topic",
    description: "Thoroughly investigate any topic with configurable depth of analysis",
    argsSchema: {
      topic: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      depth: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Investigate this topic with ${args.depth || 'standard'} analysis: ${args.topic}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("research", {
    title: "Comprehensive Research",
    description: "Conduct thorough research on any topic with multiple output formats",
    argsSchema: {
      query: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      outputFormat: z.string().optional(),
      sources: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Research this topic thoroughly: ${args.query}${args.outputFormat ? ` (format: ${args.outputFormat})` : ''}${args.sources ? `\n\nFocus on these sources: ${args.sources}` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("list-ai-models", {
    title: "List AI Models",
    description: "Show all available AI models and their configuration status",
    argsSchema: {},
  }, () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: "Show me all available AI models and their configuration status"
      }
    }]
  }));

  // Code tool prompts
  server.registerPrompt("analyze-code", {
    title: "Analyze Code", 
    description: "Analyze code for architecture, performance, security, or quality issues",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      focus: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Analyze this code: ${args.task}${args.files ? `\n\nFocus on these files: ${args.files}` : ''}${args.focus ? ` (analysis focus: ${args.focus})` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("review-code", {
    title: "Review Code",
    description: "Review code for bugs, security issues, performance, or style problems",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      focus: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Review this code: ${args.task}${args.files ? `\n\nFocus on these files: ${args.files}` : ''}${args.focus ? ` (review focus: ${args.focus})` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("debug-issue", {
    title: "Debug Issue",
    description: "Debug technical issues with systematic problem-solving approach",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      symptoms: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Debug this issue: ${args.task}${args.files ? `\n\nRelevant files: ${args.files}` : ''}${args.symptoms ? `\n\nSymptoms observed: ${args.symptoms}` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("plan-feature", {
    title: "Plan Feature",
    description: "Plan feature implementation with comprehensive step-by-step approach",
    argsSchema: {
      task: z.string(),
      requirements: z.string().optional(),
      scope: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Plan this feature implementation: ${args.task}${args.requirements ? `\n\nRequirements: ${args.requirements}` : ''}${args.scope ? ` (planning scope: ${args.scope})` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("generate-docs", {
    title: "Generate Documentation",
    description: "Generate comprehensive documentation in various formats",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      format: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Generate documentation for: ${args.task}${args.files ? `\n\nFiles to document: ${args.files}` : ''}${args.format ? ` (format: ${args.format})` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  // Advanced tool prompts
  server.registerPrompt("challenge", {
    title: "Challenge Statement",
    description: "Challenge a statement or assumption with critical thinking",
    argsSchema: {
      prompt: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      sessionId: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Challenge this statement with critical thinking and provide alternative perspectives: ${args.prompt}`
      }
    }]
  }));

  server.registerPrompt("consensus", {
    title: "Multi-Model Consensus",
    description: "Get consensus from multiple AI models on a proposal or decision",
    // Use string-only schema for MCP compatibility
    argsSchema: {
      proposal: z.string(),
      models: z.string(), // e.g., "gpt-4:for, gemini:neutral"
      files: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Get multi-model consensus on this proposal: ${args.proposal}\n\nConsult these models: ${args.models}${args.files ? `\n\nRelevant files for context: ${args.files}` : ''}`
      }
    }]
  }));

  server.registerPrompt("planner", {
    title: "Multi-Step Planning",
    description: "Create detailed multi-step plans with revisions and branching support",
    // String-only schema
    argsSchema: {
      task: z.string(),
      stepNumber: z.string(),
      totalSteps: z.string(),
      scope: z.string().optional(),
      requirements: z.string().optional(),
      isRevision: z.string().optional(),
      revisingStep: z.string().optional(),
      isBranching: z.string().optional(),
      branchingFrom: z.string().optional(),
      branchId: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Create a detailed plan for: ${args.task} (Step ${args.stepNumber} of ${args.totalSteps})${args.scope ? ` (scope: ${args.scope})` : ''}${args.requirements ? `\n\nRequirements: ${args.requirements}` : ''}${args.isRevision ? `\n\nThis is a revision of step ${args.revisingStep}` : ''}${args.isBranching ? `\n\nThis branches from step ${args.branchingFrom} as ${args.branchId}` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("precommit", {
    title: "Pre-commit Validation",
    description: "Validate code changes before committing with comprehensive checks",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      focus: z.string().optional(),
      compareTo: z.string().optional(),
      severity: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Validate these changes before commit: ${args.task}${args.files ? `\n\nFiles to check: ${args.files}` : ''}${args.focus ? ` (focus: ${args.focus})` : ''}${args.compareTo ? `\n\nCompare against: ${args.compareTo}` : ''}${args.severity ? ` (minimum severity: ${args.severity})` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("secaudit", {
    title: "Security Audit", 
    description: "Comprehensive security audit for code and configurations",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      focus: z.string().optional(),
      complianceRequirements: z.string().optional(),
      securityScope: z.string().optional(),
      provider: z.string().optional(),
      threatLevel: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Perform security audit: ${args.task}${args.files ? `\n\nFiles to audit: ${args.files}` : ''}${args.focus ? ` (focus: ${args.focus})` : ''}${args.threatLevel ? ` (threat level: ${args.threatLevel})` : ''}${args.complianceRequirements ? `\n\nCompliance requirements: ${args.complianceRequirements}` : ''}${args.securityScope ? `\n\nApplication context: ${args.securityScope}` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("tracer", {
    title: "Code Tracer",
    description: "Trace execution flow and debug complex code relationships", 
    argsSchema: {
      task: z.string(),
      traceMode: z.string().optional(),
      targetDescription: z.string().optional(),
      files: z.string().optional(),
      provider: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Trace this code: ${args.task}${args.traceMode ? ` (trace mode: ${args.traceMode})` : ''}${args.targetDescription ? `\n\nTarget to trace: ${args.targetDescription}` : ''}${args.files ? `\n\nFocus on files: ${args.files}` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  // Workflow tool prompts
  server.registerPrompt("ultra-review", {
    title: "Ultra Code Review",
    description: "Comprehensive step-by-step code review with detailed analysis",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      focus: z.string().optional(),
      stepNumber: z.string(),
      totalSteps: z.string(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Perform comprehensive code review: ${args.task}${args.files ? `\n\nFiles to review: ${args.files}` : ''}${args.focus ? ` (focus: ${args.focus})` : ''} (Step ${args.stepNumber} of ${args.totalSteps})`
      }
    }]
  }));

  server.registerPrompt("ultra-analyze", {
    title: "Ultra Code Analysis",
    description: "Deep step-by-step code analysis with architectural insights",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      focus: z.string().optional(),
      stepNumber: z.string(),
      totalSteps: z.string(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Perform deep code analysis: ${args.task}${args.files ? `\n\nFiles to analyze: ${args.files}` : ''}${args.focus ? ` (focus: ${args.focus})` : ''} (Step ${args.stepNumber} of ${args.totalSteps})`
      }
    }]
  }));

  server.registerPrompt("ultra-debug", {
    title: "Ultra Debug Analysis",
    description: "Systematic step-by-step debugging with root cause analysis",
    argsSchema: {
      issue: z.string(),
      files: z.string().optional(),
      symptoms: z.string().optional(),
      stepNumber: z.string(),
      totalSteps: z.string(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Debug this issue systematically: ${args.issue}${args.files ? `\n\nRelevant files: ${args.files}` : ''}${args.symptoms ? `\n\nSymptoms: ${args.symptoms}` : ''} (Step ${args.stepNumber} of ${args.totalSteps})`
      }
    }]
  }));

  server.registerPrompt("ultra-plan", {
    title: "Ultra Feature Planning",
    description: "Advanced multi-step feature planning with revisions and branches",
    argsSchema: {
      task: z.string(),
      requirements: z.string().optional(),
      scope: z.string().optional(),
      stepNumber: z.string(),
      totalSteps: z.string(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Plan this feature comprehensively: ${args.task}${args.requirements ? `\n\nRequirements: ${args.requirements}` : ''}${args.scope ? ` (scope: ${args.scope})` : ''} (Step ${args.stepNumber} of ${args.totalSteps})`
      }
    }]
  }));

  server.registerPrompt("ultra-docs", {
    title: "Ultra Documentation",
    description: "Comprehensive step-by-step documentation generation",
    argsSchema: {
      task: z.string(),
      files: z.string().optional(),
      format: z.string().optional(),
      stepNumber: z.string(),
      totalSteps: z.string(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Generate comprehensive documentation: ${args.task}${args.files ? `\n\nFiles to document: ${args.files}` : ''}${args.format ? ` (format: ${args.format})` : ''} (Step ${args.stepNumber} of ${args.totalSteps})`
      }
    }]
  }));

  // Vector tool prompts
  server.registerPrompt("index-vectors", {
    title: "Index Code Vectors",
    description: "Index project files for semantic search using vector embeddings",
    argsSchema: {
      path: z.string().optional(),
      provider: z.string().optional(),
      force: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Index code files for semantic search: ${args.path || process.cwd()}${args.provider ? ` (using ${args.provider} embeddings)` : ''}${args.force ? ' (force re-indexing)' : ''}`
      }
    }]
  }));

  server.registerPrompt("search-vectors", {
    title: "Search Code Vectors",
    description: "Search indexed code files using natural language queries",
    argsSchema: {
      query: z.string(),
      path: z.string().optional(),
      provider: z.string().optional(),
      limit: z.string().optional(),
      similarityThreshold: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Search code semantically: ${args.query} in ${args.path || process.cwd()}${args.provider ? ` (using ${args.provider} embeddings)` : ''}${args.limit ? ` (max ${args.limit} results)` : ''}${args.similarityThreshold ? ` (min similarity: ${args.similarityThreshold})` : ''}`
      }
    }]
  }));

  server.registerPrompt("clear-vectors", {
    title: "Clear Code Vectors",
    description: "Clear all indexed vectors for a project",
    argsSchema: {
      path: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Clear all indexed vectors for project: ${args.path || process.cwd()}`
      }
    }]
  }));

  // Register ultra-inspired tools
  server.registerTool("ultra-challenge", {
    title: "Zen Challenge",
    description: "Challenges a statement or assumption with critical thinking to prevent reflexive agreement",
    inputSchema: ZenChallengeSchema.shape,
  }, async (args) => {
    const provider = await getProviderManager();
    return await handleChallenge(args, provider) as any;
  });

  server.registerTool("ultra-continuation", {
    title: "Zen Continuation",
    description: "Continue a conversation with context from a previous session, enabling context revival across interactions",
    inputSchema: ZenContinuationSchema.shape,
  }, async (args) => {
    const provider = await getProviderManager();
    return await handleContinuation(args, provider) as any;
  });

  server.registerTool("ultra-session", {
    title: "Zen Session",
    description: "Manage conversation sessions for persistent context and memory",
    inputSchema: ZenSessionSchema.shape,
  }, async (args) => {
    return await handleSession(args) as any;
  });

  server.registerTool("ultra-budget", {
    title: "Zen Budget",
    description: "Set and monitor conversation budgets for cost and token control",
    inputSchema: ZenBudgetSchema.shape,
  }, async (args) => {
    return await handleBudget(args) as any;
  });

  // Register ultra tool prompts
  server.registerPrompt("ultra-challenge", {
    title: "Zen Challenge",
    description: "Challenge statements with critical thinking to prevent reflexive agreement",
    argsSchema: ZenChallengeSchema.shape,
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Challenge this statement with critical thinking: ${args.prompt}${args.sessionId ? ` (session: ${args.sessionId})` : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("ultra-continuation", {
    title: "Zen Continuation",
    description: "Continue conversations with session context revival",
    argsSchema: {
      sessionId: z.string(),
      prompt: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      includeFiles: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Continue conversation from session ${args.sessionId}: ${args.prompt}${args.includeFiles === 'false' ? ' (without files)' : ''}${args.provider ? ` (using ${args.provider} provider)` : ''}`
      }
    }]
  }));

  server.registerPrompt("ultra-session", {
    title: "Zen Session Management", 
    description: "Manage conversation sessions for persistent memory",
    argsSchema: {
      action: z.string(),
      sessionId: z.string().optional(),
      name: z.string().optional(),
      status: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Session management: ${args.action}${args.sessionId ? ` (ID: ${args.sessionId})` : ''}${args.name ? ` (name: ${args.name})` : ''}${args.status ? ` (status: ${args.status})` : ''}`
      }
    }]
  }));

  server.registerPrompt("ultra-budget", {
    title: "Zen Budget Control",
    description: "Manage conversation budgets for cost and token control",
    argsSchema: {
      action: z.string(),
      sessionId: z.string(),
      maxTokens: z.string().optional(),
      maxCostUsd: z.string().optional(),
      maxDurationMs: z.string().optional(),
    },
  }, (args) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Budget management: ${args.action} for session ${args.sessionId}${args.maxTokens ? ` (max tokens: ${args.maxTokens})` : ''}${args.maxCostUsd ? ` (max cost: $${args.maxCostUsd})` : ''}${args.maxDurationMs ? ` (max duration: ${args.maxDurationMs}ms)` : ''}`
      }
    }]
  }));

  return server;
}
