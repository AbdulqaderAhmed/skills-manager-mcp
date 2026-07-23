import { SkillManager } from '../skillManager.js';

/**
 * Executes the `skills-manager-mcp remove` CLI command.
 *
 * @param skills List of skill or bundle names to remove
 * @param options Command flags ({ removeFromConfig?: boolean, projectPath?: string })
 */
export async function runRemoveCommand(
  skills: string[],
  options: { removeFromConfig?: boolean; projectPath?: string } = {}
): Promise<void> {
  if (!skills || skills.length === 0) {
    console.error('Error: Please specify at least one skill or bundle name to remove.\n');
    console.log('Usage:');
    console.log('  skills-manager-mcp remove <skill-name1> [skill-name2...] [--from-config]\n');
    process.exit(1);
  }

  console.log('Running Skill Removal...\n');
  try {
    const report = await SkillManager.removeSkills(
      skills,
      Boolean(options.removeFromConfig),
      options.projectPath
    );
    console.log(report.summary);
  } catch (err: any) {
    console.error(`✗ Removal failed: ${err.message}`);
    process.exit(1);
  }
}
