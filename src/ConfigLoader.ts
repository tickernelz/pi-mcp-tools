import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { McpConfig, McpServerConfig } from "./types.js";

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

  static loadFromExtensionConfig(configPath?: string): McpConfig | null {
    if (!configPath) {
      return null;
    }

    const pathsToTry = [configPath, join(process.cwd(), configPath), join(homedir(), ".pi", "agent", configPath)];

    for (const path of pathsToTry) {
      const config = this.loadFromFile(path);
      if (config) {
        return config;
      }
    }

    return null;
  }

  static validateConfig(config: McpConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.servers || !Array.isArray(config.servers)) {
      errors.push("Missing or invalid 'servers' array");
      return { valid: false, errors };
    }

    config.servers.forEach((server, index) => {
      if (!server.name) {
        errors.push(`Server at index ${index} missing 'name'`);
      }

      if (!server.type || !["local", "remote"].includes(server.type)) {
        errors.push(`Server '${server.name || index}' has invalid 'type'`);
      }

      if (server.type === "local") {
        const localServer = server as McpServerConfig & { type: "local" };
        if (!localServer.command) {
          errors.push(`Local server '${server.name}' missing 'command'`);
        }
        if (!localServer.args || !Array.isArray(localServer.args)) {
          errors.push(`Local server '${server.name}' missing or invalid 'args'`);
        }
      }

      if (server.type === "remote") {
        const remoteServer = server as McpServerConfig & { type: "remote" };
        if (!remoteServer.url) {
          errors.push(`Remote server '${server.name}' missing 'url'`);
        }
        if (!remoteServer.transport || !["sse", "websocket"].includes(remoteServer.transport)) {
          errors.push(`Remote server '${server.name}' has invalid 'transport'`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getEnabledServers(config: McpConfig): McpServerConfig[] {
    return config.servers.filter((server) => server.enabled !== false);
  }
}
