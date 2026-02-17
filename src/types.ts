import type { Static, TSchema } from "@sinclair/typebox";

export interface McpServerConfigBase {
  name: string;
  enabled: boolean;
  toolPrefix?: string;
  filterPatterns?: string[];
}

export interface LocalMcpServerConfig extends McpServerConfigBase {
  type: "local";
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface RemoteMcpServerConfig extends McpServerConfigBase {
  type: "remote";
  url: string;
  transport: "sse" | "websocket";
  headers?: Record<string, string>;
}

export type McpServerConfig = LocalMcpServerConfig | RemoteMcpServerConfig;

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content?: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
}

export type McpToolInput = Static<TSchema>;

export interface McpConfig {
  servers: McpServerConfig[];
  autoReconnect?: boolean;
  reconnectInterval?: number;
  healthCheckInterval?: number;
}
