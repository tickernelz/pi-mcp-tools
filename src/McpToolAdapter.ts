import type { TSchema } from "@sinclair/typebox";
import type { McpClient } from "./McpClient.js";
import type { McpTool } from "./types.js";
import { SchemaConverter } from "./SchemaConverter.js";
import { Type } from "@sinclair/typebox";
import type { ExtensionContext, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { TextContent, ImageContent } from "@mariozechner/pi-ai";

interface McpCallResult {
  content?: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
}

export class McpToolAdapter {
  static convertToPiTool<TDetails = Record<string, unknown>>(
    mcpTool: McpTool,
    serverName: string,
    client: McpClient,
    toolPrefix?: string,
    filterPatterns?: string[],
  ): ToolDefinition<TSchema, TDetails> | null {
    if (filterPatterns && filterPatterns.length > 0) {
      const matches = filterPatterns.some((pattern) => {
        const regex = new RegExp(pattern);
        return regex.test(mcpTool.name);
      });
      if (!matches) {
        return null;
      }
    }

    const prefix = toolPrefix || `mcp_${serverName}`;
    const toolName = `${prefix}_${mcpTool.name}`;

    let parameters: TSchema;
    try {
      parameters = SchemaConverter.convertJsonSchemaToTypeBox(mcpTool.inputSchema as Record<string, unknown>);
    } catch {
      parameters = Type.Any();
    }

    return {
      name: toolName,
      label: `${serverName}: ${mcpTool.name}`,
      description: mcpTool.description || `Call ${mcpTool.name} on ${serverName} MCP server`,
      parameters,
      async execute(_toolCallId, params, signal, _onUpdate, _ctx: ExtensionContext) {
        try {
          if (signal?.aborted) {
            return {
              content: [{ type: "text", text: "Tool call cancelled" } as TextContent],
              details: { cancelled: true } as TDetails,
            };
          }

          const result = (await client.callTool(mcpTool.name, params as Record<string, unknown>)) as McpCallResult;

          if (result.isError) {
            const errorText = extractErrorText(result);
            return {
              content: [{ type: "text", text: errorText } as TextContent],
              details: { server: serverName, tool: mcpTool.name } as TDetails,
              isError: true,
            };
          }

          const content = convertResultToContent(result);

          return {
            content,
            details: { server: serverName, tool: mcpTool.name } as TDetails,
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [{ type: "text", text: `MCP Error: ${errorMessage}` } as TextContent],
            details: { error: true, server: serverName, tool: mcpTool.name } as TDetails,
            isError: true,
          };
        }
      },
    };
  }
}

function extractErrorText(result: McpCallResult): string {
  if (result.content && result.content.length > 0) {
    const textParts = result.content
      .filter((c): c is { type: string; text: string } => c.type === "text" && c.text !== undefined)
      .map((c) => c.text);
    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }
  return "Unknown MCP error";
}

function convertResultToContent(result: McpCallResult): (TextContent | ImageContent)[] {
  if (!result.content || result.content.length === 0) {
    return [{ type: "text", text: "No content returned" } as TextContent];
  }

  const contentParts: (TextContent | ImageContent)[] = [];

  for (const item of result.content) {
    if (item.type === "text" && item.text) {
      contentParts.push({ type: "text", text: item.text } as TextContent);
    } else if (item.type === "image" || item.type === "resource") {
      contentParts.push({ type: "text", text: `[${item.type} content received]` } as TextContent);
    } else if (item.data !== undefined) {
      try {
        contentParts.push({ type: "text", text: JSON.stringify(item.data, null, 2) } as TextContent);
      } catch {
        contentParts.push({ type: "text", text: "[Unserializable data]" } as TextContent);
      }
    }
  }

  if (contentParts.length === 0) {
    return [{ type: "text", text: "No content returned" } as TextContent];
  }

  return contentParts;
}
