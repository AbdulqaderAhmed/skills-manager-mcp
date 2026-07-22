import path from 'node:path';
import { detectWorkspace, isServerDirectory } from './workspace.js';
import { GlobalConfig } from './globalConfig.js';
import {
  ensureSkillsDirectory,
  checkSkillExists,
  listInstalledSkillFolders,
} from './filesystem.js';
import { installSkill } from './installer.js';
import { Tracker } from './tracker.js';
import { CacheManager } from './cacheManager.js';
import {
  InstallSkillsReport,
  ListInstalledReport,
  CheckMissingReport,
  BootstrapReport,
  SyncReport,
  InstallResult,
  WorkspaceDetectionResult,
} from './types.js';

/**
 * Main orchestration service for managing AI agent skills and bundles across project workspaces.
 */
export class SkillManager {
  /**
   * Returns workspace debugging information.
   *
   * @param projectPath Optional explicit project path
   * @param clientRootPath Optional client root directory detected via roots/list
   */
  public static async getWorkspaceInfo(
    projectPath?: string,
    clientRootPath?: string
  ): Promise<WorkspaceDetectionResult> {
    return await detectWorkspace(projectPath, clientRootPath);
  }

  /**
   * Bootstraps a project workspace headlessly by setting up `.agents/skills`,
   * installing configured individual skills & bundles, and updating tracking metadata.
   *
   * @param projectPath Optional target workspace directory
   * @param configPath Optional explicit config file path
   * @param clientRootPath Optional client root directory detected via roots/list
   */
  public static async bootstrapProject(
    projectPath?: string,
    configPath?: string,
    clientRootPath?: string
  ): Promise<BootstrapReport> {
    const wsResult = await detectWorkspace(projectPath, clientRootPath);
    const targetDir = wsResult.workspacePath;
    const skillsDir = await ensureSkillsDirectory(targetDir);

    const mergedConfig = await GlobalConfig.loadMergedSkillsConfig(targetDir, configPath);

    const installed: string[] = [];
    const alreadyAvailable: string[] = [];
    const failed: string[] = [];

    const summaryLines: string[] = [
      'Workspace detected:',
      targetDir,
      '',
      'Detection source:',
      wsResult.source,
      '',
      'Installing skills into:',
      skillsDir,
      '',
      'Project Bootstrap Progress:',
    ];

    for (const skillConfig of mergedConfig.skills) {
      const result = await installSkill(targetDir, skillConfig);
      const isBundle = skillConfig.type === 'bundle';
      const label = isBundle ? `[Bundle] ${skillConfig.name}` : skillConfig.name;

      const formattedLogs = result.message
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');

      if (result.status === 'installed') {
        installed.push(label);
        summaryLines.push(`✓ ${label}`);
        summaryLines.push(formattedLogs);
      } else if (result.status === 'skipped') {
        alreadyAvailable.push(label);
        summaryLines.push(`✓ ${label} (Already available)`);
        summaryLines.push(formattedLogs);
      } else {
        failed.push(label);
        summaryLines.push(`✗ ${label} (Failed)`);
        summaryLines.push(formattedLogs);
      }
      summaryLines.push('');
    }

    const metadataPath = Tracker.getTrackerPath(targetDir);

    summaryLines.push('Updated metadata:');
    summaryLines.push(`✓ .agents/skills-manager.json`);

    return {
      workspace: targetDir,
      source: wsResult.source,
      installed,
      alreadyAvailable,
      failed,
      metadataFile: metadataPath,
      summary: summaryLines.join('\n').trim(),
    };
  }

  /**
   * Synchronizes project skills with global personal skill collection (~/.ai-skills).
   */
  public static async syncSkills(
    projectPath?: string,
    configPath?: string,
    clientRootPath?: string
  ): Promise<SyncReport> {
    const wsResult = await detectWorkspace(projectPath, clientRootPath);
    const targetDir = wsResult.workspacePath;
    const mergedConfig = await GlobalConfig.loadMergedSkillsConfig(targetDir, configPath);

    const synced: string[] = [];
    const alreadySynced: string[] = [];
    const failed: string[] = [];

    const summaryLines: string[] = [
      'Skill Synchronization Complete',
      '',
      'Workspace:',
      targetDir,
      `[Source: ${wsResult.source}]`,
      '',
      'Execution Details:',
    ];

    for (const skillConfig of mergedConfig.skills) {
      const result = await installSkill(targetDir, skillConfig);
      const isBundle = skillConfig.type === 'bundle';
      const label = isBundle ? `[Bundle] ${skillConfig.name}` : skillConfig.name;

      const formattedLogs = result.message
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');

      if (result.status === 'installed') {
        synced.push(label);
        summaryLines.push(`✓ ${label}`);
        summaryLines.push(formattedLogs);
      } else if (result.status === 'skipped') {
        alreadySynced.push(label);
        summaryLines.push(`✓ ${label} (Up to date)`);
        summaryLines.push(formattedLogs);
      } else {
        failed.push(label);
        summaryLines.push(`✗ ${label} (Sync error)`);
        summaryLines.push(formattedLogs);
      }
      summaryLines.push('');
    }

    return {
      workspace: targetDir,
      source: wsResult.source,
      synced,
      alreadySynced,
      failed,
      summary: summaryLines.join('\n').trim(),
    };
  }

  /**
   * Installs all missing skills and bundles into the target project directory.
   */
  public static async installSkills(
    projectPath?: string,
    configPath?: string,
    clientRootPath?: string
  ): Promise<InstallSkillsReport> {
    const wsResult = await detectWorkspace(projectPath, clientRootPath);
    const targetDir = wsResult.workspacePath;
    await ensureSkillsDirectory(targetDir);

    const config = await GlobalConfig.loadMergedSkillsConfig(targetDir, configPath);

    const installed: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const details: InstallResult[] = [];

    const summaryLines: string[] = [
      `Skill Installation Report for: ${targetDir}`,
      `Detection Source: ${wsResult.source}`,
      '',
      'Execution Details:',
    ];

    for (const skillConfig of config.skills) {
      const result = await installSkill(targetDir, skillConfig);
      details.push(result);
      const isBundle = skillConfig.type === 'bundle';
      const label = isBundle ? `[Bundle] ${skillConfig.name}` : skillConfig.name;

      const formattedLogs = result.message
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');

      if (result.status === 'installed') {
        installed.push(label);
        summaryLines.push(`Installed: ${label}`);
        summaryLines.push(formattedLogs);
      } else if (result.status === 'skipped') {
        skipped.push(label);
        summaryLines.push(`Skipped: ${label}`);
        summaryLines.push(formattedLogs);
      } else {
        failed.push(label);
        summaryLines.push(`Failed: ${label}`);
        summaryLines.push(formattedLogs);
      }
      summaryLines.push('');
    }

    return {
      workspace: targetDir,
      source: wsResult.source,
      installed,
      skipped,
      failed,
      details,
      summary: summaryLines.join('\n').trim(),
    };
  }

  /**
   * Lists all currently installed project skills in `.agents/skills`.
   */
  public static async listInstalledSkills(
    projectPath?: string,
    clientRootPath?: string
  ): Promise<ListInstalledReport> {
    const wsResult = await detectWorkspace(projectPath, clientRootPath);
    const targetDir = wsResult.workspacePath;
    const installedFolders = await listInstalledSkillFolders(targetDir);
    const tracker = await Tracker.loadTracker(targetDir);

    const skills = installedFolders.map((folder) => {
      const fullPath = path.join(targetDir, '.agents', 'skills', folder);
      const metadata = tracker.skills[folder];

      return {
        name: folder,
        location: fullPath,
        status: 'Installed',
        type: metadata?.type || 'skill',
        version: metadata?.version || 'latest',
        installedAt: metadata?.installedAt,
        source: metadata?.source,
        installedSkills: metadata?.installedSkills,
      };
    });

    const summaryLines: string[] = [
      `Installed Skills in ${path.join(targetDir, '.agents', 'skills')}:`,
      `Detection Source: ${wsResult.source}`,
      '',
    ];

    if (skills.length === 0) {
      summaryLines.push('No skills installed yet.');
    } else {
      skills.forEach((s) => {
        const typeStr = s.type === 'bundle' ? ' [Bundle]' : '';
        const sourceStr = s.source ? ` [Source: ${s.source}]` : '';
        const bundleSkillsStr =
          s.installedSkills && s.installedSkills.length > 0
            ? ` (Includes: ${s.installedSkills.join(', ')})`
            : '';
        summaryLines.push(
          `- ${s.name}${typeStr} [Location: ${s.location}]${sourceStr}${bundleSkillsStr} (${s.status})`
        );
      });
    }

    return {
      workspace: targetDir,
      source: wsResult.source,
      skills,
      summary: summaryLines.join('\n').trim(),
    };
  }

  /**
   * Checks missing skills and bundles without executing installations.
   */
  public static async checkMissingSkills(
    projectPath?: string,
    configPath?: string,
    clientRootPath?: string
  ): Promise<CheckMissingReport> {
    const wsResult = await detectWorkspace(projectPath, clientRootPath);
    const targetDir = wsResult.workspacePath;
    const config = await GlobalConfig.loadMergedSkillsConfig(targetDir, configPath);

    const installed: string[] = [];
    const missing: string[] = [];

    for (const skillConfig of config.skills) {
      if (skillConfig.type === 'bundle') {
        const isCached = await CacheManager.hasInCache(skillConfig.name);
        if (isCached) {
          installed.push(`[Bundle] ${skillConfig.name}`);
        } else {
          missing.push(`[Bundle] ${skillConfig.name}`);
        }
      } else {
        const { exists } = await checkSkillExists(targetDir, skillConfig.name);
        if (exists) {
          installed.push(skillConfig.name);
        } else {
          missing.push(skillConfig.name);
        }
      }
    }

    const summaryLines: string[] = [
      `Skill Status Check for: ${targetDir}`,
      `Detection Source: ${wsResult.source}`,
      '',
      `Installed skills/bundles (${installed.length}):`,
    ];

    if (installed.length === 0) {
      summaryLines.push('  (none)');
    } else {
      installed.forEach((s) => summaryLines.push(`  - ${s}`));
    }

    summaryLines.push('');
    summaryLines.push(`Missing skills/bundles (${missing.length}):`);

    if (missing.length === 0) {
      summaryLines.push('  (none - all configured skills/bundles are installed!)');
    } else {
      missing.forEach((s) => summaryLines.push(`  - ${s}`));
    }

    return {
      workspace: targetDir,
      source: wsResult.source,
      installed,
      missing,
      summary: summaryLines.join('\n').trim(),
    };
  }
}
