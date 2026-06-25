# powerBI-auth-by-account

Claude-compatible Power BI MCP using **personal account authentication only**.

This repo is based on Microsoft's official [`powerbi-modeling-mcp`](https://github.com/microsoft/powerbi-modeling-mcp):

- Workspace/model querying uses Microsoft `@microsoft/powerbi-modeling-mcp` and the signed-in user's Power BI/Fabric account.
- REST catalog tools use delegated personal-account tokens from `start_device_login` / `complete_device_login` or `POWERBI_ACCESS_TOKEN`.
- There is no service-principal, app-secret, or client-credentials authentication path in this repo.

## Tools

- `auth_status`
- `start_device_login`
- `complete_device_login`
- `list_workspaces`
- `list_semantic_models`
- `get_catalog`
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

- Directory tenant ID/domain
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
        "POWERBI_TENANT": "vnu.edu.vn",
        "POWERBI_KNOWN_WORKSPACES": "test-mcp",
        "POWERBI_DEFAULT_WORKSPACE": "test-mcp",
        "POWERBI_MODELING_MCP_COMMAND": "/absolute/path/to/powerbi-modeling-mcp-darwin-arm64",
        "POWERBI_MODELING_MCP_ARGS": "--start"
      }
    }
  }
}
```

## Authentication

This server supports only personal-account authentication:

1. `POWERBI_ACCESS_TOKEN` containing a delegated user token.
2. Cached personal-account token from `start_device_login` / `complete_device_login`.
3. Microsoft Modeling MCP account login for XMLA/Fabric connections.

No app secret or service principal is used.

## CEO Workflow

For a simple CEO experience, set:

```env
POWERBI_KNOWN_WORKSPACES=test-mcp
POWERBI_DEFAULT_WORKSPACE=test-mcp
# Optional fallback only. Prefer letting Claude choose from workspace schema.
# POWERBI_DEFAULT_SEMANTIC_MODEL=hospital
```

Then Claude can use `get_known_workspace_catalog` to list models from configured workspaces without REST workspace discovery, choose the relevant semantic model from schema/context, and call `execute_dax_query` for follow-up business questions.

The wrapper keeps the Microsoft Modeling MCP process alive, so repeated questions reuse the same process and should reduce repeated login prompts.

## Account Setup

For REST workspace discovery:

1. Ask Claude to call `start_device_login`.
2. Open the Microsoft verification URL.
3. Sign in with the personal Power BI account.
4. Ask Claude to call `complete_device_login`.

If you do not need REST workspace discovery, configure `POWERBI_KNOWN_WORKSPACES` and let Microsoft Modeling MCP handle account auth when connecting to a known workspace.

## Notes

- `list_workspaces` uses `GET https://api.powerbi.com/v1.0/myorg/groups` with delegated personal-account auth.
- `list_semantic_models` uses delegated personal-account auth.
- `get_known_workspace_catalog` avoids REST discovery and lists semantic models from manually configured workspace names through Microsoft Modeling MCP.
- The first query in a fresh Claude/MCP session can still trigger Microsoft account authentication. Follow-up queries in the same running session reuse the Modeling MCP process and connection.
