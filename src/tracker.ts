import fs from 'node:fs/promises';
import path from 'node:path';
import { SkillsTrackerFile, SkillMetadata, SkillType } from './types.js';

const TRACKER_FILE_NAME = 'skills-manager.json';
const CURRENT_TRACKER_VERSION = '1.5.1';

/**
 * Manages `.agents/skills-manager.json` version metadata file inside project directories.
 */
export class Tracker {
  /**
   * Gets the absolute path to `.agents/skills-manager.json` for a project.
   */
  public static getTrackerPath(projectPath: string): string {
    return path.join(projectPath, '.agents', TRACKER_FILE_NAME);
  }

  /**
   * Performs automatic schema migration on older tracker structures.
   */
  public static migrateTracker(tracker: SkillsTrackerFile): SkillsTrackerFile {
    if (!tracker.migrations) {
      tracker.migrations = {};
    }

    if (tracker.version !== CURRENT_TRACKER_VERSION) {
      const oldVersion = tracker.version || '1.0';
      tracker.migrations[oldVersion] = 'completed';
      tracker.migrations[CURRENT_TRACKER_VERSION] = 'completed';
      tracker.version = CURRENT_TRACKER_VERSION;
    }

    return tracker;
  }

  /**
   * Loads the existing metadata tracking file, applies migrations, or returns a default tracker structure.
   */
  public static async loadTracker(projectPath: string): Promise<SkillsTrackerFile> {
    const filePath = Tracker.getTrackerPath(projectPath);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as SkillsTrackerFile;
      if (parsed && typeof parsed.skills === 'object') {
        return Tracker.migrateTracker(parsed);
      }
    } catch {
      // File does not exist or is invalid JSON
    }

    return {
      version: CURRENT_TRACKER_VERSION,
      updatedAt: new Date().toISOString().split('T')[0],
      migrations: {
        '1.0': 'completed',
        [CURRENT_TRACKER_VERSION]: 'completed',
      },
      skills: {},
    };
  }

  /**
   * Saves metadata tracking object to `.agents/skills-manager.json`.
   */
  public static async saveTracker(projectPath: string, tracker: SkillsTrackerFile): Promise<void> {
    const agentsDir = path.join(projectPath, '.agents');
    await fs.mkdir(agentsDir, { recursive: true });

    const filePath = Tracker.getTrackerPath(projectPath);
    const migrated = Tracker.migrateTracker(tracker);
    migrated.updatedAt = new Date().toISOString().split('T')[0];

    await fs.writeFile(filePath, JSON.stringify(migrated, null, 2), 'utf-8');
  }

  /**
   * Records or updates installation details for a skill or bundle in `.agents/skills-manager.json`.
   *
   * @param projectPath Target project directory
   * @param entryName Name of the skill or bundle
   * @param sourceRepo Repository URL source
   * @param type SkillType ('skill' | 'bundle')
   * @param installedSkills List of skill folder names included (for bundles)
   * @param version Optional version string (defaults to 'latest')
   */
  public static async recordSkillInstallation(
    projectPath: string,
    entryName: string,
    sourceRepo: string,
    type: SkillType = 'skill',
    installedSkills?: string[],
    version: string = 'latest'
  ): Promise<void> {
    const tracker = await Tracker.loadTracker(projectPath);
    const today = new Date().toISOString().split('T')[0];

    const metadata: SkillMetadata = {
      type,
      source: sourceRepo,
      installedAt: today,
      version,
      ...(installedSkills && installedSkills.length > 0 ? { installedSkills } : {}),
    };

    tracker.skills[entryName] = metadata;
    await Tracker.saveTracker(projectPath, tracker);
  }
}
