import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { McpRegistry } from "./McpRegistry.js";
import { McpToolAdapter } from "./McpToolAdapter.js";
import { ConfigLoader } from "./ConfigLoader.js";
import type { McpConfig } from "./types.js";
import { Type } from "@sinclair/typebox";

let registry: McpRegistry | null = null;
let mcpConfig: McpConfig | null = null;

export default function (pi: ExtensionAPI) {
  mcpConfig = ConfigLoader.loadFromSettingsJson();

  if (!mcpConfig) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify("MCP: No configuration found in settings.json", "info");
    });

    pi.registerCommand("mcp-status", {
      description: "Show MCP connection status",
      handler: async (_args, ctx) => {
        ctx.ui.notify("MCP: No configuration loaded", "info");
      },
    });
    return;
  }

  const validation = ConfigLoader.validateConfig(mcpConfig);
  if (!validation.valid) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify(`MCP: Invalid config - ${validation.errors.join(", ")}`, "error");
    });
    return;
  }

  const enabledServers = ConfigLoader.getEnabledServers(mcpConfig);

  if (enabledServers.length === 0) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify("MCP: No servers enabled", "info");
    });
    return;
  }

  pi.registerFlag("mcp-debug", {
    description: "Enable MCP debug logging",
    type: "boolean",
    default: false,
  });

  const isDebugEnabled = () => pi.getFlag("mcp-debug") === true;

  pi.on("session_start", async (_event, ctx) => {
    registry = new McpRegistry(enabledServers);

    ctx.ui.setStatus("mcp", "Connecting...");

    try {
      await registry.initialize();

      const clients = registry.getClients();
      let totalTools = 0;
      const registeredTools: string[] = [];

      for (const [serverName, client] of clients) {
        const serverConfig = enabledServers.find((s) => s.name === serverName);
        if (!serverConfig) continue;

        const tools = await client.listTools();
        const toolPrefix = serverConfig.config.toolPrefix;
        const filterPatterns = serverConfig.config.filterPatterns;

        for (const tool of tools) {
          const piTool = McpToolAdapter.convertToPiTool(tool, serverName, client, toolPrefix, filterPatterns);
          if (piTool) {
            pi.registerTool(piTool);
            registeredTools.push(piTool.name);
            totalTools++;
          }
        }

        if (isDebugEnabled()) {
          ctx.ui.notify(`MCP: ${serverName} - ${tools.length} tools available`, "info");
        }
      }

      const connectedCount = registry.getConnectedCount();
      ctx.ui.setStatus("mcp", `MCP: ${connectedCount}/${enabledServers.length} servers, ${totalTools} tools`);

      if (isDebugEnabled()) {
        ctx.ui.notify(`MCP connected: ${registeredTools.length} tools registered`, "info");
        if (isDebugEnabled()) {
          ctx.ui.notify(`Tools: ${registeredTools.join(", ")}`, "info");
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      ctx.ui.setStatus("mcp", `Error: ${errorMessage}`);
      ctx.ui.notify(`MCP connection failed: ${errorMessage}`, "error");
    }
  });

  pi.on("session_shutdown", async () => {
    if (registry) {
      await registry.shutdown();
      registry = null;
    }
  });

  pi.registerCommand("mcp-status", {
    description: "Show MCP server status with health check",
    handler: async (_args, ctx) => {
      if (!registry) {
        ctx.ui.notify("MCP: Not initialized", "warning");
        return;
      }

      ctx.ui.setStatus("mcp", "Checking...");

      try {
        const clients = registry.getClients();
        const status: string[] = [];

        for (const [name, client] of clients) {
          try {
            await client.listTools();
            status.push(`✓ ${name}`);
          } catch {
            status.push(`✗ ${name}`);
          }
        }

        ctx.ui.setStatus("mcp", `Status: ${clients.size} servers`);
        ctx.ui.notify(`MCP Status:\n${status.join("\n")}`, "info");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        ctx.ui.notify(`Status check failed: ${errorMessage}`, "error");
      }
    },
  });

  pi.registerCommand("mcp-reconnect", {
    description: "Reconnect to all MCP servers",
    handler: async (_args, ctx) => {
      if (!registry || !mcpConfig) {
        ctx.ui.notify("MCP: Not initialized", "warning");
        return;
      }

      ctx.ui.setStatus("mcp", "Reconnecting...");

      try {
        await registry.shutdown();
        const enabledServers = ConfigLoader.getEnabledServers(mcpConfig);
        registry = new McpRegistry(enabledServers);
        await registry.initialize();

        const connectedCount = registry.getConnectedCount();
        ctx.ui.setStatus("mcp", `MCP: ${connectedCount} servers`);
        ctx.ui.notify(`MCP reconnected: ${connectedCount} servers`, "info");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        ctx.ui.setStatus("mcp", `Error: ${errorMessage}`);
        ctx.ui.notify(`MCP reconnect failed: ${errorMessage}`, "error");
      }
    },
  });

  pi.registerCommand("mcp-toggle", {
    description: "Toggle MCP server on/off",
    handler: async (args, ctx) => {
      if (!registry || !mcpConfig) {
        ctx.ui.notify("MCP: Not initialized", "warning");
        return;
      }

      const serverName = args?.trim();
      if (!serverName) {
        ctx.ui.notify("Usage: /mcp-toggle <server-name>", "warning");
        return;
      }

      const clients = registry.getClients();
      const client = clients.get(serverName);

      if (!client) {
        ctx.ui.notify(`Server '${serverName}' not found`, "error");
        return;
      }

      try {
        if (client.isConnected()) {
          await client.disconnect();
          ctx.ui.setStatus("mcp", `${serverName}: off`);
          ctx.ui.notify(`Server '${serverName}' disconnected`, "info");
        } else {
          await client.reconnect();
          ctx.ui.setStatus("mcp", `${serverName}: on`);
          ctx.ui.notify(`Server '${serverName}' connected`, "info");
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        ctx.ui.notify(`Toggle failed: ${errorMessage}`, "error");
      }
    },
  });

  pi.registerCommand("mcp-list", {
    description: "List all available MCP tools",
    handler: async (_args, ctx) => {
      if (!registry) {
        ctx.ui.notify("MCP: Not initialized", "warning");
        return;
      }

      const clients = registry.getClients();
      const toolList: string[] = [];

      for (const [serverName, client] of clients) {
        try {
          const tools = await client.listTools();
          toolList.push(`\n${serverName}:`);
          tools.forEach((tool) => {
            toolList.push(`  - ${tool.name}${tool.description ? `: ${tool.description}` : ""}`);
          });
        } catch {
          toolList.push(`\n${serverName}: [unable to list tools]`);
        }
      }

      ctx.ui.notify(`MCP Tools:${toolList.join("\n")}`, "info");
    },
  });

  pi.registerTool({
    name: "mcp_list_servers",
    label: "List MCP Servers",
    description: "List all configured MCP servers and their connection status",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate) {
      if (!registry) {
        return {
          content: [{ type: "text", text: "MCP not initialized" }],
          details: { initialized: false },
        };
      }

      const clients = registry.getClients();
      const servers: Array<{ name: string; connected: boolean }> = [];

      for (const [name, client] of clients) {
        servers.push({ name, connected: client.isConnected() });
      }

      return {
        content: [{ type: "text", text: JSON.stringify(servers, null, 2) }],
        details: { servers },
      };
    },
  });
}
