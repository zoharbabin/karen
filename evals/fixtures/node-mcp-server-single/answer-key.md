## Answers
Q: what does this project do / who uses it?
A: "Internal MCP server for SRE runbook automation — exposes `run_shell_command` and `read_config` tools to a connected LLM client during incident response. Used by our on-call engineers, invoked through their MCP-enabled agent client, not by external customers."

Q: what's the deployment context and runtime environment?
A: "It's launched as a long-lived stdio subprocess by whatever MCP client connects to it — usually Claude Desktop or an internal agent framework — running on an internal ops host. It's never deployed to a browser and never exposes a public network endpoint."

Q: what's the audience and does it handle sensitive data?
A: "Internal only — SRE and on-call engineers. No PII, no payment data. But `read_config` can read files under the config directory, and some of those files hold infrastructure credentials, so treat the config directory as sensitive even though there's no formal PII/PCI classification."

Q: any compliance or regulatory requirements?
A: "No. This is internal tooling only — no SOC2, HIPAA, or PCI requirement."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "Both, in different ways. It's built with Claude Code day to day. At runtime, it's the reverse of a normal AI app: an LLM client *calls into* this server over MCP to run tools — this process never calls an LLM itself, never renders model output, and has no conversational surface. It just executes the tool calls the connecting LLM asks for, including `run_shell_command`."

Q: does `run_shell_command` need a narrow allow-list, or is broad shell access intentional for this tool?
A: "Intentional — on-call engineers need to run arbitrary diagnostic and remediation commands during an incident; a fixed allow-list would defeat the point of the tool. We do want every call logged so it's reviewable after the fact, but we don't want it gated to a fixed command list."

Q: what's your coverage threshold?
A: "80% is fine, same as our other internal services."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- runtime AI-powered classification for an MCP server (source shows the `@modelcontextprotocol/sdk` dependency and two tool handlers, but detect_project cannot tell from code alone whether "invoked by an LLM, calls none itself" should classify as `aiPowered: true` — this is the exact interpretive corner BLUEPRINT.md's ai-agent profile section requires the interview to resolve, not assume)
- excessive-agency scope (least-privilege vs. maximal) for the `run_shell_command` tool-call surface (source shows `exec()` called directly on a caller-supplied string with no allow-list, but detect_project can't tell whether that's an intentional maximal-access runbook tool or an oversight that needs a least-privilege allow-list — only the interview can settle which bar applies)
- sensitivity of files reachable through `read_config`'s config directory (source shows `configDir` is read from an env var with a filesystem default, but not what actually lives under that directory in production)
- compliance/regulatory requirements (no compliance artifacts of any kind exist in the repo, so detect_project has no signal either way — must be asked, not assumed absent)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present and configured)
- test runner and coverage tool (repo/vitest.config.ts and the `@vitest/coverage-v8` devDependency already present)
- CI configuration (repo/.github/workflows/ci.yml already present)
- agent context file presence (repo/CLAUDE.md already present)
