import { SkillManager } from '../skillManager.js';

/**
 * Executes the `skills-manager-mcp sync` CLI command.
 * Reuses existing SkillManager.syncSkills business logic.
 */
export async function runSyncCommand(providedPath?: string, configPath?: string): Promise<void> {
  console.log('Running Skill Synchronization...\n');
  try {
    const report = await SkillManager.syncSkills(providedPath, configPath);
    console.log(report.summary);
  } catch (err: any) {
    console.error(`✗ Synchronization failed: ${err.message}`);
    process.exit(1);
  }
}
