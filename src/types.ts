/**
 * Type discriminator for skill configuration entries.
 */
export type SkillType = 'skill' | 'bundle';

/**
 * Configuration definition for an individual skill.
 */
export interface SingleSkillConfig {
  type?: 'skill';
  /** Unique name identifier for the skill */
  name: string;
  /** Git repository URL containing the skill */
  repository: string;
  /** Skill identifier within the repository */
  skill?: string;
}

/**
 * Configuration definition for a skill bundle repository.
 */
export interface BundleSkillConfig {
  type: 'bundle';
  /** Unique name identifier for the bundle */
  name: string;
  /** Git repository URL containing multiple skills */
  repository: string;
}

/**
 * Union type for skill entry configurations in skills.config.json.
 */
export type SkillConfig = SingleSkillConfig | BundleSkillConfig;

/**
 * Root structure for skills.config.json file.
 */
export interface SkillsConfigFile {
  skills: SkillConfig[];
}

/**
 * Skill version tracking metadata stored in `.agents/skills-manager.json`.
 */
export interface SkillMetadata {
  type: SkillType;
  source: string;
  installedAt: string;
  version: string;
  installedSkills?: string[];
}

/**
 * Structure of `.agents/skills-manager.json` metadata file inside a project.
 */
export interface SkillsTrackerFile {
  version: string;
  updatedAt: string;
  migrations?: Record<string, string>;
  skills: Record<string, SkillMetadata>;
}

/**
 * Detailed status of a skill relative to a target project path.
 */
export interface SkillStatusItem {
  name: string;
  repository: string;
  skill?: string;
  type: SkillType;
  installed: boolean;
  location: string;
  status: 'Installed' | 'Missing';
}

/**
 * Result of installing an individual skill or a skill bundle.
 */
export interface InstallResult {
  skillName: string;
  type: SkillType;
  status: 'installed' | 'skipped' | 'failed';
  message: string;
  fromCache?: boolean;
  discoveredSkills?: string[];
}

/**
 * Aggregated report after running the `install_skills` tool.
 */
export interface InstallSkillsReport {
  workspace: string;
  source: string;
  installed: string[];
  skipped: string[];
  failed: string[];
  details: InstallResult[];
  summary: string;
}

/**
 * Report returned by `bootstrap_project` MCP tool.
 */
export interface BootstrapReport {
  workspace: string;
  source: string;
  installed: string[];
  alreadyAvailable: string[];
  failed: string[];
  metadataFile: string;
  summary: string;
}

/**
 * Report returned by `sync_skills` MCP tool.
 */
export interface SyncReport {
  workspace: string;
  source: string;
  synced: string[];
  alreadySynced: string[];
  failed: string[];
  summary: string;
}

/**
 * Aggregated report after running the `list_installed_skills` tool.
 */
export interface ListInstalledReport {
  workspace: string;
  source: string;
  skills: Array<{
    name: string;
    location: string;
    status: string;
    type?: SkillType;
    version?: string;
    installedAt?: string;
    source?: string;
    installedSkills?: string[];
  }>;
  summary: string;
}

/**
 * Aggregated report after running the `check_missing_skills` tool.
 */
export interface CheckMissingReport {
  workspace: string;
  source: string;
  installed: string[];
  missing: string[];
  summary: string;
}

/**
 * Result of removing an individual skill or bundle.
 */
export interface RemoveResult {
  skillName: string;
  status: 'removed' | 'not_found' | 'failed';
  message: string;
}

/**
 * Aggregated report after running the `remove_skills` tool.
 */
export interface RemoveSkillsReport {
  workspace: string;
  source: string;
  removed: string[];
  notFound: string[];
  failed: string[];
  details: RemoveResult[];
  summary: string;
}


/**
 * Input arguments for MCP tool calls.
 */
export interface ToolArguments {
  projectPath?: string;
  configPath?: string;
}

/**
 * Workspace detection sources.
 */
export type WorkspaceDetectionSource =
  | 'argument'
  | 'environment'
  | 'antigravity'
  | 'project-root'
  | 'fallback';

/**
 * Result structure returned by workspace resolution.
 */
export interface WorkspaceDetectionResult {
  workspacePath: string;
  source: WorkspaceDetectionSource;
  mcpServerDirectory: string;
  isValidWorkspace: boolean;
}

/**
 * Workspace detection configuration options in ~/.ai-skills/config.json.
 */
export interface WorkspaceConfig {
  preventServerDirectoryInstall?: boolean;
  autoDetectProjectRoot?: boolean;
  preferredMarkers?: string[];
}

/**
 * Structure of ~/.ai-skills/config.json file.
 */
export interface GlobalSettingsFile {
  workspaceDetection?: WorkspaceConfig;
}
