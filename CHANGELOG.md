# Changelog

All notable changes to the Karen plugin are recorded here. The eval benchmark (`evals/`) versions independently — see `EVALS-PLAN.md` §11.4.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Repo scaffolding for external contribution and feedback: issue templates, PR template, `CONTRIBUTING.md`, this changelog, and a CI workflow running the eval benchmark's self-test suite.
- `evals/self-test/run-self-test.js` — an automated runner for the self-test contract (`CONTRACT.md` §4): every fixture's golden sample must pass every applicable grading dimension, and every broken sample must fail exactly its declared flaw(s).
- `.claude-plugin/marketplace.json` and `plugins/karen/.claude-plugin/plugin.json` — this repo now self-hosts as its own Claude Code plugin marketplace.
- `plugins/karen/skills/karen/SKILL.md` and 13 `reference/*.md` files — Karen ported from `BLUEPRINT.md` into a runtime-executable Claude Code skill: detection, the interview, gate generation and the gate contract, run-state/delta/circuit-breaker, every quality dimension, deployment-context profiles, monorepo scoping, reconciliation, integration, and voice.
- `plugins/karen/commands/init.md` and `commands/audit.md` — thin, discoverable slash-command triggers into the skill's procedures.
- `plugins/karen/commands/feedback.md` + `scripts/collect-feedback-bundle.sh` — opt-in, user-initiated feedback: gathers a redacted bundle (`.karen.json`, gate summary counts, plugin version, tool-probe results), shows it to the user, then files via `gh issue create` or a pre-filled URL. No automatic telemetry.

### Fixed
- `evals/schema/CONTRACT.md` §3 named a standalone `issue-id.js` helper that never existed; `issueId()` has always lived inside `parse-gate-output.js`. Doc corrected to match the code.
- `gate-contract.md`/`write-harness.md` never said how a non-shell gate (Node, Python) should actually be invoked, and `evals/runner/fixture-workflow.js`'s audit-sequence prompt hardcoded `bash <script>` regardless of the gate's real extension — a real `mode: 'full'` run surfaced this: `.mjs` gates ran fine under some sub-agents' own judgment but produced bash syntax-error garbage under others that followed the literal instruction, corrupting 2 of 7 audit triggers non-deterministically. Fixed by specifying direct-execution-via-shebang as the one invocation rule everywhere a gate gets run (`run_gate`, `run-all.sh`, the eval runner).
- `integration.md` referenced a `.karen/run-all.sh` orchestrator in six places as something `write_harness` already produces, but no reference file described it being generated. `write-harness.md` now documents it as a real output of `write_harness`.
- `probe-tools.md` checked a candidate tool's presence and config but never its actual flags — a dogfood run against a real project assumed `gitleaks --exclude-path` existed when the installed CLI doesn't support it. Added a step to verify any flag a gate depends on before shipping it.

### Validated
- First real `mode: 'full'` end-to-end run against the installed Karen plugin (`node-sdk-single` fixture): 90.9% pass@1 across 11 grading dimensions, one failing dimension (`delta`) traced to the gate-invocation bug above. After the fix, a repeat run scores 100.0% pass@1 across all 11 dimensions. Real-project dogfooding (separately, against the same fixture) confirmed detection (4/4 planted issues caught, 0/3 decoys flagged), the interview's must-ask/must-not-ask behavior, and the gate contract's mechanics (tab-byte parsing, one-line-per-issue, zero-tolerance marking, tool-absence-fails-loud) all hold under real tool execution (npm, eslint, semgrep, gitleaks, vitest).
