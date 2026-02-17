import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import type { McpServerConfig } from "./types.js";

type TransportType = "stdio" | "websocket" | "streamable-http" | "sse";

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
  private detectedTransport: TransportType | null = null;

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
        this.detectedTransport = "stdio";
      } else {
        const transportType = await this.getTransportType();
        this.transport = this.createRemoteTransport(transportType);
        this.detectedTransport = transportType;
      }

      await this.client.connect(this.transport);
      this.connected = true;
    } catch (error) {
      this.transport = null;
      throw error;
    }
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

  private async getTransportType(): Promise<TransportType> {
    if (this.detectedTransport) {
      return this.detectedTransport;
    }

    if (this.config.type !== "remote") {
      throw new Error("Expected remote config for transport detection");
    }

    const url = new URL(this.config.url);
    const transportType = await this.detectTransport(url);
    this.detectedTransport = transportType;
    return transportType;
  }

  private createRemoteTransport(transportType: TransportType) {
    if (this.config.type !== "remote") {
      throw new Error("Expected remote config for remote transport");
    }

    const url = new URL(this.config.url);
    const headers = this.config.headers ? { ...this.config.headers } : undefined;

    switch (transportType) {
      case "websocket":
        return new WebSocketClientTransport(url);
      case "streamable-http":
        return new StreamableHTTPClientTransport(url, { requestInit: headers ? { headers } : undefined });
      case "sse":
        return new SSEClientTransport(url, { requestInit: headers ? { headers } : undefined });
      default:
        throw new Error(`Unknown transport type: ${transportType}`);
    }
  }

  private async detectTransport(url: URL): Promise<TransportType> {
    if (url.protocol === "ws:" || url.protocol === "wss:") {
      return "websocket";
    }

    if (url.pathname.toLowerCase().includes("websocket")) {
      return "websocket";
    }

    try {
      const probeUrl = new URL(url);
      probeUrl.pathname = probeUrl.pathname.endsWith("/") ? probeUrl.pathname.slice(0, -1) : probeUrl.pathname;

      const headers: Record<string, string> = {};
      if (this.config.type === "remote" && this.config.headers) {
        Object.assign(headers, this.config.headers);
      }

      const response = await fetch(probeUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(3000),
      });

      const mcpProtocolVersion = response.headers.get("mcp-protocol-version");
      if (mcpProtocolVersion && mcpProtocolVersion.startsWith("2025-")) {
        return "streamable-http";
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream")) {
        return "sse";
      }

      if (response.ok) {
        return "streamable-http";
      }

      return "sse";
    } catch {
      return "sse";
    }
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

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }
}
