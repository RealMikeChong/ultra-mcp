import express, { type Request, type Response } from 'express';
import { createServer } from '../server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

import pinoHttp from 'pino-http';

const yieldGenericServerError = (res: Response) => {
  res.status(500).json({
    id: null,
    jsonrpc: '2.0',
    error: { code: -32603, message: 'Internal server error' },
  });
};

const ULTRA_MCP_LOG = process.env.ULTRA_MCP_LOG === "true" || process.env.ULTRA_MCP_LOG === "1"
const ULTRA_MCP_ENABLE_SSE = process.env.ULTRA_MCP_ENABLE_SSE === "true" || process.env.ULTRA_MCP_ENABLE_SSE === "1"

export const start = (port = 8080, host = '0.0.0.0') => {

  // #region :: init express
  const app = express();
  app.use(express.json());
  // #endregion

  // #region :: HTTP logger, /health
  // Log format is json, for observability services
  if (ULTRA_MCP_LOG) {
    app.use(pinoHttp());
    app.all("/mcp", async (req: Request, res: Response) => {
      req.log.info(req);
      res.status(200).json({ message: "Ultra MCP Server" });
    });
  }

  // Health Check Endpoint
  app.get('/health', (req, res) => {
    const healthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      transport: 'http'
    };
    res.status(200).json(healthStatus);
  });
  // #endregion

  // #region :: MCP
  // In stateless mode, create a new instance of transport and server for each request
  // to ensure complete isolation. A single instance would cause request ID collisions
  // when multiple clients connect concurrently.

  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        // Setting to undefined will opt-out of session-id generation
        sessionIdGenerator: undefined,

        // The Streamable HTTP transport includes DNS rebinding protection to prevent security vulnerabilities. 
        // By default, this protection is disabled for backwards compatibility.
        // Important: If you are running this server locally, enable DNS rebinding protection

        enableDnsRebindingProtection: true,
      });

      await createServer().connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        yieldGenericServerError(res);
      }
    }
  });
  // #endregion

  // #region :: Legacy SSE endpoints for older clients
  // Protocol Revision**: 2025-03-26 - /sse are deprecated
  // Disabled by default, can be enabled via ULTRA_MCP_ENABLE_SSE environment variable
  if (ULTRA_MCP_ENABLE_SSE) {
    // Store transports for each session type
    const transports = {
      streamable: {} as Record<string, StreamableHTTPServerTransport>,
      sse: {} as Record<string, SSEServerTransport>
    };

    const legacyServer = createServer();

    app.get('/sse', async (req, res) => {
      // Add deprecation warning header
      res.setHeader('X-Deprecated', 'SSE transport is deprecated. Use StreamableHTTP at /mcp instead.');
      res.setHeader('X-Migration-Guide', 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse');
      
      // Create SSE transport for legacy clients
      const transport = new SSEServerTransport('/messages', res);
      transports.sse[transport.sessionId] = transport;
      
      res.on("close", () => {
        delete transports.sse[transport.sessionId];
      });
      
      await legacyServer.connect(transport);
    });

    app.post('/messages', async (req, res) => {
      // Add deprecation warning header
      res.setHeader('X-Deprecated', 'SSE transport is deprecated. Use StreamableHTTP at /mcp instead.');
      res.setHeader('X-Migration-Guide', 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse');
      
      const sessionId = req.query.sessionId as string;
      const transport = transports.sse[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    });
  } else {
    // Return 410 Gone for disabled SSE endpoints (disabled by default)
    app.get('/sse', (req, res) => {
      res.status(410).json({
        error: 'SSE transport is disabled by default. Use StreamableHTTP at /mcp instead, or enable with ULTRA_MCP_ENABLE_SSE=true.',
        migrationGuide: 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse'
      });
    });

    app.post('/messages', (req, res) => {
      res.status(410).json({
        error: 'SSE transport is disabled by default. Use StreamableHTTP at /mcp instead, or enable with ULTRA_MCP_ENABLE_SSE=true.',
        migrationGuide: 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse'
      });
    });
  }
  // #endregion

  // #region :: listener
  app.listen(port, host, () => {
    console.error(`Server is running on http://${host}:${port}/mcp`);
  });
  // #endregion

};

export default { start };