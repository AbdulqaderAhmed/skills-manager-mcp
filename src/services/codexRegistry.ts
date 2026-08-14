import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getMcpServerIndexPath } from "./antigravityRegistry.js";

/**
 * Resolves the path to OpenAI Codex CLI's user-level MCP configuration file.
 *
 * Codex CLI stores MCP server definitions in `~/.codex/config.toml`:
 *   - All platforms: ~/.codex/config.toml
 *   - Windows: %USERPROFILE%\.codex\config.toml
 *
 * Codex uses TOML format with `[mcp_servers.<name>]` tables.
 * Project-level configuration lives at `.codex/config.toml` in the project root.
 *
 * @see https://github.com/openai/codex
 */
export function getCodexMcpConfigPath(): string {
  const home = os.homedir();
  return path.join(home, ".codex", "config.toml");
}

export interface CodexRegistrationResult {
  registered: boolean;
  configPath: string;
  serverIndexPath: string;
  newlyAdded: boolean;
}

/**
 * Escapes a string value for TOML by doubling backslashes and escaping quotes.
 */
function tomlEscapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Formats an array of strings as a TOML inline array.
 */
function tomlFormatArray(values: string[]): string {
  const escaped = values.map((v) => `"${tomlEscapeString(v)}"`);
  return `[${escaped.join(", ")}]`;
}

/**
 * Generates the TOML block for the skills-manager MCP server entry.
 */
function generateSkillsManagerToml(serverIndexPath: string): string {
  return [
    `[mcp_servers.skills-manager]`,
    `command = "node"`,
    `args = ${tomlFormatArray([serverIndexPath])}`,
  ].join("\n");
}

/**
 * Checks whether the TOML content already has a skills-manager MCP server entry.
 */
function hasSkillsManagerEntry(tomlContent: string): boolean {
  return /^\[mcp_servers\.skills-manager\]/m.test(tomlContent);
}

/**
 * Extracts the args value from an existing skills-manager TOML block.
 * Returns the first arg string or null if not found.
 */
function extractExistingArgs(tomlContent: string): string | null {
  const match = tomlContent.match(
    /\[mcp_servers\.skills-manager\][^[]*?args\s*=\s*\["([^"]+)"\]/s,
  );
  return match ? match[1].replace(/\\\\/g, "\\") : null;
}

/**
 * Removes the [mcp_servers.skills-manager] section from TOML content.
 * Handles the section header and all key-value pairs until the next section or end of file.
 */
function removeSkillsManagerSection(tomlContent: string): string {
  // Match from [mcp_servers.skills-manager] to the next section header or end of file
  const pattern =
    /\n?\[mcp_servers\.skills-manager\]\n(?:(?!\n\[)[^\n]*\n?)*/g;
  let result = tomlContent.replace(pattern, "");

  // Also handle if it's at the very start of the file
  const startPattern =
    /^\[mcp_servers\.skills-manager\]\n(?:(?!\n\[)[^\n]*\n?)*/;
  result = result.replace(startPattern, "");

  // Clean up excessive blank lines
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

/**
 * Helper to register skills-manager into Codex's config.toml file.
 * Codex uses TOML format with `[mcp_servers.<name>]` sections.
 *
 * @returns True if the entry was newly added or updated, false if already current.
 */
async function registerIntoCodexFile(
  configPath: string,
  serverIndexPath: string,
): Promise<boolean> {
  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });

  let existingContent = "";

  try {
    existingContent = await fs.readFile(configPath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  const serverBlock = generateSkillsManagerToml(serverIndexPath);

  if (hasSkillsManagerEntry(existingContent)) {
    // Check if the existing entry already points to the correct path
    const existingArgs = extractExistingArgs(existingContent);
    if (existingArgs === serverIndexPath) {
      // Already up-to-date, no changes needed
      return false;
    }

    // Remove old entry and add updated one
    const cleaned = removeSkillsManagerSection(existingContent);
    const newContent = cleaned
      ? `${cleaned}\n\n${serverBlock}\n`
      : `${serverBlock}\n`;
    await fs.writeFile(configPath, newContent, "utf-8");
    return true;
  }

  // Append new entry
  const separator = existingContent.trim() ? "\n\n" : "";
  const newContent = `${existingContent.trim()}${separator}${serverBlock}\n`;
  await fs.writeFile(configPath, newContent, "utf-8");
  return true;
}

/**
 * Registers skills-manager-mcp into Codex CLI's user-level config.toml file.
 * Preserves all existing configuration and MCP server entries.
 * Operates idempotently — safe to run multiple times.
 *
 * @param customServerPath Optional custom path to dist/index.js
 * @param customConfigPath Optional custom path to a config file (for testing)
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
 * Removes the skills-manager MCP server entry from Codex's config.toml file.
 * Preserves all other configuration and MCP server entries.
 *
 * @param customConfigPath Optional custom path to a config file (for testing)
 */
export async function unregisterCodexMcp(
  customConfigPath?: string,
): Promise<{ unregistered: boolean; configPath: string }> {
  const targetPath = customConfigPath || getCodexMcpConfigPath();

  try {
    const existingContent = await fs.readFile(targetPath, "utf-8");

    if (hasSkillsManagerEntry(existingContent)) {
      const cleaned = removeSkillsManagerSection(existingContent);
      await fs.writeFile(targetPath, cleaned ? `${cleaned}\n` : "", "utf-8");
    }
  } catch {
    // Ignore if file doesn't exist
  }

  return { unregistered: true, configPath: targetPath };
}

/**
 * Checks whether skills-manager is registered in Codex's config.toml file.
 */
export async function isCodexMcpRegistered(
  customConfigPath?: string,
): Promise<boolean> {
  const configPath = customConfigPath || getCodexMcpConfigPath();

  try {
    const content = await fs.readFile(configPath, "utf-8");
    return hasSkillsManagerEntry(content);
  } catch {
    // File missing or invalid
    return false;
  }
}
