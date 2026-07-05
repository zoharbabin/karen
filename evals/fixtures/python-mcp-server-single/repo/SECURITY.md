# Security

This server exposes two tools to whatever LLM client connects over MCP:

- `apply_config_patch` accepts a YAML string from the tool call and merges it
  into the running config. Treat the patch argument as untrusted input — it
  is only as trustworthy as the connecting agent's own tool-call arguments.
- `run_diagnostic_command` runs a shell command supplied by the tool call on
  the host. Broad shell access is intentional for incident response (see
  `.karen.json` `project.agentActions`); every call is logged for review.

Report suspected vulnerabilities to security@example.com.
