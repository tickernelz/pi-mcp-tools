import type { McpServerConfig } from "./types.js";
import { McpClient } from "./McpClient.js";

export class McpRegistry {
  private clients: Map<string, McpClient> = new Map();
  private serverConfigs: Array<{ name: string; config: McpServerConfig }>;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private autoReconnect: boolean;
  private reconnectInterval: number;

  constructor(
    serverConfigs: Array<{ name: string; config: McpServerConfig }>,
    autoReconnect: boolean = true,
    reconnectInterval: number = 5000,
  ) {
    this.serverConfigs = serverConfigs.filter((s) => s.config.enabled !== false);
    this.autoReconnect = autoReconnect;
    this.reconnectInterval = reconnectInterval;
  }

  async initialize(): Promise<void> {
    const connectPromises = this.serverConfigs.map(async ({ name, config }) => {
      try {
        const client = new McpClient(config);
        await client.connect();
        this.clients.set(name, client);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to connect to MCP server ${name}: ${errorMessage}`);
      }
    });

    const results = await Promise.allSettled(connectPromises);
    const failures = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    if (failures.length > 0) {
      failures.forEach((f) => console.error(f.reason));
    }
  }

  getClients(): Map<string, McpClient> {
    return new Map(this.clients);
  }

  getClient(name: string): McpClient | undefined {
    return this.clients.get(name);
  }

  async shutdown(): Promise<void> {
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    const disconnectPromises = Array.from(this.clients.entries()).map(async ([name, client]) => {
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`Failed to disconnect ${name}:`, error);
      }
    });

    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  async reconnectClient(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.reconnect();
    }
  }

  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }

  setReconnectInterval(interval: number): void {
    this.reconnectInterval = interval;
  }

  scheduleReconnect(name: string, config: McpServerConfig): void {
    if (!this.autoReconnect) {
      return;
    }

    const existingTimer = this.reconnectTimers.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        const client = new McpClient(config);
        await client.connect();
        this.clients.set(name, client);
        this.reconnectTimers.delete(name);
      } catch {
        this.scheduleReconnect(name, config);
      }
    }, this.reconnectInterval);

    this.reconnectTimers.set(name, timer);
  }

  getConnectedCount(): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.isConnected()) {
        count++;
      }
    });
    return count;
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, client] of this.clients) {
      try {
        await client.listTools();
        results.set(name, true);
      } catch {
        results.set(name, false);
        if (this.autoReconnect) {
          const serverConfig = this.serverConfigs.find((s) => s.name === name);
          if (serverConfig) {
            this.scheduleReconnect(name, serverConfig.config);
          }
        }
      }
    }

    return results;
  }
}
