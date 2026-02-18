# @zhafron/pi-mcp-tools

[![npm version](https://img.shields.io/npm/v/@zhafron/pi-mcp-tools)](https://www.npmjs.com/package/@zhafron/pi-mcp-tools)
[![npm downloads](https://img.shields.io/npm/dm/@zhafron/pi-mcp-tools)](https://www.npmjs.com/package/@zhafron/pi-mcp-tools)
[![license](https://img.shields.io/npm/l/@zhafron/pi-mcp-tools)](https://www.npmjs.com/package/@zhafron/pi-mcp-tools)

Universal MCP (Model Context Protocol) tools extension for pi coding agent.

## Install

```bash
pi install git:github.com/tickernelz/pi-mcp-tools
```

Or via npm:

```bash
pi install npm:@zhafron/pi-mcp-tools
```

## Quick Start

Add to `~/.pi/agent/settings.json`:

```json
{
  "mcp": {
    "web-search": {
      "type": "local",
      "command": ["npx", "-y", "@zhafron/mcp-web-search"]
    },
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp", "--api-key", "your-api-key"]
    },
    "deepwiki": {
      "type": "remote",
      "url": "https://mcp.deepwiki.com/mcp"
    },
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
      "enabled": true
    }
  }
}
```

## Config Format

Each MCP server is a key under `"mcp"` with the following structure:

### Local Servers

```json
{
  "server-name": {
    "type": "local",
    "command": ["npx", "-y", "package-name", "args..."],
    "env": { "KEY": "value" },
    "cwd": "/path/to/workdir",
    "enabled": true,
    "toolPrefix": "prefix",
    "filterPatterns": ["pattern1", "pattern2"]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"local"` | ✓ | Server type |
| `command` | `string[]` | ✓ | Command and args as array |
| `env` | `object` | - | Environment variables |
| `cwd` | `string` | - | Working directory |
| `enabled` | `boolean` | - | Enable/disable (default: true) |
| `toolPrefix` | `string` | - | Custom tool name prefix |
| `filterPatterns` | `string[]` | - | Regex to filter tools |

### Remote Servers

```json
{
  "server-name": {
    "type": "remote",
    "url": "https://example.com/mcp",
    "headers": { "Authorization": "Bearer token" },
    "enabled": true,
    "toolPrefix": "prefix"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"remote"` | ✓ | Server type |
| `url` | `string` | ✓ | MCP server URL (auto-detects transport) |
| `headers` | `object` | - | HTTP headers |
| `enabled` | `boolean` | - | Enable/disable (default: true) |
| `toolPrefix` | `string` | - | Custom tool name prefix |

**Transport auto-detection:**
- WebSocket: `ws://`, `wss://`, or URL contains "websocket"
- StreamableHTTP: MCP protocol 2025-xx (newest standard)
- SSE: Legacy servers or fallback

## Commands

| Command | Description |
|---------|-------------|
| `/mcp-status` | Show server status with health check |
| `/mcp-reconnect` | Reconnect all servers |
| `/mcp-toggle <server>` | Toggle server on/off |
| `/mcp-list` | List available tools |
| `/mcp-tools` | Toggle tools per server (interactive UI) |

**Flag:** `--mcp-debug` - Enable debug logging

## Tools

Tools auto-registered as: `mcp_{server}_{tool}` or `{toolPrefix}_{tool}`

Example: `mcp_web-search_search`, `ctx7_read_docs`

## Examples

### Multiple Providers

```json
{
  "mcp": {
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp", "--api-key", "ctx7sk-..."]
    },
    "deepwiki": {
      "type": "remote",
      "url": "https://mcp.deepwiki.com/mcp"
    },
    "chrome-devtools": {
      "type": "local",
      "command": ["npx", "-y", "chrome-devtools-mcp@latest"]
    },
    "web-search": {
      "type": "local",
      "command": ["npx", "-y", "@zhafron/mcp-web-search"]
    },
    "octocode": {
      "type": "local",
      "command": ["npx", "octocode-mcp@latest"]
    }
  }
}
```

### With Environment Variables

```json
{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    },
    "postgres": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/db"]
    }
  }
}
```

### Disable Server Temporarily

```json
{
  "mcp": {
    "web-search": {
      "type": "local",
      "command": ["npx", "-y", "@zhafron/mcp-web-search"],
      "enabled": true
    },
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "enabled": false
    }
  }
}
```

### Disable Individual Tools

Tools can be disabled via `/mcp-tools` command (interactive UI) or manually in settings:

```json
{
  "mcp": { ... },
  "mcpDisabledTools": ["mcp_context7_query-docs", "mcp_web-search_fetch_url"]
}
```

Disabled tools are persisted globally in `~/.pi/agent/settings.json`.

## Development

```bash
npm install
npm run build       # Type check
npm run format      # Format code
npm run format:check
```

## Publish

```bash
npm version patch  # Bump version
git push --tags    # Trigger npm publish
```

## Links

- [GitHub](https://github.com/tickernelz/pi-mcp-tools)
- [npm](https://www.npmjs.com/package/@zhafron/pi-mcp-tools)
- [Report issues](https://github.com/tickernelz/pi-mcp-tools/issues)

## License

MIT
