# Changelog

All notable changes to the `skills-manager-mcp` project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-07-23

### Added
- **Skill & Bundle Removal System (`remove_skills`)**: Added ability to remove single or multiple skills/bundles at once from project workspace `.agents/skills`.
- **New MCP Tool (`remove_skills`)**: Accepts an array of skill or bundle names and removes their directory, tracker metadata, and optionally removes them from project `skills.config.json`.
- **New CLI Command (`skills-manager-mcp remove`)**: Added `skills-manager-mcp remove <skill1> [skill2] [--from-config]`.
- **Bundle Teardown**: Automatically cleans up all nested sub-skills associated with a bundle when the bundle name is specified for removal.

---

## [1.5.2] - 2026-07-22

### Fixed
- **Multi-Path Antigravity Registration**: Registration engine now writes entries into **both** `~/.gemini/config/mcp_config.json` and `~/.gemini/antigravity-ide/mcp.json` to guarantee Antigravity Desktop UI lists `skills-manager` immediately under MCP Servers settings.

---

## [1.5.1] - 2026-07-22

### Changed
- **Repository & Metadata**: Updated repository links to `https://github.com/AbdulqaderAhmed/skills-manager-mcp.git`.
- **Version Release Bump**: Bumped version to `1.5.1` for npm publishing.

---

## [1.5.0] - 2026-07-22

### Added
- **Automatic First-Run Initialization Guard**: Added `src/services/initializer.ts` with `isInitialized()` and `ensureInitialized()`.
- Automatically executes environment setup and Antigravity MCP registration on first CLI command execution or stdio MCP server startup.
- Added Test 7A and 7B to test suite verifying lifecycle script absence, initialization guard, idempotency, and server preservation.

### Changed
- **Removed npm Lifecycle Scripts**: Removed `"postinstall"` and `"preuninstall"` scripts from `package.json` to avoid npm security policy blocks (`--allow-scripts`).
- **Clean Installation**: `npm install -g skills-manager-mcp` now completes with zero install script warnings or security policy prompts.
- **Refactored CLI Routing**: `src/cli.ts` executes `ensureInitialized()` before commands (`status`, `bootstrap`, `sync`), bypassing auto-initialization for diagnostic commands (`setup`, `doctor`, `help`).
- **Refactored MCP Server Entry**: `src/index.ts` calls `ensureInitialized({ silent: true })` prior to connecting stdio server transport.

---

## [1.4.0] - 2026-07-22

### Added
- **Production CLI Architecture**: Added executable CLI binary (`bin` entry point `./dist/cli.js`).
- **CLI Commands**:
  - `skills-manager-mcp doctor`: Complete diagnostic health check for installation, config, global cache, and MCP registration.
  - `skills-manager-mcp setup`: Manual setup & Antigravity MCP registration command.
  - `skills-manager-mcp status`: Workspace & cache status dashboard.
  - `skills-manager-mcp bootstrap`: Project workspace bootstrapping command.
  - `skills-manager-mcp sync`: Personal skill collection sync command.
- **Schema Migration Engine**: Added automatic version migration support in `.agents/skills-manager.json` tracking files.
- **npm Packaging Metadata**: Added `files`, `keywords`, and `repository` fields in `package.json` for npm publishing.

---

## [1.3.0] - 2026-07-22

### Added
- **Strict Server Directory Protection**: Hard blocking in `src/workspace.ts` preventing skills from ever being installed into the `skills-manager-mcp` package directory itself.
- **AI Agent Tool Guidance**: Updated MCP tool parameter descriptions in `src/server.ts` instructing AI client models to pass the active workspace directory path.

---

## [1.2.0] - 2026-07-22

### Added
- **Recursive Skill Bundle Discovery**: Extended installer to recursively discover nested `SKILL.md` folders inside skill bundles (e.g. `bundle/category/skill-name/SKILL.md`).
- **Duplicate Skill Name Handling**: Preserves first discovered skill and logs duplicate warnings without crashing.

---

## [1.1.0] - 2026-07-22

### Added
- **Headless Programmatic Installer**: Replaced interactive `npx skills add` with non-interactive git cloning (`GIT_TERMINAL_PROMPT=0`).
- **Global Skill Cache**: Introduced global cache storage at `C:\Users\<username>\.ai-skills\cache\`.
- **Personal Collection Merger**: Added support for personal global skills config (`~/.ai-skills/skills.config.json`).

---

## [1.0.0] - 2026-07-22

### Added
- Initial release of `skills-manager-mcp` Model Context Protocol (MCP) server supporting `bootstrap_project`, `sync_skills`, `install_skills`, `list_installed_skills`, `check_missing_skills`, and `get_workspace_info`.
