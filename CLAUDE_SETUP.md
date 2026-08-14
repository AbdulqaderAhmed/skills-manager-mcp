# Claude MCP Configuration Guide

This guide explains how to set up and use `skills-manager-mcp` with Claude.

## Overview

Claude supports Model Context Protocol (MCP) servers to extend its capabilities. The `skills-manager-mcp` server provides Claude with access to AI agent skills and bundles, automatically managing skill installation and organization across your projects.

## Configuration Files & Locations

Claude stores MCP configuration in multiple locations with a clear priority order:

| Location                      | Purpose                                               | Priority |
| ----------------------------- | ----------------------------------------------------- | -------- |
| `~/.claude.json`              | Main Claude configuration (recommended)               | 1st      |
| `~/.claude/mcp_servers.json`  | Dedicated MCP servers file                            | 2nd      |
| `~/.claude/settings.json`     | User-specific global settings                         | 3rd      |
| `.claude/settings.local.json` | Project-specific local settings                       | Project  |
| `.mcp.json`                   | Project-scoped MCP configuration (version-controlled) | Project  |

## Automatic Setup (Recommended)

When you install `skills-manager-mcp` globally and run any command, the first-run initialization automatically registers with Claude:

```bash
npm install -g skills-manager-mcp
skills-manager-mcp setup
```

_Output:_

```
Skills Manager MCP Setup

✓ Operating system detected: Windows (win32)
✓ Global directory created: C:\Users\<username>\.ai-skills
✓ Global cache directory verified: C:\Users\<username>\.ai-skills\cache
✓ Created default global skills collection: C:\Users\<username>\.ai-skills\skills.config.json
✓ Antigravity MCP registered: C:\Users\<username>\.gemini\config\mcp_config.json
✓ VS Code MCP registered: C:\Users\<username>\AppData\Roaming\Code\User\mcp.json
✓ Claude Code MCP registered: C:\Users\<username>\.claude.json
✓ Cursor IDE MCP registered: C:\Users\<username>\AppData\Roaming\Cursor\User\mcp.json
✓ Codex MCP registered: C:\Users\<username>\AppData\Roaming\Codex\User\mcp.json

Setup completed successfully!
```

The registration creates the following configuration in `~/.claude.json`:

```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

## Manual Configuration

If you prefer to configure Claude manually, add the `skills-manager` entry to your Claude configuration:

### Option 1: Global Configuration (`~/.claude.json`)

```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": [
        "C:\\Users\\<username>\\AppData\\Roaming\\npm\\node_modules\\skills-manager-mcp\\dist\\index.js"
      ]
    }
  }
}
```

**On macOS/Linux:**

```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

### Option 2: Project-Scoped Configuration (`.mcp.json`)

Create a `.mcp.json` file in your project root:

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

Then enable project MCP servers in `.claude/settings.json`:

```json
{
  "enableAllProjectMcpServers": true
}
```

Or whitelist specific servers:

```json
{
  "enabledMcpjsonServers": ["skills-manager"]
}
```

## Verifying Configuration

Check if `skills-manager-mcp` is correctly registered:

```bash
skills-manager-mcp doctor
```

Look for the "Claude Code MCP registered" check to confirm:

```
✓ Claude Code MCP registered
  ~/.claude.json
```

Also verify with the status command:

```bash
skills-manager-mcp status
```

Expected output:

```
Claude Code:
✓ MCP registered
```

## Using with Claude

Once configured:

1. **Start Claude** with your project open
2. **Claude will automatically load** the skills-manager MCP server
3. **Use Claude's chat** to interact with skills:
   - "Bootstrap my project with skills"
   - "What skills are installed?"
   - "Install the code-review skill"
   - "Sync my skills with the global collection"

## Available Tools

`skills-manager-mcp` exposes these tools to Claude:

| Tool                    | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `get_workspace_info`    | Detects project workspace and configuration                               |
| `bootstrap_project`     | Initializes project: creates `.agents/skills`, installs configured skills |
| `sync_skills`           | Re-downloads all configured skills (updates)                              |
| `install_skills`        | Installs only missing skills                                              |
| `list_installed_skills` | Lists currently installed skills with metadata                            |
| `check_missing_skills`  | Audits which configured skills are missing                                |
| `remove_skills`         | Removes specified skills from project                                     |

## Configuration Structure

### skills.config.json

Both global (`~/.ai-skills/skills.config.json`) and project-scoped (`./skills.config.json`) configs use:

```json
{
  "skills": [
    {
      "name": "code-review",
      "repository": "https://github.com/user/skills",
      "skill": "code-review"
    },
    {
      "type": "bundle",
      "name": "mattpocock-skills",
      "repository": "https://github.com/mattpocock/skills"
    }
  ]
}
```

**Fields:**

- `name` (required): Unique skill identifier
- `repository` (required): Git HTTPS repository URL
- `skill` (optional): Folder name in repo; defaults to `name` if omitted
- `type` (optional): `'skill'` or `'bundle'`; defaults to `'skill'`

## Troubleshooting

### MCP server not connecting

1. **Verify installation:**

   ```bash
   skills-manager-mcp status
   ```

2. **Re-run setup:**

   ```bash
   skills-manager-mcp setup
   ```

3. **Check configuration:**
   - Ensure `~/.claude.json` exists and contains the `skills-manager` entry
   - Verify the path to `dist/index.js` is correct

4. **Restart Claude** after changes

### Skills not installing

1. Check workspace detection:

   ```bash
   skills-manager-mcp status
   ```

2. Run diagnostics:

   ```bash
   skills-manager-mcp doctor
   ```

3. Verify `skills.config.json` syntax:
   - Use valid JSON
   - Ensure repositories are accessible (HTTPS, public or authenticated)

## Platform Paths

**macOS:**

- Config: `~/.claude.json`
- Cache: `~/.ai-skills/cache/`

**Linux:**

- Config: `~/.claude.json`
- Cache: `~/.ai-skills/cache/`

**Windows:**

- Config: `%USERPROFILE%\.claude.json`
- Cache: `%USERPROFILE%\.ai-skills\cache\`

## More Information

- [Skills Manager MCP Documentation](README.md)
- [CLI Commands](README.md#cli-commands)
- [Configuration Architecture](README.md#configuration)
