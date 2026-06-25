#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnvFile } from "./env.js";
import { defaultModelingArgs, defaultModelingCommand } from "./modelingBinary.js";
import { ModelingMcpBridge } from "./modelingMcpBridge.js";

loadEnvFile();

const modelingBridge = new ModelingMcpBridge();

const server = new McpServer({
  name: "mcp-powerbi",
  version: "0.1.0"
});

server.registerTool(
  "auth_status",
  {
    title: "Power BI Modeling MCP auth status",
    description: "Show Modeling MCP authentication configuration. Authentication is handled by Microsoft powerbi-modeling-mcp interactive account login.",
    inputSchema: {}
  },
  async () => jsonResult({
    authProvider: "microsoft-powerbi-modeling-mcp",
    authMode: "interactive_account",
    deviceCodeRestAuth: "disabled",
    modelingCommand: process.env.POWERBI_MODELING_MCP_COMMAND || defaultModelingCommand(),
    modelingArgs: process.env.POWERBI_MODELING_MCP_ARGS || defaultModelingArgs(process.env.POWERBI_MODELING_MCP_COMMAND || defaultModelingCommand()).join(" "),
    knownWorkspaces: uniqueNonEmpty(configuredWorkspaces())
  })
);

server.registerTool(
  "list_semantic_models_in_workspace_via_modeling_mcp",
  {
    title: "List semantic models in known workspace via Microsoft Modeling MCP",
    description: "Use Microsoft powerbi-modeling-mcp interactive account auth to list semantic models inside a known workspace name. The workspace name must be explicit; if it is missing, ask the user instead of guessing.",
    inputSchema: {
      workspaceName: z.string().describe("Exact Fabric/Power BI workspace name, for example 'test-mcp'.")
    }
  },
  async ({ workspaceName }) => {
    return jsonResult({
      source: "microsoft-powerbi-modeling-mcp",
      workspaceName,
      semanticModels: await modelingBridge.listSemanticModelsInWorkspace(workspaceName)
    });
  }
);

server.registerTool(
  "open_modeling_mcp_session",
  {
    title: "Open Power BI Modeling MCP session",
    description: "Trigger Microsoft powerbi-modeling-mcp interactive account auth by connecting to a workspace or workspace/model.",
    inputSchema: {
      workspaceName: z.string().optional().describe("Power BI workspace name. Defaults to POWERBI_DEFAULT_WORKSPACE."),
      semanticModelName: z.string().optional().describe("Optional semantic model name. If omitted, lists semantic models in the workspace.")
    }
  },
  async ({ workspaceName, semanticModelName }) => {
    const workspace = workspaceName || process.env.POWERBI_DEFAULT_WORKSPACE;
    if (!workspace) {
      throw new Error("Missing workspace. Set POWERBI_DEFAULT_WORKSPACE or pass workspaceName.");
    }

    if (semanticModelName) {
      await modelingBridge.connectFabric(workspace, semanticModelName);
      return jsonResult({
        source: "microsoft-powerbi-modeling-mcp",
        authMode: "interactive_account",
        workspaceName: workspace,
        semanticModelName,
        connected: true
      });
    }

    return jsonResult({
      source: "microsoft-powerbi-modeling-mcp",
      authMode: "interactive_account",
      workspaceName: workspace,
      semanticModels: await modelingBridge.listSemanticModelsInWorkspace(workspace)
    });
  }
);

server.registerTool(
  "get_known_workspace_catalog",
  {
    title: "Get known workspace semantic model catalog",
    description: "List semantic models for manually configured POWERBI_KNOWN_WORKSPACES using Microsoft Modeling MCP interactive account auth.",
    inputSchema: {
      workspaceNames: z.array(z.string()).optional().describe("Optional workspace names. Defaults to POWERBI_KNOWN_WORKSPACES, then POWERBI_DEFAULT_WORKSPACE.")
    }
  },
  async ({ workspaceNames }) => {
    const names = uniqueNonEmpty(workspaceNames?.length ? workspaceNames : configuredWorkspaces());
    if (names.length === 0) {
      throw new Error("No known workspaces configured. Set POWERBI_KNOWN_WORKSPACES or POWERBI_DEFAULT_WORKSPACE.");
    }

    const workspaces = [];
    for (const workspaceName of names) {
      workspaces.push({
        name: workspaceName,
        semanticModels: await modelingBridge.listSemanticModelsInWorkspace(workspaceName)
      });
    }

    return jsonResult({
      source: "microsoft-powerbi-modeling-mcp",
      workspaces
    });
  }
);

server.registerTool(
  "execute_dax_query",
  {
    title: "Execute DAX query with CEO defaults",
    description: "Execute a DAX query against a Power BI semantic model using default workspace/model when omitted. This keeps the Microsoft Modeling MCP process alive to reduce repeated login prompts.",
    inputSchema: {
      query: z.string().describe("DAX query text, for example EVALUATE ROW(\"Revenue\", SUM(Visits[TreatmentCost]))."),
      workspaceName: z.string().optional().describe("Power BI workspace name. Defaults to POWERBI_DEFAULT_WORKSPACE."),
      semanticModelName: z.string().optional().describe("Semantic model name. Defaults to POWERBI_DEFAULT_SEMANTIC_MODEL."),
      maxRows: z.number().int().positive().optional().default(100),
      timeoutSeconds: z.number().int().positive().optional().default(120)
    }
  },
  async ({ query, workspaceName, semanticModelName, maxRows, timeoutSeconds }) => {
    const workspace = workspaceName || process.env.POWERBI_DEFAULT_WORKSPACE;
    const model = semanticModelName || process.env.POWERBI_DEFAULT_SEMANTIC_MODEL;
    if (!workspace || !model) {
      throw new Error("Missing workspace/model. Set POWERBI_DEFAULT_WORKSPACE and POWERBI_DEFAULT_SEMANTIC_MODEL, or pass workspaceName and semanticModelName.");
    }

    return jsonResult({
      source: "microsoft-powerbi-modeling-mcp",
      workspaceName: workspace,
      semanticModelName: model,
      result: await modelingBridge.executeDaxQuery({
        workspaceName: workspace,
        semanticModelName: model,
        query,
        maxRows,
        timeoutSeconds
      })
    });
  }
);

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

function configuredWorkspaces(): string[] {
  return [
    ...(process.env.POWERBI_KNOWN_WORKSPACES || "").split(","),
    process.env.POWERBI_DEFAULT_WORKSPACE || ""
  ];
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
