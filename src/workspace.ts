import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  WorkspaceDetectionResult,
  WorkspaceDetectionSource,
  GlobalSettingsFile,
  WorkspaceConfig,
} from './types.js';

const DEFAULT_MARKERS = [
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.git',
  'pyproject.toml',
  'requirements.txt',
  '.sln',
  '.csproj',
];

/**
 * Returns the absolute directory path of the skills-manager-mcp server itself.
 */
export function getMcpServerDirectory(): string {
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);
  const normalizedModuleDir =
    process.platform === 'win32' && moduleDir.startsWith('/')
      ? moduleDir.slice(1)
      : moduleDir;
  return path.resolve(normalizedModuleDir, '..');
}

/**
 * Checks if a given directory path is the MCP server's installation directory.
 */
export async function isServerDirectory(targetPath: string): Promise<boolean> {
  const normalizedTarget = path.resolve(targetPath);
  const serverDir = getMcpServerDirectory();

  if (normalizedTarget.toLowerCase() === serverDir.toLowerCase()) {
    return true;
  }

  // Double check by reading package.json name if present
  try {
    const pkgPath = path.join(normalizedTarget, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed && parsed.name === 'skills-manager-mcp') {
      return true;
    }
  } catch {
    // Ignore read errors
  }

  return false;
}

/**
 * Loads configuration options from ~/.ai-skills/config.json, automatically creating it if missing.
 */
export async function loadGlobalWorkspaceConfig(): Promise<WorkspaceConfig> {
  const configPath = path.join(os.homedir(), '.ai-skills', 'config.json');
  const configDir = path.dirname(configPath);

  const defaultConfig: WorkspaceConfig = {
    preventServerDirectoryInstall: true,
    autoDetectProjectRoot: true,
    preferredMarkers: DEFAULT_MARKERS,
  };

  try {
    await fs.mkdir(configDir, { recursive: true });
    const exists = await fs.stat(configPath).then((s) => s.isFile()).catch(() => false);

    if (!exists) {
      // Automatically create default ~/.ai-skills/config.json if missing
      const settingsObj: GlobalSettingsFile = { workspaceDetection: defaultConfig };
      await fs.writeFile(configPath, JSON.stringify(settingsObj, null, 2), 'utf-8');
      return defaultConfig;
    }

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as GlobalSettingsFile;
    if (parsed && parsed.workspaceDetection) {
      return parsed.workspaceDetection;
    }
  } catch {
    // Return default settings on read error
  }

  return defaultConfig;
}

/**
 * Walks parent directories to find the nearest project root containing any marker file/folder.
 *
 * @param startDir Starting directory path
 * @param markers Array of marker filenames/directory names
 * @returns Absolute path to discovered project root directory, or null if none found
 */
export async function findProjectRoot(
  startDir: string,
  markers: string[] = DEFAULT_MARKERS
): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  const rootDir = path.parse(currentDir).root;

  while (currentDir && currentDir !== rootDir) {
    // Skip if currentDir is the MCP server's own directory
    if (await isServerDirectory(currentDir)) {
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
      continue;
    }

    try {
      const entries = await fs.readdir(currentDir);
      const hasMarker = markers.some((marker) => {
        if (marker.endsWith('.sln') || marker.endsWith('.csproj')) {
          return entries.some((e) => e.endsWith('.sln') || e.endsWith('.csproj'));
        }
        return entries.includes(marker);
      });

      if (hasMarker) {
        return currentDir;
      }
    } catch {
      // Ignore read errors
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return null;
}

/**
 * Robustly detects the active workspace directory path with strict protection against installing into the MCP server directory.
 *
 * Priority Resolution:
 * 1. MCP tool argument `providedPath` (highest priority - strictly validated against server directory self-install)
 * 2. Antigravity / MCP environment variables (`ANTIGRAVITY_WORKSPACE`, `MCP_WORKSPACE_DIR`)
 * 3. MCP client initialization context / roots (`clientRootPath`)
 * 4. Parent directory search for project root markers (`package.json`, `.git`, etc.)
 * 5. `process.cwd()` as final fallback only
 *
 * @param providedPath Explicit project path passed in tool args
 * @param clientRootPath Client root path received from roots/list RPC
 * @returns WorkspaceDetectionResult object
 */
export async function detectWorkspace(
  providedPath?: string,
  clientRootPath?: string
): Promise<WorkspaceDetectionResult> {
  const config = await loadGlobalWorkspaceConfig();
  const preventServerInstall = config.preventServerDirectoryInstall !== false;
  const serverDir = getMcpServerDirectory();
  const markers = config.preferredMarkers || DEFAULT_MARKERS;

  // Helper to test if a candidate directory is valid and allowed
  const isValidCandidate = async (candidate?: string): Promise<string | null> => {
    if (!candidate || candidate.trim() === '') return null;
    const resolved = path.resolve(candidate.trim());
    try {
      const stats = await fs.stat(resolved);
      if (!stats.isDirectory()) return null;
      if (preventServerInstall && (await isServerDirectory(resolved))) {
        return null; // Reject server directory
      }
      return resolved;
    } catch {
      return null;
    }
  };

  // 1. Explicit tool argument
  if (providedPath && providedPath.trim() !== '') {
    const resolved = path.resolve(providedPath.trim());
    let stats: any;
    try {
      stats = await fs.stat(resolved);
    } catch {
      throw new Error(`Specified projectPath does not exist: '${providedPath}'`);
    }

    if (!stats.isDirectory()) {
      throw new Error(`Specified projectPath is not a directory: '${providedPath}'`);
    }

    if (preventServerInstall && (await isServerDirectory(resolved))) {
      throw new Error(
        `Installation Blocked: '${resolved}' is the skills-manager-mcp server directory. Skills cannot be installed into the server project itself. Please pass your development project path in 'projectPath' (e.g. projectPath: 'D:/Projects/Work/my-project').`
      );
    }

    return {
      workspacePath: resolved,
      source: 'argument',
      mcpServerDirectory: serverDir,
      isValidWorkspace: true,
    };
  }

  // 2. Antigravity environment variables
  const envVarCandidates = [
    process.env.ANTIGRAVITY_WORKSPACE,
    process.env.MCP_WORKSPACE_DIR,
  ];

  for (const envCandidate of envVarCandidates) {
    const valid = await isValidCandidate(envCandidate);
    if (valid) {
      return {
        workspacePath: valid,
        source: 'environment',
        mcpServerDirectory: serverDir,
        isValidWorkspace: true,
      };
    }
  }

  // 3. Antigravity / Client roots context
  const validClientRoot = await isValidCandidate(clientRootPath);
  if (validClientRoot) {
    return {
      workspacePath: validClientRoot,
      source: 'antigravity',
      mcpServerDirectory: serverDir,
      isValidWorkspace: true,
    };
  }

  // 4. Project Root detection by walking parent directories
  const startPathsForRootSearch = [
    process.env.INIT_CWD,
    process.env.WORKSPACE_FOLDER,
    process.env.PROJECT_CWD,
    process.env.VSCODE_WORKSPACE,
    process.cwd(),
  ].filter(Boolean) as string[];

  if (config.autoDetectProjectRoot !== false) {
    for (const startPath of startPathsForRootSearch) {
      const discoveredRoot = await findProjectRoot(startPath, markers);
      if (discoveredRoot && (await isValidCandidate(discoveredRoot))) {
        return {
          workspacePath: discoveredRoot,
          source: 'project-root',
          mcpServerDirectory: serverDir,
          isValidWorkspace: true,
        };
      }
    }
  }

  // 5. process.cwd() fallback
  const validCwd = await isValidCandidate(process.cwd());
  if (validCwd) {
    return {
      workspacePath: validCwd,
      source: 'fallback',
      mcpServerDirectory: serverDir,
      isValidWorkspace: true,
    };
  }

  // If process.cwd() or all candidates were rejected because they equal the MCP server directory:
  throw new Error(
    `Installation Blocked: The current directory ('${serverDir}') is the skills-manager-mcp server project directory. Skills cannot be installed here. Please open your development project folder in Antigravity Desktop or pass your project path in 'projectPath' (e.g. projectPath: 'D:/Projects/Work/my-project').`
  );
}
