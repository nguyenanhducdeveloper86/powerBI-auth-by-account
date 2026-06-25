import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot } from "./env.js";

const PLATFORM_BINARY_MAP: Record<string, string> = {
  "win32-x64": "@microsoft/powerbi-modeling-mcp-win32-x64/dist/powerbi-modeling-mcp.exe",
  "darwin-arm64": "@microsoft/powerbi-modeling-mcp-darwin-arm64/dist/powerbi-modeling-mcp",
  "darwin-x64": "@microsoft/powerbi-modeling-mcp-darwin-x64/dist/powerbi-modeling-mcp",
  "linux-x64": "@microsoft/powerbi-modeling-mcp-linux-x64/dist/powerbi-modeling-mcp"
};

export function resolveModelingMcpBinary(): string | undefined {
  const platformKey = `${process.platform}-${process.arch}`;
  const mapped = PLATFORM_BINARY_MAP[platformKey];
  if (mapped) {
    const candidate = resolve(projectRoot(), "node_modules", mapped);
    if (existsSync(candidate)) return candidate;
  }

  const microsoftDir = resolve(projectRoot(), "node_modules/@microsoft");
  if (!existsSync(microsoftDir)) return undefined;

  for (const entry of readdirSync(microsoftDir)) {
    if (!entry.startsWith("powerbi-modeling-mcp-")) continue;
    const dist = resolve(microsoftDir, entry, "dist");
    for (const binary of ["powerbi-modeling-mcp.exe", "powerbi-modeling-mcp"]) {
      const candidate = resolve(dist, binary);
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

export function defaultModelingCommand(): string {
  return resolveModelingMcpBinary() || "npx";
}

export function defaultModelingArgs(command: string): string[] {
  return command === "npx"
    ? ["-y", "@microsoft/powerbi-modeling-mcp@latest", "--start", "--authmode=interactive"]
    : ["--start", "--authmode=interactive"];
}
