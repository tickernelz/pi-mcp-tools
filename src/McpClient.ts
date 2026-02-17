import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import type { McpServerConfig, McpTool } from "./types.js";

export class McpClient {
  private client: Client;
  private transport: StdioClientTransport | SSEClientTransport | WebSocketClientTransport | null = null;
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
        const env: Record<string, string> = {};
        Object.entries({ ...process.env, ...this.config.env }).forEach(([key, value]) => {
          if (value !== undefined) {
            env[key] = value;
          }
        });
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args,
          env,
          cwd: this.config.cwd,
        });
      } else if (this.config.type === "remote") {
        const url = new URL(this.config.url);
        if (this.config.transport === "websocket") {
          this.transport = new WebSocketClientTransport(url);
        } else {
          this.transport = new SSEClientTransport(url, {
            requestInit: { headers: this.config.headers },
          });
        }
      }

      if (!this.transport) {
        throw new Error("Failed to create transport");
      }

      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error) {
      this.transport = null;
      throw error;
    }
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.connected) {
      throw new Error("Client not connected");
    }

    const response = await this.client.listTools();
    return response.tools as McpTool[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error("Client not connected");
    }

    return await this.client.callTool({ name, arguments: args });
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

  getName(): string {
    return this.config.name;
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }
}
