import { SkillManager } from '../skillManager.js';

/**
 * Executes the `skills-manager-mcp bootstrap` CLI command.
 * Reuses existing SkillManager.bootstrapProject business logic.
 */
export async function runBootstrapCommand(providedPath?: string, configPath?: string): Promise<void> {
  console.log('Running Project Bootstrap...\n');
  try {
    const report = await SkillManager.bootstrapProject(providedPath, configPath);
    console.log(report.summary);
  } catch (err: any) {
    console.error(`✗ Bootstrap failed: ${err.message}`);
    process.exit(1);
  }
}
