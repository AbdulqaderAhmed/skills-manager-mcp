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
      return await isVsCodeMcpRegistered();
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
    console.log("\nInitialization complete.\n");
  }

  return { newlyInitialized: true, mcpRegistered: regResult.registered };
}
