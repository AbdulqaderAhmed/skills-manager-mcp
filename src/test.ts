import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  isValidRepositoryUrl,
  isValidSkillName,
  discoverSkillFolders,
} from "./installer.js";
import { loadSkillsConfig } from "./config.js";
import { CacheManager } from "./cacheManager.js";
import {
  detectWorkspace,
  getMcpServerDirectory,
  isServerDirectory,
  findProjectRoot,
} from "./workspace.js";
import {
  registerAntigravityMcp,
  unregisterAntigravityMcp,
  getAntigravityMcpConfigPath,
  getMcpServerIndexPath,
} from "./services/antigravityRegistry.js";
import {
  registerVsCodeMcp,
  unregisterVsCodeMcp,
  getVsCodeMcpConfigPaths,
} from "./services/vscodeRegistry.js";
import {
  registerClaudeDesktopMcp,
  unregisterClaudeDesktopMcp,
  isClaudeDesktopMcpRegistered,
} from "./services/claudeDesktopRegistry.js";
import {
  registerClaudeCodeMcp,
  unregisterClaudeCodeMcp,
  isClaudeCodeMcpRegistered,
} from "./services/claudeCodeRegistry.js";
import {
  registerCursorMcp,
  unregisterCursorMcp,
  isCursorMcpRegistered,
} from "./services/cursorRegistry.js";
import {
  registerCodexMcp,
  unregisterCodexMcp,
  isCodexMcpRegistered,
} from "./services/codexRegistry.js";
import { performDoctorChecks } from "./commands/doctor.js";
import { Tracker } from "./tracker.js";
import { SkillManager } from "./skillManager.js";
import { isInitialized, ensureInitialized } from "./services/initializer.js";
import {
  checkNodeVersion,
  getModuleDir,
  MIN_NODE_MAJOR_VERSION,
} from "./nodeCompat.js";

async function runTests() {
  console.log("Running skills-manager-mcp test suite...\n");

  // Test 1: URL and Skill Name Validation
  assert.strictEqual(
    isValidRepositoryUrl("https://github.com/vercel-labs/skills"),
    true,
  );
  assert.strictEqual(
    isValidRepositoryUrl("http://github.com/mattpocock/skills"),
    true,
  );
  assert.strictEqual(isValidRepositoryUrl("invalid-url"), false);

  assert.strictEqual(isValidSkillName("find-skills"), true);
  assert.strictEqual(isValidSkillName("mattpocock-skills"), true);
  assert.strictEqual(isValidSkillName("invalid skill name!"), false);
  console.log("✓ Test 1: URL and identifier validation passed.");

  // Test 2: Backward Compatible Config Loading
  const config = await loadSkillsConfig(process.cwd());
  assert.ok(Array.isArray(config.skills));
  assert.ok(config.skills.length > 0);
  assert.ok(
    config.skills[0].type === "skill" || config.skills[0].type === "bundle",
  );
  console.log("✓ Test 2: Backward compatible config loading passed.");

  // Test 3: Global Cache Directory Pathing
  const cacheDir = CacheManager.getGlobalCacheDir();
  assert.ok(cacheDir.includes(".ai-skills"));
  console.log(
    `✓ Test 3: Global cache directory path verified ('${cacheDir}').`,
  );

  // Test 4: Recursive Bundle Skill Discovery
  const tempTestDir = await fs.mkdtemp(path.join(os.tmpdir(), "test-bundle-"));
  const nestedSkillDir = path.join(tempTestDir, "engineering", "test-skill");
  const agentsSubDir = path.join(nestedSkillDir, "agents");

  await fs.mkdir(agentsSubDir, { recursive: true });
  await fs.writeFile(
    path.join(nestedSkillDir, "SKILL.md"),
    "# Test Skill",
    "utf-8",
  );
  await fs.writeFile(
    path.join(agentsSubDir, "openai.yaml"),
    "model: gpt-4",
    "utf-8",
  );

  const duplicateSkillDir = path.join(
    tempTestDir,
    "productivity",
    "test-skill",
  );
  await fs.mkdir(duplicateSkillDir, { recursive: true });
  await fs.writeFile(
    path.join(duplicateSkillDir, "SKILL.md"),
    "# Duplicate Skill",
    "utf-8",
  );

  const logs: string[] = [];
  const discovered = await discoverSkillFolders(tempTestDir, logs);

  assert.strictEqual(discovered.has("test-skill"), true);
  assert.strictEqual(discovered.get("test-skill"), nestedSkillDir);
  assert.strictEqual(discovered.size, 1);
  assert.ok(logs.some((l) => l.includes("Duplicate skill name")));

  await fs.rm(tempTestDir, { recursive: true, force: true }).catch(() => {});
  console.log(
    "✓ Test 4: Nested bundle discovery with SKILL.md and duplicate handling passed.",
  );

  // -------------------------------------------------------------
  // WORKSPACE DETECTION TEST CASES
  // -------------------------------------------------------------

  // Case 1: Server Directory Protection
  const serverDir = getMcpServerDirectory();
  assert.strictEqual(await isServerDirectory(serverDir), true);

  const origEnvMcpWorkspace = process.env.MCP_WORKSPACE_DIR;
  const origEnvAntigravityWorkspace = process.env.ANTIGRAVITY_WORKSPACE;
  delete process.env.MCP_WORKSPACE_DIR;
  delete process.env.ANTIGRAVITY_WORKSPACE;

  try {
    await detectWorkspace();
    assert.fail(
      "Expected detectWorkspace to throw protection error when in server directory",
    );
  } catch (err: any) {
    const msg = err.message.toLowerCase();
    assert.ok(
      msg.includes("no active project workspace") || msg.includes("blocked"),
    );
  }

  try {
    await detectWorkspace(serverDir);
    assert.fail(
      "Expected detectWorkspace to block explicit server directory providedPath",
    );
  } catch (err: any) {
    assert.ok(err.message.toLowerCase().includes("blocked"));
  }

  console.log("✓ Case 1: Server directory protection test passed.");

  // Case 2: Subdirectory Parent Search
  const mockProjectDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "my-next-app-"),
  );
  const mockSrcSubDir = path.join(mockProjectDir, "src", "components");
  await fs.mkdir(mockSrcSubDir, { recursive: true });
  await fs.writeFile(
    path.join(mockProjectDir, "package.json"),
    JSON.stringify({ name: "my-next-app" }),
    "utf-8",
  );

  const resolvedProjectRoot = await findProjectRoot(mockSrcSubDir);
  assert.strictEqual(resolvedProjectRoot, mockProjectDir);
  console.log("✓ Case 2: Subdirectory parent search test passed.");

  // Case 3: Environment Workspace variable (MCP_WORKSPACE_DIR)
  const tempEnvDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-project-"));
  process.env.MCP_WORKSPACE_DIR = tempEnvDir;

  const envWsResult = await detectWorkspace();
  assert.strictEqual(envWsResult.workspacePath, tempEnvDir);
  assert.strictEqual(envWsResult.source, "environment");
  console.log(
    "✓ Case 3: MCP_WORKSPACE_DIR environment variable resolution test passed.",
  );

  // Case 4: Explicit projectPath provided
  const tempExplicitDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "explicit-project-"),
  );
  const explicitWsResult = await detectWorkspace(tempExplicitDir);

  assert.strictEqual(explicitWsResult.workspacePath, tempExplicitDir);
  assert.strictEqual(explicitWsResult.source, "argument");
  console.log("✓ Case 4: Explicit projectPath highest priority test passed.");

  // -------------------------------------------------------------
  // REGISTRATION & UNINSTALLATION TESTS
  // -------------------------------------------------------------

  // Test 5A: Dynamic Server Index Path Resolution
  const indexPath = getMcpServerIndexPath();
  assert.ok(indexPath.endsWith(path.join("dist", "index.js")));
  assert.strictEqual(path.isAbsolute(indexPath), true);

  // Test 5B: Registration in fresh & existing mcp.json with server preservation
  const mockMcpConfigDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "mock-mcp-config-"),
  );
  const mockMcpFile = path.join(mockMcpConfigDir, "mcp.json");

  const existingConfig = {
    mcpServers: {
      "other-server": {
        command: "node",
        args: ["/path/to/other.js"],
      },
    },
  };
  await fs.writeFile(
    mockMcpFile,
    JSON.stringify(existingConfig, null, 2),
    "utf-8",
  );

  const mockCustomServer = path.join(mockMcpConfigDir, "dist", "index.js");
  await registerAntigravityMcp(mockCustomServer, mockMcpFile);

  const readBack = JSON.parse(await fs.readFile(mockMcpFile, "utf-8"));
  assert.ok(readBack.mcpServers["other-server"]);
  assert.strictEqual(
    readBack.mcpServers["other-server"].args[0],
    "/path/to/other.js",
  );
  assert.ok(readBack.mcpServers["skills-manager"]);
  assert.strictEqual(readBack.mcpServers["skills-manager"].command, "node");
  assert.strictEqual(
    readBack.mcpServers["skills-manager"].args[0],
    mockCustomServer,
  );

  // Test 5C: Idempotence (running registration twice)
  await registerAntigravityMcp(mockCustomServer, mockMcpFile);
  const readBackTwice = JSON.parse(await fs.readFile(mockMcpFile, "utf-8"));
  assert.strictEqual(Object.keys(readBackTwice.mcpServers).length, 2);

  // Test 5D: Uninstallation removal of skills-manager while keeping other servers
  await unregisterAntigravityMcp(mockMcpFile);
  const readBackUninstalled = JSON.parse(
    await fs.readFile(mockMcpFile, "utf-8"),
  );
  assert.ok(readBackUninstalled.mcpServers["other-server"]);
  assert.strictEqual(
    readBackUninstalled.mcpServers["skills-manager"],
    undefined,
  );

  // Test 5E: Live Environment Registration test
  const liveReg = await registerAntigravityMcp();
  assert.strictEqual(liveReg.registered, true);

  console.log(
    "✓ Test 5: Registration, preservation, idempotence, path generation, and uninstallation passed.",
  );

  // -------------------------------------------------------------
  // VS CODE REGISTRATION TESTS
  // -------------------------------------------------------------

  // Test 5F: VS Code registration uses `servers` key and preserves existing entries
  const mockVsCodeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "mock-vscode-config-"),
  );
  const mockVsCodeFile = path.join(mockVsCodeDir, "mcp.json");

  const existingVsCodeConfig = {
    servers: {
      "other-vscode-server": {
        type: "stdio",
        command: "node",
        args: ["/path/to/other.js"],
      },
    },
  };
  await fs.writeFile(
    mockVsCodeFile,
    JSON.stringify(existingVsCodeConfig, null, 2),
    "utf-8",
  );

  const mockVsCodeServer = path.join(mockVsCodeDir, "dist", "index.js");
  const vsCodeRegResult = await registerVsCodeMcp(
    mockVsCodeServer,
    mockVsCodeFile,
  );
  assert.strictEqual(vsCodeRegResult.registered, true);
  assert.strictEqual(vsCodeRegResult.newlyAdded, true);

  const vsCodeReadBack = JSON.parse(await fs.readFile(mockVsCodeFile, "utf-8"));
  assert.ok(vsCodeReadBack.servers["other-vscode-server"]);
  assert.ok(vsCodeReadBack.servers["skills-manager"]);
  assert.strictEqual(vsCodeReadBack.servers["skills-manager"].type, "stdio");
  assert.strictEqual(vsCodeReadBack.servers["skills-manager"].command, "node");
  assert.strictEqual(
    vsCodeReadBack.servers["skills-manager"].args[0],
    mockVsCodeServer,
  );

  // Test 5G: Idempotence (running VS Code registration twice)
  const vsCodeRegResult2 = await registerVsCodeMcp(
    mockVsCodeServer,
    mockVsCodeFile,
  );
  assert.strictEqual(vsCodeRegResult2.newlyAdded, false);
  const vsCodeReadBackTwice = JSON.parse(
    await fs.readFile(mockVsCodeFile, "utf-8"),
  );
  assert.strictEqual(Object.keys(vsCodeReadBackTwice.servers).length, 2);

  // Test 5H: Unregistration removes skills-manager while keeping other servers
  await unregisterVsCodeMcp(mockVsCodeFile);
  const vsCodeReadBackUninstalled = JSON.parse(
    await fs.readFile(mockVsCodeFile, "utf-8"),
  );
  assert.ok(vsCodeReadBackUninstalled.servers["other-vscode-server"]);
  assert.strictEqual(
    vsCodeReadBackUninstalled.servers["skills-manager"],
    undefined,
  );

  // Test 5I: VS Code config paths are platform-appropriate and non-empty
  const vsCodePaths = getVsCodeMcpConfigPaths();
  assert.ok(vsCodePaths.length >= 1);
  assert.ok(
    vsCodePaths.every((p) => p.endsWith(path.join("User", "mcp.json"))),
  );

  await fs.rm(mockVsCodeDir, { recursive: true, force: true }).catch(() => {});
  console.log(
    "✓ Test 5F-5I: VS Code registration, preservation, idempotence, and uninstallation passed.",
  );

  // -------------------------------------------------------------
  // CLAUDE DESKTOP & CLAUDE CODE REGISTRATION TESTS
  // -------------------------------------------------------------
  const mockClaudeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "mock-claude-config-"),
  );
  const mockClaudeDesktopFile = path.join(
    mockClaudeDir,
    "claude_desktop_config.json",
  );
  const mockClaudeCodeFile = path.join(mockClaudeDir, ".claude.json");

  // Pre-seed Claude Desktop config with preferences and coworkUserFilesPath
  const initialClaudeDesktopData = {
    preferences: {
      coworkWebSearchEnabled: true,
      remoteToolsDeviceName: "test-device",
    },
    coworkUserFilesPath: "C:\\Users\\Test\\Claude",
  };
  await fs.writeFile(
    mockClaudeDesktopFile,
    JSON.stringify(initialClaudeDesktopData, null, 2),
    "utf-8",
  );

  const mockClaudeServer = path.join(mockClaudeDir, "dist", "index.js");
  const claudeDesktopReg = await registerClaudeDesktopMcp(
    mockClaudeServer,
    mockClaudeDesktopFile,
  );
  assert.strictEqual(claudeDesktopReg.registered, true);
  assert.strictEqual(claudeDesktopReg.newlyAdded, true);

  const desktopReadBack = JSON.parse(
    await fs.readFile(mockClaudeDesktopFile, "utf-8"),
  );
  assert.strictEqual(desktopReadBack.preferences.coworkWebSearchEnabled, true);
  assert.strictEqual(
    desktopReadBack.coworkUserFilesPath,
    "C:\\Users\\Test\\Claude",
  );
  assert.ok(desktopReadBack.mcpServers["skills-manager"]);
  assert.strictEqual(
    desktopReadBack.mcpServers["skills-manager"].args[0],
    mockClaudeServer,
  );
  assert.strictEqual(
    await isClaudeDesktopMcpRegistered(mockClaudeDesktopFile),
    true,
  );

  // Unregister Claude Desktop
  await unregisterClaudeDesktopMcp(mockClaudeDesktopFile);
  const desktopUnregistered = JSON.parse(
    await fs.readFile(mockClaudeDesktopFile, "utf-8"),
  );
  assert.strictEqual(
    desktopUnregistered.mcpServers["skills-manager"],
    undefined,
  );
  assert.strictEqual(
    desktopUnregistered.preferences.coworkWebSearchEnabled,
    true,
  );

  // Test Claude Code (~/.claude.json)
  const claudeCodeReg = await registerClaudeCodeMcp(
    mockClaudeServer,
    mockClaudeCodeFile,
  );
  assert.strictEqual(claudeCodeReg.registered, true);
  assert.strictEqual(await isClaudeCodeMcpRegistered(mockClaudeCodeFile), true);
  await unregisterClaudeCodeMcp(mockClaudeCodeFile);
  assert.strictEqual(
    await isClaudeCodeMcpRegistered(mockClaudeCodeFile),
    false,
  );

  await fs.rm(mockClaudeDir, { recursive: true, force: true }).catch(() => {});
  console.log(
    "✓ Test 5J: Claude Desktop & Claude Code registration, preservation, and uninstallation passed.",
  );

  // -------------------------------------------------------------
  // CURSOR & CODEX REGISTRATION TESTS
  // -------------------------------------------------------------
  const mockCursorDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "mock-cursor-config-"),
  );
  const mockCursorFile = path.join(mockCursorDir, "mcp.json");
  const mockCursorServer = path.join(mockCursorDir, "dist", "index.js");

  const cursorReg = await registerCursorMcp(
    mockCursorServer,
    mockCursorFile,
  );
  assert.strictEqual(cursorReg.registered, true);
  const cursorReadBack = JSON.parse(
    await fs.readFile(mockCursorFile, "utf-8"),
  );
  assert.ok(cursorReadBack.mcpServers["skills-manager"]);
  assert.strictEqual(
    cursorReadBack.mcpServers["skills-manager"].args[0],
    mockCursorServer,
  );
  assert.strictEqual(await isCursorMcpRegistered(mockCursorFile), true);
  await unregisterCursorMcp(mockCursorFile);
  assert.strictEqual(await isCursorMcpRegistered(mockCursorFile), false);
  await fs.rm(mockCursorDir, { recursive: true, force: true }).catch(() => {});

  // Codex TOML Test
  const mockCodexDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "mock-codex-config-"),
  );
  const mockCodexFile = path.join(mockCodexDir, "config.toml");
  const mockCodexServer = path.join(mockCodexDir, "dist", "index.js");

  // Pre-seed with existing TOML section
  await fs.writeFile(
    mockCodexFile,
    '[model]\ndefault = "gpt-4o"\n\n[mcp_servers.existing]\ncommand = "npx"\nargs = ["some-tool"]\n',
    "utf-8",
  );

  const codexReg = await registerCodexMcp(mockCodexServer, mockCodexFile);
  assert.strictEqual(codexReg.registered, true);
  const codexContent = await fs.readFile(mockCodexFile, "utf-8");
  assert.ok(codexContent.includes("[mcp_servers.skills-manager]"));
  assert.ok(codexContent.includes("[mcp_servers.existing]"));
  assert.strictEqual(await isCodexMcpRegistered(mockCodexFile), true);

  await unregisterCodexMcp(mockCodexFile);
  const codexUnregContent = await fs.readFile(mockCodexFile, "utf-8");
  assert.ok(!codexUnregContent.includes("[mcp_servers.skills-manager]"));
  assert.ok(codexUnregContent.includes("[mcp_servers.existing]"));
  assert.strictEqual(await isCodexMcpRegistered(mockCodexFile), false);

  await fs.rm(mockCodexDir, { recursive: true, force: true }).catch(() => {});
  console.log(
    "✓ Test 5K: Cursor (mcpServers key) & Codex (TOML format) registration and uninstallation passed.",
  );

  // -------------------------------------------------------------
  // DOCTOR & TRACKER VERSION MIGRATION TESTS
  // -------------------------------------------------------------

  // Test 6A: Doctor Health Checks
  const doctorChecks = await performDoctorChecks();
  assert.ok(Array.isArray(doctorChecks));
  assert.ok(doctorChecks.length >= 5);
  console.log("✓ Test 6A: Doctor health checks execution passed.");

  // Test 6B: Tracker Schema Migration Test (1.0 -> 1.4.0)
  const legacyTrackerDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "legacy-tracker-"),
  );
  const legacyTrackerFile = path.join(
    legacyTrackerDir,
    ".agents",
    "skills-manager.json",
  );
  await fs.mkdir(path.dirname(legacyTrackerFile), { recursive: true });

  const legacyData = {
    version: "1.0",
    updatedAt: "2026-01-01",
    skills: {
      "find-skills": {
        type: "skill",
        source: "https://github.com/vercel-labs/skills",
        installedAt: "2026-01-01",
        version: "latest",
      },
    },
  };
  await fs.writeFile(
    legacyTrackerFile,
    JSON.stringify(legacyData, null, 2),
    "utf-8",
  );

  const loadedTracker = await Tracker.loadTracker(legacyTrackerDir);
  assert.strictEqual(loadedTracker.version, "1.6.0");
  assert.ok(loadedTracker.migrations);
  assert.strictEqual(loadedTracker.migrations["1.0"], "completed");
  assert.strictEqual(loadedTracker.migrations["1.6.0"], "completed");

  await fs
    .rm(legacyTrackerDir, { recursive: true, force: true })
    .catch(() => {});
  console.log(
    "✓ Test 6B: Tracker schema migration test (1.0 -> 1.6.0) passed.",
  );

  // -------------------------------------------------------------
  // FIRST-RUN AUTOMATIC INITIALIZATION TESTS (REQUIREMENT #6)
  // -------------------------------------------------------------

  // Test 7A: Verify package.json contains NO postinstall or preuninstall scripts
  const pkgContent = await fs.readFile(
    path.join(process.cwd(), "package.json"),
    "utf-8",
  );
  const pkgJson = JSON.parse(pkgContent);
  assert.strictEqual(pkgJson.scripts?.postinstall, undefined);
  assert.strictEqual(pkgJson.scripts?.preuninstall, undefined);
  console.log(
    "✓ Test 7A: package.json verified free of npm lifecycle scripts.",
  );

  // Test 7B: Fresh environment initialization test using mock mcp.json
  const freshMockDir = await fs.mkdtemp(path.join(os.tmpdir(), "fresh-init-"));
  const freshMcpFile = path.join(freshMockDir, "mcp.json");

  // Pre-seed with existing other server
  await fs.writeFile(
    freshMcpFile,
    JSON.stringify(
      {
        mcpServers: {
          "custom-tool": { command: "node", args: ["/bin/custom"] },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  // isInitialized should be false for freshMcpFile
  const initBefore = await isInitialized(freshMcpFile);
  assert.strictEqual(initBefore, false);

  // ensureInitialized should auto-initialize
  const dummyIndex = path.join(freshMockDir, "dist", "index.js");
  await fs.mkdir(path.dirname(dummyIndex), { recursive: true });
  await fs.writeFile(dummyIndex, "// index.js", "utf-8");

  const initResult = await ensureInitialized({
    silent: true,
    customConfigPath: freshMcpFile,
    customServerPath: dummyIndex,
  });
  assert.strictEqual(initResult.newlyInitialized, true);
  assert.strictEqual(initResult.mcpRegistered, true);

  // Read back freshMcpFile: ensure custom-tool is preserved and skills-manager is added
  const freshReadBack = JSON.parse(await fs.readFile(freshMcpFile, "utf-8"));
  assert.ok(freshReadBack.mcpServers["custom-tool"]);
  assert.ok(freshReadBack.mcpServers["skills-manager"]);
  assert.strictEqual(
    freshReadBack.mcpServers["skills-manager"].args[0],
    dummyIndex,
  );

  // Running ensureInitialized a second time should be idempotent (newlyInitialized: false)
  const secondInitResult = await ensureInitialized({
    silent: true,
    customConfigPath: freshMcpFile,
    customServerPath: dummyIndex,
  });
  assert.strictEqual(secondInitResult.newlyInitialized, false);
  assert.strictEqual(await isInitialized(freshMcpFile), true);

  await fs.rm(freshMockDir, { recursive: true, force: true }).catch(() => {});
  console.log(
    "✓ Test 7B: First-run auto-initialization, idempotency, and server preservation passed.",
  );

  // -------------------------------------------------------------
  // SKILL REMOVAL TESTS (REQUIREMENT #8)
  // -------------------------------------------------------------
  const removeTestDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "remove-test-ws-"),
  );
  const skill1Dir = path.join(
    removeTestDir,
    ".agents",
    "skills",
    "dummy-skill-1",
  );
  const skill2Dir = path.join(
    removeTestDir,
    ".agents",
    "skills",
    "dummy-skill-2",
  );
  await fs.mkdir(skill1Dir, { recursive: true });
  await fs.mkdir(skill2Dir, { recursive: true });

  // Record in tracker
  await Tracker.recordSkillInstallation(
    removeTestDir,
    "dummy-skill-1",
    "http://repo1",
    "skill",
  );
  await Tracker.recordSkillInstallation(
    removeTestDir,
    "dummy-skill-2",
    "http://repo2",
    "skill",
  );

  // Also record a bundle
  await Tracker.recordSkillInstallation(
    removeTestDir,
    "dummy-bundle",
    "http://bundle-repo",
    "bundle",
    ["dummy-skill-1"],
  );

  // Pre-seed skills.config.json
  const initialConfig = {
    skills: [
      { type: "skill", name: "dummy-skill-1", repository: "http://repo1" },
      { type: "skill", name: "dummy-skill-2", repository: "http://repo2" },
    ],
  };
  await fs.writeFile(
    path.join(removeTestDir, "skills.config.json"),
    JSON.stringify(initialConfig, null, 2),
    "utf-8",
  );

  // Test batch removal with removeFromConfig: true
  const removeReport = await SkillManager.removeSkills(
    ["dummy-skill-1", "dummy-skill-2", "non-existent-skill"],
    true,
    removeTestDir,
  );

  assert.strictEqual(removeReport.removed.length, 2);
  assert.strictEqual(removeReport.notFound.length, 1);
  assert.ok(removeReport.removed.includes("dummy-skill-1"));
  assert.ok(removeReport.removed.includes("dummy-skill-2"));

  // Assert folders are gone
  assert.strictEqual(
    await fs
      .stat(skill1Dir)
      .then(() => true)
      .catch(() => false),
    false,
  );
  assert.strictEqual(
    await fs
      .stat(skill2Dir)
      .then(() => true)
      .catch(() => false),
    false,
  );

  // Assert tracker updated
  const trackerAfterRemove = await Tracker.loadTracker(removeTestDir);
  assert.strictEqual(trackerAfterRemove.skills["dummy-skill-1"], undefined);
  assert.strictEqual(trackerAfterRemove.skills["dummy-skill-2"], undefined);

  // Assert skills.config.json updated
  const configAfterRemove = JSON.parse(
    await fs.readFile(path.join(removeTestDir, "skills.config.json"), "utf-8"),
  );
  assert.strictEqual(configAfterRemove.skills.length, 0);

  await fs.rm(removeTestDir, { recursive: true, force: true }).catch(() => {});
  console.log(
    "✓ Test 8: Batch skill removal, tracker cleanup, and config sync passed.",
  );

  // -------------------------------------------------------------
  // NODE.JS BACKWARD COMPATIBILITY TESTS
  // -------------------------------------------------------------

  // Test 9A: Node version check passes on the current (supported) runtime
  const versionCheck = checkNodeVersion();
  assert.strictEqual(versionCheck.ok, true);
  assert.strictEqual(versionCheck.message, undefined);
  console.log(
    `✓ Test 9A: Node version check passed (running v${process.versions.node}, minimum v${MIN_NODE_MAJOR_VERSION}).`,
  );

  // Test 9B: getModuleDir returns a valid absolute directory without URL-encoding artifacts
  const moduleDirResult = getModuleDir(import.meta.url);
  assert.strictEqual(path.isAbsolute(moduleDirResult), true);
  assert.ok(
    !moduleDirResult.includes("%20"),
    "Module dir must not contain URL-encoded characters",
  );
  assert.ok(
    !moduleDirResult.startsWith("/D:") && !moduleDirResult.startsWith("/C:"),
    "Module dir must not have a leading slash before the drive letter",
  );
  const moduleDirStat = await fs.stat(moduleDirResult);
  assert.strictEqual(moduleDirStat.isDirectory(), true);
  console.log(
    `✓ Test 9B: getModuleDir path decoding passed ('${moduleDirResult}').`,
  );

  // Test 9C: package.json engines field declares Node >= 20
  const pkgForEngines = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8"),
  );
  assert.ok(
    pkgForEngines.engines,
    "package.json must declare an engines field",
  );
  assert.ok(
    String(pkgForEngines.engines.node).includes(String(MIN_NODE_MAJOR_VERSION)),
    `engines.node must reference Node ${MIN_NODE_MAJOR_VERSION}`,
  );
  console.log(
    `✓ Test 9C: package.json engines field verified ('${pkgForEngines.engines.node}').`,
  );

  // Test 9D: fs.cp / fs.rm availability (required APIs, stable since Node 18/14.14)
  assert.strictEqual(typeof fs.cp, "function");
  assert.strictEqual(typeof fs.rm, "function");
  console.log("✓ Test 9D: Required fs APIs (cp, rm) are available.");

  // Restore env vars & cleanup temp dirs
  if (origEnvMcpWorkspace) process.env.MCP_WORKSPACE_DIR = origEnvMcpWorkspace;
  else delete process.env.MCP_WORKSPACE_DIR;

  if (origEnvAntigravityWorkspace)
    process.env.ANTIGRAVITY_WORKSPACE = origEnvAntigravityWorkspace;
  else delete process.env.ANTIGRAVITY_WORKSPACE;

  await fs.rm(mockProjectDir, { recursive: true, force: true }).catch(() => {});
  await fs.rm(tempEnvDir, { recursive: true, force: true }).catch(() => {});
  await fs
    .rm(tempExplicitDir, { recursive: true, force: true })
    .catch(() => {});
  await fs
    .rm(mockMcpConfigDir, { recursive: true, force: true })
    .catch(() => {});

  console.log("\nAll tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
