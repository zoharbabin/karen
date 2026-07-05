"""Entry point: registers tools and serves them over stdio to whatever MCP
client connects (Claude Desktop, an internal on-call agent framework, etc.).
This process never calls an LLM itself — it only executes the tool calls the
connecting agent sends.
"""

from mcp.server import Server
from mcp.server.stdio import stdio_server

from incident_mcp_server.tools.apply_config_patch import (
    APPLY_CONFIG_PATCH_TOOL,
    handle_apply_config_patch,
)
from incident_mcp_server.tools.run_diagnostic_command import (
    RUN_DIAGNOSTIC_COMMAND_TOOL,
    handle_run_diagnostic_command,
)

server = Server("incident-mcp-server")


@server.list_tools()
async def list_tools():
    return [APPLY_CONFIG_PATCH_TOOL, RUN_DIAGNOSTIC_COMMAND_TOOL]


@server.call_tool()
async def call_tool(name, arguments):
    if name == "apply_config_patch":
        return handle_apply_config_patch(arguments)
    if name == "run_diagnostic_command":
        return handle_run_diagnostic_command(arguments)
    raise ValueError(f"Unknown tool: {name}")


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
