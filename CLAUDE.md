# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server called "Ultra MCP" that exposes OpenAI, Gemini, Azure OpenAI, and xAI Grok AI models through a single MCP interface for use with Claude Code and Cursor. The project uses TypeScript, Node.js, and the Vercel AI SDK.

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the MCP server locally (after building)
node dist/cli.js

# Development mode with TypeScript watch
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/cli.js

# Configure API keys
npx -y ultra-mcp config
# or after building locally:
node dist/cli.js config

# Run via npx (after publishing)
npx -y ultra-mcp
```

## CLI Commands

The Ultra MCP CLI provides several commands:

### Default Command - MCP Server

When run without arguments, Ultra MCP starts as an MCP server using stdio protocol:

```bash
# Start MCP server (stdio protocol)
npx -y ultra-mcp
# or locally:
node dist/cli.js
```

### config - Interactive Configuration

Configure API keys interactively (similar to rclone):

```bash
npx -y ultra-mcp config
# or locally:
node dist/cli.js config
```

Features:

- Interactive menu-driven interface
- Configure OpenAI, Google Gemini, Azure OpenAI, and xAI Grok API keys
- View current configuration (with masked API keys)
- Reset configuration
- API keys are stored securely in your system's config directory

### doctor - Health Check

Check installation and configuration health:

```bash
npx -y ultra-mcp doctor
# or locally:
node dist/cli.js doctor

# Test connections to configured providers
npx -y ultra-mcp doctor --test
```

The doctor command checks:

- Configuration file location and status
- API key configuration for each provider
- Provider availability
- Connection testing (with --test flag)

### chat - Interactive Chat

Chat interactively with AI models:

```bash
npx -y ultra-mcp chat
# or locally:
node dist/cli.js chat

# Specify model and provider
npx -y ultra-mcp chat -m o3-mini -p openai
npx -y ultra-mcp chat -m grok-4 -p grok
```

### install - Install for Claude Code

Install Ultra MCP as an MCP server for Claude Code:

```bash
npx -y ultra-mcp install
# or locally:
node dist/cli.js install
```

Features:

- Automatic detection of Claude Code installation
- Interactive scope selection (user or project)
- Verifies API key configuration
- Provides manual installation instructions if needed
- Uses `claude mcp add` command internally

### db:show - Show Database Information

Display database file location and statistics:

```bash
npx -y ultra-mcp db:show
# or locally:
node dist/cli.js db:show
```

### db:view - View Database with Drizzle Studio

Launch Drizzle Studio to view and query the usage database:

```bash
npx -y ultra-mcp db:view
# or locally:
node dist/cli.js db:view
```

### db:stats - Usage Statistics

Show LLM usage statistics for the last 30 days:

```bash
npx -y ultra-mcp db:stats
# or locally:
node dist/cli.js db:stats
```

Features:

- Total requests, tokens, and estimated costs
- Breakdown by AI provider
- Tracks all LLM interactions automatically

## Configuration

Ultra MCP uses the `conf` library to store configuration locally in your system's default config directory:

- macOS: `~/Library/Preferences/ultra-mcp-nodejs/`
- Linux: `~/.config/ultra-mcp/`
- Windows: `%APPDATA%\ultra-mcp-nodejs\`

The usage tracking database is stored separately:

- Unix (macOS/Linux): `~/.config/ultra-mcp/usage.db`
- Windows: `%APPDATA%\ultra-mcp-nodejs\usage.db`

### Setting up API Keys

Run the interactive configuration:

```bash
npx -y ultra-mcp config
```

This will:

1. Show current configuration status
2. Allow you to set/update API keys and base URLs for OpenAI, Google Gemini, Azure OpenAI, and xAI Grok
3. Store the configuration securely on your system
4. Automatically load API keys when the server starts

You can also set API keys and base URLs via environment variables:

- `OPENAI_API_KEY` / `OPENAI_BASE_URL`
- `GOOGLE_API_KEY` / `GOOGLE_BASE_URL`
- `AZURE_API_KEY` / `AZURE_BASE_URL` (base URL required for Azure)
- `XAI_API_KEY` / `XAI_BASE_URL`

Note: Configuration file takes precedence over environment variables.

### Provider Priority

When Azure OpenAI is configured, it is automatically preferred over other providers:

- If Azure is configured and no provider is specified in a tool call, Azure will be used
- This applies to all AI tools (deep-reasoning, investigate, research, etc.)
- You can still explicitly specify a different provider if needed

## Architecture

This MCP server acts as a bridge between multiple AI model providers and MCP clients:

1. **MCP Protocol Layer**: Implements the Model Context Protocol to communicate with Claude Code/Cursor
2. **Model Providers**: Integrates with OpenAI, Google (Gemini), Azure OpenAI, and xAI Grok models via Vercel AI SDK
3. **Usage Tracking**: SQLite database with Drizzle ORM for automatic LLM usage tracking
4. **Unified Interface**: Provides a single MCP interface to access multiple AI models

### Key Components

- `src/cli.ts`: CLI entry point with commander
- `src/server.ts`: MCP server implementation
- `src/config/`: Configuration management with schema validation
- `src/handlers/`: MCP protocol handlers for different tool types
- `src/providers/`: Model provider implementations (OpenAI, Gemini, Azure, Grok)
- `src/db/`: Database schema, connection, and usage tracking utilities
- `src/utils/`: Shared utilities for streaming, error handling, etc.

## MCP Tools

Ultra MCP exposes the following AI-powered tools through the Model Context Protocol:

### 1. `deep-reasoning`

Use advanced AI models for deep reasoning and complex problem-solving.

- **Default Models**:
  - OpenAI/Azure: O3-mini (optimized for reasoning)
  - Gemini: Gemini 2.5 Pro with Google Search enabled
- **Parameters**:
  - `prompt`: The complex question or problem (required)
  - `provider`: (optional) "openai", "gemini", "azure", or "grok" - defaults to Azure if configured
  - `model`: (optional) Specific model to use
  - `reasoningEffort`: (optional) "low", "medium", "high" (for O3 models)
  - `enableSearch`: (optional) Enable Google Search (Gemini only)

### 2. `investigate`

Investigate topics thoroughly with configurable depth.

- **Parameters**:
  - `topic`: The topic to investigate (required)
  - `provider`: (optional) "openai", "gemini", "azure", or "grok" - defaults to Azure if configured
  - `depth`: (optional) "shallow", "medium", "deep" (default: "deep")
  - `enableSearch`: (optional) Enable web search (Gemini only)

### 3. `research`

Conduct comprehensive research with multiple output formats.

- **Parameters**:
  - `query`: Research query or topic (required)
  - `provider`: (optional) "openai", "gemini", "azure", or "grok" - defaults to Azure if configured
  - `outputFormat`: (optional) "summary", "detailed", "academic" (default: "detailed")
  - `sources`: (optional) Specific sources to consider

### 4. `list-ai-models`

List all available AI models and their configuration status.

## Zen-Inspired Simplified Tools

Ultra MCP includes 5 simplified tools inspired by zen-mcp-server but designed for ease of use:

### 5. `analyze-code`

Analyze code for architecture, performance, security, or quality issues.

- **Parameters**:
  - `task`: What to analyze (required)
  - `files`: File paths to analyze (optional)
  - `focus`: "architecture", "performance", "security", "quality", "all" (default: "all")
  - `provider`: "openai", "gemini", "azure", "grok" (default: "gemini")

### 6. `review-code`

Review code for bugs, security issues, performance, or style problems.

- **Parameters**:
  - `task`: What to review (required)
  - `files`: File paths to review (optional)
  - `focus`: "bugs", "security", "performance", "style", "all" (default: "all")
  - `provider`: "openai", "gemini", "azure", "grok" (default: "openai")

### 7. `debug-issue`

Debug technical issues with systematic problem-solving approach.

- **Parameters**:
  - `task`: What to debug (required)
  - `files`: Relevant file paths (optional)
  - `symptoms`: Error symptoms or behavior observed (optional)
  - `provider`: "openai", "gemini", "azure", "grok" (default: "openai")

### 8. `plan-feature`

Plan feature implementation with step-by-step approach.

- **Parameters**:
  - `task`: What to plan (required)
  - `requirements`: Specific requirements or constraints (optional)
  - `scope`: "minimal", "standard", "comprehensive" (default: "standard")
  - `provider`: "openai", "gemini", "azure", "grok" (default: "gemini")

### 9. `generate-docs`

Generate documentation in various formats.

- **Parameters**:
  - `task`: What to document (required)
  - `files`: File paths to document (optional)
  - `format`: "markdown", "comments", "api-docs", "readme" (default: "markdown")
  - `provider`: "openai", "gemini", "azure", "grok" (default: "gemini")

### Tool Design Philosophy

These zen-inspired tools follow simplified design principles:

- **Maximum 4 parameters** (vs zen's 10-15 parameters)
- **Smart defaults** for provider and model selection
- **Single required parameter** (`task`) for ease of use
- **Consistent output format** across all tools
- **Optional file integration** without mandatory specification

### MCP Implementation Notes

- Use the `@modelcontextprotocol/sdk` package for MCP server implementation
- Implement standard MCP tools like `chat`, `completion`, etc.
- Handle streaming responses properly for real-time model outputs
- Implement proper error handling and model fallbacks
- Support environment variables for API keys (OPENAI_API_KEY, GOOGLE_API_KEY, etc.)

## TypeScript Configuration

Create a `tsconfig.json` for proper TypeScript compilation:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## MCP Server Configuration

When implementing, the MCP server should be configured in Claude Code or Cursor's settings:

```json
{
  "mcpServers": {
    "ultra-mcp": {
      "command": "node",
      "args": ["path/to/dist/cli.js"],
      "env": {
        "OPENAI_API_KEY": "your-key",
        "GOOGLE_API_KEY": "your-key"
      }
    }
  }
}
```

Or if installed globally via npm:

```json
{
  "mcpServers": {
    "ultra-mcp": {
      "command": "npx",
      "args": ["-y", "ultra"]
    }
  }
}
```

## Roadmap

### Phase 1: Zero Config Setup

- Interactive mode for seamless first-time setup
- Auto-detection of available API keys
- Smart defaults and configuration recommendations
- One-command installation and setup

### Phase 2: Integration Helpers

- Helper commands to integrate Ultra MCP into Claude Code
- Cursor IDE integration utilities
- Auto-generation of MCP server configuration files
- Integration validation and troubleshooting tools

### Phase 3: Cost Dashboard & Analytics

- Web UI dashboard using React, shadcn/ui, and Tremor
- SQLite database for usage tracking via Drizzle ORM
- Real-time cost monitoring and budget alerts
- Usage analytics and model performance insights
- Export capabilities for billing and reporting

### Phase 4: Workflow Optimization

- Use Ultra MCP to 100x your current LLM coding workflows
- Advanced prompt templates and automation
- Multi-model orchestration and fallback strategies
- Workflow optimization recommendations
- Performance monitoring and optimization tools

## Coding Guide

1. Be a good TypeScript citizen, DO NOT USE `as any`. Find good typing when needed.
2. Run `npm run lint` after each code iteration. Fix any lint errors if any.
3. Have good unit test coverage. For 3rd party dependencies which are hard to test, mock them. But don't write test for test. Just need good coverage for complicated logic.
4. Do not use `as any` unless you don't have any better way to do that. For Zod to TS interface conversion if you cannot do it, define TS shadow types.
5. We should not import TS files using .js like `import { ProviderManager } from '../providers/manager.js';` it should be `import { ProviderManager } from '../providers/manager.';` instead.

## Development Best Practices

- We don't require like 100% unit test coverage, but good to have like unit test coverages for critical logic so that we won't regress critical logic. 