## Answers
Q: what does this project do / who uses it?
A: "Internal MCP server for incident response — exposes `apply_config_patch` and `run_diagnostic_command` tools to a connected LLM client during incidents. Used by our on-call engineers, invoked through their MCP-enabled agent client, not by external customers."

Q: what's the deployment context and runtime environment?
A: "It's launched as a long-lived stdio subprocess by whatever MCP client connects to it — usually Claude Desktop or an internal agent framework — running on an internal ops host. It's never deployed to a browser and never exposes a public network endpoint."

Q: what's the audience and does it handle sensitive data?
A: "Internal only — SRE and on-call engineers. No PII, no payment data. But `apply_config_patch` writes into the live incident-response config, and `run_diagnostic_command` can read anything the host process can read, so treat both tool surfaces as sensitive even though there's no formal PII/PCI classification."

Q: any compliance or regulatory requirements?
A: "No. This is internal tooling only — no SOC2, HIPAA, or PCI requirement."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "Both, in different ways. It's built with Claude Code day to day. At runtime, it's the reverse of a normal AI app: an LLM client *calls into* this server over MCP to run tools — this process never calls an LLM itself, never renders model output, and has no conversational surface. It just executes the tool calls the connecting LLM asks for, including `run_diagnostic_command` and `apply_config_patch`."

Q: does `run_diagnostic_command` need a narrow allow-list, or is broad shell access intentional for this tool?
A: "Intentional — on-call engineers need to run arbitrary diagnostic and remediation commands during an incident; a fixed allow-list would defeat the point of the tool. We do want every call logged so it's reviewable after the fact, but we don't want it gated to a fixed command list."

Q: what's your coverage threshold?
A: "80% is fine, same as our other internal services."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- runtime AI-powered classification for an MCP server (source shows the `mcp` dependency and two tool handlers, but detect_project cannot tell from code alone whether "invoked by an LLM, calls none itself" should classify as `aiPowered: true` — this is the exact interpretive corner BLUEPRINT.md's ai-agent profile section requires the interview to resolve, not assume, and the corner this fixture stresses in parity with the Node and Go MCP-server fixtures)
- excessive-agency scope (least-privilege vs. maximal) for the `run_diagnostic_command` tool-call surface (source shows `subprocess.run(..., shell=True)` called directly on a caller-supplied string with no allow-list, but detect_project can't tell whether that's an intentional maximal-access incident-response tool or an oversight that needs a least-privilege allow-list — only the interview can settle which bar applies)
- sensitivity of the config surface reachable through `apply_config_patch` (source shows the patch is merged directly into the running config, but not what production data or access that config controls)
- compliance/regulatory requirements (no compliance artifacts of any kind exist in the repo, so detect_project has no signal either way — must be asked, not assumed absent)

## Must NOT ask (already answerable from detect_project output)
- test runner and coverage tool (repo/pyproject.toml's `[tool.pytest.ini_options]` and `pytest-cov` dependency already present)
- CI configuration (repo/.github/workflows/ci.yml already present)
- agent context file presence (repo/CLAUDE.md already present)
- primary implementation language (unambiguous from `pyproject.toml`, no other manifest present)
