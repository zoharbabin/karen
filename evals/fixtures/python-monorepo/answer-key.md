## Answers
Q: what does this project do / who uses it?
A: "Signal Relay is our telemetry platform. `backend/` is the ingestion service customers' agents send telemetry to. `client-lib/` is the Python SDK our other internal services use to call it — not distributed to external customers."

Q: what's the deployment context and runtime environment for each subproject?
A: "Both are plain Python — `backend/` runs as a FastAPI service behind our internal load balancer, `client-lib/` is installed as a library into other internal Python services. Neither is browser-facing."

Q: I see `backend/docs/compliance/SOC2-CONTROLS.md` mapping audit-log and SBOM controls, but nothing like that under `client-lib/`. Is `client-lib` covered by the same SOC2 scope, or is that backend-only?
A: "Backend-only. `backend/` holds customer telemetry and the audit-log evidence trail, so it's SOC2-scoped. `client-lib/` is just an HTTP wrapper — it doesn't store or process customer data itself, so it isn't in SOC2 scope. Don't apply the SBOM/audit-log requirements to `client-lib/`."

Q: what's the audience and does either subproject handle sensitive data?
A: "Internal only — both subprojects are used by our own engineering org, not external customers. `backend/` handles customer telemetry data in transit and at rest, which is why it's SOC2-scoped. `client-lib/` just forwards requests; it doesn't persist anything."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "Built day to day with Claude Code, but neither subproject calls an LLM at runtime or is itself invoked by one — plain telemetry ingestion and a plain HTTP client."

Q: what's your coverage threshold?
A: "80% for both subprojects, same as our other internal services."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- SOC2 scope split between `backend/` and `client-lib/` (source shows `backend/docs/compliance/SOC2-CONTROLS.md` exists with a control mapping, and the root `SECURITY.md` gestures at a scoping split, but `detect_project` can only report file presence — it can't determine on its own whether `client-lib/` shares that compliance scope or is deliberately excluded from it; only the interview settles the split explicitly)
- audience and data sensitivity per subproject (source shows `backend/` handles customer telemetry and holds a signing key for audit-log entries, while `client-lib/` only forwards HTTP requests — `detect_project` can't infer from that alone whether both are equally in scope for SOC2 artifact requirements)
- AI-powered classification for each subproject (neither subproject's source calls an LLM, but `detect_project` can't tell from file presence alone whether either is intended as agent-facing tooling versus plain telemetry infrastructure)
- coverage threshold (no coverage threshold is configured in either `pyproject.toml`, so `detect_project` has no signal either way — must be asked, not assumed at Karen's default)

## Must NOT ask (already answerable from detect_project output)
- linting setup for either subproject (both `backend/pyproject.toml` and `client-lib/pyproject.toml` already configure `[tool.ruff]`)
- test runner and coverage tool for either subproject (both `pyproject.toml` files already declare `pytest` and `pytest-cov` as dev dependencies, and `.github/workflows/ci.yml` already runs `pytest --cov --cov-report=xml` for each)
- CI configuration (repo root `.github/workflows/ci.yml` already present with jobs for both `backend` and `client-lib`)
- agent context file presence (repo root `AGENTS.md` already present)
- whether the repo is a monorepo (two `pyproject.toml` files at `backend/` and `client-lib/` already establish this)
