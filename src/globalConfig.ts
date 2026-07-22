import fs from 'node:fs/promises';
import path from 'node:path';
import { CacheManager } from './cacheManager.js';
import { SkillsConfigFile, SkillConfig } from './types.js';
import { loadSkillsConfig } from './config.js';

/**
 * Default global personal skills collection configuration.
 */
const DEFAULT_GLOBAL_SKILLS: SkillsConfigFile = {
  skills: [
    {
      type: 'skill',
      name: 'find-skills',
      repository: 'https://github.com/vercel-labs/skills',
      skill: 'find-skills',
    },
    {
      type: 'skill',
      name: 'frontend-design',
      repository: 'https://github.com/anthropics/skills',
      skill: 'frontend-design',
    },
    {
      type: 'bundle',
      name: 'mattpocock-skills',
      repository: 'https://github.com/mattpocock/skills',
    },
  ],
};

/**
 * Personal Skill Collection & Configuration Merger service.
 */
export class GlobalConfig {
  /**
   * Returns path to personal global skills configuration file (`~/.ai-skills/skills.config.json`).
   */
  public static getGlobalConfigPath(): string {
    return path.join(CacheManager.getLegacyCacheDir(), 'skills.config.json');
  }

  /**
   * Loads or automatically creates personal global skills configuration file (`~/.ai-skills/skills.config.json`).
   */
  public static async loadGlobalSkillsConfig(): Promise<SkillsConfigFile> {
    const globalPath = GlobalConfig.getGlobalConfigPath();
    const globalDir = path.dirname(globalPath);

    try {
      await fs.mkdir(globalDir, { recursive: true });
      const exists = await fs.stat(globalPath).then((s) => s.isFile()).catch(() => false);

      if (!exists) {
        // Automatically create ~/.ai-skills/skills.config.json if missing
        await fs.writeFile(
          globalPath,
          JSON.stringify(DEFAULT_GLOBAL_SKILLS, null, 2),
          'utf-8'
        );
        return DEFAULT_GLOBAL_SKILLS;
      }

      const content = await fs.readFile(globalPath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<SkillsConfigFile>;
      if (parsed && Array.isArray(parsed.skills)) {
        return { skills: parsed.skills };
      }
    } catch {
      // Return default configuration on read error
    }

    return DEFAULT_GLOBAL_SKILLS;
  }

  /**
   * Merges skill configurations according to priority:
   * 1. Explicit project skills.config.json
   * 2. Personal collection (~/.ai-skills/skills.config.json)
   * 3. Built-in defaults
   *
   * Deduplicates entries based on skill `name`.
   *
   * @param projectPath Active project workspace directory
   * @param customConfigPath Optional explicit config file path
   */
  public static async loadMergedSkillsConfig(
    projectPath: string,
    customConfigPath?: string
  ): Promise<SkillsConfigFile> {
    const projectConfig = await loadSkillsConfig(projectPath, customConfigPath);
    const globalConfig = await GlobalConfig.loadGlobalSkillsConfig();

    const mergedMap = new Map<string, SkillConfig>();

    // Add global skills first
    if (globalConfig && Array.isArray(globalConfig.skills)) {
      for (const skill of globalConfig.skills) {
        mergedMap.set(skill.name, skill);
      }
    }

    // Override / add project skills (higher priority)
    if (projectConfig && Array.isArray(projectConfig.skills)) {
      for (const skill of projectConfig.skills) {
        mergedMap.set(skill.name, skill);
      }
    }

    return {
      skills: Array.from(mergedMap.values()),
    };
  }
}
