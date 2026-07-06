# ops-mcp-server

An internal [Model Context Protocol](https://modelcontextprotocol.io) server. It exposes
two tools — `run_shell_command` and `read_config` — over stdio so our SRE team's LLM
client can execute runbook commands during incident response.

## Tools

| Tool | Description |
|---|---|
| `run_shell_command` | Runs a shell command on the host and returns stdout. |
| `read_config` | Returns the server's non-secret runtime configuration. |
| `rotate_credentials` | Rotates on-host service credentials and returns a confirmation. |

<!-- Decoy: `apply_patch` was removed in v0.1.0 and intentionally is not listed
     above — this note names a retired tool but is not a claim that it still
     exists, so it should not be flagged as doc-contract-drift. -->

## Development

```bash
npm install
npm test
npm run build
npm start
```

## Scope

This server is a tool provider only. It does not call an LLM itself and has no
conversational surface — the connecting client is the one doing the reasoning; this
process only executes the tool calls it receives.
