import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the path to Claude Desktop's MCP configuration file.
 *
 * Claude Desktop (the GUI application) stores MCP server definitions in
 * `claude_desktop_config.json` within the OS-specific application support folder:
 *   - Windows: %APPDATA%\Claude\claude_desktop_config.json
 *   - macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
 *   - Linux:   ~/.config/Claude/claude_desktop_config.json
 *
 * This is SEPARATE from Claude Code (the terminal CLI), which uses `~/.claude.json`.
 *
 * The file uses a `mcpServers` key at the top level to define MCP servers.
 *
 * @see https://modelcontextprotocol.io/quickstart/user
 */
export function getClaudeDesktopMcpConfigPath(): string {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }

  if (platform === "darwin") {
    return path.join(
      home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }

  // Linux / other Unix
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(configHome, "Claude", "claude_desktop_config.json");
}

export interface ClaudeDesktopRegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into Claude Desktop's configuration file.
 * Claude Desktop uses `mcpServers` key at the top level.
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoClaudeDesktopFile(
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

  // Ensure mcpServers object exists at top level
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
 * Registers skills-manager-mcp into Claude Desktop's MCP configuration file.
 * Uses the OS-specific `claude_desktop_config.json` location.
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a config file (for testing)
 */
export async function registerClaudeDesktopMcp(
  customServerPath?: string,
  customConfigPath?: string,
): Promise<ClaudeDesktopRegistrationResult> {
  const targetPath = customConfigPath || getClaudeDesktopMcpConfigPath();
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  try {
    const newlyAdded = await registerIntoClaudeDesktopFile(
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
    // If registration fails (e.g., Claude Desktop not installed), return a non-critical result
    return {
      registered: false,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded: false,
    };
  }
}

/**
 * Removes the skills-manager MCP server entry from Claude Desktop's configuration.
 * Preserves all other user MCP servers.
 *
 * @param customConfigPath Optional custom path to a config file (for testing)
 */
export async function unregisterClaudeDesktopMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPath: string }> {
  const targetPath = customConfigPath || getClaudeDesktopMcpConfigPath();

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
 * Checks whether skills-manager is registered in Claude Desktop's configuration.
 */
export async function isClaudeDesktopMcpRegistered(
  customConfigPath?: string,
): Promise<boolean> {
  const configPath = customConfigPath || getClaudeDesktopMcpConfigPath();

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return !!parsed?.mcpServers?.["skills-manager"];
  } catch {
    // File missing or invalid
    return false;
  }
}
