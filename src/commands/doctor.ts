import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getAntigravityMcpConfigPath,
  getMcpServerIndexPath,
} from '../services/antigravityRegistry.js';
import { CacheManager } from '../cacheManager.js';
import { GlobalConfig } from '../globalConfig.js';

export interface DoctorCheckResult {
  title: string;
  success: boolean;
  message?: string;
}

/**
 * Performs complete diagnostic health checks on skills-manager-mcp installation and environment.
 */
export async function performDoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  // Check 1: npm installation & dist/index.js existence
  const indexPath = getMcpServerIndexPath();
  const indexExists = await fs
    .stat(indexPath)
    .then((s) => s.isFile())
    .catch(() => false);

  results.push({
    title: 'dist/index.js exists',
    success: indexExists,
    message: indexExists ? indexPath : `Missing at ${indexPath}`,
  });

  // Check 2: Antigravity configuration file existence
  const mcpConfigPath = getAntigravityMcpConfigPath();
  const configExists = await fs
    .stat(mcpConfigPath)
    .then((s) => s.isFile())
    .catch(() => false);

  results.push({
    title: 'Antigravity configuration exists',
    success: configExists,
    message: configExists ? mcpConfigPath : `Missing at ${mcpConfigPath}`,
  });

  // Check 3: MCP registration path validity in mcp.json
  let mcpPathValid = false;
  let mcpPathDetail = 'skills-manager entry not found in mcp.json';

  if (configExists) {
    try {
      const content = await fs.readFile(mcpConfigPath, 'utf-8');
      const parsed = JSON.parse(content);
      const entry = parsed?.mcpServers?.['skills-manager'];

      if (entry && entry.command === 'node' && Array.isArray(entry.args) && entry.args[0]) {
        const configuredPath = entry.args[0];
        const targetExists = await fs
          .stat(configuredPath)
          .then((s) => s.isFile())
          .catch(() => false);

        if (targetExists) {
          mcpPathValid = true;
          mcpPathDetail = `Points to valid file (${configuredPath})`;
        } else {
          mcpPathDetail = `Configured path does not exist on disk: '${configuredPath}'`;
        }
      }
    } catch (err: any) {
      mcpPathDetail = `Error parsing mcp.json: ${err.message}`;
    }
  }

  results.push({
    title: 'MCP path valid',
    success: mcpPathValid,
    message: mcpPathDetail,
  });

  // Check 4: Global cache availability (~/.ai-skills/cache)
  const cacheDir = CacheManager.getGlobalCacheDir();
  const cacheExists = await fs
    .stat(cacheDir)
    .then((s) => s.isDirectory())
    .catch(() => false);

  results.push({
    title: 'Global cache available',
    success: cacheExists,
    message: cacheExists ? cacheDir : `Missing at ${cacheDir}`,
  });

  // Check 5: skills.config.json validity
  const globalConfigPath = GlobalConfig.getGlobalConfigPath();
  let configValid = false;
  let configDetail = '';

  try {
    const configContent = await fs.readFile(globalConfigPath, 'utf-8');
    const parsed = JSON.parse(configContent);
    if (parsed && Array.isArray(parsed.skills)) {
      configValid = true;
      configDetail = `${parsed.skills.length} skills/bundles configured`;
    } else {
      configDetail = 'skills property is missing or not an array';
    }
  } catch (err: any) {
    configDetail = `Missing or invalid JSON at ${globalConfigPath}`;
  }

  results.push({
    title: 'skills.config.json valid',
    success: configValid,
    message: configDetail,
  });

  return results;
}

/**
 * Executes the `skills-manager-mcp doctor` CLI command.
 */
export async function runDoctorCommand(): Promise<void> {
  console.log('Skills Manager Doctor\n');

  const checks = await performDoctorChecks();
  let allHealthy = true;

  for (const check of checks) {
    if (check.success) {
      console.log(`✓ ${check.title}`);
    } else {
      allHealthy = false;
      console.log(`✗ ${check.title} (${check.message})`);
    }
  }

  console.log('');
  if (allHealthy) {
    console.log('Everything is healthy.');
  } else {
    console.log('Issues detected. Run "skills-manager-mcp setup" to repair registration.');
  }
}
