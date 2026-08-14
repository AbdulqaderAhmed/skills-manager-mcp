# Skills Manager MCP

**A production-grade Model Context Protocol (MCP) server and CLI tool for managing AI agent skills across VS Code, Claude, Antigravity Desktop, Cursor IDE, and Codex.**

[![npm version](https://img.shields.io/npm/v/skills-manager-mcp.svg)](https://www.npmjs.com/package/skills-manager-mcp)
[![node version](https://img.shields.io/node/v/skills-manager-mcp.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

## Overview

**Skills Manager MCP** provides intelligent, zero-configuration management of AI agent skills and bundles across your development environment. Whether you're working in VS Code with Copilot, Claude, Cursor IDE, Antigravity Desktop, or Codex, this tool automatically handles skill installation, caching, configuration merging, and version management.

### Key Features

- **🚀 Zero-Config Setup** — Automatic first-run initialization with platform-aware registration
- **🎯 Multi-Editor Support** — Unified MCP registration for VS Code, Claude, Cursor IDE, Antigravity Desktop, and Codex
- **📦 Smart Caching** — Global skill cache at `~/.ai-skills/cache/` eliminates redundant downloads
- **🔄 Config Merging** — Intelligently combines project-specific and personal global skill collections
- **🏗️ Workspace Detection** — Automatic project root discovery using multiple heuristics
- **📊 Metadata Tracking** — Maintains `.agents/skills-manager.json` with versioning and schema migrations
- **🔍 Health Diagnostics** — Built-in `doctor` command for troubleshooting
- **🛠️ Headless Installation** — Perfect for CI/CD pipelines and unattended environments
- **📝 Full API** — Comprehensive MCP tools for programmatic skill management

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Multi-Editor Integration](#multi-editor-integration)
  - [VS Code](#vs-code-integration)
  - [Claude](#claude-integration)
  - [Cursor IDE](#cursor-ide-integration)
  - [Codex](#codex-integration)
  - [Antigravity Desktop](#antigravity-desktop-integration)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
- [MCP Tools Reference](#mcp-tools-reference)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Support & License](#support--license)

---

## Requirements

- **Node.js**: 20.0.0 or newer (LTS recommended)
- **Operating System**: Windows, macOS, or Linux
- **Git**: Required for skill repository cloning

The package enforces Node.js version requirements at runtime with a clear error message if an older version is detected.

---

## Installation

### Global Installation (Recommended)

Install globally to use the CLI and MCP server across all projects:

```bash
npm install -g skills-manager-mcp
```

Or with pnpm:

```bash
pnpm add -g skills-manager-mcp
```

**Note:** No npm postinstall scripts are required. The tool performs all setup automatically on first use.

### Verification

Verify the installation:

```bash
skills-manager-mcp --version
skills-manager-mcp status
```

---

## Getting Started

### Automatic First-Run Setup

The tool automatically configures itself on first use:

```bash
skills-manager-mcp status
```

This single command:
1. Detects first-time installation
2. Creates global storage at `~/.ai-skills/`
3. Initializes the skill cache
4. Auto-registers with all detected editors (VS Code, Claude, Cursor IDE, etc.)
5. Displays initialization summary

**Sample Output:**

```
Skills Manager MCP first-time setup detected...

✓ Global storage initialized: ~/.ai-skills
✓ Skills cache ready: ~/.ai-skills/cache
✓ Antigravity MCP registered: ~/.gemini/antigravity-ide/mcp.json
✓ VS Code MCP registered: ~/.config/Code/User/mcp.json
✓ Cursor IDE MCP registered: ~/.config/Cursor/User/mcp.json
✓ Claude Code MCP registered: ~/.claude.json
✓ Codex MCP registered: ~/.config/Codex/User/mcp.json
✓ Server executable path: ~/.local/share/npm/node_modules/skills-manager-mcp/dist/index.js

Initialization complete.
```

Subsequent runs skip initialization instantly.

### Manual Setup

To re-run setup or register with additional editors:

```bash
skills-manager-mcp setup
```

---

## Multi-Editor Integration

### VS Code Integration

The MCP server automatically registers with all VS Code variants during initialization.

**Configuration:** `mcp.json` (automatically updated)

**Supported Variants:**
- VS Code (stable)
- VS Code Insiders
- VSCodium

**Paths by Platform:**
- **Windows**: `%APPDATA%\Code\User\mcp.json`
- **macOS**: `~/Library/Application Support/Code/User/mcp.json`
- **Linux**: `~/.config/Code/User/mcp.json`

**Configuration Format:**
```json
{
  "servers": {
    "skills-manager": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

**Usage in VS Code:**
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Search "MCP: List Servers"
3. Select and start `skills-manager`
4. Use skills in Copilot Chat agent mode

### Claude Integration

The MCP server automatically registers with Claude's primary configuration file.

**Configuration:** `~/.claude.json` (recommended by Claude)

**Alternative Locations (priority order):**
- `~/.claude/mcp_servers.json` — Dedicated MCP file
- `~/.claude/settings.json` — User-specific settings
- `.mcp.json` — Project-scoped (version-controlled, requires enablement)

**Configuration Format:**
```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/path/to/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

**Paths by Platform:**
- **All Platforms**: `~/.claude.json`
- **Windows Alternative**: `%USERPROFILE%\.claude.json`

For detailed setup instructions, see [CLAUDE_SETUP.md](CLAUDE_SETUP.md).

### Cursor IDE Integration

Cursor IDE uses the same configuration format as VS Code.

**Configuration:** `mcp.json` (automatically updated)

**Paths by Platform:**
- **Windows**: `%APPDATA%\Cursor\User\mcp.json`
- **macOS**: `~/Library/Application Support/Cursor/User/mcp.json`
- **Linux**: `~/.config/Cursor/User/mcp.json`

### Codex Integration

Codex uses the same configuration format as VS Code.

**Configuration:** `mcp.json` (automatically updated)

**Paths by Platform:**
- **Windows**: `%APPDATA%\Codex\User\mcp.json`
- **macOS**: `~/Library/Application Support/Codex/User/mcp.json`
- **Linux**: `~/.config/Codex/User/mcp.json`

### Antigravity Desktop Integration

Antigravity Desktop is the primary MCP target with specialized registration.

**Configuration Files:**
- `~/.gemini/config/mcp_config.json` — Primary
- `~/.gemini/antigravity-ide/mcp.json` — Secondary

**Configuration Format:**
```json
{
  "mcpServers": {
    "skills-manager": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

---

## CLI Commands

### `skills-manager-mcp status`

Displays a comprehensive status dashboard including configuration, cache statistics, MCP registration status across all editors, workspace detection, and installed skills.

**Usage:**
```bash
skills-manager-mcp status [projectPath]
```

**Output Includes:**
- Global configuration presence
- Cache skill count
- MCP registration status per editor
- Detected workspace and detection source
- List of installed skills in workspace

### `skills-manager-mcp doctor`

Runs comprehensive diagnostic health checks on installation, configuration, cache, and MCP registration.

**Usage:**
```bash
skills-manager-mcp doctor
```

**Checks Performed:**
- ✓ dist/index.js exists and is valid
- ✓ Antigravity configuration file
- ✓ MCP path validity and file existence
- ✓ VS Code MCP registration
- ✓ Claude MCP registration
- ✓ Cursor IDE MCP registration
- ✓ Codex MCP registration
- ✓ Global cache availability
- ✓ skills.config.json validity

**Sample Output:**
```
Skills Manager Doctor

✓ dist/index.js exists
✓ Antigravity configuration exists
✓ MCP path valid
✓ VS Code MCP registered
✓ Claude MCP registered
✓ Global cache available
✓ skills.config.json valid

Everything is healthy.
```

### `skills-manager-mcp bootstrap [projectPath]`

Initializes a project workspace for skill management.

**Usage:**
```bash
skills-manager-mcp bootstrap [projectPath]
```

**Operations:**
1. Detects or validates workspace root
2. Creates `.agents/skills/` directory structure
3. Loads and merges project and global skill configurations
4. Installs all configured skills (from cache or remote repository)
5. Creates `.agents/skills-manager.json` metadata tracker
6. Generates detailed installation report

**Output Example:**
```
Workspace: /path/to/project [Source: package.json]

Installed: 3
- find-skills
- frontend-design
- mattpocock-skills (bundle)

Skipped: 0
Failed: 0
```

### `skills-manager-mcp sync [projectPath]`

Synchronizes workspace skills with global personal collection.

**Usage:**
```bash
skills-manager-mcp sync [projectPath]
```

**Operations:**
- Fetches latest global skill configuration
- Re-downloads all configured skills (updates)
- Updates metadata and cache
- Validates installation integrity

**Use Case:** When you've updated `~/.ai-skills/skills.config.json` globally and want to apply changes across all projects.

### `skills-manager-mcp install [projectPath]`

Installs only missing skills, skipping already-installed ones.

**Usage:**
```bash
skills-manager-mcp install [projectPath]
```

**Useful for:**
- Adding new skills to an existing project
- Recovering from partial installations
- CI/CD pipelines requiring idempotent operations

### `skills-manager-mcp remove <skill1> [skill2] [...skillN]`

Removes specified skills from the project workspace.

**Usage:**
```bash
# Remove single skill
skills-manager-mcp remove find-skills

# Remove multiple skills
skills-manager-mcp remove find-skills frontend-design mattpocock-skills

# Remove from both filesystem and config (prevents re-installation)
skills-manager-mcp remove find-skills --from-config
skills-manager-mcp remove find-skills -c
```

**Options:**
- `--from-config`, `-c` — Also remove skill entries from `skills.config.json`

**Output Example:**
```
Removed: 1
- find-skills

Skipped: 0
Failed: 0
```

### `skills-manager-mcp setup`

Manually re-run setup and MCP registration for all editors.

**Usage:**
```bash
skills-manager-mcp setup
```

**Useful for:**
- Re-registering after editor installation
- Fixing MCP configuration issues
- Manual initialization on different platforms

---

## Configuration

### Global Skills Collection (`~/.ai-skills/skills.config.json`)

Manage your master skills collection globally:

```json
{
  "skills": [
    {
      "name": "find-skills",
      "repository": "https://github.com/vercel-labs/skills",
      "skill": "find-skills"
    },
    {
      "name": "frontend-design",
      "repository": "https://github.com/anthropics/skills",
      "skill": "frontend-design"
    },
    {
      "type": "bundle",
      "name": "mattpocock-skills",
      "repository": "https://github.com/mattpocock/skills"
    }
  ]
}
```

### Project-Specific Configuration (`./skills.config.json`)

Override or extend global configuration per project:

```json
{
  "skills": [
    {
      "name": "tdd",
      "repository": "https://github.com/custom/skills",
      "skill": "tdd"
    }
  ]
}
```

**Merge Behavior:** Project skills with matching `name` override global skills.

### Configuration Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Unique skill identifier (alphanumeric, hyphens, underscores) |
| `repository` | string | ✓ | Git HTTPS repository URL containing skill(s) |
| `skill` | string | | Folder name in repository; defaults to `name` |
| `type` | string | | `'skill'` (default) or `'bundle'` |

### Metadata Tracker (`.agents/skills-manager.json`)

Automatically maintained project metadata:

```json
{
  "version": "1.6.0",
  "updatedAt": "2026-08-14",
  "migrations": {
    "1.0": "completed",
    "1.6.0": "completed"
  },
  "skills": {
    "find-skills": {
      "type": "skill",
      "source": "https://github.com/vercel-labs/skills",
      "installedAt": "2026-08-14",
      "version": "latest"
    }
  }
}
```

---

## MCP Tools Reference

When running within VS Code (Copilot Chat agent mode), Claude, or Antigravity Desktop, the following MCP tools are available:

| Tool | Purpose |
|------|---------|
| `get_workspace_info` | Diagnose workspace detection and configuration |
| `bootstrap_project` | Initialize project with skills |
| `sync_skills` | Update skills from global collection |
| `install_skills` | Install missing skills only |
| `remove_skills` | Remove skills from project |
| `list_installed_skills` | Audit current installation |
| `check_missing_skills` | Validate skill completeness |

---

## Architecture

### Directory Structure

```
~/.ai-skills/
├── skills.config.json          # Global skill collection
├── config.json                 # Workspace detection settings
└── cache/
    ├── find-skills/
    └── mattpocock-skills/

<project>/
├── .agents/
│   ├── skills/                 # Installed skills
│   └── skills-manager.json     # Installation metadata
└── skills.config.json          # Project config (optional)
```

### Design Patterns

- **Layered Architecture** — Clear separation between CLI, orchestration, services, and utilities
- **Idempotent Operations** — All commands are safe to run multiple times
- **Lazy Initialization** — Zero-config setup on first use
- **Configuration Merging** — Smart override semantics for project + global configs
- **Schema Versioning** — Automatic metadata migrations for forward compatibility

---

## Troubleshooting

### MCP Server Not Connecting

**Symptom:** Editor doesn't recognize the MCP server.

**Solution:**
1. Run diagnostics:
   ```bash
   skills-manager-mcp doctor
   ```
2. Re-run setup:
   ```bash
   skills-manager-mcp setup
   ```
3. Restart the editor
4. Check file permissions on MCP config files

### Skills Installation Fails

**Symptom:** Error during `bootstrap` or `install`.

**Solution:**
1. Verify workspace detection:
   ```bash
   skills-manager-mcp status
   ```
2. Check network connectivity (repositories must be accessible)
3. Validate `skills.config.json` JSON syntax
4. Ensure repository URLs use HTTPS
5. Review `doctor` output for configuration issues

### Workspace Not Detected

**Symptom:** `status` shows incorrect or no workspace.

**Solution:**
1. Run with explicit path:
   ```bash
   skills-manager-mcp bootstrap /path/to/project
   ```
2. Ensure project contains a marker file: `package.json`, `.git`, `pnpm-lock.yaml`, etc.
3. Check `~/.ai-skills/config.json` for custom detection settings

### Cache Issues

**Symptom:** Skill installation is slow or cached versions are stale.

**Solution:**
1. Clear cache manually:
   ```bash
   rm -rf ~/.ai-skills/cache
   ```
2. Rebuild cache:
   ```bash
   skills-manager-mcp sync
   ```

---

## Development

### Prerequisites

- Node.js 20.0.0+
- pnpm (or npm)
- TypeScript

### Setup & Build

```bash
git clone https://github.com/your-org/skills-manager-mcp.git
cd skills-manager-mcp
pnpm install
pnpm run build
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

### Project Structure

```
src/
├── cli.ts                  # CLI entry point
├── index.ts               # MCP server entry point
├── skillManager.ts        # Core orchestration
├── commands/              # CLI command handlers
└── services/              # Platform-specific services
    ├── antigravityRegistry.ts
    ├── vscodeRegistry.ts
    ├── claudeCodeRegistry.ts
    ├── cursorRegistry.ts
    └── codexRegistry.ts
```

---

## Support & License

### Documentation

- [Claude Setup Guide](CLAUDE_SETUP.md) — Detailed Claude integration instructions
- [Configuration Reference](#configuration) — Skills config schema
- [Architecture Overview](#architecture) — System design and data flow

### Issues & Feedback

Report issues on [GitHub Issues](https://github.com/your-org/skills-manager-mcp/issues).

### License

**MIT License** — Copyright © 2024-2026. See [LICENSE](LICENSE) for details.

### Security & Privacy

- **No telemetry** — Your usage remains private
- **Local-only operation** — All processing happens on your machine
- **No automatic updates** — Manual npm updates only
- **Unencrypted configs** — Treat `~/.ai-skills/` like sensitive configuration

---

**Questions?** Consult the [CLAUDE_SETUP.md](CLAUDE_SETUP.md) guide or open an issue on GitHub.
