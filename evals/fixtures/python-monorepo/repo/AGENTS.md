# Agent Instructions — Signal Relay

This repo has two independently-lifecycled Python subprojects: `backend/`
(the ingestion service, SOC2-scoped) and `client-lib/` (the Python SDK,
not SOC2-scoped). Each has its own `pyproject.toml` and test suite.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Model selection guidance
- `haiku` — quick, routine tasks: file lookup, grep, diff, formatting.
- `sonnet` — standard/deep tasks: implementation, bug fixes, tests, review.
- `opus` — hardest problems: ambiguous multi-domain synthesis.

## Notes for agents
- `backend/` handles customer telemetry — treat anything under
  `backend/src/signal_relay_backend/` as customer-data-adjacent.
- `client-lib/` ships to other internal services as a dependency — keep its
  public surface stable; it has no SOC2 scope of its own.
