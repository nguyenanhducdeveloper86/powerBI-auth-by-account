# powerBI-auth-by-account

Claude-compatible Power BI MCP using **Microsoft Power BI Modeling MCP interactive account login only**.

This repo is based on Microsoft's official [`powerbi-modeling-mcp`](https://github.com/microsoft/powerbi-modeling-mcp).

## What This Does

- Uses Microsoft `powerbi-modeling-mcp` for Power BI/Fabric authentication.
- Uses interactive account auth via Modeling MCP.
- Keeps the Modeling MCP process alive so follow-up CEO questions reuse the same session.
- Uses manually configured known workspace names instead of REST workspace discovery.

## What This Does Not Do

- No REST device-code login.
- No service principal.
- No app secret.
- No REST `/groups` workspace discovery.

This is intentional because REST/device-code auth is often blocked by tenant admin policy.

## Tools

- `auth_status`
- `open_modeling_mcp_session`
- `list_semantic_models_in_workspace_via_modeling_mcp`
- `get_known_workspace_catalog`
- `execute_dax_query`

## Install

Prerequisites:

- Node.js 18 or newer
- git

```bash
git clone https://github.com/nguyenanhducdeveloper86/powerBI-auth-by-account.git
cd powerBI-auth-by-account
npm install
npm run setup
npm run build
```

On macOS, `npm install` also ad-hoc signs the Microsoft native Modeling MCP binary so Claude can launch it without the unsigned-binary failure.

`npm run setup` asks for:

- Microsoft `powerbi-modeling-mcp` command and args
- Known workspace names
- Default CEO workspace
- Optional default semantic model fallback

It writes a local `.env` file with mode `0600`. The MCP server loads this file automatically on start.

## Agent Auto Setup

Claude agents can generate or write Claude configuration with:

```bash
npm run setup:agent -- --workspaces test-mcp
```

Write directly to Claude Desktop config, with an automatic backup:

```bash
npm run setup:agent -- --workspaces test-mcp --write-desktop
```

Register directly with Claude Code:

```bash
npm run setup:agent -- --workspaces test-mcp --install-claude-code
```

The script installs dependencies/builds when needed, detects the native Microsoft Modeling MCP binary for the OS, and uses `--start --authmode=interactive`.

## Claude Code

Register the MCP server with Claude Code:

```bash
claude mcp add powerbi-auth-by-account --scope user \
  --env POWERBI_KNOWN_WORKSPACES="test-mcp" \
  --env POWERBI_DEFAULT_WORKSPACE="test-mcp" \
  --env POWERBI_MODELING_MCP_COMMAND="/absolute/path/to/powerbi-modeling-mcp-native-binary" \
  --env POWERBI_MODELING_MCP_ARGS="--start --authmode=interactive" \
  -- node /absolute/path/to/powerBI-auth-by-account/dist/server.js
```

On Windows, do not use `npx` for `POWERBI_MODELING_MCP_COMMAND`. Point directly to the native Microsoft Modeling MCP binary, for example:

```text
C:\Users\<you>\powerBI-auth-by-account\node_modules\@microsoft\powerbi-modeling-mcp-win32-x64\dist\powerbi-modeling-mcp.exe
```

## Claude Desktop Config

Use the built JS after `npm run build`.

For this machine, start from [`docs/claude-desktop-config.example.json`](docs/claude-desktop-config.example.json). It points the wrapper to the Microsoft MCP binary installed by this repo:

```text
/Users/ducna/powerBI-auth-by-account/node_modules/.bin/powerbi-modeling-mcp-darwin-arm64
```

Generic config:

```json
{
  "mcpServers": {
    "powerbi-auth-by-account": {
      "command": "node",
      "args": ["/absolute/path/to/powerBI-auth-by-account/dist/server.js"],
      "env": {
        "POWERBI_KNOWN_WORKSPACES": "test-mcp",
        "POWERBI_DEFAULT_WORKSPACE": "test-mcp",
        "POWERBI_MODELING_MCP_COMMAND": "/absolute/path/to/powerbi-modeling-mcp-darwin-arm64",
        "POWERBI_MODELING_MCP_ARGS": "--start --authmode=interactive"
      }
    }
  }
}
```

Windows example:

```json
{
  "mcpServers": {
    "powerbi-auth-by-account": {
      "command": "node",
      "args": ["C:\\Users\\<you>\\powerBI-auth-by-account\\dist\\server.js"],
      "env": {
        "POWERBI_KNOWN_WORKSPACES": "test-mcp",
        "POWERBI_DEFAULT_WORKSPACE": "test-mcp",
        "POWERBI_MODELING_MCP_COMMAND": "C:\\Users\\<you>\\powerBI-auth-by-account\\node_modules\\@microsoft\\powerbi-modeling-mcp-win32-x64\\dist\\powerbi-modeling-mcp.exe",
        "POWERBI_MODELING_MCP_ARGS": "--start --authmode=interactive"
      }
    }
  }
}
```

Claude Desktop config paths:

- Standard install: `%APPDATA%\Claude\claude_desktop_config.json`
- Microsoft Store/MSIX install: `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude\claude_desktop_config.json`

Close Claude Desktop completely before editing the config file. Otherwise Claude can overwrite the file and remove `mcpServers`.

## CEO Workflow

For a simple CEO experience, set:

```env
POWERBI_KNOWN_WORKSPACES=test-mcp
POWERBI_DEFAULT_WORKSPACE=test-mcp
# Optional fallback only. Prefer letting Claude choose from workspace schema.
# POWERBI_DEFAULT_SEMANTIC_MODEL=hospital
```

Then Claude can:

1. Call `open_modeling_mcp_session` to trigger Microsoft account login through Modeling MCP.
2. Call `get_known_workspace_catalog` to list semantic models in configured workspaces.
3. Choose the relevant semantic model from context/schema.
4. Call `execute_dax_query` for business questions.

The first query in a fresh Claude/MCP session can still trigger Microsoft account authentication. Follow-up queries in the same running session reuse the Modeling MCP process and connection.

## Common Pitfalls

- Windows: do not use `npx` for the Modeling MCP command. Use the native `powerbi-modeling-mcp.exe` path.
- Authentication is `--authmode=interactive` through Microsoft Modeling MCP. Do not use REST device-code login.
- Claude Desktop Store/MSIX uses the virtualized config path under `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude`.
- Close Claude Desktop before editing `claude_desktop_config.json`.
- Always configure a real Premium/PPU workspace name in `POWERBI_KNOWN_WORKSPACES`; do not rely on `My workspace`.
