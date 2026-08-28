import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { McpConfig, McpServerConfig, LocalMcpServerConfig, RemoteMcpServerConfig } from "./types.js";

const GLOBAL_SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

export class ConfigLoader {
  /** Load MCP config from user-global settings.json only.
   *
   * Project-local .pi/settings.json is deliberately NOT checked first:
   * headless pi at default trust ignores project-local extensions (F20-F22),
   * so preferring project config would silently load untrusted server config.
   * User scope is the only safe default.
   */
  static loadFromSettingsJson(): McpConfig | null {
    return this.loadFromFile(GLOBAL_SETTINGS_PATH);
  }

  static loadFromFile(path: string): McpConfig | null {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, "utf-8");
      const settings = JSON.parse(content);
      return settings.mcp ?? null;
    } catch {
      return null;
    }
  }

  static loadDisabledTools(): Set<string> {
    if (!existsSync(GLOBAL_SETTINGS_PATH)) {
      return new Set();
    }

    try {
      const content = readFileSync(GLOBAL_SETTINGS_PATH, "utf-8");
      const settings = JSON.parse(content);
      const disabled = settings.mcpDisabledTools;
      if (Array.isArray(disabled)) {
        return new Set(disabled);
      }
      return new Set();
    } catch {
      return new Set();
    }
  }

  static saveDisabledTools(disabledTools: Set<string>): void {
    if (!existsSync(GLOBAL_SETTINGS_PATH)) {
      return;
    }

    try {
      const content = readFileSync(GLOBAL_SETTINGS_PATH, "utf-8");
      const settings = JSON.parse(content);
      settings.mcpDisabledTools = Array.from(disabledTools);
      writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    } catch (error) {
      console.error(`[pi-mcp-tools] Failed to save disabled tools to ${GLOBAL_SETTINGS_PATH}:`, error);
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
      .map(([name, cfg]) => ({ name, config: cfg }));
  }
}
