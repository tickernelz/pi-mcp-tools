# pi-mcp-tools

Universal MCP (Model Context Protocol) tools extension for pi coding agent.

## Install

```bash
pi install git:github.com/tickernelz/pi-mcp-tools
```

Or manually:

```bash
cd ~/.pi/agent/extensions
git clone https://github.com/tickernelz/pi-mcp-tools.git
cd pi-mcp-tools && npm install
```

## Quick Start

Add to `~/.pi/agent/settings.json`:

```json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
        "enabled": true
      },
      {
        "name": "github",
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "ghp_..." },
        "enabled": true
      }
    ]
  }
}
```

## Config Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Server identifier |
| `type` | `"local"` \| `"remote"` | ✓ | Server type |
| `command` | string | local ✓ | Command (e.g., `npx`) |
| `args` | string[] | local ✓ | Command arguments |
| `url` | string | remote ✓ | Server URL |
| `transport` | `"sse"` \| `"websocket"` | remote ✓ | Transport protocol |
| `env` | object | - | Environment variables |
| `toolPrefix` | string | - | Custom tool name prefix |
| `filterPatterns` | string[] | - | Regex to filter tools |
| `enabled` | boolean | - | Enable/disable (default: true) |

### Global Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoReconnect` | boolean | `true` | Auto-reconnect on failure |
| `reconnectInterval` | number | `5000` | Reconnect interval (ms) |

## Commands

| Command | Description |
|---------|-------------|
| `/mcp-status` | Show server connection status |
| `/mcp-reconnect` | Reconnect all servers |
| `/mcp-health` | Health check all servers |
| `/mcp-list` | List available tools |

**Flag:** `--mcp-debug` - Enable debug logging

## Tools

Tools auto-registered as: `mcp_{server}_{tool}` or `{toolPrefix}_{tool}`

Example: `fs_read_file`, `mcp_github_create_issue`

## Popular MCP Servers

```json
// Filesystem
{ "name": "fs", "type": "local", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] }

// GitHub
{ "name": "github", "type": "local", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "ghp_..." } }

// Git
{ "name": "git", "type": "local", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-git"] }

// PostgreSQL
{ "name": "db", "type": "local", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/db"] }

// Fetch/HTTP
{ "name": "fetch", "type": "local", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-fetch"] }

// Remote (SSE)
{ "name": "remote", "type": "remote", "url": "http://localhost:3000/sse", "transport": "sse" }

// Remote (WebSocket)
{ "name": "ws", "type": "remote", "url": "ws://localhost:8080/mcp", "transport": "websocket" }
```

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
- [npm](https://www.npmjs.com/package/pi-mcp-tools)
- [Report issues](https://github.com/tickernelz/pi-mcp-tools/issues)

## License

MIT
