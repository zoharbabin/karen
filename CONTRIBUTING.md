# Contributing to Karen

Karen is two things in this repo: the **design spec + eval benchmark** and the **installable plugin** (`plugins/karen/`). Both take contributions and feedback the same way: file it, don't silently drift.

## Filing feedback or a bug

- **Karen skill misbehaved on your project** (once installed): use the "Skill bug report" issue template. If you have the plugin installed, run `/karen:feedback` first — it builds a redacted bundle (`.karen.json`, gate summary counts, Karen/plugin version, OS/tool-probe results) you can paste straight into the template.
- **A fixture, grading script, or the benchmark's methodology in `evals/` is wrong**: use the "Eval benchmark issue" template and name the exact fixture + `score-*.js` dimension where possible.
- **You want a new gate, deployment profile, or fixture**: use the "Feature request" template.
- Design questions that aren't a specific bug go to GitHub Discussions, not an issue.

No telemetry is ever collected automatically. Nothing leaves your machine unless you run `/karen:feedback` (or `gh issue create`) yourself, and the command always shows you the exact bundle before sending it.

## `BLUEPRINT.md` is the source of truth — keep the skill in sync

`BLUEPRINT.md` defines Karen's behavior. `plugins/karen/skills/karen/` (SKILL.md + `reference/*.md`) is a ported, runtime-executable copy of it — end users installing the plugin never see `BLUEPRINT.md` itself, so every behavioral change has to land in both places in the same PR, per the PR template's checklist.

| `BLUEPRINT.md` section | Ported to |
|---|---|
| Brand Voice & Personality | `reference/voice.md` |
| What Karen Is · The Skill Architecture · The Two Operations | `SKILL.md` |
| The Skill Architecture's `detect_project` / `probe_tools` tool-surface rows | `reference/detect-project.md` / `reference/probe-tools.md` |
| The Init Conversation · Phase 0 — Bootstrap Karen | `reference/interview.md` |
| What Gets Generated | `reference/write-harness.md` |
| Reconciling Existing Quality Tooling | `reference/reconciliation.md` |
| The Gate Contract | `reference/gate-contract.md` |
| Run State, Delta Feedback, and the Circuit Breaker | `reference/run-state.md` |
| What Karen Knows (all quality dimensions) | `reference/quality-dimensions.md` |
| Configuration: `.karen.json` | `reference/karen-json-schema.md` |
| Deployment Context Profiles | `reference/deployment-profiles.md` |
| Poly-repo & Monorepo Structure | `reference/monorepo.md` |
| The LLM Prompt Pattern · Teaching Karen New Complaints · Integration | `reference/integration.md` |
| Mental Models | (background only — not ported verbatim; informs tone across all reference files) |

`detect_project` / `probe_tools` / `write_harness` / `run_gate` / `read_run_state` / `write_run_state` are **not** callable functions — v1 has no dedicated tool scripts. They're named procedures the agent carries out itself with `Read`/`Glob`/`Grep`/`Bash`, per `SKILL.md`. Don't add a `scripts/` wrapper for any of these six; the one script this repo does bundle (`scripts/collect-feedback-bundle.sh`) is feedback tooling, not part of the init/audit loop, and that's a deliberate exception — see `BLUEPRINT.md`'s "The Skill Architecture" section and this repo's root `CLAUDE.md` for why.

## Local dev / test flow

Everything under `evals/` is zero-dependency Node — no `npm install` needed.

```sh
# Grade one fixture against one dimension
node evals/grading/score-gate-issues.js evals/fixtures/node-sdk-single evals/self-test/golden/node-sdk-single/run-capture.json

# Run the full self-test suite (all 14 fixtures × all applicable dimensions,
# golden-must-pass / broken-must-fail-exactly-its-declared-flaws)
node evals/self-test/run-self-test.js

# Drive a real fixture against the installed Karen plugin (mode: 'full')
# — see evals/runner/fixture-workflow.js. 11 of 14 fixtures have a real
# mode:'full' result as of this writing (node-sdk-single, go-monorepo,
# node-personalization-backend-single, python-sdk-single, go-backend-single,
# go-mcp-server-single, node-mcp-server-single, python-mcp-server-single,
# and python-monorepo all pass or have every failing dimension traced to a
# specific cause and fixed/classified; see evals/README.md's Status
# section). The remaining fixtures are still ahead of EVALS-PLAN.md §9 step
# 5, and a fresh live re-run to confirm this round's fixes hold under a new
# generation hasn't happened yet.
```

CI (`.github/workflows/evals-selftest.yml`) runs the self-test suite on every push/PR touching `evals/`. It has to stay green.

To iterate on the plugin locally before it's published: `/plugin marketplace add ./` from this repo's root, then `/plugin install karen@karen-marketplace`.

## Pull requests

See `.github/PULL_REQUEST_TEMPLATE.md` — it asks which area you touched and, if you changed Karen's behavior, whether `BLUEPRINT.md` and the matching `reference/*.md` file were both updated.

## Commit style

Follow the existing log: imperative, specific, no conventional-commit prefixes (`feat:`, `fix:`, etc.).
