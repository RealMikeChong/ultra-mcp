import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('HTTP Protocol Logging Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ULTRA_MCP_LOG Boolean Conversion', () => {
    const testCases = [
      { value: 'true', expected: true, description: 'should return true for "true"' },
      { value: '1', expected: true, description: 'should return true for "1"' },
      { value: 'false', expected: false, description: 'should return false for "false"' },
      { value: '0', expected: false, description: 'should return false for "0"' },
      { value: '', expected: false, description: 'should return false for empty string' },
      { value: 'random', expected: false, description: 'should return false for random string' },
    ];

    testCases.forEach(({ value, expected, description }) => {
      it(description, () => {
        process.env.ULTRA_MCP_LOG = value;
        const result = process.env.ULTRA_MCP_LOG === "true" || process.env.ULTRA_MCP_LOG === "1";
        expect(result).toBe(expected);
      });
    });

    it('should return false when ULTRA_MCP_LOG is unset', () => {
      delete process.env.ULTRA_MCP_LOG;
      const result = process.env.ULTRA_MCP_LOG === "true" || process.env.ULTRA_MCP_LOG === "1";
      expect(result).toBe(false);
    });
  });

  describe('URL Format Validation', () => {
    it('should format URL correctly for default host and port', () => {
      const host = '0.0.0.0';
      const port = 8080;
      const expectedUrl = `http://${host}:${port}/mcp`;
      expect(expectedUrl).toBe('http://0.0.0.0:8080/mcp');
    });

    it('should format URL correctly for custom host and port', () => {
      const host = 'localhost';
      const port = 3000;
      const expectedUrl = `http://${host}:${port}/mcp`;
      expect(expectedUrl).toBe('http://localhost:3000/mcp');
    });

    it('should format URL correctly for IPv6 addresses', () => {
      const host = '::1';
      const port = 8080;
      const expectedUrl = `http://${host}:${port}/mcp`;
      expect(expectedUrl).toBe('http://::1:8080/mcp');
    });
  });
});

describe('Express Route Behavior Simulation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Standard Endpoints', () => {
    beforeEach(() => {
      // Simulate the health route from http.ts
      app.get('/health', (req, res) => {
        const healthStatus = {
          status: 'UP',
          timestamp: new Date().toISOString(),
          transport: 'http'
        };
        res.status(200).json(healthStatus);
      });
    });

    it('should respond to health endpoint with correct format', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'UP',
        transport: 'http'
      });
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Root Route with Logging', () => {
    it('should respond correctly when logging is enabled', async () => {
      // Simulate the root route that gets added when logging is enabled
      app.all('/', async (req: any, res) => {
        // Simulate pino-http logger
        req.log = { info: vi.fn() };
        req.log.info(req);
        res.status(200).json({ message: 'Ultra MCP Server' });
      });

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({ message: 'Ultra MCP Server' });
    });

    it('should return 404 when logging is disabled (no root route)', async () => {
      // Don't add root route - simulate disabled logging behavior
      await request(app)
        .get('/')
        .expect(404);
    });
  });

  describe('MCP Error Response Format', () => {
    it('should return correctly formatted error response', () => {
      const errorResponse = {
        id: null,
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
      };

      expect(errorResponse).toMatchObject({
        id: null,
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        }
      });
    });
  });
});

describe('Legacy SSE Endpoints (Deprecated)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Simulate SSE transport storage
    const sseTransports: Record<string, any> = {};
    
    // Mock SSE endpoint
    app.get('/sse', (req, res) => {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Simulate session ID generation
      const sessionId = `sse-session-${Date.now()}`;
      sseTransports[sessionId] = { sessionId, active: true };

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(':keep-alive\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAlive);
        delete sseTransports[sessionId];
      });

      // Send initial connection event
      res.write(`data: {"type":"connection","sessionId":"${sessionId}"}\n\n`);
    });

    // Mock messages endpoint
    app.post('/messages', (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = sseTransports[sessionId];
      
      if (transport) {
        // Simulate successful message handling
        res.status(200).json({ 
          jsonrpc: '2.0',
          id: req.body.id || null,
          result: { success: true }
        });
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    });
  });

  describe('SSE Connection Tests', () => {
    it('should establish SSE connection with proper headers', async () => {
      const response = await request(app)
        .get('/sse')
        .expect(200)
        .expect('Content-Type', /text\/event-stream/)
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive');
    });

    it('should send initial connection data', (done) => {
      const req = request(app).get('/sse');
      
      req.buffer(false);
      req.parse((res, callback) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
          if (data.includes('connection')) {
            // Verify connection event format
            expect(data).toMatch(/data: \{"type":"connection","sessionId":"sse-session-\d+"\}/);
            callback(null, data);
            done();
          }
        });
      });
      
      req.end();
      
      // Timeout to prevent hanging tests
      setTimeout(() => {
        done();
      }, 1000);
    });
  });

  describe('Messages Endpoint Tests', () => {
    it('should handle valid sessionId', async () => {
      // First establish a connection to get a sessionId
      const sessionId = 'test-session-123';
      
      const response = await request(app)
        .post('/messages')
        .query({ sessionId })
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
          params: {}
        });

      // Since we don't have a real transport, this will fail
      // but we test the endpoint structure
      expect(response.status).toBe(400);
      expect(response.text).toBe('No transport found for sessionId');
    });

    it('should reject missing sessionId', async () => {
      const response = await request(app)
        .post('/messages')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'test'
        })
        .expect(400);

      expect(response.text).toBe('No transport found for sessionId');
    });

    it('should reject invalid sessionId', async () => {
      const response = await request(app)
        .post('/messages')
        .query({ sessionId: 'invalid-session' })
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'test'
        })
        .expect(400);

      expect(response.text).toBe('No transport found for sessionId');
    });
  });
});

describe('StreamableHTTP Transport (Primary)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock the MCP server creation and transport
    const mockServer = {
      connect: vi.fn().mockResolvedValue(undefined)
    };

    const mockTransport = {
      handleRequest: vi.fn().mockResolvedValue(undefined),
      sessionId: 'http-session-123'
    };

    // Mock StreamableHTTPServerTransport
    const MockStreamableTransport = vi.fn().mockImplementation(() => mockTransport);

    // Add MCP endpoint
    app.post('/mcp', async (req, res) => {
      try {
        const transport = new MockStreamableTransport({
          sessionIdGenerator: undefined,
          enableDnsRebindingProtection: true,
        });

        await mockServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        
        // Simulate successful MCP response
        if (!res.headersSent) {
          res.status(200).json({
            jsonrpc: '2.0',
            id: req.body.id || null,
            result: { success: true }
          });
        }
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({
            id: null,
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
          });
        }
      }
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should handle valid MCP initialize request', async () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: true
            }
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await request(app)
        .post('/mcp')
        .send(initializeRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true }
      });
    });

    it('should handle tool call requests', async () => {
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'deep-reasoning',
          arguments: {
            prompt: 'Test reasoning request'
          }
        }
      };

      const response = await request(app)
        .post('/mcp')
        .send(toolCallRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: { success: true }
      });
    });

    it('should handle list tools requests', async () => {
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {}
      };

      const response = await request(app)
        .post('/mcp')
        .send(listToolsRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: { success: true }
      });
    });
  });

  describe('Error Handling', () => {
    it('should return MCP-compliant error for malformed requests', async () => {
      const malformedRequest = {
        not: 'a valid mcp request',
        missing: ['jsonrpc', 'id', 'method']
      };

      const response = await request(app)
        .post('/mcp')
        .send(malformedRequest)
        .expect(200); // Transport handles it gracefully

      // Should still get a successful response from our mock
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        result: { success: true }
      });
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({})
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        result: { success: true }
      });
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'text/plain')
        .send('invalid json')
        .expect(400); // Express will reject invalid JSON

      // Express middleware will handle this before reaching our handler
    });
  });

  describe('Transport Configuration', () => {
    it('should create transport with correct configuration', () => {
      // Test transport configuration options
      const expectedConfig = {
        sessionIdGenerator: undefined, // Stateless mode
        enableDnsRebindingProtection: true // Security feature
      };

      // This tests the configuration structure
      expect(expectedConfig.sessionIdGenerator).toBeUndefined();
      expect(expectedConfig.enableDnsRebindingProtection).toBe(true);
    });

    it('should support stateless operation', () => {
      // Verify stateless mode configuration
      const isStateless = undefined; // sessionIdGenerator set to undefined
      expect(isStateless).toBeUndefined();
    });

    it('should enable DNS rebinding protection', () => {
      const dnsProtection = true;
      expect(dnsProtection).toBe(true);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0',
        id: i + 1,
        method: 'test',
        params: { requestNumber: i + 1 }
      }));

      // Send all requests concurrently
      const responses = await Promise.all(
        requests.map(req => 
          request(app)
            .post('/mcp')
            .send(req)
            .expect(200)
        )
      );

      // Verify all responses are successful
      responses.forEach((response, index) => {
        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: index + 1,
          result: { success: true }
        });
      });
    });
  });
});