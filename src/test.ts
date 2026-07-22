import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  isValidRepositoryUrl,
  isValidSkillName,
  discoverSkillFolders,
} from './installer.js';
import { loadSkillsConfig } from './config.js';
import { CacheManager } from './cacheManager.js';
import {
  detectWorkspace,
  getMcpServerDirectory,
  isServerDirectory,
  findProjectRoot,
} from './workspace.js';
import {
  registerAntigravityMcp,
  unregisterAntigravityMcp,
  getAntigravityMcpConfigPath,
  getMcpServerIndexPath,
} from './services/antigravityRegistry.js';
import { performDoctorChecks } from './commands/doctor.js';
import { Tracker } from './tracker.js';
import { isInitialized, ensureInitialized } from './services/initializer.js';

async function runTests() {
  console.log('Running skills-manager-mcp test suite...\n');

  // Test 1: URL and Skill Name Validation
  assert.strictEqual(isValidRepositoryUrl('https://github.com/vercel-labs/skills'), true);
  assert.strictEqual(isValidRepositoryUrl('http://github.com/mattpocock/skills'), true);
  assert.strictEqual(isValidRepositoryUrl('invalid-url'), false);

  assert.strictEqual(isValidSkillName('find-skills'), true);
  assert.strictEqual(isValidSkillName('mattpocock-skills'), true);
  assert.strictEqual(isValidSkillName('invalid skill name!'), false);
  console.log('✓ Test 1: URL and identifier validation passed.');

  // Test 2: Backward Compatible Config Loading
  const config = await loadSkillsConfig(process.cwd());
  assert.ok(Array.isArray(config.skills));
  assert.ok(config.skills.length > 0);
  assert.ok(config.skills[0].type === 'skill' || config.skills[0].type === 'bundle');
  console.log('✓ Test 2: Backward compatible config loading passed.');

  // Test 3: Global Cache Directory Pathing
  const cacheDir = CacheManager.getGlobalCacheDir();
  assert.ok(cacheDir.includes('.ai-skills'));
  console.log(`✓ Test 3: Global cache directory path verified ('${cacheDir}').`);

  // Test 4: Recursive Bundle Skill Discovery
  const tempTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-bundle-'));
  const nestedSkillDir = path.join(tempTestDir, 'engineering', 'test-skill');
  const agentsSubDir = path.join(nestedSkillDir, 'agents');

  await fs.mkdir(agentsSubDir, { recursive: true });
  await fs.writeFile(path.join(nestedSkillDir, 'SKILL.md'), '# Test Skill', 'utf-8');
  await fs.writeFile(path.join(agentsSubDir, 'openai.yaml'), 'model: gpt-4', 'utf-8');

  const duplicateSkillDir = path.join(tempTestDir, 'productivity', 'test-skill');
  await fs.mkdir(duplicateSkillDir, { recursive: true });
  await fs.writeFile(path.join(duplicateSkillDir, 'SKILL.md'), '# Duplicate Skill', 'utf-8');

  const logs: string[] = [];
  const discovered = await discoverSkillFolders(tempTestDir, logs);

  assert.strictEqual(discovered.has('test-skill'), true);
  assert.strictEqual(discovered.get('test-skill'), nestedSkillDir);
  assert.strictEqual(discovered.size, 1);
  assert.ok(logs.some((l) => l.includes('Duplicate skill name')));

  await fs.rm(tempTestDir, { recursive: true, force: true }).catch(() => {});
  console.log('✓ Test 4: Nested bundle discovery with SKILL.md and duplicate handling passed.');

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
    assert.fail('Expected detectWorkspace to throw protection error when in server directory');
  } catch (err: any) {
    const msg = err.message.toLowerCase();
    assert.ok(msg.includes('no active project workspace') || msg.includes('blocked'));
  }

  try {
    await detectWorkspace(serverDir);
    assert.fail('Expected detectWorkspace to block explicit server directory providedPath');
  } catch (err: any) {
    assert.ok(err.message.toLowerCase().includes('blocked'));
  }

  console.log('✓ Case 1: Server directory protection test passed.');

  // Case 2: Subdirectory Parent Search
  const mockProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-next-app-'));
  const mockSrcSubDir = path.join(mockProjectDir, 'src', 'components');
  await fs.mkdir(mockSrcSubDir, { recursive: true });
  await fs.writeFile(path.join(mockProjectDir, 'package.json'), JSON.stringify({ name: 'my-next-app' }), 'utf-8');

  const resolvedProjectRoot = await findProjectRoot(mockSrcSubDir);
  assert.strictEqual(resolvedProjectRoot, mockProjectDir);
  console.log('✓ Case 2: Subdirectory parent search test passed.');

  // Case 3: Environment Workspace variable (MCP_WORKSPACE_DIR)
  const tempEnvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-project-'));
  process.env.MCP_WORKSPACE_DIR = tempEnvDir;

  const envWsResult = await detectWorkspace();
  assert.strictEqual(envWsResult.workspacePath, tempEnvDir);
  assert.strictEqual(envWsResult.source, 'environment');
  console.log('✓ Case 3: MCP_WORKSPACE_DIR environment variable resolution test passed.');

  // Case 4: Explicit projectPath provided
  const tempExplicitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'explicit-project-'));
  const explicitWsResult = await detectWorkspace(tempExplicitDir);

  assert.strictEqual(explicitWsResult.workspacePath, tempExplicitDir);
  assert.strictEqual(explicitWsResult.source, 'argument');
  console.log('✓ Case 4: Explicit projectPath highest priority test passed.');

  // -------------------------------------------------------------
  // REGISTRATION & UNINSTALLATION TESTS
  // -------------------------------------------------------------

  // Test 5A: Dynamic Server Index Path Resolution
  const indexPath = getMcpServerIndexPath();
  assert.ok(indexPath.endsWith(path.join('dist', 'index.js')));
  assert.strictEqual(path.isAbsolute(indexPath), true);

  // Test 5B: Registration in fresh & existing mcp.json with server preservation
  const mockMcpConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mock-mcp-config-'));
  const mockMcpFile = path.join(mockMcpConfigDir, 'mcp.json');

  const existingConfig = {
    mcpServers: {
      "other-server": {
        command: "node",
        args: ["/path/to/other.js"]
      }
    }
  };
  await fs.writeFile(mockMcpFile, JSON.stringify(existingConfig, null, 2), 'utf-8');

  const mockCustomServer = path.join(mockMcpConfigDir, 'dist', 'index.js');
  await registerAntigravityMcp(mockCustomServer, mockMcpFile);

  const readBack = JSON.parse(await fs.readFile(mockMcpFile, 'utf-8'));
  assert.ok(readBack.mcpServers['other-server']);
  assert.strictEqual(readBack.mcpServers['other-server'].args[0], '/path/to/other.js');
  assert.ok(readBack.mcpServers['skills-manager']);
  assert.strictEqual(readBack.mcpServers['skills-manager'].command, 'node');
  assert.strictEqual(readBack.mcpServers['skills-manager'].args[0], mockCustomServer);

  // Test 5C: Idempotence (running registration twice)
  await registerAntigravityMcp(mockCustomServer, mockMcpFile);
  const readBackTwice = JSON.parse(await fs.readFile(mockMcpFile, 'utf-8'));
  assert.strictEqual(Object.keys(readBackTwice.mcpServers).length, 2);

  // Test 5D: Uninstallation removal of skills-manager while keeping other servers
  await unregisterAntigravityMcp(mockMcpFile);
  const readBackUninstalled = JSON.parse(await fs.readFile(mockMcpFile, 'utf-8'));
  assert.ok(readBackUninstalled.mcpServers['other-server']);
  assert.strictEqual(readBackUninstalled.mcpServers['skills-manager'], undefined);

  // Test 5E: Live Environment Registration test
  const liveReg = await registerAntigravityMcp();
  assert.strictEqual(liveReg.registered, true);

  console.log('✓ Test 5: Registration, preservation, idempotence, path generation, and uninstallation passed.');

  // -------------------------------------------------------------
  // DOCTOR & TRACKER VERSION MIGRATION TESTS
  // -------------------------------------------------------------

  // Test 6A: Doctor Health Checks
  const doctorChecks = await performDoctorChecks();
  assert.ok(Array.isArray(doctorChecks));
  assert.ok(doctorChecks.length >= 5);
  console.log('✓ Test 6A: Doctor health checks execution passed.');

  // Test 6B: Tracker Schema Migration Test (1.0 -> 1.4.0)
  const legacyTrackerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-tracker-'));
  const legacyTrackerFile = path.join(legacyTrackerDir, '.agents', 'skills-manager.json');
  await fs.mkdir(path.dirname(legacyTrackerFile), { recursive: true });

  const legacyData = {
    version: '1.0',
    updatedAt: '2026-01-01',
    skills: {
      'find-skills': {
        type: 'skill',
        source: 'https://github.com/vercel-labs/skills',
        installedAt: '2026-01-01',
        version: 'latest'
      }
    }
  };
  await fs.writeFile(legacyTrackerFile, JSON.stringify(legacyData, null, 2), 'utf-8');

  const loadedTracker = await Tracker.loadTracker(legacyTrackerDir);
  assert.strictEqual(loadedTracker.version, '1.5.0');
  assert.ok(loadedTracker.migrations);
  assert.strictEqual(loadedTracker.migrations['1.0'], 'completed');
  assert.strictEqual(loadedTracker.migrations['1.5.0'], 'completed');

  await fs.rm(legacyTrackerDir, { recursive: true, force: true }).catch(() => {});
  console.log('✓ Test 6B: Tracker schema migration test (1.0 -> 1.5.0) passed.');

  // -------------------------------------------------------------
  // FIRST-RUN AUTOMATIC INITIALIZATION TESTS (REQUIREMENT #6)
  // -------------------------------------------------------------

  // Test 7A: Verify package.json contains NO postinstall or preuninstall scripts
  const pkgContent = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8');
  const pkgJson = JSON.parse(pkgContent);
  assert.strictEqual(pkgJson.scripts?.postinstall, undefined);
  assert.strictEqual(pkgJson.scripts?.preuninstall, undefined);
  console.log('✓ Test 7A: package.json verified free of npm lifecycle scripts.');

  // Test 7B: Fresh environment initialization test using mock mcp.json
  const freshMockDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fresh-init-'));
  const freshMcpFile = path.join(freshMockDir, 'mcp.json');

  // Pre-seed with existing other server
  await fs.writeFile(freshMcpFile, JSON.stringify({ mcpServers: { "custom-tool": { command: "node", args: ["/bin/custom"] } } }, null, 2), 'utf-8');

  // isInitialized should be false for freshMcpFile
  const initBefore = await isInitialized(freshMcpFile);
  assert.strictEqual(initBefore, false);

  // ensureInitialized should auto-initialize
  const dummyIndex = path.join(freshMockDir, 'dist', 'index.js');
  await fs.mkdir(path.dirname(dummyIndex), { recursive: true });
  await fs.writeFile(dummyIndex, '// index.js', 'utf-8');

  const initResult = await ensureInitialized({
    silent: true,
    customConfigPath: freshMcpFile,
    customServerPath: dummyIndex
  });
  assert.strictEqual(initResult.newlyInitialized, true);
  assert.strictEqual(initResult.mcpRegistered, true);

  // Read back freshMcpFile: ensure custom-tool is preserved and skills-manager is added
  const freshReadBack = JSON.parse(await fs.readFile(freshMcpFile, 'utf-8'));
  assert.ok(freshReadBack.mcpServers['custom-tool']);
  assert.ok(freshReadBack.mcpServers['skills-manager']);
  assert.strictEqual(freshReadBack.mcpServers['skills-manager'].args[0], dummyIndex);

  // Running ensureInitialized a second time should be idempotent (newlyInitialized: false)
  const secondInitResult = await ensureInitialized({
    silent: true,
    customConfigPath: freshMcpFile,
    customServerPath: dummyIndex
  });
  assert.strictEqual(secondInitResult.newlyInitialized, false);
  assert.strictEqual(await isInitialized(freshMcpFile), true);

  await fs.rm(freshMockDir, { recursive: true, force: true }).catch(() => {});
  console.log('✓ Test 7B: First-run auto-initialization, idempotency, and server preservation passed.');

  // Restore env vars & cleanup temp dirs
  if (origEnvMcpWorkspace) process.env.MCP_WORKSPACE_DIR = origEnvMcpWorkspace;
  else delete process.env.MCP_WORKSPACE_DIR;

  if (origEnvAntigravityWorkspace) process.env.ANTIGRAVITY_WORKSPACE = origEnvAntigravityWorkspace;
  else delete process.env.ANTIGRAVITY_WORKSPACE;

  await fs.rm(mockProjectDir, { recursive: true, force: true }).catch(() => {});
  await fs.rm(tempEnvDir, { recursive: true, force: true }).catch(() => {});
  await fs.rm(tempExplicitDir, { recursive: true, force: true }).catch(() => {});
  await fs.rm(mockMcpConfigDir, { recursive: true, force: true }).catch(() => {});

  console.log('\nAll tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
