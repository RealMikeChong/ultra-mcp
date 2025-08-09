#!/usr/bin/env node

import { program } from 'commander';
import { runInteractiveConfig } from './config/interactive';
import { stdioServer, httpServer } from './protocols/index.js';
import { runDoctor } from './commands/doctor';
import { runChat } from './commands/chat';
import { runInstall } from './commands/install';
import { runDbShow, runDbView, runDbStats } from './commands/db';
import { runDashboard } from './commands/dashboard';
import { createVectorIndexCommand } from './commands/vector-index';
import { createVectorSearchCommand } from './commands/vector-search';
import { 
  createReviewCommand, 
  createAnalyzeCommand, 
  createDebugCommand, 
  createPlanCommand, 
  createDocsCommand 
} from './commands/workflow-tools';
import { showQuickApiKeyGuide } from './utils/api-key-guide';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json
let version = '0.1.0'; // fallback
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  version = packageJson.version;
} catch {
  // Use fallback version
}

program
  .name('ultra-mcp')
  .description('Ultra MCP - Model Context Protocol server for OpenAI and Gemini')
  .version(version)
  .addHelpText('after', '\nGetting Started:\n  1. Install for Claude Code: npx -y ultra-mcp install\n  2. Configure API keys: npx -y ultra-mcp config\n  3. Check health: npx -y ultra-mcp doctor\n\nTransport Modes:\n  Default: stdio (local MCP protocol)\n  HTTP/SSE: TRANSPORT=sse ultra-mcp (remote/containerized)\n\nEnvironment Variables:\n  TRANSPORT=sse     Use Server-Sent Events transport (HTTP)\n  PORT=3000         HTTP server port (SSE mode only)\n  ALLOWED_ORIGINS   Comma-separated CORS origins (SSE mode only)')
  .on('--help', () => {
    showQuickApiKeyGuide();
  });

program
  .command('config')
  .description('Configure API keys and settings')
  .action(async () => {
    try {
      await runInteractiveConfig();
      process.exit(0);
    } catch (error) {
      console.error('Configuration error:', error);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check installation and configuration health')
  .option('--test', 'Test connections to configured providers')
  .action(async (options) => {
    try {
      await runDoctor(options);
    } catch (error) {
      console.error('Doctor error:', error);
      process.exit(1);
    }
  });

program
  .command('chat')
  .description('Interactive chat with AI models')
  .option('-m, --model <model>', 'Model to use for chat')
  .option('-p, --provider <provider>', 'Provider to use (openai, gemini, azure, grok)')
  .action(async (options) => {
    try {
      await runChat(options);
    } catch (error) {
      console.error('Chat error:', error);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install Ultra MCP for Claude Code')
  .action(async () => {
    try {
      await runInstall();
    } catch (error) {
      console.error('Install error:', error);
      process.exit(1);
    }
  });

program
  .command('db:show')
  .description('Show database file path and info')
  .action(async () => {
    try {
      await runDbShow();
    } catch (error) {
      console.error('Database show error:', error);
      process.exit(1);
    }
  });

program
  .command('db:view')
  .description('Launch Drizzle Studio to view database')
  .action(async () => {
    try {
      await runDbView();
    } catch (error) {
      console.error('Database view error:', error);
      process.exit(1);
    }
  });

program
  .command('db:stats')
  .description('Show usage statistics')
  .action(async () => {
    try {
      await runDbStats();
    } catch (error) {
      console.error('Database stats error:', error);
      process.exit(1);
    }
  });

program
  .command('dashboard')
  .description('Start web dashboard for analytics and configuration')
  .option('-p, --port <port>', 'port to run dashboard on', '3000')
  .option('--dev', 'run in development mode')
  .action(async (options) => {
    try {
      await runDashboard({
        port: parseInt(options.port, 10),
        dev: options.dev || false,
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      process.exit(1);
    }
  });

// Add vector commands
program.addCommand(createVectorIndexCommand());
program.addCommand(createVectorSearchCommand());

// Add advanced workflow commands
program.addCommand(createReviewCommand());
program.addCommand(createAnalyzeCommand());
program.addCommand(createDebugCommand());
program.addCommand(createPlanCommand());
program.addCommand(createDocsCommand());

// Default command (when no subcommand is provided)
program
  .option('-t, --transport <transport>', 'transport to run server on', 'stdio')
  .option('-p, --port <port>', 'port to run server on', '8080')
  .action(async (options) => {
    try {
      // Add debugging
      writeFileSync('/tmp/ultra-mcp-cli-start.log', `Starting server at ${new Date().toISOString()}\n`);

      if (options.transport === 'http') {
        await httpServer.start(parseInt(options.port, 10));
      } else {
        await stdioServer.start();
      }

      appendFileSync('/tmp/ultra-mcp-cli-start.log', `Server started successfully at ${new Date().toISOString()}\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      appendFileSync('/tmp/ultra-mcp-cli-start.log', `Server error: ${errorMessage}\n${errorStack}\n`);
      console.error('Server error:', error);
      process.exit(1);
    }
  });

program.parse();