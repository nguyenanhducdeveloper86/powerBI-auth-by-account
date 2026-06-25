#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
  process.exit(0);
}

const binaryPath = resolve(
  process.cwd(),
  "node_modules/@microsoft/powerbi-modeling-mcp-darwin-arm64/dist/powerbi-modeling-mcp"
);

if (!existsSync(binaryPath)) {
  process.exit(0);
}

const check = spawnSync("codesign", ["-dv", binaryPath], {
  encoding: "utf8",
  stdio: "pipe"
});

if (check.status === 0) {
  process.exit(0);
}

const sign = spawnSync("codesign", ["--force", "--sign", "-", binaryPath], {
  encoding: "utf8",
  stdio: "pipe"
});

if (sign.status !== 0) {
  console.warn("Unable to ad-hoc sign Microsoft Power BI Modeling MCP binary.");
  console.warn(sign.stderr || sign.stdout || "codesign failed");
  process.exit(0);
}

console.log("Signed Microsoft Power BI Modeling MCP binary for local macOS execution.");
