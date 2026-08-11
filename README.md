# Skills Manager MCP Server & CLI (`skills-manager-mcp`)

A production-ready CLI tool and Model Context Protocol (MCP) server for **Antigravity Desktop** and **VS Code** that acts as your personal AI development environment manager.

It features **zero-config automatic first-run initialization**, **workspace detection**, **headless skill & bundle installation**, **global skill caching**, **personal skill collection merging**, **schema version migrations**, and **health diagnostics**.

---

## Installation

**Requirements:** Node.js **20.0.0 or newer** (LTS recommended). The package declares `engines: { "node": ">=20.0.0" }` and performs a runtime version check at startup with a clear error message on unsupported versions.

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

_(or when Antigravity Desktop invokes any MCP tool)_, the tool automatically detects first-time usage and configures itself:

```text
Skills Manager MCP first-time setup detected...

✓ Global storage initialized: C:\Users\<username>\.ai-skills
✓ Skills cache ready: C:\Users\<username>\.ai-skills\cache
✓ Antigravity MCP registered: C:\Users\<username>\.gemini\antigravity-ide\mcp.json
✓ VS Code MCP registered: C:\Users\<username>\AppData\Roaming\Code\User\mcp.json
✓ Server executable path: C:\Users\<username>\AppData\Roaming\npm\node_modules\skills-manager-mcp\dist\index.js

Initialization complete.
```

Subsequent executions skip initialization instantly because all configurations are already verified and active!

---

## VS Code Integration

The MCP server is automatically registered in VS Code's user-level `mcp.json` during first-run initialization (or via `skills-manager-mcp setup`). Registration targets all installed editor variants:

- **Windows**: `%APPDATA%\Code\User\mcp.json`, `%APPDATA%\Code - Insiders\User\mcp.json`, `%APPDATA%\VSCodium\User\mcp.json`
- **macOS**: `~/Library/Application Support/<Editor>/User/mcp.json`
- **Linux**: `~/.config/<Editor>/User/mcp.json`

VS Code uses the `servers` top-level key (instead of Antigravity's `mcpServers`):

```json
{
  "servers": {
    "skills-manager": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\...\\skills-manager-mcp\\dist\\index.js"]
    }
  }
}
```

After registration, open the VS Code Command Palette → **MCP: List Servers** → start `skills-manager`, and the tools become available to Copilot Chat in agent mode.

---

## CLI Commands

### 1. `skills-manager-mcp status`

Displays the status dashboard (global config presence, cache statistics, Antigravity & VS Code MCP registration status, detected workspace, and installed skills). Triggers auto-initialization on first run.

### 2. `skills-manager-mcp doctor`

Runs diagnostic health checks on your installation, configuration, global cache, and MCP registration.

```bash
skills-manager-mcp doctor
```

_Example Output:_

```text
Skills Manager Doctor

✓ dist/index.js exists
✓ Antigravity configuration exists
✓ MCP path valid
✓ VS Code MCP registered
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

### 5. `skills-manager-mcp remove <skill1> [skill2]`

Removes one or an array of specified skills or bundles from the project workspace `.agents/skills`.

- Option `--from-config` also removes them from `skills.config.json` to prevent auto-reinstallation.

```bash
# Remove single skill
skills-manager-mcp remove find-skills

# Batch remove multiple skills & bundles
skills-manager-mcp remove find-skills frontend-design mattpocock-skills --from-config
```

### 6. `skills-manager-mcp setup`

Re-run setup & Antigravity/VS Code MCP registration manually anytime.

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

When running inside Antigravity Desktop or VS Code (Copilot Chat agent mode), the following MCP tools are available:

- `bootstrap_project`: Prepares active workspace with skills and bundles.
- `sync_skills`: Synchronizes workspace skills with personal collection.
- `install_skills`: Installs missing skills and bundles.
- `remove_skills`: Removes one or an array of specified skills/bundles from workspace.
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
