import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { McpRegistry } from "./McpRegistry.js";
import { McpToolAdapter } from "./McpToolAdapter.js";
import { ConfigLoader } from "./ConfigLoader.js";
import type { McpConfig } from "./types.js";
import { Type } from "@sinclair/typebox";
import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@mariozechner/pi-tui";

let registry: McpRegistry | null = null;
let mcpConfig: McpConfig | null = null;
let enabledServers: Array<{ name: string; config: import("./types.js").McpServerConfig }> = [];
let initError: string | null = null;
let initStats: { servers: number; tools: number; failed: string[] } | null = null;
const toolToServer = new Map<string, string>();
const registeredTools = new Set<string>();
let disabledTools = new Set<string>();

export default async function (pi: ExtensionAPI) {
  mcpConfig = ConfigLoader.loadFromSettingsJson();
  disabledTools = ConfigLoader.loadDisabledTools();

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

  enabledServers = ConfigLoader.getEnabledServers(mcpConfig);

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

  registry = new McpRegistry(enabledServers);

  const initTimeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("Connection timeout (>30s)")), 30000),
  );

  try {
    await Promise.race([registry.initialize(), initTimeout]);

    const clients = registry.getClients();
    let totalTools = 0;
    const failedServers: string[] = [];

    for (const [serverName, client] of clients) {
      const serverConfig = enabledServers.find((s) => s.name === serverName);
      if (!serverConfig) continue;

      try {
        const tools = await client.listTools();
        const toolPrefix = serverConfig.config.toolPrefix;
        const filterPatterns = serverConfig.config.filterPatterns;

        for (const tool of tools) {
          const piTool = McpToolAdapter.convertToPiTool(tool, serverName, client, toolPrefix, filterPatterns);
          if (piTool) {
            toolToServer.set(piTool.name, serverName);
            registeredTools.add(piTool.name);
            pi.registerTool(piTool);
            totalTools++;
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        failedServers.push(`${serverName}: ${errMsg}`);
      }
    }

    initStats = { servers: clients.size, tools: totalTools, failed: failedServers };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    initError = errorMessage;
  }

  pi.on("session_start", async (_event, ctx) => {
    applyToolFilter(pi);

    const connectedCount = registry?.getConnectedCount() ?? 0;
    const toolCount = initStats?.tools ?? 0;
    const enabledCount = registeredTools.size - disabledTools.size;

    if (initError) {
      ctx.ui.setStatus("mcp", `Error: ${initError}`);
      if (isDebugEnabled()) {
        ctx.ui.notify(`MCP init failed: ${initError}`, "error");
      }
    } else {
      ctx.ui.setStatus(
        "mcp",
        `MCP: ${connectedCount}/${enabledServers.length} servers, ${enabledCount}/${toolCount} tools`,
      );

      if (isDebugEnabled() && initStats) {
        ctx.ui.notify(`MCP: ${initStats.servers} servers, ${initStats.tools} tools loaded`, "info");
        if (initStats.failed.length > 0) {
          ctx.ui.notify(`Failed: ${initStats.failed.join(", ")}`, "warning");
        }
      }
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

  pi.registerCommand("mcp-tools", {
    description: "Toggle MCP tools per server",
    handler: async (_args, ctx) => {
      if (registeredTools.size === 0) {
        ctx.ui.notify("MCP: No tools registered", "warning");
        return;
      }

      const toolsByServer = new Map<string, string[]>();
      for (const toolName of registeredTools) {
        const serverName = toolToServer.get(toolName) || "unknown";
        if (!toolsByServer.has(serverName)) {
          toolsByServer.set(serverName, []);
        }
        toolsByServer.get(serverName)!.push(toolName);
      }

      const items: SettingItem[] = [];
      const sortedServers = Array.from(toolsByServer.keys()).sort();

      for (const serverName of sortedServers) {
        const tools = toolsByServer.get(serverName)!.sort();
        for (const toolName of tools) {
          items.push({
            id: toolName,
            label: `${serverName}: ${toolName}`,
            currentValue: disabledTools.has(toolName) ? "disabled" : "enabled",
            values: ["enabled", "disabled"],
          });
        }
      }

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new Text(theme.fg("accent", theme.bold("MCP Tools Configuration")), 1, 0));
        container.addChild(new Text("", 0, 0));

        const settingsList = new SettingsList(
          items,
          Math.min(items.length + 2, 20),
          getSettingsListTheme(),
          (id, newValue) => {
            if (newValue === "enabled") {
              disabledTools.delete(id);
            } else {
              disabledTools.add(id);
            }
            ConfigLoader.saveDisabledTools(disabledTools);
            applyToolFilter(pi);
          },
          () => done(undefined),
        );

        container.addChild(settingsList);

        return {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            settingsList.handleInput?.(data);
            tui.requestRender();
          },
        };
      });
    },
  });

  pi.registerTool({
    name: "mcp_list_servers",
    label: "List MCP Servers",
    description: "List all configured MCP servers and their connection status",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate) {
      if (!registry) {
        return { content: [{ type: "text", text: "MCP not initialized" }], details: { initialized: false } };
      }
      const clients = registry.getClients();
      const servers: Array<{ name: string; connected: boolean }> = [];
      for (const [name, client] of clients) {
        servers.push({ name, connected: client.isConnected() });
      }
      return { content: [{ type: "text", text: JSON.stringify(servers, null, 2) }], details: { servers } };
    },
  });
}

function applyToolFilter(pi: ExtensionAPI) {
  const allTools = pi.getAllTools();
  const enabledToolNames = allTools
    .map((t) => t.name)
    .filter((name) => !name.startsWith("mcp_") || !disabledTools.has(name));
  pi.setActiveTools(enabledToolNames);
}
