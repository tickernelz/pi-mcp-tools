import type { Static, TSchema } from "@sinclair/typebox";

export interface LocalMcpServerConfig {
  type: "local";
  command: string[];
  env?: Record<string, string>;
  cwd?: string;
  enabled?: boolean;
  toolPrefix?: string;
  filterPatterns?: string[];
}

export interface RemoteMcpServerConfig {
  type: "remote";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  toolPrefix?: string;
  filterPatterns?: string[];
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
  [serverName: string]: McpServerConfig;
}
