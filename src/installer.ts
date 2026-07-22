import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SkillConfig, InstallResult, SkillType } from './types.js';
import { checkSkillExists, ensureSkillsDirectory, isDirectory } from './filesystem.js';
import { CacheManager } from './cacheManager.js';
import { Tracker } from './tracker.js';

const execAsync = promisify(exec);

/**
 * Validates a repository URL to prevent shell injection / illegal protocols.
 */
export function isValidRepositoryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates a skill or bundle name to contain safe identifier characters.
 */
export function isValidSkillName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Recursively scans a directory to discover all skill folders (directories containing SKILL.md).
 * Handles arbitrarily nested categories (e.g. engineering/code-review/SKILL.md).
 * Handles duplicate skill folder names by preserving the first found and logging a warning.
 *
 * @param repoDir Absolute path to repository directory
 * @param logs Output logs array for warnings
 * @returns Map of skill folder name -> absolute path of skill folder
 */
export async function discoverSkillFolders(
  repoDir: string,
  logs: string[] = []
): Promise<Map<string, string>> {
  const discovered = new Map<string, string>();

  const scanDirectory = async (currentDir: string): Promise<void> => {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      // Check if currentDir itself contains SKILL.md
      const hasSkillMd = entries.some(
        (e) => e.isFile() && e.name.toLowerCase() === 'skill.md'
      );

      if (hasSkillMd) {
        const skillFolderName = path.basename(currentDir);
        if (discovered.has(skillFolderName)) {
          logs.push(
            `[Warning] Duplicate skill name '${skillFolderName}' found in '${currentDir}'. Skipping duplicate.`
          );
        } else {
          discovered.set(skillFolderName, currentDir);
        }
        // Stop recursing inside a skill directory so internal subfolders (e.g., agents/) stay intact
        return;
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)
        ) {
          await scanDirectory(path.join(currentDir, entry.name));
        }
      }
    } catch {
      // Ignore directory read errors
    }
  };

  await scanDirectory(repoDir);
  return discovered;
}

/**
 * Programmatically downloads and extracts a single skill folder headlessly.
 */
async function downloadAndExtractSingleSkill(
  repository: string,
  skillName: string,
  skillIdentifier: string,
  logs: string[]
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-skill-dl-'));
  logs.push(`[Download Started] Fetching skill '${skillName}' from '${repository}'...`);

  try {
    const cloneCmd = `git clone --depth 1 --quiet "${repository}" "${tempDir}"`;
    await execAsync(cloneCmd, {
      timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', FORCE_COLOR: '0' },
    });

    logs.push(`[Download Completed] Repository downloaded successfully.`);

    const searchTargets = [
      path.join(tempDir, 'skills', skillIdentifier),
      path.join(tempDir, 'skills', skillName),
      path.join(tempDir, skillIdentifier),
      path.join(tempDir, skillName),
      path.join(tempDir, 'skills'),
    ];

    let foundSkillDir: string | null = null;

    for (const targetPath of searchTargets) {
      if (await isDirectory(targetPath)) {
        const hasSkillMd = await fs
          .stat(path.join(targetPath, 'SKILL.md'))
          .then((s) => s.isFile())
          .catch(() => false);
        if (hasSkillMd) {
          foundSkillDir = targetPath;
          break;
        }
      }
    }

    if (!foundSkillDir) {
      const recursiveFind = async (currentDir: string): Promise<string | null> => {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const fullSubPath = path.join(currentDir, entry.name);
            if (entry.name === skillIdentifier || entry.name === skillName) {
              return fullSubPath;
            }
            const subFound = await recursiveFind(fullSubPath);
            if (subFound) return subFound;
          }
        }
        return null;
      };

      foundSkillDir = await recursiveFind(tempDir);
    }

    if (!foundSkillDir) {
      const rootHasSkillMd = await fs
        .stat(path.join(tempDir, 'SKILL.md'))
        .then((s) => s.isFile())
        .catch(() => false);
      if (rootHasSkillMd) {
        foundSkillDir = tempDir;
      }
    }

    if (!foundSkillDir || !(await isDirectory(foundSkillDir))) {
      throw new Error(
        `Skill '${skillName}' (${skillIdentifier}) could not be located inside repository '${repository}'.`
      );
    }

    const cachedPath = await CacheManager.saveToCache(skillName, foundSkillDir);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return cachedPath;
  } catch (err: any) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Programmatically downloads and extracts a skill bundle repository headlessly.
 * Recursively discovers all nested skill directories containing SKILL.md.
 */
async function downloadAndExtractBundle(
  repository: string,
  bundleName: string,
  logs: string[]
): Promise<{ cachedBundlePath: string; discoveredSkills: string[] }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-bundle-dl-'));
  logs.push(`[Download Started] Fetching skill bundle '${bundleName}' from '${repository}'...`);

  try {
    const cloneCmd = `git clone --depth 1 --quiet "${repository}" "${tempDir}"`;
    await execAsync(cloneCmd, {
      timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', FORCE_COLOR: '0' },
    });

    logs.push(`[Download Completed] Repository bundle downloaded successfully.`);

    const discoveredMap = await discoverSkillFolders(tempDir, logs);
    if (discoveredMap.size === 0) {
      throw new Error(`No skill folders containing SKILL.md found in bundle repository '${repository}'.`);
    }

    const cacheBundleDir = path.join(CacheManager.getGlobalCacheDir(), bundleName);
    await fs.mkdir(cacheBundleDir, { recursive: true });

    const discoveredSkills: string[] = [];

    for (const [skillFolderName, sourcePath] of discoveredMap.entries()) {
      const targetCachePath = path.join(cacheBundleDir, skillFolderName);
      await fs.mkdir(targetCachePath, { recursive: true });
      await fs.cp(sourcePath, targetCachePath, { recursive: true });
      discoveredSkills.push(skillFolderName);
    }

    logs.push(
      `[Bundle Extracted] Discovered ${discoveredSkills.length} skills in bundle: ${discoveredSkills.join(
        ', '
      )}.`
    );

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return { cachedBundlePath: cacheBundleDir, discoveredSkills };
  } catch (err: any) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Headlessly installs a skill entry or bundle entry into a project workspace.
 *
 * @param projectPath Absolute path to target project directory
 * @param skillConfig Skill or Bundle configuration entry
 * @returns Installation result with detailed step-by-step logs
 */
export async function installSkill(
  projectPath: string,
  skillConfig: SkillConfig
): Promise<InstallResult> {
  const name = skillConfig.name;
  const repository = skillConfig.repository;
  const entryType: SkillType = skillConfig.type === 'bundle' ? 'bundle' : 'skill';
  const logs: string[] = [];

  // Security checks
  if (!isValidRepositoryUrl(repository)) {
    const errorMsg = `Invalid repository URL format: '${repository}'. Must be a valid HTTP/HTTPS URL.`;
    logs.push(`[Failure Reason] ${errorMsg}`);
    return {
      skillName: name,
      type: entryType,
      status: 'failed',
      message: logs.join('\n'),
    };
  }

  if (!isValidSkillName(name)) {
    const errorMsg = `Invalid identifier name: '${name}'. Must contain only letters, numbers, hyphens, and underscores.`;
    logs.push(`[Failure Reason] ${errorMsg}`);
    return {
      skillName: name,
      type: entryType,
      status: 'failed',
      message: logs.join('\n'),
    };
  }

  const projectSkillsDir = await ensureSkillsDirectory(projectPath);

  // -------------------------------------------------------------
  // HANDLE SINGLE SKILL
  // -------------------------------------------------------------
  if (entryType === 'skill') {
    const skillIdentifier = (skillConfig as any).skill || name;

    // Check if already in project workspace
    const { exists: alreadyExists } = await checkSkillExists(projectPath, name);
    if (alreadyExists) {
      logs.push(`[Skipped] '${name}' already exists in workspace '.agents/skills/${name}'.`);
      await Tracker.recordSkillInstallation(projectPath, name, repository, 'skill');
      return {
        skillName: name,
        type: 'skill',
        status: 'skipped',
        message: logs.join('\n'),
      };
    }

    // Check global cache
    const isCached = await CacheManager.hasInCache(name);
    if (isCached) {
      const cachePath = await CacheManager.getSkillCachePath(name);
      logs.push(`[Cache Hit] Found skill '${name}' in global cache ('${cachePath}').`);

      try {
        await CacheManager.copyFromCache(name, projectSkillsDir);
        logs.push(
          `[Copy Completed] Copied '${name}' from global cache to workspace '.agents/skills/${name}'.`
        );
        await Tracker.recordSkillInstallation(projectPath, name, repository, 'skill');

        return {
          skillName: name,
          type: 'skill',
          status: 'installed',
          fromCache: true,
          message: logs.join('\n'),
        };
      } catch (err: any) {
        logs.push(
          `[Warning] Copy from cache failed, falling back to download. Error: ${err.message}`
        );
      }
    }

    // Programmatic download
    try {
      await downloadAndExtractSingleSkill(repository, name, skillIdentifier, logs);
      await CacheManager.copyFromCache(name, projectSkillsDir);
      logs.push(`[Copy Completed] Copied '${name}' to workspace '.agents/skills/${name}'.`);

      await Tracker.recordSkillInstallation(projectPath, name, repository, 'skill');

      return {
        skillName: name,
        type: 'skill',
        status: 'installed',
        fromCache: false,
        message: logs.join('\n'),
      };
    } catch (err: any) {
      const failureReason = err.message || String(err);
      logs.push(`[Failure Reason] ${failureReason}`);

      return {
        skillName: name,
        type: 'skill',
        status: 'failed',
        message: logs.join('\n'),
      };
    }
  }

  // -------------------------------------------------------------
  // HANDLE SKILL BUNDLE
  // -------------------------------------------------------------
  else {
    // Check if bundle is in global cache
    const isBundleCached = await CacheManager.hasInCache(name);

    if (isBundleCached) {
      const cacheBundlePath = await CacheManager.getSkillCachePath(name);
      logs.push(`[Cache Hit] Found skill bundle '${name}' in global cache ('${cacheBundlePath}').`);

      try {
        const copiedSkills = await CacheManager.copyFromCache(name, projectSkillsDir);
        logs.push(
          `[Copy Completed] Copied ${copiedSkills.length} bundled skills (${copiedSkills.join(
            ', '
          )}) into workspace '.agents/skills/'.`
        );

        await Tracker.recordSkillInstallation(
          projectPath,
          name,
          repository,
          'bundle',
          copiedSkills
        );

        return {
          skillName: name,
          type: 'bundle',
          status: 'installed',
          fromCache: true,
          discoveredSkills: copiedSkills,
          message: logs.join('\n'),
        };
      } catch (err: any) {
        logs.push(
          `[Warning] Copy bundle from cache failed, falling back to download. Error: ${err.message}`
        );
      }
    }

    // Download & extract bundle programmatically
    try {
      const { discoveredSkills } = await downloadAndExtractBundle(repository, name, logs);
      const copiedSkills = await CacheManager.copyFromCache(name, projectSkillsDir);

      logs.push(
        `[Copy Completed] Copied ${copiedSkills.length} bundled skills into workspace '.agents/skills/'.`
      );

      await Tracker.recordSkillInstallation(
        projectPath,
        name,
        repository,
        'bundle',
        copiedSkills
      );

      return {
        skillName: name,
        type: 'bundle',
        status: 'installed',
        fromCache: false,
        discoveredSkills: copiedSkills,
        message: logs.join('\n'),
      };
    } catch (err: any) {
      const failureReason = err.message || String(err);
      logs.push(`[Failure Reason] ${failureReason}`);

      return {
        skillName: name,
        type: 'bundle',
        status: 'failed',
        message: logs.join('\n'),
      };
    }
  }
}
