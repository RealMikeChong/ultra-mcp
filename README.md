# Ultra MCP

[![npm version](https://badge.fury.io/js/ultra-mcp.svg)](https://badge.fury.io/js/ultra-mcp)
[![npm downloads](https://img.shields.io/npm/dm/ultra-mcp.svg)](https://www.npmjs.com/package/ultra-mcp)

🚀 **Ultra MCP** - A Model Context Protocol server that exposes OpenAI, Gemini, Azure OpenAI, and xAI Grok AI models through a single MCP interface for use with Claude Code and Cursor.

## Inspiration

This project is inspired by:

- **[Agent2Agent (A2A)](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)** by Google - Thank you Google for pioneering agent-to-agent communication protocols
- **[Zen MCP](https://github.com/BeehiveInnovations/zen-mcp-server)** - The AI orchestration server that enables Claude to collaborate with multiple AI models

## Why Ultra MCP?

While inspired by zen-mcp-server, Ultra MCP offers several key advantages:

### 🚀 **Easier to Use**

- **No cloning required** - Just run `npx ultra-mcp` to get started
- **NPM package** - Install globally with `npm install -g ultra-mcp`
- **Interactive setup** - Guided configuration with `npx ultra-mcp config`
- **Zero friction** - From zero to AI-powered coding in under a minute

### 📊 **Built-in Usage Analytics**

- **Local SQLite database** - All usage data stored locally using libSQL
- **Automatic tracking** - Every LLM request is tracked with token counts and costs
- **Usage statistics** - View your AI usage with `npx ultra-mcp db:stats`
- **Privacy first** - Your data never leaves your machine

### 🌐 **Modern Web Dashboard**

- **Beautiful UI** - React dashboard with Tailwind CSS
- **Real-time stats** - View usage trends, costs by provider, and model distribution
- **Easy access** - Just run `npx ultra-mcp dashboard`
- **Configuration UI** - Manage API keys and model priorities from the web

### 🔧 **Additional Benefits**

- **Simplified tools** - Maximum 4 parameters per tool (vs zen's 10-15)
- **Smart defaults** - Optimal model selection out of the box
- **TypeScript first** - Full type safety and better developer experience
- **Regular updates** - Active development with new features weekly

## Features

- 🤖 **Multi-Model Support**: Integrate OpenAI (O3), Google Gemini (2.5 Pro), Azure OpenAI, and xAI Grok models
- 🔌 **MCP Protocol**: Standard Model Context Protocol interface
- 🧠 **Deep Reasoning Tools**: Access O3 models for complex problem-solving
- 🔍 **Investigation & Research**: Built-in tools for thorough investigation and research
- 🌐 **Google Search Integration**: Gemini 2.5 Pro with real-time web search
- ⚡ **Real-time Streaming**: Live model responses via Vercel AI SDK
- 🔧 **Zero Config**: Interactive setup with smart defaults
- 🔑 **Secure Configuration**: Local API key storage with `conf` library
- 🧪 **TypeScript**: Full type safety and modern development experience

## Quick Start

### Installation

```bash
# Install globally via npm
npm install -g ultra-mcp

# Or run directly with npx
npx -y ultra-mcp config
```

### Configuration

Set up your API keys interactively:

```bash
npx -y ultra-mcp config
```

This will:

1. Show current configuration status
2. Allow you to set/update API keys and base URLs for OpenAI, Google Gemini, Azure OpenAI, and xAI Grok
3. Store configuration securely on your system
4. Auto-load API keys when the server starts

### Running the Server

```bash
# Run the MCP server
npx -y ultra

# Or after building locally
npm run build
node dist/cli.js
```

## CLI Commands

Ultra MCP provides several powerful commands:

### `config` - Interactive Configuration

```bash
npx -y ultra-mcp config
```

Configure API keys interactively with a user-friendly menu system.

### `dashboard` - Web Dashboard

```bash
npx -y ultra-mcp dashboard

# Custom port
npx -y ultra-mcp dashboard --port 4000

# Development mode
npx -y ultra-mcp dashboard --dev
```

Launch the web dashboard to view usage statistics, manage configurations, and monitor AI costs.

### `install` - Install for Claude Code

```bash
npx -y ultra-mcp install
```

Automatically install Ultra MCP as an MCP server for Claude Code.

### `doctor` - Health Check

```bash
npx -y ultra-mcp doctor

# Test connections to providers
npx -y ultra-mcp doctor --test
```

Check installation health and test API connections.

### `chat` - Interactive Chat

```bash
npx -y ultra-mcp chat

# Specify model and provider
npx -y ultra-mcp chat -m o3 -p openai
npx -y ultra-mcp chat -m grok-4 -p grok
```

Chat interactively with AI models from the command line.

### Database Commands

#### `db:show` - Show Database Info

```bash
npx -y ultra-mcp db:show
```

Display database file location and basic statistics.

#### `db:stats` - Usage Statistics

```bash
npx -y ultra-mcp db:stats
```

Show detailed usage statistics for the last 30 days including costs by provider.

#### `db:view` - Database Viewer

```bash
npx -y ultra-mcp db:view
```

Launch Drizzle Studio to explore the usage database interactively.

### Integration with Claude Code

#### Automatic Installation (Recommended)

```bash
# Install Ultra MCP for Claude Code
npx -y ultra-mcp install
```

This command will:

- Detect Claude Code installation
- Add Ultra MCP as an MCP server
- Configure for user or project scope
- Verify API key configuration

#### Manual Installation

Add to your Claude Code settings:

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

### Integration with Cursor

First configure your API keys:

```bash
npx -y ultra-mcp config
```

Then add to your Cursor MCP settings:

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

Ultra MCP will automatically use the API keys you configured with the `config` command.

## MCP Tools

Ultra MCP provides powerful AI tools accessible through Claude Code and Cursor:

### 🧠 Deep Reasoning (`deep-reasoning`)

Leverage advanced AI models for complex problem-solving and analysis.

- **Default**: O3 for OpenAI/Azure, Gemini 2.5 Pro with Google Search, Grok-4 for xAI
- **Use Cases**: Complex algorithms, architectural decisions, deep analysis

### 🔍 Investigate (`investigate`)

Thoroughly investigate topics with configurable depth levels.

- **Depth Levels**: shallow, medium, deep
- **Google Search**: Enabled by default for Gemini
- **Use Cases**: Research topics, explore concepts, gather insights

### 📚 Research (`research`)

Conduct comprehensive research with multiple output formats.

- **Output Formats**: summary, detailed, academic
- **Use Cases**: Literature reviews, technology comparisons, documentation

### 📋 List Models (`list-ai-models`)

View all available AI models and their configuration status.

### Example Usage

```javascript
// In Claude Code or Cursor with MCP
await use_mcp_tool('ultra-mcp', 'deep-reasoning', {
  provider: 'openai',
  prompt: 'Design a distributed caching system for microservices',
  reasoningEffort: 'high',
});
```

## Development

```bash
# Clone the repository
git clone https://github.com/RealMikeChong/ultra-mcp
cd ultra-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Development mode with watch
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/cli.js
```

## Architecture

Ultra MCP acts as a bridge between multiple AI model providers and MCP clients:

1. **MCP Protocol Layer**: Implements Model Context Protocol for Claude Code/Cursor communication
2. **Model Providers**: Integrates OpenAI, Google (Gemini), Azure OpenAI, and xAI Grok via Vercel AI SDK
3. **Unified Interface**: Single MCP interface to access multiple AI models
4. **Configuration Management**: Secure local storage with schema validation

### Key Components

- `src/cli.ts` - CLI entry point with commander
- `src/server.ts` - MCP server implementation
- `src/config/` - Configuration management with schema validation
- `src/handlers/` - MCP protocol handlers
- `src/providers/` - Model provider implementations
- `src/utils/` - Shared utilities for streaming and error handling

## Configuration Storage

Ultra MCP stores configuration in your system's default config directory:

- **macOS**: `~/Library/Preferences/ultra-mcp-nodejs/`
- **Linux**: `~/.config/ultra-mcp/`
- **Windows**: `%APPDATA%\ultra-mcp-nodejs\`

## Environment Variables

You can also set API keys and base URLs via environment variables:

- `OPENAI_API_KEY` / `OPENAI_BASE_URL`
- `GOOGLE_API_KEY` / `GOOGLE_BASE_URL`
- `AZURE_API_KEY` / `AZURE_BASE_URL` (base URL required for Azure)
- `XAI_API_KEY` / `XAI_BASE_URL`

_Note: Configuration file takes precedence over environment variables._

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

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -m "Add feature"`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Google** for the [Agent2Agent (A2A) Protocol](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) inspiring agent interoperability
- **BeehiveInnovations** for [Zen MCP](https://github.com/BeehiveInnovations/zen-mcp-server) demonstrating AI model orchestration
- **Anthropic** for the [Model Context Protocol](https://modelcontextprotocol.io/)
- **Vercel** for the excellent [AI SDK](https://sdk.vercel.ai/)

## About the Author

👋 **Mike Chong** - Building tools to amplify human potential through AI.

As one of the earliest **users** of GitHub Copilot (personally invited by Nat Friedman, former GitHub CEO), I've witnessed firsthand how AI-assisted development can transform the way we build software. My journey as a former engineer on **Outlook iOS/Android** taught me the importance of creating tools that genuinely improve people's daily lives.

**Ultra MCP** represents my vision of democratizing access to the best AI models, making cutting-edge AI capabilities accessible to every developer through a unified, simple interface. I believe that by removing barriers between developers and AI models, we can accelerate innovation and create a better world for everyone.

_"The future belongs to those who can seamlessly orchestrate human creativity with AI capabilities."_

## Why Ultra MCP is Different from Zen MCP Server

While both projects aim to enhance AI development workflows, Ultra MCP brings unique advantages:

1. **Written in TypeScript** - Full type safety, better IDE support, and more maintainable codebase compared to Python-based alternatives
2. **Built-in Usage Analytics** - Lightweight SQLite database powered by libsql for automatic LLM usage tracking and cost monitoring. Without knowing your bill, it's not great to use AI by AI IMHO.

These features make Ultra MCP particularly suited for developers who want robust tooling with built-in cost visibility for responsible AI usage.

## Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Agent2Agent Protocol](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [Claude Code](https://claude.ai/code)
- [Cursor IDE](https://cursor.sh/)
