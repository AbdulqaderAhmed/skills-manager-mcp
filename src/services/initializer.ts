import fs from "node:fs/promises";
import path from "node:path";
import { GlobalConfig } from "../globalConfig.js";
import { CacheManager } from "../cacheManager.js";
import {
  getAntigravityMcpConfigPath,
  getMcpServerIndexPath,
  registerAntigravityMcp,
} from "./antigravityRegistry.js";
import { isVsCodeMcpRegistered, registerVsCodeMcp } from "./vscodeRegistry.js";
import { isCursorMcpRegistered, registerCursorMcp } from "./cursorRegistry.js";
import {
  isClaudeCodeMcpRegistered,
  registerClaudeCodeMcp,
} from "./claudeCodeRegistry.js";
import { isCodexMcpRegistered, registerCodexMcp } from "./codexRegistry.js";
import {
  registerClaudeDesktopMcp,
} from "./claudeDesktopRegistry.js";

export interface InitializeOptions {
  silent?: boolean;
  customConfigPath?: string;
  customServerPath?: string;
}

export interface InitializeResult {
  newlyInitialized: boolean;
  mcpRegistered: boolean;
}

/**
 * Checks whether global skills storage, cache, and Antigravity MCP registration have been completed.
 */
export async function isInitialized(
  customConfigPath?: string,
): Promise<boolean> {
  try {
    // 1. Check global skills config (~/.ai-skills/skills.config.json)
    const globalConfigPath = GlobalConfig.getGlobalConfigPath();
    const configExists = await fs
      .stat(globalConfigPath)
      .then((s) => s.isFile())
      .catch(() => false);

    if (!configExists) return false;

    // 2. Check global cache (~/.ai-skills/cache)
    const cacheDir = CacheManager.getGlobalCacheDir();
    const cacheExists = await fs
      .stat(cacheDir)
      .then((s) => s.isDirectory())
      .catch(() => false);

    if (!cacheExists) return false;

    // 3. Check Antigravity MCP registration (mcp.json)
    const mcpConfigPath = customConfigPath || getAntigravityMcpConfigPath();
    const mcpContent = await fs.readFile(mcpConfigPath, "utf-8");
    const parsed = JSON.parse(mcpContent);
    const entry = parsed?.mcpServers?.["skills-manager"];

    if (
      !entry ||
      entry.command !== "node" ||
      !Array.isArray(entry.args) ||
      !entry.args[0]
    ) {
      return false;
    }

    const serverIndexPath = entry.args[0];
    const serverFileExists = await fs
      .stat(serverIndexPath)
      .then((s) => s.isFile())
      .catch(() => false);

    if (!serverFileExists) return false;

    // 4. Check VS Code MCP registration (only when not using a custom test config)
    if (!customConfigPath) {
      const vsCodeRegistered = await isVsCodeMcpRegistered();
      if (!vsCodeRegistered) return false;

      // 5. Check Cursor MCP registration (optional, as Cursor may not be installed)
      // We don't require Cursor for initialization, but it's nice-to-have
      // This prevents the initialization check from failing if Cursor isn't installed
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Idempotently ensures global storage, cache, and Antigravity MCP registration exist.
 * Executes first-time setup automatically if missing.
 */
export async function ensureInitialized(
  options: InitializeOptions = {},
): Promise<InitializeResult> {
  const alreadyInitialized = await isInitialized(options.customConfigPath);

  if (alreadyInitialized) {
    return { newlyInitialized: false, mcpRegistered: true };
  }

  if (!options.silent) {
    console.log("Skills Manager MCP first-time setup detected...\n");
  }

  // 1. Ensure global storage & cache
  const cacheDir = await CacheManager.ensureGlobalCacheDir();
  const globalDir = path.dirname(cacheDir);

  if (!options.silent) {
    console.log(`✓ Global storage initialized: ${globalDir}`);
    console.log(`✓ Skills cache ready: ${cacheDir}`);
  }

  // 2. Ensure default skills.config.json (preserve existing)
  await GlobalConfig.loadGlobalSkillsConfig();

  // 3. Automatically register MCP server in mcp.json
  const regResult = await registerAntigravityMcp(
    options.customServerPath,
    options.customConfigPath,
  );

  if (!options.silent) {
    console.log(`✓ Antigravity MCP registered: ${regResult.configPath}`);
    console.log(`✓ Server executable path: ${regResult.serverIndexPath}`);
  }

  // 4. Automatically register MCP server in VS Code user mcp.json
  const vsCodeRegResult = await registerVsCodeMcp(
    options.customServerPath,
    options.customConfigPath,
  );

  if (!options.silent) {
    console.log(`✓ VS Code MCP registered: ${vsCodeRegResult.configPaths[0]}`);
  }

  // 5. Automatically register MCP server in Cursor user mcp.json
  const cursorRegResult = await registerCursorMcp(
    options.customServerPath,
    options.customConfigPath,
  );

  if (!options.silent) {
    if (cursorRegResult.registered) {
      console.log(`✓ Cursor IDE MCP registered: ${cursorRegResult.configPath}`);
    }
  }

  // 6. Automatically register MCP server in Claude Desktop (claude_desktop_config.json)
  const claudeDesktopRegResult = await registerClaudeDesktopMcp(
    options.customServerPath,
    options.customConfigPath,
  );

  if (!options.silent) {
    if (claudeDesktopRegResult.registered) {
      console.log(
        `✓ Claude Desktop MCP registered: ${claudeDesktopRegResult.configPath}`,
      );
    }
  }

  // 7. Automatically register MCP server in Claude Code user (~/.claude.json)
  const claudeCodeRegResult = await registerClaudeCodeMcp(
    options.customServerPath,
    options.customConfigPath,
  );

  if (!options.silent) {
    if (claudeCodeRegResult.registered) {
      console.log(
        `✓ Claude Code MCP registered: ${claudeCodeRegResult.configPath}`,
      );
    }
  }

  // 8. Automatically register MCP server in Codex CLI (~/.codex/config.toml)
  const codexRegResult = await registerCodexMcp(
    options.customServerPath,
    options.customConfigPath,
  );

  if (!options.silent) {
    if (codexRegResult.registered) {
      console.log(`✓ Codex MCP registered: ${codexRegResult.configPath}`);
    }
    console.log("\nInitialization complete.\n");
  }

  return { newlyInitialized: true, mcpRegistered: regResult.registered };
}
