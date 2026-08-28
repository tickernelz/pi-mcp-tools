import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpToolAdapter } from "../src/McpToolAdapter.js";
import type { McpTool } from "../src/types.js";

// Minimal mock that supports callTool only
function createMockClient() {
  return {
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "result" }],
    }),
  } as any;
}

const serverName = "test-server";

describe("McpToolAdapter", () => {
  describe("convertToPiTool", () => {
    it("returns null when tool is filtered out by filterPatterns", () => {
      const tool: McpTool = { name: "secret_tool", description: "hidden", inputSchema: {} };
      const result = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient(), undefined, ["^public_"]);
      expect(result).toBeNull();
    });

    it("passes through when tool matches filterPatterns", () => {
      const tool: McpTool = { name: "public_list", description: "visible", inputSchema: {} };
      const result = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient(), undefined, ["^public_"]);
      expect(result).not.toBeNull();
    });

    it("uses custom toolPrefix when provided", () => {
      const tool: McpTool = { name: "my_tool", description: "test", inputSchema: {} };
      const result = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient(), "custom_prefix");
      expect(result!.name).toBe("custom_prefix_my_tool");
    });

    it("uses default mcp_<server> prefix when no toolPrefix", () => {
      const tool: McpTool = { name: "my_tool", description: "test", inputSchema: {} };
      const result = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient());
      expect(result!.name).toBe("mcp_test-server_my_tool");
    });

    it("sets description to tool description when present", () => {
      const tool: McpTool = { name: "my_tool", description: "Does something", inputSchema: {} };
      const result = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient());
      expect(result!.description).toBe("Does something");
    });

    it("falls back to generated description when none provided", () => {
      const tool: McpTool = { name: "my_tool", inputSchema: {} };
      const result = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient());
      expect(result!.description).toContain("my_tool");
      expect(result!.description).toContain(serverName);
    });
  });

  describe("execute function", () => {
    it("returns cancelled result when signal is aborted", async () => {
      const tool: McpTool = { name: "my_tool", inputSchema: {} };
      const piTool = McpToolAdapter.convertToPiTool(tool, serverName, () => createMockClient());
      const signal = { aborted: true } as any;
      const result = await piTool!.execute("id", {}, signal, undefined, {} as any);
      expect(result.details).toBeDefined();
      expect(result.details.cancelled).toBe(true);
    });

    it("returns error when getClient returns undefined", async () => {
      const tool: McpTool = { name: "my_tool", inputSchema: {} };
      const piTool = McpToolAdapter.convertToPiTool(tool, serverName, () => undefined);
      const result = await piTool!.execute("id", {}, undefined, undefined, {} as any);
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain("not connected");
    });

    it("calls client.callTool with correct params and returns result", async () => {
      const mockClient = createMockClient();
      const tool: McpTool = { name: "my_tool", inputSchema: {} };
      const piTool = McpToolAdapter.convertToPiTool(tool, serverName, () => mockClient);
      const result = await piTool!.execute("id", { key: "value" }, undefined, undefined, {} as any);
      expect(mockClient.callTool).toHaveBeenCalledWith("my_tool", { key: "value" });
      expect(result.isError).toBeFalsy();
    });

    it("handles isError from MCP server", async () => {
      const mockClient = createMockClient();
      mockClient.callTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Something went wrong" }],
        isError: true,
      });
      const tool: McpTool = { name: "my_tool", inputSchema: {} };
      const piTool = McpToolAdapter.convertToPiTool(tool, serverName, () => mockClient);
      const result = await piTool!.execute("id", {}, undefined, undefined, {} as any);
      expect(result.isError).toBeTruthy();
    });

    it("handles exceptions from client.callTool", async () => {
      const mockClient = createMockClient();
      mockClient.callTool = vi.fn().mockRejectedValue(new Error("Connection refused"));
      const tool: McpTool = { name: "my_tool", inputSchema: {} };
      const piTool = McpToolAdapter.convertToPiTool(tool, serverName, () => mockClient);
      const result = await piTool!.execute("id", {}, undefined, undefined, {} as any);
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain("MCP Error");
    });
  });
});