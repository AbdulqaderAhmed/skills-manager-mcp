import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { GlobalConfig } from '../globalConfig.js';
import { CacheManager } from '../cacheManager.js';
import {
  registerAntigravityMcp,
  getAntigravityMcpConfigPath,
} from '../services/antigravityRegistry.js';

// Re-export helper for external callers / tests
export { getAntigravityMcpConfigPath, registerAntigravityMcp };

/**
 * Executes the `skills-manager-mcp setup` CLI command.
 */
export async function runSetupCommand(): Promise<void> {
  console.log('Skills Manager MCP Setup\n');

  // 1. Detect OS
  const platform = os.platform();
  let osName = 'Linux/Unix';
  if (platform === 'win32') osName = 'Windows';
  else if (platform === 'darwin') osName = 'macOS';

  console.log(`✓ Operating system detected: ${osName} (${platform})`);

  // 2. Create global AI skills directory (~/.ai-skills and ~/.ai-skills/cache)
  const globalCacheDir = await CacheManager.ensureGlobalCacheDir();
  console.log(`✓ Global directory created: ${path.dirname(globalCacheDir)}`);
  console.log(`✓ Global cache directory verified: ${globalCacheDir}`);

  // 3. Create default skills.config.json if missing (preserve existing file)
  const globalConfigPath = GlobalConfig.getGlobalConfigPath();
  const existsBefore = await fs.stat(globalConfigPath).then((s) => s.isFile()).catch(() => false);
  await GlobalConfig.loadGlobalSkillsConfig();

  if (existsBefore) {
    console.log(`✓ Preserved existing global skills collection: ${globalConfigPath}`);
  } else {
    console.log(`✓ Created default global skills collection: ${globalConfigPath}`);
  }

  // 4. Register in Antigravity Desktop mcp.json
  try {
    const regResult = await registerAntigravityMcp();
    console.log(`✓ Antigravity MCP registered (${regResult.configPath})`);
    console.log(`✓ Server executable path: ${regResult.serverIndexPath}`);
  } catch (err: any) {
    console.error(`✗ Antigravity MCP registration failed: ${err.message}`);
  }

  console.log('\nSetup completed successfully!');
  console.log('Run "skills-manager-mcp status" to inspect your installation.');
}
