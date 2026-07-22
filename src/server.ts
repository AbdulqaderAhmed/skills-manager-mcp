import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListRootsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SkillManager } from './skillManager.js';

/**
 * Creates and configures the Skills Manager MCP Server instance.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'skills-manager-mcp',
      version: '1.5.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_workspace_info',
          description:
            'Debugging tool to inspect the active project workspace resolution, detection source, server directory protection status, and workspace validity.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description:
                  'Path to the target project workspace directory. Pass the active project workspace folder path.',
              },
            },
            required: [],
          },
        },
        {
          name: 'bootstrap_project',
          description:
            'Automatically bootstrap a new or existing project workspace by setting up .agents/skills, loading personal skill collection & project config, using global cache, installing missing skills, and updating version metadata tracker (.agents/skills-manager.json).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description:
                  'Path to the target project workspace directory. AI agents should pass the user\'s currently active project workspace directory path here.',
              },
              configPath: {
                type: 'string',
                description:
                  'Optional explicit path to a skills.config.json file.',
              },
            },
            required: [],
          },
        },
        {
          name: 'sync_skills',
          description:
            'Synchronize project workspace skills with your personal skill collection (~/.ai-skills/skills.config.json) and global cache.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description:
                  'Path to the target project workspace directory. AI agents should pass the user\'s currently active project workspace directory path here.',
              },
              configPath: {
                type: 'string',
                description:
                  'Optional explicit path to a skills.config.json file.',
              },
            },
            required: [],
          },
        },
        {
          name: 'install_skills',
          description:
            'Install missing project skills defined in project/global skills.config.json into .agents/skills. Uses workspace auto-detection, global cache, and version tracking.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description:
                  'Path to the target project workspace directory. AI agents should pass the user\'s currently active project workspace directory path here.',
              },
              configPath: {
                type: 'string',
                description:
                  'Optional explicit path to skills.config.json file.',
              },
            },
            required: [],
          },
        },
        {
          name: 'list_installed_skills',
          description:
            'List all currently installed skills inside the project (.agents/skills) along with version metadata tracker details.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description:
                  'Path to the target project workspace directory. AI agents should pass the user\'s currently active project workspace directory path here.',
              },
            },
            required: [],
          },
        },
        {
          name: 'check_missing_skills',
          description:
            'Check the status of project skills against merged project/global skills.config.json without triggering any installation.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description:
                  'Path to the target project workspace directory. AI agents should pass the user\'s currently active project workspace directory path here.',
              },
              configPath: {
                type: 'string',
                description:
                  'Optional explicit path to skills.config.json file.',
              },
            },
            required: [],
          },
        },
      ],
    };
  });

  // Handle tool executions
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args || {}) as { projectPath?: string; configPath?: string };

    // Detect active client workspace root via MCP roots/list RPC
    let detectedClientRoot: string | undefined = undefined;
    try {
      const rootsResponse = await server.request(
        { method: 'roots/list' },
        ListRootsResultSchema
      );
      if (rootsResponse && rootsResponse.roots && rootsResponse.roots.length > 0) {
        const rootUri = rootsResponse.roots[0].uri;
        if (rootUri.startsWith('file://')) {
          detectedClientRoot = fileURLToPath(rootUri);
        } else {
          detectedClientRoot = rootUri;
        }
      }
    } catch {
      // Client does not support roots/list or request timed out
    }

    try {
      switch (name) {
        case 'get_workspace_info': {
          const info = await SkillManager.getWorkspaceInfo(
            toolArgs.projectPath,
            detectedClientRoot
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    workspace: info.workspacePath,
                    source: info.source,
                    mcpServerDirectory: info.mcpServerDirectory,
                    isValidWorkspace: info.isValidWorkspace,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'bootstrap_project': {
          const report = await SkillManager.bootstrapProject(
            toolArgs.projectPath,
            toolArgs.configPath,
            detectedClientRoot
          );
          return {
            content: [
              {
                type: 'text',
                text: report.summary,
              },
            ],
          };
        }

        case 'sync_skills': {
          const report = await SkillManager.syncSkills(
            toolArgs.projectPath,
            toolArgs.configPath,
            detectedClientRoot
          );
          return {
            content: [
              {
                type: 'text',
                text: report.summary,
              },
            ],
          };
        }

        case 'install_skills': {
          const report = await SkillManager.installSkills(
            toolArgs.projectPath,
            toolArgs.configPath,
            detectedClientRoot
          );
          return {
            content: [
              {
                type: 'text',
                text: report.summary,
              },
            ],
          };
        }

        case 'list_installed_skills': {
          const report = await SkillManager.listInstalledSkills(
            toolArgs.projectPath,
            detectedClientRoot
          );
          return {
            content: [
              {
                type: 'text',
                text: report.summary,
              },
            ],
          };
        }

        case 'check_missing_skills': {
          const report = await SkillManager.checkMissingSkills(
            toolArgs.projectPath,
            toolArgs.configPath,
            detectedClientRoot
          );
          return {
            content: [
              {
                type: 'text',
                text: report.summary,
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool name: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${name}': ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
