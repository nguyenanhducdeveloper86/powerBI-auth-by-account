# Verification

This server is a Claude-facing wrapper around Microsoft's official `powerbi-modeling-mcp`.

## Authentication

Authentication is handled only by Microsoft `powerbi-modeling-mcp` interactive account login.

REST/device-code auth is intentionally disabled because it is often blocked by tenant admin policy.

## What was verified locally

- MCP server starts over stdio and returns its tool list.
- The server exposes Modeling MCP tools only.
- The bundled native Microsoft Modeling MCP binary launches from this repo.
- `get_known_workspace_catalog` can connect to workspace `test-mcp`.
- Workspace `test-mcp` returns semantic models `codex` and `hospital`.
- Verification above was run on macOS. Windows setup uses the native `powerbi-modeling-mcp-win32-x64` binary and avoids `npx`.
- XMLA access requires a Premium/PPU/Fabric capacity workspace.

## Expected login behavior

The first Modeling MCP connection in a fresh Claude/MCP session can trigger Microsoft account login. Follow-up queries in the same running MCP session reuse the Modeling MCP process and connection.
