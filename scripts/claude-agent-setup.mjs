#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = resolve(repoRoot, "dist/server.js");
const serverName = "powerbi-auth-by-account";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.installDeps || !existsSync(resolve(repoRoot, "node_modules"))) {
  run("npm", ["install"]);
}

if (args.build || !existsSync(serverPath)) {
  run("npm", ["run", "build"]);
}

const modelingCommand = args.modelingCommand || findModelingMcpBinary();
const workspaces = args.workspaces || args.workspace || process.env.POWERBI_KNOWN_WORKSPACES || process.env.POWERBI_DEFAULT_WORKSPACE || "test-mcp";
const defaultWorkspace = args.defaultWorkspace || firstCsvValue(workspaces);
const semanticModel = args.semanticModel || process.env.POWERBI_DEFAULT_SEMANTIC_MODEL || "";
const modelingArgs = args.modelingArgs || "--start --authmode=interactive";

const serverConfig = {
  command: "node",
  args: [serverPath],
  env: Object.fromEntries(
    [
      ["POWERBI_KNOWN_WORKSPACES", workspaces],
      ["POWERBI_DEFAULT_WORKSPACE", defaultWorkspace],
      semanticModel ? ["POWERBI_DEFAULT_SEMANTIC_MODEL", semanticModel] : undefined,
      ["POWERBI_MODELING_MCP_COMMAND", modelingCommand],
      ["POWERBI_MODELING_MCP_ARGS", modelingArgs]
    ].filter(Boolean)
  )
};

const desktopConfigBlock = { mcpServers: { [serverName]: serverConfig } };

console.log("Power BI Claude agent setup");
console.log(`Repo: ${repoRoot}`);
console.log(`Server: ${serverPath}`);
console.log(`Modeling MCP: ${modelingCommand}`);
console.log(`Known workspaces: ${workspaces}`);
console.log("");

if (args.writeDesktop) {
  const configPath = args.desktopConfig || findClaudeDesktopConfigPath();
  writeClaudeDesktopConfig(configPath, serverConfig);
  console.log(`Updated Claude Desktop config: ${configPath}`);
  console.log("Close and reopen Claude Desktop before testing the MCP server.");
  console.log("");
}

if (args.installClaudeCode) {
  const claudeArgs = [
    "mcp",
    "add",
    serverName,
    "--scope",
    args.scope || "user",
    "--env",
    `POWERBI_KNOWN_WORKSPACES=${workspaces}`,
    "--env",
    `POWERBI_DEFAULT_WORKSPACE=${defaultWorkspace}`,
    "--env",
    `POWERBI_MODELING_MCP_COMMAND=${modelingCommand}`,
    "--env",
    `POWERBI_MODELING_MCP_ARGS=${modelingArgs}`
  ];
  if (semanticModel) {
    claudeArgs.push("--env", `POWERBI_DEFAULT_SEMANTIC_MODEL=${semanticModel}`);
  }
  claudeArgs.push("--", "node", serverPath);
  run("claude", claudeArgs);
}

console.log("Claude Desktop mcpServers block:");
console.log(JSON.stringify(desktopConfigBlock, null, 2));
console.log("");
console.log("Claude Code command:");
console.log(formatClaudeCodeCommand({ workspaces, defaultWorkspace, semanticModel, modelingCommand, modelingArgs }));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--workspace":
        parsed.workspace = requireValue(argv, ++i, arg);
        break;
      case "--workspaces":
        parsed.workspaces = requireValue(argv, ++i, arg);
        break;
      case "--default-workspace":
        parsed.defaultWorkspace = requireValue(argv, ++i, arg);
        break;
      case "--semantic-model":
        parsed.semanticModel = requireValue(argv, ++i, arg);
        break;
      case "--modeling-command":
        parsed.modelingCommand = requireValue(argv, ++i, arg);
        break;
      case "--modeling-args":
        parsed.modelingArgs = requireValue(argv, ++i, arg);
        break;
      case "--desktop-config":
        parsed.desktopConfig = requireValue(argv, ++i, arg);
        break;
      case "--write-desktop":
        parsed.writeDesktop = true;
        break;
      case "--install-claude-code":
        parsed.installClaudeCode = true;
        break;
      case "--scope":
        parsed.scope = requireValue(argv, ++i, arg);
        break;
      case "--install-deps":
        parsed.installDeps = true;
        break;
      case "--build":
        parsed.build = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function findModelingMcpBinary() {
  const platformMap = {
    "win32-x64": "@microsoft/powerbi-modeling-mcp-win32-x64/dist/powerbi-modeling-mcp.exe",
    "darwin-arm64": "@microsoft/powerbi-modeling-mcp-darwin-arm64/dist/powerbi-modeling-mcp",
    "darwin-x64": "@microsoft/powerbi-modeling-mcp-darwin-x64/dist/powerbi-modeling-mcp",
    "linux-x64": "@microsoft/powerbi-modeling-mcp-linux-x64/dist/powerbi-modeling-mcp"
  };
  const mapped = platformMap[`${process.platform}-${process.arch}`];
  const candidates = mapped ? [resolve(repoRoot, "node_modules", mapped)] : [];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const microsoftDir = resolve(repoRoot, "node_modules/@microsoft");
  if (existsSync(microsoftDir)) {
    for (const entry of readdirSync(microsoftDir)) {
      if (!entry.startsWith("powerbi-modeling-mcp-")) continue;
      const dist = resolve(microsoftDir, entry, "dist");
      for (const binary of ["powerbi-modeling-mcp.exe", "powerbi-modeling-mcp"]) {
        const candidate = resolve(dist, binary);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  return platform() === "win32" ? "powerbi-modeling-mcp.exe" : "npx";
}

function findClaudeDesktopConfigPath() {
  if (process.env.CLAUDE_DESKTOP_CONFIG) {
    return process.env.CLAUDE_DESKTOP_CONFIG;
  }

  if (platform() === "darwin") {
    return join(homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  }

  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const packagesDir = join(localAppData, "Packages");
      if (existsSync(packagesDir)) {
        const packageName = readdirSync(packagesDir).find(name => /^Claude_/i.test(name));
        if (packageName) {
          return join(packagesDir, packageName, "LocalCache/Roaming/Claude/claude_desktop_config.json");
        }
      }
    }
    return join(process.env.APPDATA || join(homedir(), "AppData/Roaming"), "Claude/claude_desktop_config.json");
  }

  return join(homedir(), ".config/Claude/claude_desktop_config.json");
}

function writeClaudeDesktopConfig(configPath, config) {
  mkdirSync(dirname(configPath), { recursive: true });

  let current = {};
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf8").trim();
    current = raw ? JSON.parse(raw) : {};
    const backupPath = `${configPath}.bak.${timestamp()}`;
    writeFileSync(backupPath, JSON.stringify(current, null, 2));
    console.log(`Backup: ${backupPath}`);
  }

  current.mcpServers = current.mcpServers && typeof current.mcpServers === "object"
    ? current.mcpServers
    : {};
  current.mcpServers[serverName] = config;

  writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`);
}

function formatClaudeCodeCommand({ workspaces, defaultWorkspace, semanticModel, modelingCommand, modelingArgs }) {
  const parts = [
    "claude mcp add powerbi-auth-by-account --scope user",
    `--env POWERBI_KNOWN_WORKSPACES=${shellQuote(workspaces)}`,
    `--env POWERBI_DEFAULT_WORKSPACE=${shellQuote(defaultWorkspace)}`,
    semanticModel ? `--env POWERBI_DEFAULT_SEMANTIC_MODEL=${shellQuote(semanticModel)}` : undefined,
    `--env POWERBI_MODELING_MCP_COMMAND=${shellQuote(modelingCommand)}`,
    `--env POWERBI_MODELING_MCP_ARGS=${shellQuote(modelingArgs)}`,
    "--",
    "node",
    shellQuote(serverPath)
  ].filter(Boolean);
  return parts.join(" ");
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: platform() === "win32"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed`);
  }
}

function shellQuote(value) {
  if (platform() === "win32") {
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function firstCsvValue(value) {
  return value.split(",").map(item => item.trim()).find(Boolean) || "";
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function printHelp() {
  console.log(`Usage:
  npm run setup:agent -- --workspaces test-mcp
  npm run setup:agent -- --workspaces test-mcp --write-desktop
  npm run setup:agent -- --workspaces test-mcp --install-claude-code

Options:
  --workspaces <csv>          Known workspace names, comma-separated
  --default-workspace <name>  Default workspace for CEO questions
  --semantic-model <name>     Optional default semantic model fallback
  --modeling-command <path>   Native Microsoft Modeling MCP binary
  --modeling-args <args>      Defaults to "--start --authmode=interactive"
  --write-desktop             Merge config into Claude Desktop config
  --desktop-config <path>     Explicit Claude Desktop config path
  --install-claude-code       Run "claude mcp add ..."
  --scope <scope>             Claude Code scope, default: user
  --install-deps              Run npm install
  --build                     Run npm run build`);
}
