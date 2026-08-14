import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { GlobalConfig } from "../globalConfig.js";
import { CacheManager } from "../cacheManager.js";
import {
  registerAntigravityMcp,
  getAntigravityMcpConfigPath,
} from "../services/antigravityRegistry.js";
import { registerVsCodeMcp } from "../services/vscodeRegistry.js";
import { registerCursorMcp } from "../services/cursorRegistry.js";
import { registerClaudeCodeMcp } from "../services/claudeCodeRegistry.js";
import { registerCodexMcp } from "../services/codexRegistry.js";

// Re-export helper for external callers / tests
export { getAntigravityMcpConfigPath, registerAntigravityMcp };

/**
 * Executes the `skills-manager-mcp setup` CLI command.
 */
export async function runSetupCommand(): Promise<void> {
  console.log("Skills Manager MCP Setup\n");

  // 1. Detect OS
  const platform = os.platform();
  let osName = "Linux/Unix";
  if (platform === "win32") osName = "Windows";
  else if (platform === "darwin") osName = "macOS";

  console.log(`✓ Operating system detected: ${osName} (${platform})`);

  // 2. Create global AI skills directory (~/.ai-skills and ~/.ai-skills/cache)
  const globalCacheDir = await CacheManager.ensureGlobalCacheDir();
  console.log(`✓ Global directory created: ${path.dirname(globalCacheDir)}`);
  console.log(`✓ Global cache directory verified: ${globalCacheDir}`);

  // 3. Create default skills.config.json if missing (preserve existing file)
  const globalConfigPath = GlobalConfig.getGlobalConfigPath();
  const existsBefore = await fs
    .stat(globalConfigPath)
    .then((s) => s.isFile())
    .catch(() => false);
  await GlobalConfig.loadGlobalSkillsConfig();

  if (existsBefore) {
    console.log(
      `✓ Preserved existing global skills collection: ${globalConfigPath}`,
    );
  } else {
    console.log(
      `✓ Created default global skills collection: ${globalConfigPath}`,
    );
  }

  // 4. Register in Antigravity Desktop mcp.json
  try {
    const regResult = await registerAntigravityMcp();
    console.log(`✓ Antigravity MCP registered (${regResult.configPath})`);
    console.log(`✓ Server executable path: ${regResult.serverIndexPath}`);
  } catch (err: any) {
    console.error(`✗ Antigravity MCP registration failed: ${err.message}`);
  }

  // 5. Register in VS Code user mcp.json
  try {
    const vsCodeRegResult = await registerVsCodeMcp();
    console.log(`✓ VS Code MCP registered (${vsCodeRegResult.configPaths[0]})`);
  } catch (err: any) {
    console.error(`✗ VS Code MCP registration failed: ${err.message}`);
  }

  // 6. Register in Cursor IDE user mcp.json
  try {
    const cursorRegResult = await registerCursorMcp();
    if (cursorRegResult.registered) {
      console.log(
        `✓ Cursor IDE MCP registered (${cursorRegResult.configPath})`,
      );
    }
  } catch (err: any) {
    console.error(`✗ Cursor IDE MCP registration failed: ${err.message}`);
  }

  // 7. Register in Claude Code user mcp.json
  try {
    const claudeCodeRegResult = await registerClaudeCodeMcp();
    if (claudeCodeRegResult.registered) {
      console.log(
        `✓ Claude Code MCP registered (${claudeCodeRegResult.configPath})`,
      );
    }
  } catch (err: any) {
    console.error(`✗ Claude Code MCP registration failed: ${err.message}`);
  }

  // 8. Register in Codex user mcp.json
  try {
    const codexRegResult = await registerCodexMcp();
    if (codexRegResult.registered) {
      console.log(`✓ Codex MCP registered (${codexRegResult.configPath})`);
    }
  } catch (err: any) {
    console.error(`✗ Codex MCP registration failed: ${err.message}`);
  }

  console.log("\nSetup completed successfully!");
  console.log('Run "skills-manager-mcp status" to inspect your installation.');
}
