import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the path to Claude Code's user-level MCP configuration file.
 *
 * Claude Code stores MCP server definitions in the user profile `mcp.json`:
 *   - Windows: %APPDATA%\Claude Code\User\mcp.json
 *   - macOS:   ~/Library/Application Support/Claude Code/User/mcp.json
 *   - Linux:   ~/.config/Claude Code/User/mcp.json
 *
 * Claude Code uses the same configuration structure as VS Code.
 */
export function getClaudeCodeMcpConfigPath(): string {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Claude Code", "User", "mcp.json");
  }

  if (platform === "darwin") {
    return path.join(
      home,
      "Library",
      "Application Support",
      "Claude Code",
      "User",
      "mcp.json",
    );
  }

  // Linux / other Unix
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(configHome, "Claude Code", "User", "mcp.json");
}

export interface ClaudeCodeRegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into Claude Code's mcp.json file.
 * Claude Code uses the `servers` top-level key (same as VS Code).
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoClaudeCodeFile(
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

  if (!configData.servers || typeof configData.servers !== "object") {
    configData.servers = {};
  }

  let newlyAdded = false;
  const existingEntry = configData.servers["skills-manager"];

  if (
    !existingEntry ||
    existingEntry.type !== "stdio" ||
    existingEntry.command !== "node" ||
    !Array.isArray(existingEntry.args) ||
    existingEntry.args[0] !== serverIndexPath
  ) {
    configData.servers["skills-manager"] = {
      type: "stdio",
      command: "node",
      args: [serverIndexPath],
    };
    newlyAdded = true;
  }

  await fs.writeFile(configPath, JSON.stringify(configData, null, 2), "utf-8");
  return newlyAdded;
}

/**
 * Registers skills-manager-mcp into Claude Code's user-level mcp.json file.
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a single mcp.json file (for testing)
 */
export async function registerClaudeCodeMcp(
  customServerPath?: string,
  customConfigPath?: string,
): Promise<ClaudeCodeRegistrationResult> {
  const targetPath = customConfigPath || getClaudeCodeMcpConfigPath();
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  try {
    const newlyAdded = await registerIntoClaudeCodeFile(
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
    // If registration fails (e.g., Claude Code not installed), return a non-critical result
    return {
      registered: false,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded: false,
    };
  }
}

/**
 * Removes the skills-manager MCP server entry from Claude Code's mcp.json file.
 * Preserves all other user MCP servers.
 *
 * @param customConfigPath Optional custom path to a single mcp.json file (for testing)
 */
export async function unregisterClaudeCodeMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPath: string }> {
  const targetPath = customConfigPath || getClaudeCodeMcpConfigPath();

  try {
    const existingContent = await fs.readFile(targetPath, "utf-8");
    const parsed = JSON.parse(existingContent);

    if (parsed && parsed.servers && parsed.servers["skills-manager"]) {
      delete parsed.servers["skills-manager"];
      await fs.writeFile(targetPath, JSON.stringify(parsed, null, 2), "utf-8");
    }
  } catch {
    // Ignore if file doesn't exist
  }

  return { unregistered: true, configPath: targetPath };
}

/**
 * Checks whether skills-manager is registered in Claude Code's mcp.json file.
 */
export async function isClaudeCodeMcpRegistered(
  customConfigPath?: string,
): Promise<boolean> {
  const configPath = customConfigPath || getClaudeCodeMcpConfigPath();

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return !!parsed?.servers?.["skills-manager"];
  } catch {
    // File missing or invalid
    return false;
  }
}
