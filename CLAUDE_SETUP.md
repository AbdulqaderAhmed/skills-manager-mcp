# Claude MCP Configuration Guide

This guide explains how to set up and use `skills-manager-mcp` with **Claude Desktop** (the GUI application) and **Claude Code** (the terminal CLI agent).

## Overview

Claude supports Model Context Protocol (MCP) servers to extend its capabilities. The `skills-manager-mcp` server provides Claude with access to AI agent skills and bundles, automatically managing skill installation and organization across your projects.

> **Important:** Claude Desktop and Claude Code use **different** configuration files. Make sure you configure the right one for the tool you're using.

## Quick Comparison

| Feature | Claude Desktop (GUI App) | Claude Code (Terminal CLI) |
| --- | --- | --- |
| **Config File** | `claude_desktop_config.json` | `~/.claude.json` |
| **JSON Key** | `mcpServers` | `mcpServers` |
| **Windows Path** | `%APPDATA%\Claude\claude_desktop_config.json` | `%USERPROFILE%\.claude.json` |
| **macOS Path** | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.claude.json` |
| **Linux Path** | `~/.config/Claude/claude_desktop_config.json` | `~/.claude.json` |
| **Project-level** | No | Yes (`.mcp.json` in project root) |

---

## Automatic Setup (Recommended)

When you install `skills-manager-mcp` globally and run the setup command, it automatically registers with **both** Claude Desktop and Claude Code:

```bash
npm install -g skills-manager-mcp
skills-manager-mcp setup
```

**Output:**
```
Skills Manager MCP Setup

✓ Operating system detected: Windows (win32)
✓ Global directory created: C:\Users\<username>\.ai-skills
✓ Global cache directory verified: C:\Users\<username>\.ai-skills\cache
✓ Created default global skills collection: C:\Users\<username>\.ai-skills\skills.config.json
✓ Antigravity MCP registered: C:\Users\<username>\.gemini\config\mcp_config.json
✓ VS Code MCP registered: C:\Users\<username>\AppData\Roaming\Code\User\mcp.json
✓ Cursor IDE MCP registered: C:\Users\<username>\.cursor\mcp.json
✓ Claude Desktop MCP registered: C:\Users\<username>\AppData\Roaming\Claude\claude_desktop_config.json
✓ Claude Code MCP registered: C:\Users\<username>\.claude.json
✓ Codex MCP registered: C:\Users\<username>\.codex\config.toml

Setup completed successfully!
```

The setup command will:
1. Create config files if they don't exist (or preserve existing content)
2. Add the `mcpServers` section with the `skills-manager` entry
3. Preserve all existing preferences and configuration

---

## Claude Desktop Configuration

Claude Desktop stores MCP server definitions in `claude_desktop_config.json` within the OS-specific application support folder.

### File Structure

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

### Manual Configuration

#### Windows

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["C:\\Users\\<username>\\AppData\\Roaming\\npm\\node_modules\\skills-manager-mcp\\dist\\index.js"]
    }
  }
}
```

You can also access this file through Claude Desktop: **Settings → Developer → Edit Config**.

#### macOS

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

#### Linux

Edit `~/.config/Claude/claude_desktop_config.json`:

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

### Verifying Claude Desktop

1. **Restart Claude Desktop** completely (close and reopen)
2. Go to **Settings → Developer → Edit Config** to verify the file
3. Look for `skills-manager` in the MCP servers list

---

## Claude Code Configuration

Claude Code (the terminal-based CLI agent) stores user-level MCP configuration in `~/.claude.json`. The `mcpServers` key sits alongside other top-level keys like `preferences` and `coworkUserFilesPath`.

### File Structure

```json
{
  "preferences": { ... existing preferences ... },
  "coworkUserFilesPath": "...",
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/path/to/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

### Manual Configuration

#### Windows

Edit `%USERPROFILE%\.claude.json`:

```json
{
  "preferences": {
    "launchPreviewPersistedWorkspaces": [],
    "launchPreviewSessionScopedSessions": [],
    "coworkHipaaRestricted": false,
    "coworkWebSearchEnabled": true,
    "remoteToolsDeviceName": "desktop-xxxxx"
  },
  "coworkUserFilesPath": "C:\\Users\\<username>\\Claude",
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["C:\\Users\\<username>\\AppData\\Roaming\\npm\\node_modules\\skills-manager-mcp\\dist\\index.js"]
    }
  }
}
```

#### macOS

Edit `~/.claude.json`:

```json
{
  "preferences": { ... },
  "coworkUserFilesPath": "/Users/<username>/Library/Application Support/Claude",
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

#### Linux

Edit `~/.claude.json`:

```json
{
  "preferences": { ... },
  "coworkUserFilesPath": "/home/<username>/.claude",
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/skills-manager-mcp/dist/index.js"]
    }
  }
}
```

### Verifying Claude Code

```bash
# Check registration status
skills-manager-mcp status

# Run diagnostics
skills-manager-mcp doctor

# Or use Claude Code's built-in MCP check
claude mcp list
```

Inside an active Claude Code session, type `/mcp` to view the connection status.

### Project-Level Configuration

Claude Code also supports project-level MCP servers via `.mcp.json` in your project root. This is useful for team-shared MCP configurations:

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

---

## Finding Your Node Installation Path

If you need to find the exact path to node or the skills-manager-mcp executable:

### Windows:
```cmd
where node
where skills-manager-mcp
```

### macOS/Linux:
```bash
which node
which skills-manager-mcp
```

The skills-manager-mcp executable is typically at:
- **npm global packages:**
  - Windows: `%APPDATA%\npm\node_modules\skills-manager-mcp\dist\index.js`
  - macOS: `/usr/local/lib/node_modules/skills-manager-mcp/dist/index.js`
  - Linux: `/usr/local/lib/node_modules/skills-manager-mcp/dist/index.js` or `~/.npm/_npx/.../dist/index.js`

## Troubleshooting

### MCP Server Doesn't Appear in Claude Desktop

**Problem:** Setup succeeded but Claude Desktop doesn't show the MCP server.

**Solutions:**
1. **Restart Claude Desktop** completely (close and reopen)
2. **Verify the file was written:**
   ```bash
   # Windows
   type %APPDATA%\Claude\claude_desktop_config.json

   # macOS/Linux
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```
   Look for the `mcpServers` section with `skills-manager` entry

3. **Check the node path is correct** — the path in `args` must point to an existing file

4. **Run setup again:**
   ```bash
   skills-manager-mcp setup
   ```

5. **Check file permissions:**
   - Ensure the config file is readable by Claude Desktop
   - The user running Claude Desktop should own the file

### MCP Server Doesn't Appear in Claude Code

**Problem:** Setup succeeded but Claude Code doesn't show the MCP server.

**Solutions:**
1. **Verify the file was written:**
   ```bash
   cat ~/.claude.json
   ```
   Look for the `mcpServers` section with `skills-manager` entry

2. **Check via Claude Code CLI:**
   ```bash
   claude mcp list
   ```

3. **Inside a Claude Code session**, type `/mcp` to check status

### Permission Denied Error

If you get permission errors when running setup:

**Windows:**
```cmd
icacls %USERPROFILE%\.claude.json /grant:r %USERNAME%:F
```

**macOS/Linux:**
```bash
chmod 644 ~/.claude.json
```

### JSON Validation Error

If Claude reports invalid JSON:

1. Validate the JSON syntax:
   ```bash
   cat ~/.claude.json | python -m json.tool
   ```

2. Ensure:
   - All strings are enclosed in double quotes (not single quotes)
   - No trailing commas after the last item in objects/arrays
   - Proper nesting of braces and brackets

3. Use a JSON formatter to clean up the file

### MCP Server Connects but Skills Don't Work

1. Verify the workspace has skills configured:
   ```bash
   skills-manager-mcp status
   ```

2. Bootstrap your project:
   ```bash
   skills-manager-mcp bootstrap /path/to/project
   ```

3. Check that skills are installed:
   ```bash
   ls -la /path/to/project/.agents/skills/
   ```

## Advanced: Adding Multiple MCP Servers

You can add additional MCP servers in the same `mcpServers` section of either config file:

```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/path/to/skills-manager-mcp/dist/index.js"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

Both Claude Desktop and Claude Code will automatically load all configured MCP servers on startup.

## Integration with Cursor IDE and Codex

Cursor IDE and Codex use different configuration formats. See the main [README.md](README.md) for their setup instructions.

---

**Questions?** Run `skills-manager-mcp doctor` for diagnostics or check the [main README](README.md) for additional help.
