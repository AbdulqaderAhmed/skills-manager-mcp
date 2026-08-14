import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the absolute path to the active Node.js executable.
 * On Windows, GUI applications like Claude Desktop do not inherit terminal PATH
 * environment variables, so providing the absolute path to `node.exe` is required.
 */
export function getNodeExecutablePath(): string {
  if (process.execPath && path.isAbsolute(process.execPath)) {
    return process.execPath;
  }
  return "node";
}

/**
 * Resolves all candidate paths to Claude Desktop's MCP configuration file.
 *
 * Claude Desktop (the GUI application) stores MCP server definitions in
 * `claude_desktop_config.json`.
 *
 * On Windows, Claude Desktop can be installed via:
 *   1. Standard installer:
 *      %APPDATA%\Claude\claude_desktop_config.json
 *   2. Windows Store / MSIX Packaged App:
 *      %LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json
 *
 * On macOS:
 *   ~/Library/Application Support/Claude/claude_desktop_config.json
 *
 * On Linux:
 *   ~/.config/Claude/claude_desktop_config.json
 *
 * @see https://modelcontextprotocol.io/quickstart/user
 */
export async function getClaudeDesktopMcpConfigPaths(): Promise<string[]> {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    const paths: string[] = [];
    const appData =
      process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const standardPath = path.join(appData, "Claude", "claude_desktop_config.json");

    // Check Windows Store / MSIX packaged Claude (e.g. Claude_pzs8sxrjxfjjc)
    const localAppData =
      process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const packagesDir = path.join(localAppData, "Packages");

    try {
      const entries = await fs.readdir(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          entry.name.toLowerCase().startsWith("claude_")
        ) {
          const packagedClaudePath = path.join(
            packagesDir,
            entry.name,
            "LocalCache",
            "Roaming",
            "Claude",
            "claude_desktop_config.json",
          );
          paths.push(packagedClaudePath);
        }
      }
    } catch {
      // Ignore if Packages directory is missing or unreadable
    }

    paths.push(standardPath);
    return paths;
  }

  if (platform === "darwin") {
    return [
      path.join(
        home,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json",
      ),
    ];
  }

  // Linux / other Unix
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return [path.join(configHome, "Claude", "claude_desktop_config.json")];
}

/**
 * Returns primary Claude Desktop configuration path for display.
 * Returns the first path where a config or parent directory exists, or standard default.
 */
export async function getClaudeDesktopMcpConfigPath(): Promise<string> {
  const candidatePaths = await getClaudeDesktopMcpConfigPaths();

  for (const candidate of candidatePaths) {
    try {
      const exists = await fs
        .stat(candidate)
        .then((s) => s.isFile())
        .catch(() => false);
      if (exists) return candidate;

      const parentExists = await fs
        .stat(path.dirname(candidate))
        .then((s) => s.isDirectory())
        .catch(() => false);
      if (parentExists) return candidate;
    } catch {
      // Continue to next candidate
    }
  }

  return candidatePaths[0];
}

export interface ClaudeDesktopRegistrationResult {
  registered: boolean;
  configPath: string;
  configPaths: string[];
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Helper to register skills-manager into Claude Desktop's configuration file.
 * Claude Desktop uses `mcpServers` key at the top level, preserving all existing
 * keys (like preferences, coworkUserFilesPath, etc.).
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoClaudeDesktopFile(
  configPath: string,
  serverIndexPath: string,
  customNodeCommand?: string,
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

  const nodeCommand = customNodeCommand || getNodeExecutablePath();
  let newlyAdded = false;
  const existingEntry = configData.mcpServers["skills-manager"];

  if (
    !existingEntry ||
    existingEntry.command !== nodeCommand ||
    !Array.isArray(existingEntry.args) ||
    existingEntry.args[0] !== serverIndexPath
  ) {
    configData.mcpServers["skills-manager"] = {
      command: nodeCommand,
      args: [serverIndexPath],
    };
    newlyAdded = true;
  }

  await fs.writeFile(configPath, JSON.stringify(configData, null, 2), "utf-8");
  return newlyAdded;
}

/**
 * Registers skills-manager-mcp into Claude Desktop's MCP configuration file(s).
 * Automatically detects standard and Windows Store packaged installations.
 * Uses the absolute Node.js executable path on Windows for guaranteed execution.
 * Preserves all existing MCP server configurations and operates idempotently.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a config file (for testing)
 * @param customNodeCommand Optional custom node executable path
 */
export async function registerClaudeDesktopMcp(
  customServerPath?: string,
  customConfigPath?: string,
  customNodeCommand?: string,
): Promise<ClaudeDesktopRegistrationResult> {
  const targetPaths = customConfigPath
    ? [customConfigPath]
    : await getClaudeDesktopMcpConfigPaths();
  const serverIndexPath = customServerPath || getMcpServerIndexPath();

  let newlyAdded = false;
  let registeredAtLeastOne = false;
  const successfulPaths: string[] = [];

  // Register in existing Claude directories first, or all if none exist
  for (const targetPath of targetPaths) {
    try {
      const parentDir = path.dirname(targetPath);
      const parentExists = await fs
        .stat(parentDir)
        .then((s) => s.isDirectory())
        .catch(() => false);
      const fileExists = await fs
        .stat(targetPath)
        .then((s) => s.isFile())
        .catch(() => false);

      // If the directory or file exists, or if this is the only target path
      if (parentExists || fileExists || targetPaths.length === 1) {
        const added = await registerIntoClaudeDesktopFile(
          targetPath,
          serverIndexPath,
          customNodeCommand,
        );
        if (added) newlyAdded = true;
        registeredAtLeastOne = true;
        successfulPaths.push(targetPath);
      }
    } catch {
      // Ignore individual file write failures
    }
  }

  // If no specific existing path was found, register to the default path
  if (!registeredAtLeastOne && targetPaths.length > 0) {
    const defaultPath = targetPaths[targetPaths.length - 1];
    try {
      const added = await registerIntoClaudeDesktopFile(
        defaultPath,
        serverIndexPath,
        customNodeCommand,
      );
      if (added) newlyAdded = true;
      registeredAtLeastOne = true;
      successfulPaths.push(defaultPath);
    } catch {
      // Ignore
    }
  }

  return {
    registered: registeredAtLeastOne,
    configPath: successfulPaths[0] || targetPaths[0],
    configPaths: successfulPaths.length > 0 ? successfulPaths : targetPaths,
    serverIndexPath,
    newlyAdded,
  };
}

/**
 * Removes the skills-manager MCP server entry from Claude Desktop's configuration.
 * Preserves all other user MCP servers and preferences.
 *
 * @param customConfigPath Optional custom path to a config file (for testing)
 */
export async function unregisterClaudeDesktopMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPaths: string[] }> {
  const targetPaths = customConfigPath
    ? [customConfigPath]
    : await getClaudeDesktopMcpConfigPaths();

  for (const targetPath of targetPaths) {
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
  }

  return { unregistered: true, configPaths: targetPaths };
}

/**
 * Checks whether skills-manager is registered in any Claude Desktop configuration.
 */
export async function isClaudeDesktopMcpRegistered(
  customConfigPath?: string,
): Promise<boolean> {
  const targetPaths = customConfigPath
    ? [customConfigPath]
    : await getClaudeDesktopMcpConfigPaths();

  for (const configPath of targetPaths) {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);
      const entry = parsed?.mcpServers?.["skills-manager"];
      if (
        entry &&
        (entry.command === "node" ||
          entry.command.toLowerCase().includes("node"))
      ) {
        return true;
      }
    } catch {
      // File missing or invalid; continue checking
    }
  }

  return false;
}
