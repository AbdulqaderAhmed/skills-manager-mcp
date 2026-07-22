#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { ensureInitialized } from './services/initializer.js';

async function main() {
  // Ensure global storage, cache, and MCP registration exist silently
  await ensureInitialized({ silent: true }).catch(() => {});

  const server = createServer();
  const transport = new StdioServerTransport();

  // Process signal handlers
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });

  // Connect server to stdio transport
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error starting skills-manager-mcp server:', err);
  process.exit(1);
});
