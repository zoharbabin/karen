# incident-mcp-server

An MCP server exposing incident-response tools to a connected LLM client:

- `apply_config_patch` — applies a YAML config patch during an incident
- `run_diagnostic_command` — runs a read/write diagnostic shell command on the host

This process never calls an LLM itself. It is invoked by whatever MCP-enabled
agent client connects to it (Claude Desktop, an internal on-call agent
framework, etc.) over stdio during incident response.

## Install

```
pip install -e .
```

## Run

```
python -m incident_mcp_server.server
```

## Test

```
pytest
```
