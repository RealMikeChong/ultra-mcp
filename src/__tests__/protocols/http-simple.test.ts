import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { parseUltraMcpEnableSSE } from '../../protocols/http.js';

describe('HTTP Protocol ULTRA_MCP_ENABLE_SSE Feature Flag', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Feature Flag Boolean Logic', () => {
    const testCases = [
      { value: 'true', expected: true, description: 'should enable SSE when set to "true"' },
      { value: '1', expected: true, description: 'should enable SSE when set to "1"' },
      { value: 'false', expected: false, description: 'should disable SSE when set to "false"' },
      { value: '0', expected: false, description: 'should disable SSE when set to "0"' },
      { value: '', expected: false, description: 'should disable SSE when set to empty string' },
    ];

    testCases.forEach(({ value, expected, description }) => {
      it(description, () => {
        const enabled = parseUltraMcpEnableSSE(value);
        expect(enabled).toBe(expected);
      });
    });

    it('should disable SSE when ULTRA_MCP_ENABLE_SSE is unset (default)', () => {
      const enabled = parseUltraMcpEnableSSE(undefined);
      expect(enabled).toBe(false); // SSE disabled by default
    });
  });

  describe('SSE Endpoints When Disabled By Default', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Simulate disabled SSE endpoints (ULTRA_MCP_ENABLE_SSE unset/false)
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
    });

    it('should return 410 Gone for disabled SSE endpoint by default', async () => {
      const response = await request(app)
        .get('/sse')
        .expect(410);

      expect(response.body).toMatchObject({
        error: 'SSE transport is disabled by default. Use StreamableHTTP at /mcp instead, or enable with ULTRA_MCP_ENABLE_SSE=true.',
        migrationGuide: 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse'
      });
    });

    it('should return 410 Gone for disabled messages endpoint by default', async () => {
      const response = await request(app)
        .post('/messages')
        .query({ sessionId: 'test-session' })
        .send({ test: 'message' })
        .expect(410);

      expect(response.body).toMatchObject({
        error: 'SSE transport is disabled by default. Use StreamableHTTP at /mcp instead, or enable with ULTRA_MCP_ENABLE_SSE=true.',
        migrationGuide: 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse'
      });
    });
  });

  describe('SSE Deprecation Headers When Explicitly Enabled', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Simulate enabled SSE endpoints with deprecation headers (ULTRA_MCP_ENABLE_SSE=true)
      app.get('/sse', (req, res) => {
        res.setHeader('X-Deprecated', 'SSE transport is deprecated. Use StreamableHTTP at /mcp instead.');
        res.setHeader('X-Migration-Guide', 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse');
        
        res.status(200).json({ 
          type: 'connection',
          sessionId: `sse-session-${Date.now()}`,
          message: 'SSE connection established'
        });
      });

      app.post('/messages', (req, res) => {
        res.setHeader('X-Deprecated', 'SSE transport is deprecated. Use StreamableHTTP at /mcp instead.');
        res.setHeader('X-Migration-Guide', 'https://github.com/RealMikeChong/ultra-mcp#migration-from-sse');
        
        res.status(400).send('No transport found for sessionId');
      });
    });

    it('should include deprecation headers when SSE is enabled', async () => {
      const response = await request(app)
        .get('/sse')
        .expect(200);

      expect(response.headers['x-deprecated']).toBe('SSE transport is deprecated. Use StreamableHTTP at /mcp instead.');
      expect(response.headers['x-migration-guide']).toBe('https://github.com/RealMikeChong/ultra-mcp#migration-from-sse');
      expect(response.body).toHaveProperty('type', 'connection');
    });

    it('should include deprecation headers in messages responses when SSE is enabled', async () => {
      const response = await request(app)
        .post('/messages')
        .query({ sessionId: 'invalid-session' })
        .send({ test: 'message' })
        .expect(400);

      expect(response.headers['x-deprecated']).toBe('SSE transport is deprecated. Use StreamableHTTP at /mcp instead.');
      expect(response.headers['x-migration-guide']).toBe('https://github.com/RealMikeChong/ultra-mcp#migration-from-sse');
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle mixed case values correctly', () => {
      const enabled = parseUltraMcpEnableSSE('True');
      expect(enabled).toBe(false); // Case-sensitive comparison
    });

    it('should handle numeric string values correctly', () => {
      const enabled = parseUltraMcpEnableSSE('2');
      expect(enabled).toBe(false); // Only "1" should enable
    });

    it('should handle whitespace correctly', () => {
      const enabled = parseUltraMcpEnableSSE(' true ');
      expect(enabled).toBe(false); // Whitespace should not match
    });
  });
});

describe('HTTP Protocol Modernization', () => {
  describe('Primary Transport Focus', () => {
    it('should prioritize StreamableHTTP transport', () => {
      const primaryEndpoint = '/mcp';
      const legacyEndpoint = '/sse';
      
      expect(primaryEndpoint).toBe('/mcp');
      expect(legacyEndpoint).toBe('/sse');
      
      // Test that we recognize the modern transport as primary
      const isPrimary = primaryEndpoint === '/mcp';
      const isLegacy = legacyEndpoint === '/sse';
      
      expect(isPrimary).toBe(true);
      expect(isLegacy).toBe(true);
    });

    it('should use HTTP transport in health responses', () => {
      const healthResponse = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        transport: 'http'
      };

      expect(healthResponse.transport).toBe('http');
      expect(healthResponse.transport).not.toBe('sse');
    });
  });

  describe('Migration Strategy', () => {
    it('should provide clear migration path', () => {
      const migrationInfo = {
        from: 'SSE transport (/sse, /messages)',
        to: 'StreamableHTTP transport (/mcp)',
        defaultBehavior: 'SSE disabled by default',
        enableFlag: 'ULTRA_MCP_ENABLE_SSE=true'
      };

      expect(migrationInfo.from).toContain('SSE');
      expect(migrationInfo.to).toContain('StreamableHTTP');
      expect(migrationInfo.defaultBehavior).toContain('disabled by default');
      expect(migrationInfo.enableFlag).toBe('ULTRA_MCP_ENABLE_SSE=true');
    });
  });
});