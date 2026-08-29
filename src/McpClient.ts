import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerConfig } from "./types.js";

type TransportType = "stdio" | "websocket" | "streamable-http" | "sse";

// Default per-tool-call timeout. The MCP SDK's built-in default (60s) is too
// aggressive for heavy tools (large index builds, long browser operations),
// so we pass an explicit value. Override via PI_MCP_TOOL_TIMEOUT_MS (ms, 0 = disabled).
const DEFAULT_TOOL_CALL_TIMEOUT_MS = 600_000;

function resolveToolCallTimeoutMs(): number | undefined {
  const raw = process.env.PI_MCP_TOOL_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_TOOL_CALL_TIMEOUT_MS;
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms < 0) return DEFAULT_TOOL_CALL_TIMEOUT_MS;
  if (ms === 0) return undefined; // 0 = no timeout
  return Math.floor(ms);
}

export class McpClient {
  private client: Client;
  private transport:
    | StdioClientTransport
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | WebSocketClientTransport
    | null = null;
  private config: McpServerConfig;
  private connected: boolean = false;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.client = new Client({ name: "pi-mcp-extension", version: "1.0.0" });
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      if (this.config.type === "local") {
        this.transport = this.createStdioTransport();
        await this.client.connect(this.transport);
        this.connected = true;
      } else {
        await this.connectWithAutoDetect();
      }
    } catch (error) {
      this.transport = null;
      throw error;
    }
  }

  private async connectWithAutoDetect(): Promise<void> {
    if (this.config.type !== "remote") {
      throw new Error("Expected remote config");
    }

    const url = new URL(this.config.url);
    const headers = this.config.headers ? { ...this.config.headers } : undefined;

    if (url.protocol === "ws:" || url.protocol === "wss:") {
      this.transport = new WebSocketClientTransport(url);
      await this.client.connect(this.transport);
      this.connected = true;
      return;
    }

    if (url.pathname.toLowerCase().includes("websocket")) {
      this.transport = new WebSocketClientTransport(url);
      await this.client.connect(this.transport);
      this.connected = true;
      return;
    }

    const transports: Array<{ type: TransportType; create: () => any }> = [
      {
        type: "streamable-http",
        create: () => new StreamableHTTPClientTransport(url, { requestInit: headers ? { headers } : undefined }),
      },
      {
        type: "sse",
        create: () => new SSEClientTransport(url, { requestInit: headers ? { headers } : undefined }),
      },
    ];

    for (const { type, create } of transports) {
      let attemptTimer: NodeJS.Timeout | undefined;
      try {
        const transport = create();
        const connectPromise = this.client.connect(transport);
        const timeoutPromise = new Promise<void>((_, reject) => {
          attemptTimer = setTimeout(() => reject(new Error(`Transport ${type} timeout`)), 2000);
          attemptTimer.unref();
        });

        await Promise.race([connectPromise, timeoutPromise]);

        this.transport = transport;
        this.connected = true;
        return;
      } catch {
        await this.client.close().catch(() => {});
      } finally {
        clearTimeout(attemptTimer);
      }
    }

    throw new Error("All transport types failed");
  }

  private createStdioTransport(): StdioClientTransport {
    if (this.config.type !== "local") {
      throw new Error("Expected local config for stdio transport");
    }

    const [command, ...args] = this.config.command;
    const env: Record<string, string> = {};
    Object.entries({ ...process.env, ...this.config.env }).forEach(([key, value]) => {
      if (value !== undefined) {
        env[key] = value;
      }
    });
    return new StdioClientTransport({
      command,
      args,
      env,
      cwd: this.config.cwd,
      stderr: "ignore",
    });
  }

  async listTools(): Promise<any[]> {
    if (!this.connected) {
      throw new Error("Client not connected");
    }

    const response = await this.client.listTools();
    return response.tools as any[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error("Client not connected");
    }

    const timeoutMs = resolveToolCallTimeoutMs();
    try {
      return await this.client.callTool(
        { name, arguments: args },
        undefined,
        timeoutMs !== undefined ? { timeout: timeoutMs, maxTotalTimeout: timeoutMs } : undefined,
      );
    } catch (err) {
      // Surface SDK timeouts (code -32001) with actionable context so a stuck
      // server errors out instead of hanging the agent loop forever.
      if (
        timeoutMs !== undefined &&
        err instanceof McpError &&
        (err.code === -32001 || /timed? ?out/i.test(err.message))
      ) {
        throw new Error(
          `MCP tool "${name}" timed out after ${Math.round(timeoutMs / 1000)}s (server unresponsive). ` +
            `If this tool legitimately needs longer, raise PI_MCP_TOOL_TIMEOUT_MS (ms).`,
        );
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.close();
    } finally {
      this.transport = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }
}
