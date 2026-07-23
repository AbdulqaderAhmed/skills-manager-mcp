#!/usr/bin/env node

import { runSetupCommand } from './commands/setup.js';
import { runBootstrapCommand } from './commands/bootstrap.js';
import { runSyncCommand } from './commands/sync.js';
import { runStatusCommand } from './commands/status.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runRemoveCommand } from './commands/remove.js';
import { ensureInitialized } from './services/initializer.js';

/**
 * Prints CLI help menu.
 */
function printHelp(): void {
  console.log(`
Skills Manager MCP CLI

Usage:
  skills-manager-mcp <command> [options]

Commands:
  status                   Display status dashboard (global config, cache stats, workspace)
  bootstrap                Bootstrap project workspace skills & bundles
  sync                     Synchronize project skills with global personal collection
  remove <skill1> [skill2] Remove specified skills/bundles (--from-config to remove from skills.config.json)
  setup                    Run global setup & Antigravity MCP registration
  doctor                   Run diagnostic health check on installation & registration
  help                     Show this help menu
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  // Commands that bypass automatic first-run initialization
  const bypassAutoInit = ['setup', 'doctor', 'help', '--help', '-h'];

  if (!command || !bypassAutoInit.includes(command)) {
    await ensureInitialized();
  }

  if (!command) {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'status':
      await runStatusCommand(args[1]);
      break;

    case 'bootstrap':
      await runBootstrapCommand(args[1]);
      break;

    case 'sync':
      await runSyncCommand(args[1]);
      break;

    case 'remove': {
      const rawTargets = args.slice(1);
      const removeFromConfig = rawTargets.includes('--from-config') || rawTargets.includes('-c');
      const skills = rawTargets.filter((a) => !a.startsWith('-'));
      await runRemoveCommand(skills, { removeFromConfig });
      break;
    }

    case 'setup':
      await runSetupCommand();
      break;

    case 'doctor':
      await runDoctorCommand();
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`Unknown command: '${command}'\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
