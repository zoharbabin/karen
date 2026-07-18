## Answers
Q: what does this project do / who uses it?
A: "It's prism-sdk — a Python client library for the Prism transcription platform. Data engineering teams install it from PyPI to submit audio for transcription, manage webhooks, and export finished transcripts. Not a service, not browser-facing."

Q: what's the deployment context and runtime environment?
A: "Plain pip-installed library, runs inside whatever Python process imports it — batch jobs, notebooks, internal services. No browser, no CDN."

Q: what's the audience and does it handle sensitive data?
A: "Enterprise — data engineering teams at customer organizations install it from PyPI. The `api_key` it sends as a bearer token is a real production credential once a customer sets one."

Q: any compliance or regulatory requirements?
A: "No. It's a client library — no SOC2, HIPAA, or PCI requirement of its own."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "Built with Claude Code day to day (see CLAUDE.md), but the SDK itself never calls an LLM and isn't invoked by one — it's a plain HTTP transcription client."

Q: I see `docs/internal/GAPS.md` already tracks the missing webhook signature verification as a capability-gap. Want me to treat entries in that file as `knownGaps` automatically going forward, or ask you per-stub?
A: "Treat GAPS.md entries as knownGaps automatically — that's exactly why we maintain the file. Only ask us directly for stubs that aren't listed there yet."

Q: `client.py`'s `transcribe()` has a dated TODO about 429 backoff that references an exception expiring 2026-08-15 — is that still an active, time-boxed item, or should it become a permanent knownGaps entry instead?
A: "Still active and still time-boxed — we're shipping the backoff in 0.5.0, targeting mid-August. Keep it as an exception with that expiry, not a knownGaps entry; it's not a deliberate boundary, it's just not done yet."

Q: `client.py` also has a `password` constructor parameter that isn't a credential-scanner false alarm — can you confirm what it's for?
A: "Right, that's for customers who want failed-job notifications relayed through their own SMTP server — we pass it straight through to their mail transport, never persist or log it. Not a hardcoded secret, just a pass-through parameter with an unfortunate but accurate name."

Q: what's your coverage threshold?
A: "85% — that's what `--cov-fail-under` is already set to in pyproject.toml, keep it there."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- whether `docs/internal/GAPS.md` entries should be auto-treated as `knownGaps` (source shows the tracker file exists with a table already listing the webhook-verification gap, and BLUEPRINT.md's Known Gaps section requires asking this exact question when a project already maintains a gaps/backlog file — detect_project can see the file exists but can't decide the auto-treatment policy on its own)
- whether the dated TODO in `client.py`'s `transcribe()` (referencing an exception expiring 2026-08-15) is still an active, time-boxed item or should become a permanent knownGaps entry (source shows the comment and the date, but only the interview can confirm the item is still on track rather than stale)
- purpose of the `password` constructor parameter on `PrismClient` (source shows a parameter literally named `password` passed straight through and never logged — structurally not a hardcoded secret, but detect_project has no way to confirm intent without asking, and a textual-only scanner would flag the name itself)
- audience and distribution scope (source is a public PyPI package with no audience signal in the manifest — detect_project can't tell internal-only vs. external distribution from `pyproject.toml` alone)
- compliance or regulatory requirements (no compliance artifacts of any kind exist in the repo, so detect_project has no signal either way — must be asked, not assumed absent)

## Must NOT ask (already answerable from detect_project output)
- test runner and coverage tool (repo/pyproject.toml's `[tool.pytest.ini_options]` and `--cov` addopts already present)
- CI configuration (repo/.github/workflows/ci.yml already present)
- agent context file presence (repo/CLAUDE.md already present)
- primary implementation language (unambiguous from `pyproject.toml`, no other manifest present)
- linting setup (repo/pyproject.toml's `[tool.ruff]` section already present and configured)
