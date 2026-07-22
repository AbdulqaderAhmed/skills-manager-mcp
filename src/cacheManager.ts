import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Global skill & bundle cache manager (`C:\Users\<username>\.ai-skills\cache`).
 */
export class CacheManager {
  /**
   * Returns the primary cache directory (`~/.ai-skills/cache`).
   */
  public static getGlobalCacheDir(): string {
    return path.join(os.homedir(), '.ai-skills', 'cache');
  }

  /**
   * Returns the legacy cache directory (`~/.ai-skills`) for backward compatibility.
   */
  public static getLegacyCacheDir(): string {
    return path.join(os.homedir(), '.ai-skills');
  }

  /**
   * Ensures the global cache directory exists on disk.
   */
  public static async ensureGlobalCacheDir(): Promise<string> {
    const cacheDir = CacheManager.getGlobalCacheDir();
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  }

  /**
   * Returns the absolute path for a specific cached skill or bundle.
   * Checks primary `cache/<name>` first, then legacy `~/.ai-skills/<name>`.
   */
  public static async getSkillCachePath(name: string): Promise<string> {
    const primaryPath = path.join(CacheManager.getGlobalCacheDir(), name);
    try {
      const stats = await fs.stat(primaryPath);
      if (stats.isDirectory()) return primaryPath;
    } catch {
      // Not in primary cache
    }

    const legacyPath = path.join(CacheManager.getLegacyCacheDir(), name);
    try {
      const stats = await fs.stat(legacyPath);
      if (stats.isDirectory()) return legacyPath;
    } catch {
      // Not in legacy cache
    }

    return primaryPath;
  }

  /**
   * Checks if a skill or bundle is available in the global cache.
   */
  public static async hasInCache(name: string): Promise<boolean> {
    const primaryPath = path.join(CacheManager.getGlobalCacheDir(), name);
    try {
      const stats = await fs.stat(primaryPath);
      if (stats.isDirectory()) return true;
    } catch {
      // Check legacy path
    }

    const legacyPath = path.join(CacheManager.getLegacyCacheDir(), name);
    try {
      const stats = await fs.stat(legacyPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Copies a cached skill or bundle into a project's `.agents/skills` directory.
   * Recursively discovers all skill directories containing SKILL.md and copies them into `.agents/skills/<skillName>`.
   *
   * @param name Skill or bundle name
   * @param projectSkillsDir Destination `.agents/skills` directory
   * @returns Array of skill folder names copied into the workspace
   */
  public static async copyFromCache(name: string, projectSkillsDir: string): Promise<string[]> {
    const sourcePath = await CacheManager.getSkillCachePath(name);
    await fs.mkdir(projectSkillsDir, { recursive: true });

    // Check if sourcePath is a single skill (contains SKILL.md directly at root)
    const hasSkillMdAtRoot = await fs
      .stat(path.join(sourcePath, 'SKILL.md'))
      .then((s) => s.isFile())
      .catch(() => false);

    if (hasSkillMdAtRoot) {
      const destPath = path.join(projectSkillsDir, name);
      await fs.mkdir(destPath, { recursive: true });
      await fs.cp(sourcePath, destPath, { recursive: true });
      return [name];
    }

    // Discover all skill folders inside sourcePath recursively
    const discoveredMap = new Map<string, string>();

    const scanCacheDir = async (currentDir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        const containsSkillMd = entries.some(
          (e) => e.isFile() && e.name.toLowerCase() === 'skill.md'
        );

        if (containsSkillMd) {
          const folderName = path.basename(currentDir);
          if (!discoveredMap.has(folderName)) {
            discoveredMap.set(folderName, currentDir);
          }
          return;
        }

        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            !['node_modules', 'dist', 'build', '.git'].includes(entry.name)
          ) {
            await scanCacheDir(path.join(currentDir, entry.name));
          }
        }
      } catch {
        // Ignore read errors
      }
    };

    await scanCacheDir(sourcePath);

    const copiedSkills: string[] = [];

    for (const [skillName, srcSkillPath] of discoveredMap.entries()) {
      const destSub = path.join(projectSkillsDir, skillName);
      await fs.mkdir(destSub, { recursive: true });
      await fs.cp(srcSkillPath, destSub, { recursive: true });
      copiedSkills.push(skillName);
    }

    if (copiedSkills.length === 0) {
      // Fallback: copy as single folder if no subdirectories found
      const destPath = path.join(projectSkillsDir, name);
      await fs.mkdir(destPath, { recursive: true });
      await fs.cp(sourcePath, destPath, { recursive: true });
      return [name];
    }

    return copiedSkills;
  }

  /**
   * Saves a newly downloaded skill or bundle into global cache (`~/.ai-skills/cache/<name>`).
   *
   * @param name Skill or bundle name identifier
   * @param sourcePath Path to downloaded skill/bundle directory
   */
  public static async saveToCache(name: string, sourcePath: string): Promise<string> {
    await CacheManager.ensureGlobalCacheDir();
    const destPath = path.join(CacheManager.getGlobalCacheDir(), name);

    await fs.mkdir(destPath, { recursive: true });
    await fs.cp(sourcePath, destPath, { recursive: true });

    return destPath;
  }
}
