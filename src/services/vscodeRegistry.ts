import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves candidate paths to VS Code user-level MCP configuration files.
 *
 * VS Code stores MCP server definitions in the user profile `mcp.json`:
 *   - Windows: %APPDATA%\<Editor>\User\mcp.json
 *   - macOS:   ~/Library/Application Support/<Editor>/User/mcp.json
 *   - Linux:   ~/.config/<Editor>/User/mcp.json
 *
 * All editor variants (stable, Insiders, VSCodium) are registered so the
 * skills-manager MCP server works regardless of which flavor is installed.
 */
export function getVsCodeMcpConfigPaths(): string[] {
  const home = os.homedir();
  const platform = os.platform();

  const editorDirs = ["Code", "Code - Insiders", "VSCodium"];

  if (platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return editorDirs.map((dir) => path.join(appData, dir, "User", "mcp.json"));
  }

  if (platform === "darwin") {
    return editorDirs.map((dir) =>
      path.join(
        home,
        "Library",
        "Application Support",
        dir,
        "User",
        "mcp.json",
      ),
    );
  }

  // Linux / other Unix
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return editorDirs.map((dir) =>
    path.join(configHome, dir, "User", "mcp.json"),
  );
}

/**
 * Returns the primary VS Code MCP config path (stable Code) for display purposes.
 */
export function getVsCodeMcpConfigPath(): string {
  return getVsCodeMcpConfigPaths()[0];
}

export interface VsCodeRegistrationResult {
  registered: boolean;
  configPaths: string[];
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into a single VS Code mcp.json file.
 * VS Code uses the `servers` top-level key (not `mcpServers`).
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoVsCodeFile(
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
 * Registers skills-manager-mcp into VS Code's user-level mcp.json files.
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a single mcp.json file (for testing)
 */
export async function registerVsCodeMcp(
  customServerPath?: string,
  customConfigPath?: string,
): Promise<VsCodeRegistrationResult> {
  const targetPaths = customConfigPath
    ? [customConfigPath]
    : getVsCodeMcpConfigPaths();
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  let newlyAdded = false;

  for (const targetPath of targetPaths) {
    try {
      const added = await registerIntoVsCodeFile(targetPath, serverIndexPath);
      if (added) newlyAdded = true;
    } catch {
      // Ignore individual file write errors (e.g. permission issues)
    }
  }

  return {
    registered: true,
    configPaths: targetPaths,
    serverIndexPath,
    newlyAdded,
  };
}

/**
 * Removes the skills-manager MCP server entry from VS Code's mcp.json files.
 * Preserves all other user MCP servers.
 *
 * @param customConfigPath Optional custom path to a single mcp.json file (for testing)
 */
export async function unregisterVsCodeMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPaths: string[] }> {
  const targetPaths = customConfigPath
    ? [customConfigPath]
    : getVsCodeMcpConfigPaths();

  for (const targetPath of targetPaths) {
    try {
      const existingContent = await fs.readFile(targetPath, "utf-8");
      const parsed = JSON.parse(existingContent);

      if (parsed && parsed.servers && parsed.servers["skills-manager"]) {
        delete parsed.servers["skills-manager"];
        await fs.writeFile(
          targetPath,
          JSON.stringify(parsed, null, 2),
          "utf-8",
        );
      }
    } catch {
      // Ignore if file doesn't exist
    }
  }

  return { unregistered: true, configPaths: targetPaths };
}

/**
 * Checks whether skills-manager is registered in any VS Code mcp.json file.
 */
export async function isVsCodeMcpRegistered(): Promise<boolean> {
  for (const configPath of getVsCodeMcpConfigPaths()) {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed?.servers?.["skills-manager"]) {
        return true;
      }
    } catch {
      // File missing or invalid; continue checking other editor variants
    }
  }
  return false;
}
