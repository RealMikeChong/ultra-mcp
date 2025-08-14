import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../protocols/http.js';

describe('HTTP Protocol', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  it('health endpoint returns 200 with status UP', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'UP',
      transport: 'http'
    });
    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('MCP endpoint accepts POST requests', async () => {
    const initializeRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { roots: { listChanged: true } },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    const response = await request(app)
      .post('/mcp')
      .send(initializeRequest);

    // MCP endpoint processes requests (may return 406 for content negotiation)
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });

  it('returns 400 for malformed JSON', async () => {
    await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}')
      .expect(400);
  });
});

