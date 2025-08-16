import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ProviderManager } from '../providers/manager.js';
import { conversationMemory } from '../db/conversation-memory.js';

/**
 * Challenge tool - Prevents reflexive agreement by encouraging critical thinking
 * Inspired by ultra-mcp's critical thinking approach
 */
export const challengeTool: Tool = {
  name: 'challenge',
  description: 'Challenges a statement or assumption with critical thinking to prevent reflexive agreement. Use when you want honest analysis instead of automatic agreement.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The statement, assumption, or proposal to analyze critically'
      },
      provider: {
        type: 'string',
        enum: ['openai', 'gemini', 'azure', 'grok', 'openai-compatible'],
        description: 'AI provider to use for critical analysis (optional, defaults to best available)'
      },
      model: {
        type: 'string',
        description: 'Specific model to use (optional)'
      },
      sessionId: {
        type: 'string',
        description: 'Session ID for conversation context (optional)'
      }
    },
    required: ['prompt'],
    additionalProperties: false
  }
};

/**
 * Continuation tool - Continue a conversation with another model using session context
 */
export const continuationTool: Tool = {
  name: 'continuation',
  description: 'Continue a conversation with context from a previous session, enabling context revival across interactions',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID to continue from'
      },
      prompt: {
        type: 'string',
        description: 'New prompt or question to continue the conversation'
      },
      provider: {
        type: 'string',
        enum: ['openai', 'gemini', 'azure', 'grok', 'openai-compatible'],
        description: 'AI provider to use (optional, defaults to best available)'
      },
      model: {
        type: 'string',
        description: 'Specific model to use (optional)'
      },
      includeFiles: {
        type: 'boolean',
        description: 'Whether to include file context from the session (default: true)'
      }
    },
    required: ['sessionId', 'prompt'],
    additionalProperties: false
  }
};

/**
 * Session management tool - Create, list, and manage conversation sessions
 */
export const sessionTool: Tool = {
  name: 'session',
  description: 'Manage conversation sessions for persistent context and memory',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'get', 'archive', 'delete'],
        description: 'Action to perform'
      },
      sessionId: {
        type: 'string',
        description: 'Session ID (required for get, archive, delete actions)'
      },
      name: {
        type: 'string',
        description: 'Session name (optional for create action)'
      },
      status: {
        type: 'string',
        enum: ['active', 'archived', 'deleted'],
        description: 'Session status filter for list action (default: active)'
      }
    },
    required: ['action'],
    additionalProperties: false
  }
};

/**
 * Budget management tool - Set and monitor conversation budgets
 */
export const budgetTool: Tool = {
  name: 'budget',
  description: 'Set and monitor conversation budgets for cost and token control',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['set', 'get', 'check'],
        description: 'Action to perform'
      },
      sessionId: {
        type: 'string',
        description: 'Session ID to manage budget for'
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens allowed for the session'
      },
      maxCostUsd: {
        type: 'number',
        description: 'Maximum cost in USD allowed for the session'
      },
      maxDurationMs: {
        type: 'number',
        description: 'Maximum duration in milliseconds allowed for the session'
      }
    },
    required: ['action', 'sessionId'],
    additionalProperties: false
  }
};

/**
 * Handle challenge tool execution
 */
export async function handleChallenge(args: any, providerManager: ProviderManager) {
  const { prompt, provider, model, sessionId } = args;

  // Wrap the prompt with critical thinking instructions
  const challengePrompt = `You are asked to critically analyze the following statement or assumption. Your goal is to provide honest, thoughtful analysis rather than automatic agreement.

Instructions:
- Challenge assumptions if they seem questionable
- Point out potential flaws, limitations, or alternative perspectives
- Ask clarifying questions if the statement is unclear
- Provide evidence-based reasoning for your analysis
- If you disagree, explain why clearly and constructively
- If you agree, explain your reasoning and any caveats

DO NOT simply agree to be agreeable. Your role is to provide honest, critical evaluation.

Statement to analyze:
${prompt}

Provide your critical analysis:`;

  // Get conversation context if sessionId provided
  let conversationContext = '';
  if (sessionId) {
    try {
      const context = await conversationMemory.getConversationContext(sessionId, 4000, true);
      if (context.messages.length > 0) {
        conversationContext = '\n\nPrevious conversation context:\n' + 
          context.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
      }
    } catch (error) {
      console.warn('Failed to load conversation context:', error);
    }
  }

  const finalPrompt = challengePrompt + conversationContext;

  // Use provider manager to get response
  const aiProvider = await providerManager.getProvider(provider);
  const result = await aiProvider.generateText({
    prompt: finalPrompt,
    model: model || aiProvider.getDefaultModel(),
    temperature: 0.7,
    useSearchGrounding: false,
  });

  // Save to conversation if sessionId provided
  if (sessionId) {
    try {
      await conversationMemory.getOrCreateSession(sessionId);
      await conversationMemory.addMessage(sessionId, 'user', prompt, 'challenge');
      await conversationMemory.addMessage(
        sessionId, 
        'assistant', 
        result.text, 
        'challenge',
        undefined,
        { provider, model: result.model }
      );
    } catch (error) {
      console.warn('Failed to save to conversation:', error);
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `## Critical Analysis\n\n${result.text}\n\n---\n*Analysis provided by ${result.model} via critical thinking prompt to prevent reflexive agreement.*`
      }
    ]
  };
}

/**
 * Handle continuation tool execution
 */
export async function handleContinuation(args: any, providerManager: ProviderManager) {
  const { sessionId, prompt, provider, model, includeFiles = true } = args;

  // Get conversation context
  const context = await conversationMemory.getConversationContext(sessionId, 8000, includeFiles);
  
  if (context.messages.length === 0) {
    throw new Error(`No conversation found for session ${sessionId}`);
  }

  // Build conversation history for the model (excluding 'tool' role)
  const messages = context.messages
    .filter(msg => msg.role !== 'tool')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

  // Add file context if available
  let fileContext = '';
  if (context.files.length > 0) {
    fileContext = '\n\nRelevant files from conversation:\n' +
      context.files.map(f => `**${f.filePath}**:\n${f.fileContent}`).join('\n\n');
  }

  // Add the new prompt
  messages.push({
    role: 'user',
    content: prompt + fileContext
  });

  // Build a single prompt from the conversation history
  const conversationHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
  
  // Use provider manager to get response
  const aiProvider = await providerManager.getProvider(provider);
  const result = await aiProvider.generateText({
    prompt: conversationHistory,
    model: model || aiProvider.getDefaultModel(),
    temperature: 0.7,
    useSearchGrounding: false
  });

  // Save new messages to conversation
  await conversationMemory.addMessage(sessionId, 'user', prompt, 'continuation');
  await conversationMemory.addMessage(
    sessionId,
    'assistant', 
    result.text,
    'continuation',
    undefined,
    { provider, model: result.model, continuedFromSession: true }
  );

  return {
    content: [
      {
        type: 'text',
        text: `## Continued Conversation\n\nSession: ${sessionId}\nContext: ${context.messages.length} messages, ${context.files.length} files\n\n${result.text}`
      }
    ]
  };
}

/**
 * Handle session management tool execution
 */
export async function handleSession(args: any) {
  const { action, sessionId, name, status = 'active' } = args;

  switch (action) {
    case 'create': {
      const session = await conversationMemory.getOrCreateSession(sessionId, name);
      return {
        content: [
          {
            type: 'text',
            text: `## Session Created\n\nID: ${session.id}\nName: ${session.name || 'Unnamed'}\nStatus: ${session.status}\nCreated: ${session.createdAt}`
          }
        ]
      };
    }

    case 'list': {
      const sessionsResult = await conversationMemory.listSessions(status, 20);
      const sessionList = sessionsResult.sessions.map((s: any) => 
        `- **${s.name || s.id}** (${s.id})\n  Messages: ${s.messageCount}, Files: ${s.fileCount}, Tokens: ${s.totalTokens}, Cost: $${s.totalCost.toFixed(4)}\n  Last Activity: ${s.lastActivity.toISOString()}`
      ).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `## Sessions (${status})\n\n${sessionList || 'No sessions found.'}`
          }
        ]
      };
    }

    case 'get': {
      if (!sessionId) throw new Error('Session ID required for get action');
      const context = await conversationMemory.getConversationContext(sessionId, undefined, true);
      
      return {
        content: [
          {
            type: 'text',
            text: `## Session Details\n\nID: ${sessionId}\nMessages: ${context.messages.length}\nFiles: ${context.files.length}\nTotal Tokens: ${context.totalTokens}\nTotal Cost: $${context.totalCost.toFixed(4)}\n\nBudget:\n- Max Tokens: ${context.budget?.maxTokens || 'None'}\n- Max Cost: $${context.budget?.maxCostUsd || 'None'}\n- Used Tokens: ${context.budget?.usedTokens || 0}\n- Used Cost: $${context.budget?.usedCostUsd || 0}`
          }
        ]
      };
    }

    case 'archive':
    case 'delete': {
      if (!sessionId) throw new Error(`Session ID required for ${action} action`);
      await conversationMemory.updateSessionStatus(sessionId, action === 'archive' ? 'archived' : 'deleted');
      
      return {
        content: [
          {
            type: 'text',
            text: `## Session ${action === 'archive' ? 'Archived' : 'Deleted'}\n\nSession ${sessionId} has been ${action === 'archive' ? 'archived' : 'deleted'}.`
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Handle budget management tool execution
 */
export async function handleBudget(args: any) {
  const { action, sessionId, maxTokens, maxCostUsd, maxDurationMs } = args;

  switch (action) {
    case 'set': {
      const budget = await conversationMemory.setBudget(sessionId, maxTokens, maxCostUsd, maxDurationMs);
      return {
        content: [
          {
            type: 'text',
            text: `## Budget Set\n\nSession: ${sessionId}\nMax Tokens: ${maxTokens || 'None'}\nMax Cost: $${maxCostUsd || 'None'}\nMax Duration: ${maxDurationMs || 'None'}ms`
          }
        ]
      };
    }

    case 'get': {
      const context = await conversationMemory.getConversationContext(sessionId);
      const budget = context.budget;
      
      return {
        content: [
          {
            type: 'text',
            text: `## Budget Status\n\nSession: ${sessionId}\n\n**Limits:**\n- Max Tokens: ${budget?.maxTokens || 'None'}\n- Max Cost: $${budget?.maxCostUsd || 'None'}\n- Max Duration: ${budget?.maxDurationMs || 'None'}ms\n\n**Usage:**\n- Used Tokens: ${budget?.usedTokens || 0}\n- Used Cost: $${budget?.usedCostUsd || 0}\n- Used Duration: ${budget?.usedDurationMs || 0}ms`
          }
        ]
      };
    }

    case 'check': {
      const limits = await conversationMemory.checkBudgetLimits(sessionId);
      const status = limits.withinLimits ? '✅ Within Limits' : '⚠️ Limits Exceeded';
      const details = [
        `Token Limit: ${limits.tokenLimitExceeded ? '❌ Exceeded' : '✅ OK'}`,
        `Cost Limit: ${limits.costLimitExceeded ? '❌ Exceeded' : '✅ OK'}`,
        `Duration Limit: ${limits.durationLimitExceeded ? '❌ Exceeded' : '✅ OK'}`
      ].join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `## Budget Check\n\nSession: ${sessionId}\nStatus: ${status}\n\n${details}`
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export const ultraTools = [challengeTool, continuationTool, sessionTool, budgetTool];