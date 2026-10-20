import fs from 'node:fs/promises';
import path from 'node:path';

const isValidSkillName = (name: string): boolean => /^[a-zA-Z0-9_-]+$/.test(name);

/**
 * Claude Code (CLI and desktop app) discovers project skills only in
 * `<project>/.claude/skills/<skill-name>/SKILL.md`, one folder level deep.
 * It does not read `.agents/skills`, so installed skills are mirrored there.
 */
export function getClaudeSkillsDir(projectPath: string): string {
  return path.join(projectPath, '.claude', 'skills');
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
}

/**
 * Minimal YAML frontmatter reader for the `name` and `description` keys.
 * Returns null when the file has no frontmatter block.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) return null;

  const result: SkillFrontmatter = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^(name|description):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;

    let value = kv[2].trim();
    // Folded / literal block scalars: gather the indented continuation lines
    if (/^[>|][+-]?$/.test(value)) {
      const parts: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        parts.push(lines[++i].trim());
      }
      value = parts.join(' ');
    }
    value = value.replace(/^(["'])(.*)\1$/, '$2');
    result[kv[1] as keyof SkillFrontmatter] = value;
  }
  return result;
}

/**
 * Checks a skill folder against what Claude Code needs to load it.
 * Returns human-readable problems; an empty list means the skill is loadable.
 */
export async function validateSkillForClaude(skillDir: string): Promise<string[]> {
  const issues: string[] = [];
  const skillMd = path.join(skillDir, 'SKILL.md');

  let content: string;
  try {
    content = await fs.readFile(skillMd, 'utf-8');
  } catch {
    return ['SKILL.md is missing at the skill folder root'];
  }

  const fm = parseSkillFrontmatter(content);
  if (!fm) {
    issues.push('SKILL.md has no YAML frontmatter (--- block)');
    return issues;
  }
  if (!fm.description) {
    issues.push("frontmatter has no 'description' (recommended: Claude uses it to decide when to load the skill)");
  }
  if (fm.name && (/^anthropic-skills(:|$)/.test(fm.name) || /[<>]/.test(fm.name))) {
    issues.push(`frontmatter name '${fm.name}' is reserved or contains forbidden characters`);
  }
  return issues;
}

export interface MirrorResult {
  mirrored: string[];
  alreadyPresent: string[];
  skipped: string[];
  warnings: string[];
}

/**
 * Mirrors skills from `.agents/skills/<name>` into `.claude/skills/<name>` so Claude Code
 * can load them. Existing folders in `.claude/skills` are never overwritten, so skills the
 * user authored by hand stay untouched.
 */
export async function mirrorSkillsToClaude(
  projectPath: string,
  skillNames: string[]
): Promise<MirrorResult> {
  const result: MirrorResult = { mirrored: [], alreadyPresent: [], skipped: [], warnings: [] };
  const sourceRoot = path.join(projectPath, '.agents', 'skills');
  const destRoot = getClaudeSkillsDir(projectPath);

  for (const name of skillNames) {
    if (!isValidSkillName(name)) {
      result.skipped.push(name);
      result.warnings.push(`'${name}': invalid skill folder name, not mirrored to .claude/skills`);
      continue;
    }

    const src = path.join(sourceRoot, name);
    const dest = path.join(destRoot, name);

    const hasSkillMd = await fs
      .stat(path.join(src, 'SKILL.md'))
      .then((s) => s.isFile())
      .catch(() => false);
    if (!hasSkillMd) {
      result.skipped.push(name);
      result.warnings.push(`'${name}': no SKILL.md at folder root, not mirrored to .claude/skills`);
      continue;
    }

    const destExists = await fs.stat(dest).then(() => true, () => false);
    if (destExists) {
      result.alreadyPresent.push(name);
      continue;
    }

    await fs.mkdir(destRoot, { recursive: true });
    await fs.cp(src, dest, { recursive: true });
    result.mirrored.push(name);

    for (const issue of await validateSkillForClaude(dest)) {
      result.warnings.push(`'${name}': ${issue}`);
    }
  }

  return result;
}

/**
 * Lists skill folders in `.claude/skills` that contain a SKILL.md (i.e. loadable by Claude Code).
 */
export async function listClaudeSkills(projectPath: string): Promise<string[]> {
  const dir = getClaudeSkillsDir(projectPath);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const ok = await fs
        .stat(path.join(dir, entry.name, 'SKILL.md'))
        .then((s) => s.isFile())
        .catch(() => false);
      if (ok) names.push(entry.name);
    }
    return names;
  } catch {
    return [];
  }
}
