## Answers
Q: what does this project do / who uses it?
A: "beacon-ingest is our internal telemetry ingestion backend — other Beacon platform services POST beacons to it over HTTP, a separate worker processes them, and callers poll job status back. Internal only, not customer-facing."

Q: what's your deployment/runtime environment?
A: "Runs as a standalone FastAPI service under uvicorn, talks to a shared Redis instance for job caching. No browser context, nothing client-side — plain backend service."

Q: who's the audience, and any compliance or regulatory requirements?
A: "Internal only — other services in our own infra call it. No SOC2/HIPAA/PCI requirement, no customer PII flows through this service directly."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "No LLM calls at runtime at all — it's telemetry ingestion plumbing. CLAUDE.md is there for contributors using coding agents, but the service itself never calls a model."

Q: your test suite is Playwright-driven end-to-end only — no unit tests, no coverage instrumentation on beacon_ingest.cache or beacon_ingest.config. Is that intentional for this kind of service, or should Karen flag it as a gap?
A: "Intentional. There's not much internal branching logic worth unit-testing in isolation here — it's a thin pass-through between HTTP and Redis. We'd rather exercise the real request/response contract end to end than mock Redis just to produce a coverage percentage. Run coverage-less, assertion-density-only is fine."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- E2E-only test suite intentionality (repo has a Playwright/pytest E2E suite under `tests/e2e/` and zero unit tests anywhere — detect_project can see the absence of a coverage tool but cannot tell whether that's an intentional choice for a thin pass-through service or a gap; BLUEPRINT.md's "E2E-only test suites... typically produce no function-level coverage" section requires this be asked, not silently defaulted either way)
- runtime LLM calls / agentic behavior (source is plain FastAPI handlers with no model client anywhere — detect_project has no field for "does this call an LLM at runtime," only the interview can settle `aiPowered`)

## Must NOT ask (already answerable from detect_project output)
- primary implementation language (unambiguous from `pyproject.toml`, no other manifest present)
- presence of continuous integration (`.github/workflows/ci.yml` already present and visible to detect_project)
- test runner selection (repo's `pyproject.toml` optional-dependencies and `.github/workflows/ci.yml` already show `pytest` + `playwright`, no other runner configured)
- agent context file presence (`CLAUDE.md` already present at repo root)
