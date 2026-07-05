# incident-mcp-server — Agent Context

This is an MCP server exposing `apply_config_patch` and `run_diagnostic_command`
tools to a connected LLM client for incident response. It does not call an LLM
itself — a connecting agent client invokes these tools; this process only
executes them.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Model selection guidance
Use `sonnet` for implementation and bug fixes on this server. Use `haiku` for
routine doc edits. Escalate to `opus` only for ambiguous tool-permission-scope
decisions.
