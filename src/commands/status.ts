import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { GlobalConfig } from '../globalConfig.js';
import { CacheManager } from '../cacheManager.js';
import { getAntigravityMcpConfigPath } from './setup.js';
import { detectWorkspace } from '../workspace.js';
import { SkillManager } from '../skillManager.js';

/**
 * Counts total cached skill directories inside ~/.ai-skills/cache/.
 */
async function countCachedSkills(): Promise<number> {
  const cacheDir = CacheManager.getGlobalCacheDir();
  try {
    const entries = await fs.readdir(cacheDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(cacheDir, entry.name);
        const hasSkillMd = await fs
          .stat(path.join(subPath, 'SKILL.md'))
          .then((s) => s.isFile())
          .catch(() => false);

        if (hasSkillMd) {
          count++;
        } else {
          // Bundle directory containing subdirectories
          const subEntries = await fs.readdir(subPath, { withFileTypes: true }).catch(() => []);
          const subCount = subEntries.filter((e) => e.isDirectory()).length;
          count += subCount > 0 ? subCount : 1;
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Checks if skills-manager is registered in Antigravity Desktop mcp.json.
 */
async function isAntigravityMcpRegistered(): Promise<boolean> {
  const configPath = getAntigravityMcpConfigPath();
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return Boolean(parsed?.mcpServers?.['skills-manager']);
  } catch {
    return false;
  }
}

/**
 * Executes the `skills-manager-mcp status` CLI command.
 */
export async function runStatusCommand(providedPath?: string): Promise<void> {
  console.log('Skills Manager MCP Status\n');

  // 1. Global Config Check
  const globalConfigPath = GlobalConfig.getGlobalConfigPath();
  const hasGlobalConfig = await fs
    .stat(globalConfigPath)
    .then((s) => s.isFile())
    .catch(() => false);

  const homedir = os.homedir();
  const relativeGlobalPath = globalConfigPath.replace(homedir, '~');

  if (hasGlobalConfig) {
    console.log(`Global Configuration:\n✓ ${relativeGlobalPath} exists\n`);
  } else {
    console.log(`Global Configuration:\n✗ ${relativeGlobalPath} missing\n`);
  }

  // 2. Cache Stats
  const cacheCount = await countCachedSkills();
  console.log(`Cache:\n✓ ${cacheCount} cached skills\n`);

  // 3. Antigravity MCP Registration
  const isRegistered = await isAntigravityMcpRegistered();
  if (isRegistered) {
    console.log('Antigravity:\n✓ MCP registered\n');
  } else {
    console.log('Antigravity:\n✗ MCP not registered (run "skills-manager-mcp setup")\n');
  }

  // 4. Current Workspace & Installed Skills
  try {
    const wsResult = await detectWorkspace(providedPath);
    console.log(`Current Workspace:\n${wsResult.workspacePath} [Source: ${wsResult.source}]\n`);

    const listReport = await SkillManager.listInstalledSkills(wsResult.workspacePath);
    console.log('Installed Skills:');

    if (listReport.skills.length === 0) {
      console.log('  (none installed in this workspace)');
    } else {
      listReport.skills.forEach((s) => {
        const typeLabel = s.type === 'bundle' ? ' bundle' : '';
        console.log(`✓ ${s.name}${typeLabel}`);
      });
    }
  } catch (err: any) {
    console.log(`Current Workspace:\n✗ ${err.message}\n`);
  }

  console.log('');
}
