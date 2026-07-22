import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Resolves path to Antigravity Desktop MCP configuration file (mcp.json).
 *
 * Windows: %USERPROFILE%\.gemini\antigravity-ide\mcp.json
 * Linux/macOS: $HOME/.gemini/antigravity-ide/mcp.json
 */
export function getAntigravityMcpConfigPath(): string {
  const home = os.homedir();
  return path.join(home, '.gemini', 'antigravity-ide', 'mcp.json');
}

/**
 * Dynamically resolves the absolute filesystem path to the compiled dist/index.js file.
 * Handles execution from both src/services and dist/services.
 */
export function getMcpServerIndexPath(): string {
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);
  const normalizedModuleDir =
    process.platform === 'win32' && moduleDir.startsWith('/')
      ? moduleDir.slice(1)
      : moduleDir;
  // Resolve root package directory from src/services or dist/services
  const projectRootDir = path.resolve(normalizedModuleDir, '..', '..');
  return path.join(projectRootDir, 'dist', 'index.js');
}

export interface RegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Automatically registers skills-manager-mcp into Antigravity Desktop's mcp.json.
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to mcp.json file (for testing)
 */
export async function registerAntigravityMcp(
  customServerPath?: string,
  customConfigPath?: string
): Promise<RegistrationResult> {
  const configPath = customConfigPath || getAntigravityMcpConfigPath();
  const configDir = path.dirname(configPath);
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  await fs.mkdir(configDir, { recursive: true });

  let configData: any = { mcpServers: {} };

  try {
    const existingContent = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(existingContent);
    if (parsed && typeof parsed === 'object') {
      configData = parsed;
      if (!configData.mcpServers || typeof configData.mcpServers !== 'object') {
        configData.mcpServers = {};
      }
    }
  } catch {
    // File doesn't exist yet or contains invalid JSON
  }

  let newlyAdded = false;
  const existingEntry = configData.mcpServers['skills-manager'];

  if (
    !existingEntry ||
    existingEntry.command !== 'node' ||
    !Array.isArray(existingEntry.args) ||
    existingEntry.args[0] !== serverIndexPath
  ) {
    configData.mcpServers['skills-manager'] = {
      command: 'node',
      args: [serverIndexPath],
    };
    newlyAdded = true;
  }

  await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8');

  return {
    registered: true,
    configPath,
    serverIndexPath,
    newlyAdded,
  };
}

/**
 * Safely removes the skills-manager MCP server entry from Antigravity Desktop's mcp.json.
 * Preserves all other user MCP servers and does not delete user skill caches (~/.ai-skills).
 *
 * @param customConfigPath Optional custom path to mcp.json file (for testing)
 */
export async function unregisterAntigravityMcp(
  customConfigPath?: string
): Promise<{ unregistered: boolean; configPath: string }> {
  const configPath = customConfigPath || getAntigravityMcpConfigPath();

  try {
    const existingContent = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(existingContent);

    if (parsed && parsed.mcpServers && parsed.mcpServers['skills-manager']) {
      delete parsed.mcpServers['skills-manager'];
      await fs.writeFile(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
    }
  } catch {
    // Ignore if file doesn't exist
  }

  return { unregistered: true, configPath };
}
