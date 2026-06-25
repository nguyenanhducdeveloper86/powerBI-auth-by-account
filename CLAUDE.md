# Claude Agent Setup

Use this when a Claude agent needs to configure the MCP server from a fresh clone.

## One-command setup

```bash
npm run setup:agent -- --workspaces test-mcp --write-desktop
```

What it does:

- Runs `npm install` if `node_modules` is missing.
- Runs `npm run build` if `dist/server.js` is missing.
- Detects the native Microsoft `powerbi-modeling-mcp` binary for the current OS.
- Generates a Claude Desktop `mcpServers.powerbi-auth-by-account` block.
- With `--write-desktop`, merges that block into Claude Desktop config and creates a backup.

## Claude Code

To register directly with Claude Code:

```bash
npm run setup:agent -- --workspaces test-mcp --install-claude-code
```

## Rules

- Use Modeling MCP interactive auth only: `--start --authmode=interactive`.
- Do not add REST device-code tools or service-principal auth.
- Use real Premium/PPU workspace names in `POWERBI_KNOWN_WORKSPACES`.
- Do not rely on `My workspace`.
