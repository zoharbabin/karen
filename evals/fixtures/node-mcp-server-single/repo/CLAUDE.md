# ops-mcp-server — Agent Context

This is an MCP server exposing `run_shell_command` and `read_config` tools to a
connected LLM client for SRE runbook automation. It does not call an LLM itself.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Model selection guidance
Use `sonnet` for implementation and bug fixes on this server. Use `haiku` for
routine doc edits. Escalate to `opus` only for ambiguous tool-permission-scope
decisions.
