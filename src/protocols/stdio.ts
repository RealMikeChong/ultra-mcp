import { createServer } from '../server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export const start = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  const server = createServer();
  await server.connect(transport);
  console.error('Stdio server started');
};

export default { start };