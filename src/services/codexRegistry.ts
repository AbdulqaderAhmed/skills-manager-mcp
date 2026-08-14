import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the path to Codex's user-level MCP configuration file.
 *
 * Codex stores MCP server definitions in the user profile `mcp.json`:
 *   - Windows: %APPDATA%\Codex\User\mcp.json
 *   - macOS:   ~/Library/Application Support/Codex/User/mcp.json
 *   - Linux:   ~/.config/Codex/User/mcp.json
 *
 * Codex uses the same configuration structure as VS Code.
 */
export function getCodexMcpConfigPath(): string {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Codex", "User", "mcp.json");
  }

  if (platform === "darwin") {
    return path.join(
      home,
      "Library",
      "Application Support",
      "Codex",
      "User",
      "mcp.json",
    );
  }

  // Linux / other Unix
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(configHome, "Codex", "User", "mcp.json");
}

export interface CodexRegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into Codex's mcp.json file.
 * Codex uses the `servers` top-level key (same as VS Code).
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoCodexFile(
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
 * Registers skills-manager-mcp into Codex's user-level mcp.json file.
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a single mcp.json file (for testing)
 */
export async function registerCodexMcp(
  customServerPath?: string,
  customConfigPath?: string,
): Promise<CodexRegistrationResult> {
  const targetPath = customConfigPath || getCodexMcpConfigPath();
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  try {
    const newlyAdded = await registerIntoCodexFile(targetPath, serverIndexPath);
    return {
      registered: true,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded,
    };
  } catch {
    // If registration fails (e.g., Codex not installed), return a non-critical result
    return {
      registered: false,
      configPath: targetPath,
      serverIndexPath,
      newlyAdded: false,
    };
  }
}

/**
 * Removes the skills-manager MCP server entry from Codex's mcp.json file.
 * Preserves all other user MCP servers.
 *
 * @param customConfigPath Optional custom path to a single mcp.json file (for testing)
 */
export async function unregisterCodexMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPath: string }> {
  const targetPath = customConfigPath || getCodexMcpConfigPath();

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
 * Checks whether skills-manager is registered in Codex's mcp.json file.
 */
export async function isCodexMcpRegistered(
  customConfigPath?: string,
): Promise<boolean> {
  const configPath = customConfigPath || getCodexMcpConfigPath();

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return !!parsed?.servers?.["skills-manager"];
  } catch {
    // File missing or invalid
    return false;
  }
}
