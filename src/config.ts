import fs from 'node:fs/promises';
import path from 'node:path';
import { SkillsConfigFile, SkillConfig } from './types.js';

/**
 * Default fallback skills configuration if file is missing or invalid.
 */
const DEFAULT_CONFIG: SkillsConfigFile = {
  skills: [
    {
      type: "skill",
      name: "find-skills",
      repository: "https://github.com/vercel-labs/skills",
      skill: "find-skills"
    }
  ]
};

/**
 * Dynamically loads and validates `skills.config.json`.
 * Supports both individual skill entries and bundle entries while preserving backward compatibility.
 *
 * @param targetProjectPath Target project directory path
 * @param customConfigPath Optional custom path to config file
 * @returns Parsed SkillsConfigFile object
 */
export async function loadSkillsConfig(
  targetProjectPath: string,
  customConfigPath?: string
): Promise<SkillsConfigFile> {
  const candidatePaths: string[] = [];

  if (customConfigPath) {
    candidatePaths.push(path.resolve(customConfigPath));
  }

  // Target project folder skills.config.json
  candidatePaths.push(path.join(targetProjectPath, 'skills.config.json'));

  // Server root / current working dir skills.config.json
  candidatePaths.push(path.resolve(process.cwd(), 'skills.config.json'));

  // File location relative to module root
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);
  const normalizedModuleDir =
    process.platform === 'win32' && moduleDir.startsWith('/')
      ? moduleDir.slice(1)
      : moduleDir;
  candidatePaths.push(path.resolve(normalizedModuleDir, '../skills.config.json'));

  let lastError: Error | null = null;

  for (const configFilePath of candidatePaths) {
    try {
      const fileExists = await fs.stat(configFilePath).then((s) => s.isFile()).catch(() => false);
      if (!fileExists) continue;

      const rawContent = await fs.readFile(configFilePath, 'utf-8');
      const parsed = JSON.parse(rawContent) as Partial<SkillsConfigFile>;

      if (!parsed || !Array.isArray(parsed.skills)) {
        throw new Error(`Invalid configuration format in '${configFilePath}': 'skills' must be an array.`);
      }

      // Validate individual skill entries and bundles with backward compatibility
      const validatedSkills: SkillConfig[] = parsed.skills.map((item: any, idx: number) => {
        if (!item.name || typeof item.name !== 'string') {
          throw new Error(`Skill entry at index ${idx} missing 'name' string property.`);
        }
        if (!item.repository || typeof item.repository !== 'string') {
          throw new Error(`Skill entry '${item.name}' missing 'repository' string property.`);
        }

        const type = item.type === 'bundle' ? 'bundle' : 'skill';

        if (type === 'bundle') {
          return {
            type: 'bundle',
            name: item.name.trim(),
            repository: item.repository.trim(),
          };
        } else {
          return {
            type: 'skill',
            name: item.name.trim(),
            repository: item.repository.trim(),
            skill: (item.skill || item.name).trim(),
          };
        }
      });

      return { skills: validatedSkills };
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        throw new Error(`JSON syntax error in '${configFilePath}': ${err.message}`);
      }
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return DEFAULT_CONFIG;
}

/**
 * Removes specified skill names from the target project's `skills.config.json` if present.
 *
 * @param targetProjectPath Target project directory
 * @param skillNames Array of skill or bundle names to remove
 * @returns True if config was updated, false otherwise
 */
export async function removeSkillsFromConfig(
  targetProjectPath: string,
  skillNames: string[]
): Promise<boolean> {
  const configPath = path.join(targetProjectPath, 'skills.config.json');
  try {
    const fileExists = await fs.stat(configPath).then((s) => s.isFile()).catch(() => false);
    if (!fileExists) return false;

    const rawContent = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(rawContent) as Partial<SkillsConfigFile>;

    if (!parsed || !Array.isArray(parsed.skills)) return false;

    const namesToRemove = new Set(skillNames.map((n) => n.trim().toLowerCase()));
    const initialCount = parsed.skills.length;

    parsed.skills = parsed.skills.filter(
      (item) => item && item.name && !namesToRemove.has(item.name.trim().toLowerCase())
    );

    if (parsed.skills.length !== initialCount) {
      await fs.writeFile(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
      return true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}

