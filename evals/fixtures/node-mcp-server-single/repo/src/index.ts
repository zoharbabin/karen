import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runShellCommandTool, handleRunShellCommand } from "./tools/runShellCommand.js";
import { readConfigTool, handleReadConfig } from "./tools/readConfig.js";

const server = new Server(
  { name: "ops-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/list", async () => ({
  tools: [runShellCommandTool, readConfigTool],
}));

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "run_shell_command") {
    return handleRunShellCommand(args);
  }
  if (name === "read_config") {
    return handleReadConfig(args);
  }
  throw new Error(`Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting ops-mcp-server:", err);
  process.exit(1);
});
