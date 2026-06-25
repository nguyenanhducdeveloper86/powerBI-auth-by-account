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

```bash
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
