# pi-mcp-tools

Universal MCP (Model Context Protocol) tools extension for pi coding agent.

## Installation

```bash
cd ~/.pi/agent/extensions
git clone <repository-url> pi-mcp-tools
cd pi-mcp-tools
npm install
```

Or install as a pi package:

```bash
pi install git:github.com/yourusername/pi-mcp-tools
```

## Configuration

Add MCP server configuration to `~/.pi/agent/settings.json` or `.pi/settings.json`:

```json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/Projects"],
        "enabled": true,
        "toolPrefix": "fs",
        "filterPatterns": ["read.*", "write.*", "list.*"]
      },
      {
        "name": "github",
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "your-github-token"
        },
        "enabled": true
      },
      {
        "name": "postgres",
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
        "enabled": false
      },
      {
        "name": "remote-server",
        "type": "remote",
        "url": "http://localhost:3000/sse",
        "transport": "sse",
        "headers": {
          "Authorization": "Bearer token"
        },
        "enabled": true
      },
      {
        "name": "websocket-server",
        "type": "remote",
        "url": "ws://localhost:8080/mcp",
        "transport": "websocket",
        "enabled": true
      }
    ],
    "autoReconnect": true,
    "reconnectInterval": 5000
  }
}
```

## Server Configuration Options

### Local Servers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique server identifier |
| `type` | "local" | Yes | Server type |
| `command` | string | Yes | Command to execute (e.g., `npx`, `node`) |
| `args` | string[] | Yes | Command arguments |
| `env` | object | No | Environment variables |
| `cwd` | string | No | Working directory |
| `enabled` | boolean | No | Enable/disable server (default: true) |
| `toolPrefix` | string | No | Custom prefix for tool names (default: `mcp_{name}`) |
| `filterPatterns` | string[] | No | Regex patterns to filter tools |

### Remote Servers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique server identifier |
| `type` | "remote" | Yes | Server type |
| `url` | string | Yes | Server URL |
| `transport` | "sse" \| "websocket" | Yes | Transport protocol |
| `headers` | object | No | HTTP headers |
| `enabled` | boolean | No | Enable/disable server (default: true) |
| `toolPrefix` | string | No | Custom prefix for tool names |
| `filterPatterns` | string[] | No | Regex patterns to filter tools |

### Global Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoReconnect` | boolean | true | Auto-reconnect on connection loss |
| `reconnectInterval` | number | 5000 | Reconnect interval in milliseconds |

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `/mcp-status` | Show MCP connection status |
| `/mcp-reconnect` | Reconnect to all MCP servers |
| `/mcp-health` | Run health check on all servers |
| `/mcp-list` | List all available MCP tools |

### Flags

| Flag | Description |
|------|-------------|
| `--mcp-debug` | Enable debug logging |

### Tools

All MCP tools are automatically registered with the naming convention:
- Default: `mcp_{serverName}_{toolName}`
- Custom: `{toolPrefix}_{toolName}`

Example tool names:
- `mcp_filesystem_read_file`
- `mcp_github_create_issue`
- `fs_read_file` (with custom prefix)

## Example MCP Servers

### Filesystem

```json
{
  "name": "filesystem",
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/watch"],
  "enabled": true
}
```

### GitHub

```json
{
  "name": "github",
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "ghp_..."
  },
  "enabled": true
}
```

### PostgreSQL

```json
{
  "name": "postgres",
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/db"],
  "enabled": true
}
```

### Git

```json
{
  "name": "git",
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-git"],
  "enabled": true
}
```

### Fetch/HTTP

```json
{
  "name": "fetch",
  "type": "local",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"],
  "enabled": true
}
```

## Development

```bash
npm install
npm run build
npm run format
npm run lint
```

## Testing

Test with pi coding agent:

```bash
pi -e ./src/index.ts --mcp-debug
```

Or install globally and use:

```bash
pi
```

## License

MIT
