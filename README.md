# Skills Manager MCP Server & CLI (`skills-manager-mcp`)

A production-ready CLI tool and Model Context Protocol (MCP) server for **Antigravity Desktop** that acts as your personal AI development environment manager.

It features **zero-config automatic first-run initialization**, **workspace detection**, **headless skill & bundle installation**, **global skill caching**, **personal skill collection merging**, **schema version migrations**, and **health diagnostics**.

---

## Installation

Install globally using standard `npm` or `pnpm` (no extra security flags or install script approvals required):

```bash
npm install -g skills-manager-mcp
```

---

## Automatic First-Run Initialization

`skills-manager-mcp` **does not rely on npm postinstall lifecycle scripts** (which npm security policies often block).

Instead, the very first time you run any command:

```bash
skills-manager-mcp status
```

*(or when Antigravity Desktop invokes any MCP tool)*, the tool automatically detects first-time usage and configures itself:

```text
Skills Manager MCP first-time setup detected...

✓ Global storage initialized: C:\Users\<username>\.ai-skills
✓ Skills cache ready: C:\Users\<username>\.ai-skills\cache
✓ Antigravity MCP registered: C:\Users\<username>\.gemini\antigravity-ide\mcp.json
✓ Server executable path: C:\Users\<username>\AppData\Roaming\npm\node_modules\skills-manager-mcp\dist\index.js

Initialization complete.
```

Subsequent executions skip initialization instantly because all configurations are already verified and active!

---

## CLI Commands

### 1. `skills-manager-mcp status`
Displays the status dashboard (global config presence, cache statistics, Antigravity MCP registration status, detected workspace, and installed skills). Triggers auto-initialization on first run.

### 2. `skills-manager-mcp doctor`
Runs diagnostic health checks on your installation, configuration, global cache, and MCP registration.

```bash
skills-manager-mcp doctor
```

*Example Output:*
```text
Skills Manager Doctor

✓ dist/index.js exists
✓ Antigravity configuration exists
✓ MCP path valid
✓ Global cache available
✓ skills.config.json valid

Everything is healthy.
```

### 3. `skills-manager-mcp bootstrap`
Prepares the current project workspace automatically.
- Detects active workspace
- Creates `.agents/skills/`
- Merges personal (`~/.ai-skills/skills.config.json`) and project skills
- Installs skills/bundles headlessly from global cache or remote Git repositories
- Updates version metadata tracker (`.agents/skills-manager.json`)

### 4. `skills-manager-mcp sync`
Synchronizes current workspace skills with your global personal collection (`~/.ai-skills/skills.config.json`).

### 5. `skills-manager-mcp setup`
Re-run setup & Antigravity MCP registration manually anytime.

---

## Configuration (`~/.ai-skills/skills.config.json`)

You can manage your master list of skills and bundles globally at `C:\Users\<username>\.ai-skills\skills.config.json`:

```json
{
  "skills": [
    {
      "type": "skill",
      "name": "find-skills",
      "repository": "https://github.com/vercel-labs/skills",
      "skill": "find-skills"
    },
    {
      "type": "skill",
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

---

## MCP Server Tools Reference

When running inside Antigravity Desktop, the following MCP tools are available:

- `bootstrap_project`: Prepares active workspace with skills and bundles.
- `sync_skills`: Synchronizes workspace skills with personal collection.
- `install_skills`: Installs missing skills and bundles.
- `list_installed_skills`: Lists installed skills and bundle details.
- `check_missing_skills`: Checks status of skills/bundles.
- `get_workspace_info`: Debugging tool for inspecting workspace resolution.

---

## Development & Testing Commands

```bash
# Install dependencies
pnpm install

# Run unit tests
pnpm test

# Compile TypeScript (generates dist/index.js and dist/cli.js)
pnpm run build

# Create npm distribution tarball
npm pack

# Link locally for testing
npm link
```
