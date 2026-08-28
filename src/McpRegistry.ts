import type { McpServerConfig } from "./types.js";
import { McpClient } from "./McpClient.js";

const MAX_RECONNECT_ATTEMPTS = 10;

export class McpRegistry {
  private clients: Map<string, McpClient> = new Map();
  private serverConfigs: ReadonlyArray<{ readonly name: string; readonly config: McpServerConfig }>;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private autoReconnect: boolean;
  private reconnectInterval: number;

  constructor(
    serverConfigs: ReadonlyArray<{ readonly name: string; readonly config: McpServerConfig }>,
    autoReconnect: boolean = true,
    reconnectInterval: number = 5000,
  ) {
    this.serverConfigs = serverConfigs.filter((s) => s.config.enabled !== false);
    this.autoReconnect = autoReconnect;
    this.reconnectInterval = reconnectInterval;
  }

  async initialize(): Promise<void> {
    const connectPromises = this.serverConfigs.map(async ({ name, config }) => {
      const client = new McpClient(config);

      const connectPromise = client.connect();
      let timeoutTimer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutTimer = setTimeout(() => reject(new Error(`Connection timeout (>10s)`)), 10000);
        timeoutTimer.unref();
      });

      try {
        await Promise.race([connectPromise, timeoutPromise]);
        this.clients.set(name, client);
      } catch {
        // Error captured by caller via getClients() missing this name
      } finally {
        clearTimeout(timeoutTimer);
      }
    });

    await Promise.allSettled(connectPromises);
  }

  getClients(): Map<string, McpClient> {
    return new Map(this.clients);
  }

  getClient(name: string): McpClient | undefined {
    return this.clients.get(name);
  }

  async shutdown(): Promise<void> {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();

    const disconnectPromises = Array.from(this.clients.values()).map(async (client) => {
      await client.disconnect().catch(() => {});
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

  private scheduleReconnect(name: string, config: McpServerConfig): void {
    if (!this.autoReconnect) {
      return;
    }

    const attempts = this.reconnectAttempts.get(name) ?? 0;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[pi-mcp-tools] Server '${name}': max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`,
      );
      this.reconnectAttempts.delete(name);
      return;
    }

    const existingTimer = this.reconnectTimers.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.reconnectAttempts.set(name, attempts + 1);

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(name);

      // Disconnect the old client before creating a new one
      const oldClient = this.clients.get(name);
      if (oldClient) {
        await oldClient.disconnect().catch(() => {});
      }

      try {
        const client = new McpClient(config);
        await client.connect();
        this.clients.set(name, client);
        this.reconnectAttempts.delete(name);
      } catch {
        this.scheduleReconnect(name, config);
      }
    }, this.reconnectInterval);

    timer.unref();
    this.reconnectTimers.set(name, timer);
  }

  getConnectedCount(): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        count++;
      }
    }
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
