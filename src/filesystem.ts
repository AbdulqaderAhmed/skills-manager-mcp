import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolves and normalizes target project directory path.
 *
 * @param projectPath Optional target project path provided by client
 * @returns Absolute path to project directory
 */
export function resolveProjectPath(projectPath?: string): string {
  if (projectPath && projectPath.trim() !== '') {
    return path.resolve(projectPath.trim());
  }
  return process.cwd();
}

/**
 * Checks if a given filesystem path exists.
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a given path exists and is a directory.
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Ensures `.agents/skills` directory exists inside the project directory.
 * Creates intermediate directories if necessary.
 *
 * @param projectPath Absolute path to project directory
 * @returns Absolute path to `.agents/skills` directory
 */
export async function ensureSkillsDirectory(projectPath: string): Promise<string> {
  const skillsDir = path.join(projectPath, '.agents', 'skills');
  await fs.mkdir(skillsDir, { recursive: true });
  return skillsDir;
}

/**
 * Recursively copies a directory from source to destination.
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

/**
 * Checks if a specific skill directory exists under `.agents/skills/<skillName>`.
 *
 * @param projectPath Absolute project root directory
 * @param skillName Name of the skill to check
 * @returns Object with existence status and full path
 */
export async function checkSkillExists(
  projectPath: string,
  skillName: string
): Promise<{ exists: boolean; skillPath: string }> {
  const skillPath = path.join(projectPath, '.agents', 'skills', skillName);
  const exists = await isDirectory(skillPath);
  return { exists, skillPath };
}

/**
 * Lists all installed skill directory names found in `.agents/skills`.
 *
 * @param projectPath Absolute project root directory
 * @returns Array of installed skill folder names
 */
export async function listInstalledSkillFolders(projectPath: string): Promise<string[]> {
  const skillsDir = path.join(projectPath, '.agents', 'skills');
  const exists = await isDirectory(skillsDir);
  if (!exists) {
    return [];
  }

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Removes a skill directory under `.agents/skills/<skillName>`.
 *
 * @param projectPath Absolute project root directory
 * @param skillName Name of the skill to remove
 * @returns True if directory existed and was deleted, false if directory did not exist
 */
export async function removeSkillFolder(
  projectPath: string,
  skillName: string
): Promise<boolean> {
  const { exists, skillPath } = await checkSkillExists(projectPath, skillName);
  if (!exists) {
    return false;
  }
  await fs.rm(skillPath, { recursive: true, force: true });
  return true;
}

