import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigLoader } from "../src/ConfigLoader.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// We test ConfigLoader's validation/enumeration logic directly.
// File I/O tests use mock fs to avoid polluting the real ~/.pi/.

describe("ConfigLoader", () => {
  describe("validateConfig", () => {
    it("rejects null/empty config", () => {
      const result = ConfigLoader.validateConfig(null as unknown as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects config with missing server type", () => {
      const result = ConfigLoader.validateConfig({
        myserver: {} as any,
      });
      expect(result.valid).toBe(false);
    });

    it("rejects config with invalid server type", () => {
      const result = ConfigLoader.validateConfig({
        myserver: { type: "invalid" },
      });
      expect(result.valid).toBe(false);
    });

    it("rejects local server missing command", () => {
      const result = ConfigLoader.validateConfig({
        myserver: { type: "local" },
      });
      expect(result.valid).toBe(false);
    });

    it("rejects local server with non-array command", () => {
      const result = ConfigLoader.validateConfig({
        myserver: { type: "local", command: "node" },
      });
      expect(result.valid).toBe(false);
    });

    it("accepts valid local server config", () => {
      const result = ConfigLoader.validateConfig({
        filesystem: { type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/tmp"] },
      });
      expect(result.valid).toBe(true);
    });

    it("accepts local server with all optional fields", () => {
          const result = ConfigLoader.validateConfig({
            "my-server": {
          type: "local",
          command: ["node", "server.js"],
          env: { KEY: "value" },
          cwd: "/tmp",
          enabled: true,
          toolPrefix: "custom",
          filterPatterns: ["^tool_"],
        },
      });
      expect(result.valid).toBe(true);
    });

    it("rejects remote server missing url", () => {
      const result = ConfigLoader.validateConfig({
        myserver: { type: "remote" },
      });
      expect(result.valid).toBe(false);
    });

    it("accepts valid remote server config", () => {
      const result = ConfigLoader.validateConfig({
        web: { type: "remote", url: "https://example.com/mcp" },
      });
      expect(result.valid).toBe(true);
    });

    it("validates multiple servers independently", () => {
      const result = ConfigLoader.validateConfig({
        good: { type: "local", command: ["node", "srv.js"] },
        bad: { type: "local" },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("getEnabledServers", () => {
    it("returns all servers when no enabled field", () => {
      const result = ConfigLoader.getEnabledServers({
        s1: { type: "local", command: ["node", "a.js"] },
        s2: { type: "local", command: ["node", "b.js"] },
      });
      expect(result).toHaveLength(2);
    });

    it("excludes disabled servers", () => {
      const result = ConfigLoader.getEnabledServers({
        s1: { type: "local", command: ["node", "a.js"], enabled: false },
        s2: { type: "local", command: ["node", "b.js"], enabled: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("s2");
    });

    it("returns empty array when all disabled", () => {
      const result = ConfigLoader.getEnabledServers({
        s1: { type: "local", command: ["node", "a.js"], enabled: false },
      });
      expect(result).toHaveLength(0);
    });
  });
});