import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the path to Claude Code's (terminal CLI) MCP configuration file.
 *
 * Claude Code stores user-level MCP server definitions in `~/.claude.json`
 * with the following structure:
 * ```json
 * {
 *   "preferences": { ... },
 *   "coworkUserFilesPath": "...",
 *   "mcpServers": {
 *     "skills-manager": {
 *       "command": "node",
 *       "args": ["/path/to/dist/index.js"]
 *     }
 *   }
 * }
 * ```
 *
 * The mcpServers key is added at the same level as preferences and coworkUserFilesPath.
 *
 * NOTE: This is for **Claude Code** (the terminal-based CLI agent), NOT for
 * **Claude Desktop** (the GUI application). Claude Desktop uses a separate
 * config file at `%APPDATA%\Claude\claude_desktop_config.json` — see
 * `claudeDesktopRegistry.ts` for that.
 *
 * Project-level MCP servers can also be defined in `.mcp.json` in the project root.
 *
 * @see https://docs.anthropic.com/en/docs/claude-code
 */
export function getClaudeMcpConfigPath(): string {
  const home = os.homedir();
  return path.join(home, ".claude.json");
}

/**
 * Returns Claude Code configuration paths.
 * Only `~/.claude.json` is used for user-level MCP configuration.
 */
export function getClaudeMcpConfigPaths(): string[] {
  const home = os.homedir();
  return [path.join(home, ".claude.json")];
}

export interface ClaudeCodeRegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into Claude Code's configuration file.
 * Claude Code uses `mcpServers` key at the top level, alongside preferences.
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

  // Ensure mcpServers object exists at top level (alongside preferences, coworkUserFilesPath, etc)
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
 * Registers skills-manager-mcp into Claude Code's MCP configuration.
 * Uses `~/.claude.json` as the standard location.
 * Adds mcpServers entry alongside existing preferences and configuration.
 * Operates idempotently - safe to run multiple times.
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
    const newlyAdded = await registerIntoClaudeFile(
      targetPath,
      serverIndexPath,
    );
    return {
      registered: true,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded,
    };
  } catch {
    // If registration fails, return a non-critical result
    return {
      registered: false,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded: false,
    };
  }
}

/**
 * Removes the skills-manager MCP server entry from Claude Code's configuration.
 * Preserves all other user MCP servers and preferences.
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
      await fs.writeFile(targetPath, JSON.stringify(parsed, null, 2), "utf-8");
    }
  } catch {
    // Ignore if file doesn't exist
  }

  return { unregistered: true, configPath: targetPath };
}

/**
 * Checks whether skills-manager is registered in Claude Code's MCP configuration.
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
