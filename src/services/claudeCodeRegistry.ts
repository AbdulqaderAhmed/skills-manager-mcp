import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the path to Claude's main MCP configuration file.
 *
 * Claude stores MCP server definitions in multiple locations (in priority order):
 *   - `~/.claude.json` (main configuration, recommended by Claude)
 *   - `~/.claude/mcp_servers.json` (dedicated MCP file)
 *   - `~/.claude/settings.json` (user-specific global settings)
 *
 * We use `~/.claude.json` as the primary location for global MCP registration.
 * This is Claude's recommended location for reliability.
 *
 * Configuration structure for Claude uses `mcpServers` key (not `servers` like VS Code):
 * ```json
 * {
 *   "mcpServers": {
 *     "skills-manager": {
 *       "command": "node",
 *       "args": ["/path/to/dist/index.js"]
 *     }
 *   }
 * }
 * ```
 */
export function getClaudeMcpConfigPath(): string {
  const home = os.homedir();
  return path.join(home, ".claude.json");
}

/**
 * Returns alternative Claude MCP configuration paths (fallback locations).
 */
export function getClaudeMcpConfigPaths(): string[] {
  const home = os.homedir();
  const claudeDir = path.join(home, ".claude");

  return [
    path.join(home, ".claude.json"),
    path.join(claudeDir, "mcp_servers.json"),
    path.join(claudeDir, "settings.json"),
  ];
}

export interface ClaudeCodeRegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into Claude's configuration file.
 * Claude uses `mcpServers` key (not `servers` like VS Code).
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoClaudeFile(
  configPath: string,
  serverIndexPath: string,
): Promise<boolean> {
  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });

  let configData: any = {};

  try {
    const existingContent = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(existingContent);
    if (parsed && typeof parsed === "object") {
      configData = parsed;
    }
  } catch {
    // File doesn't exist yet or contains invalid JSON
  }

  // Claude uses `mcpServers` key for MCP configurations (not `servers`)
  if (!configData.mcpServers || typeof configData.mcpServers !== "object") {
    configData.mcpServers = {};
  }

  let newlyAdded = false;
  const existingEntry = configData.mcpServers["skills-manager"];

  if (
    !existingEntry ||
    existingEntry.command !== "node" ||
    !Array.isArray(existingEntry.args) ||
    existingEntry.args[0] !== serverIndexPath
  ) {
    configData.mcpServers["skills-manager"] = {
      command: "node",
      args: [serverIndexPath],
    };
    newlyAdded = true;
  }

  await fs.writeFile(configPath, JSON.stringify(configData, null, 2), "utf-8");
  return newlyAdded;
}

/**
 * Registers skills-manager-mcp into Claude's global MCP configuration.
 * Uses `~/.claude.json` as the primary location (Claude's recommended file).
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * Configuration is stored in the `mcpServers` key within the main Claude config.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a config file (for testing)
 */
export async function registerClaudeCodeMcp(
  customServerPath?: string,
  customConfigPath?: string,
): Promise<ClaudeCodeRegistrationResult> {
  const targetPath = customConfigPath || getClaudeMcpConfigPath();
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  try {
    const newlyAdded = await registerIntoClaudeFile(targetPath, serverIndexPath);
    return {
      registered: true,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded,
    };
  } catch {
    // If registration fails (e.g., Claude not installed), return a non-critical result
    return {
      registered: false,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded: false,
    };
  }
}

/**
 * Removes the skills-manager MCP server entry from Claude's configuration.
 * Preserves all other user MCP servers.
 *
 * @param customConfigPath Optional custom path to a config file (for testing)
 */
export async function unregisterClaudeCodeMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPath: string }> {
  const targetPath = customConfigPath || getClaudeMcpConfigPath();

  try {
    const existingContent = await fs.readFile(targetPath, "utf-8");
    const parsed = JSON.parse(existingContent);

    if (parsed && parsed.mcpServers && parsed.mcpServers["skills-manager"]) {
      delete parsed.mcpServers["skills-manager"];
      await fs.writeFile(
        targetPath,
        JSON.stringify(parsed, null, 2),
        "utf-8",
      );
    }
  } catch {
    // Ignore if file doesn't exist
  }

  return { unregistered: true, configPath: targetPath };
}

/**
 * Checks whether skills-manager is registered in Claude's MCP configuration.
 */
export async function isClaudeCodeMcpRegistered(
  customConfigPath?: string,
): Promise<boolean> {
  const configPath = customConfigPath || getClaudeMcpConfigPath();

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return !!parsed?.mcpServers?.["skills-manager"];
  } catch {
    // File missing or invalid
    return false;
  }
}
