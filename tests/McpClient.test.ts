import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpClient } from "../src/McpClient.js";

// We test McpClient's disconnect/reconnect/connect logic
// without an actual MCP server by intercepting the SDK client.

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    setNotificationHandler: vi.fn(),
    onclose: null,
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

describe("McpClient", () => {
  it("connects via stdio transport for local config", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await client.connect();
    expect(client.isConnected()).toBe(true);
  });

  it("disconnect transitions to not-connected", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await client.connect();
    expect(client.isConnected()).toBe(true);
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it("reconnect re-establishes connection", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await client.connect();
    expect(client.isConnected()).toBe(true);
    await client.reconnect();
    expect(client.isConnected()).toBe(true);
  });

  it("listTools throws when not connected", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await expect(client.listTools()).rejects.toThrow("not connected");
  });

  it("callTool throws when not connected", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await expect(client.callTool("test", {})).rejects.toThrow("not connected");
  });

  it("isConnected() returns false before connect", () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    expect(client.isConnected()).toBe(false);
  });

  it("listTools succeeds after connect", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await client.connect();
    const tools = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
  });

  it("callTool succeeds after connect", async () => {
    const config = { type: "local" as const, command: ["node", "server.js"] };
    const client = new McpClient(config);
    await client.connect();
    const result = await client.callTool("test", { arg: 1 });
    expect(result).toBeDefined();
  });

  it("handles remote config with explicit websocket transport", async () => {
    const config = { type: "remote" as const, url: "ws://localhost:8080/mcp" };
    const client = new McpClient(config);
    await client.connect();
    expect(client.isConnected()).toBe(true);
  });
});