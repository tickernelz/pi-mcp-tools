import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { McpConfig, McpServerConfig, LocalMcpServerConfig, RemoteMcpServerConfig } from "./types.js";

export class ConfigLoader {
  static loadFromSettingsJson(): McpConfig | null {
    const globalSettingsPath = join(homedir(), ".pi", "agent", "settings.json");
    const projectSettingsPath = join(process.cwd(), ".pi", "settings.json");

    const projectConfig = this.loadFromFile(projectSettingsPath);
    if (projectConfig) {
      return projectConfig;
    }

    const globalConfig = this.loadFromFile(globalSettingsPath);
    if (globalConfig) {
      return globalConfig;
    }

    return null;
  }

  static loadFromFile(path: string): McpConfig | null {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, "utf-8");
      const settings = JSON.parse(content);
      return settings.mcp || null;
    } catch {
      return null;
    }
  }

  static validateConfig(config: McpConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config || typeof config !== "object" || Object.keys(config).length === 0) {
      errors.push("MCP config must be a non-empty object");
      return { valid: false, errors };
    }

    for (const [name, server] of Object.entries(config)) {
      if (!server.type || !["local", "remote"].includes(server.type)) {
        errors.push(`Server '${name}' has invalid or missing 'type'`);
        continue;
      }

      if (server.type === "local") {
        const localServer = server as LocalMcpServerConfig;
        if (!localServer.command || !Array.isArray(localServer.command)) {
          errors.push(`Local server '${name}' missing or invalid 'command' array`);
        }
      }

      if (server.type === "remote") {
        const remoteServer = server as RemoteMcpServerConfig;
        if (!remoteServer.url) {
          errors.push(`Remote server '${name}' missing 'url'`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getEnabledServers(config: McpConfig): Array<{ name: string; config: McpServerConfig }> {
    return Object.entries(config)
      .filter(([_, server]) => server.enabled !== false)
      .map(([name, config]) => ({ name, config }));
  }
}
