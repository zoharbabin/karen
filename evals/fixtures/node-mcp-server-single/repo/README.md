# ops-mcp-server

An internal [Model Context Protocol](https://modelcontextprotocol.io) server. It exposes
two tools — `run_shell_command` and `read_config` — over stdio so our SRE team's LLM
client can execute runbook commands during incident response.

## Tools

- `run_shell_command` — runs a shell command on the host and returns stdout.
- `read_config` — returns the server's non-secret runtime configuration.

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
