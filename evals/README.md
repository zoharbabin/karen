# Karen Eval Benchmark

An OWASP-Benchmark-style eval suite for [Karen](../BLUEPRINT.md), the quality-gate
harness architect skill. It scores what Karen produces during `karen init` and
`karen audit` against hand-authored ground truth across 14 fixtures and 10
grading dimensions.

Full design rationale, methodology, and citations: [EVALS-PLAN.md](../EVALS-PLAN.md).
Exact file/CLI shapes every fixture and grader must follow: [schema/CONTRACT.md](schema/CONTRACT.md).

## Layout

```
evals/
  fixtures/<name>/        14 fixtures — fake repo + ground truth + patches
  grading/                10 score-*.js scorers + judge prompt + aggregator
  runner/                 the two-agent interview simulation (Workflow script)
  self-test/golden|broken/<name>/run-capture.json  hand-authored samples
  schema/CONTRACT.md      the interface everything above agrees on
```

Karen doesn't exist yet, so every grader consumes one common artifact —
`run-capture.json` — never a live agent session directly. That decoupling is
what lets `self-test/` validate the benchmark itself before Karen is built.

## Running the benchmark

Grade one fixture's self-test sample against one dimension:

```bash
node grading/score-gate-issues.js fixtures/node-sdk-single self-test/golden/node-sdk-single/run-capture.json
```

Run the full two-agent simulation + all dimensions for one or more fixtures
(via the `Workflow` tool, see [runner/fixture-workflow.js](runner/fixture-workflow.js)):

```js
Workflow({ scriptPath: 'evals/runner/fixture-workflow.js', args: { mode: 'grade-only', source: 'golden' } })
```

`mode: 'grade-only'` (default) grades the hand-authored self-test samples —
this works today. `mode: 'full'` drives a real `karen init`/`karen audit`
session once Karen exists as an installed skill; until then it prints
`KAREN_NOT_INSTALLED` and returns null.

Aggregate multiple score-JSON outputs (e.g. across repeated judge runs):

```bash
node grading/aggregate-report.js /tmp/scores/*.json        # human-readable
node grading/aggregate-report.js --json /tmp/scores/*.json # machine-readable
```

## Grading dimensions

| # | Dimension | Script | What it checks |
|---|---|---|---|
| 4.1 | Detection accuracy | `score-detection.js` | `detect_project` fields vs. `fixture-manifest.json`, precision/recall/F1 |
| 4.2 | Interview quality | `score-interview.js` + `judge-interview-followup.md` | deterministic must-ask/must-not-ask checks + LLM-judge follow-up quality |
| 4.3 | `.karen.json` accuracy | `score-karen-json.js` | generated config vs. `expected-karen.json` |
| 4.4 | Gate issue correctness | `score-gate-issues.js` | planted-issue TP/FP/FN, zero tolerance for decoy false positives |
| 4.5 | Gate contract conformance | `score-gate-contract.js` | raw stdout format, exit codes, ZERO-TOLERANCE lines |
| 4.6 | Delta feedback | `score-delta.js` | per-gate count deltas across partial-fix/regression patches |
| 4.7 | Fingerprint stability | `score-fingerprint-stability.js` | fingerprints survive line drift |
| 4.8 | Circuit breaker | `score-circuit-breaker.js` | staleCount increments and trips correctly |
| 4.9 | Reconciliation (fixture 4 only) | `score-reconciliation.js` | existing-tooling coverage, no competing gates |
| 4.10 | Known gaps vs. exceptions (fixture 9 only) | `score-known-gaps.js` | correct classification, swap-failure detection |

Dimensions 4.9/4.10 vacuously pass on fixtures that don't exercise that
scenario. Every `score-*.js` script is plain Node.js with zero dependencies,
invoked as `node score-<dim>.js <fixtureDir> <runCaptureFile>` and printing one
JSON object (`{dimension, fixture, metrics, pass, details}`) per
[CONTRACT.md §3](schema/CONTRACT.md).

## Fixtures

14 fixtures spanning Node/Go/Python across SDK, backend, client-app, MCP
server, monorepo, and vendored-code shapes — see
[EVALS-PLAN.md §2](../EVALS-PLAN.md) for the full matrix and what mechanic each
one stresses. Each fixture directory contains:

- `repo/` — a small, real fake project tree
- `fixture-manifest.json`, `answer-key.md`, `expected-karen.json`,
  `planted-issues.json`, `expected-gates.json` — ground truth
- `patches/` — 4 patches (partial-fix, regression, noop-line-shift,
  repeat-noop ×3) that drive the delta/fingerprint/circuit-breaker dimensions

## Self-test

Every fixture ships a hand-authored `self-test/golden/<name>/run-capture.json`
(what a perfect Karen run produces) and a
`self-test/broken/<name>/run-capture.json` + `flaws.json` (the same run with a
small number of declared, isolated flaws). This validates the benchmark
against itself before Karen exists: golden must score at/above the pass
threshold on every applicable dimension, and broken must fail exactly the
dimensions `flaws.json` declares and nothing else.

Verified: across all 14 fixtures × 10 dimensions (280 checks), every golden
sample passes every applicable dimension, and every broken sample fails
exactly its declared flaw(s) — `gate-issues` on all 14 (each plants one false
negative + one decoy false positive), plus `reconciliation` on `node-monorepo`
and `karen-json`/`known-gaps` on `python-sdk-single` for their fixture-specific
swap flaws. Six fixtures additionally stack a second `gate-issues` category
closing gaps found by comparing Karen's design against a real MCP-server
project: `unlabeled-tool-output` on `python-mcp-server-single`,
`doc-contract-drift` and `agent-context-audience-overclaim` on
`node-mcp-server-single`, `unannotated-intentional-duplication` on
`node-personalization-backend-single`, `accuracy-overclaim` on
`go-notification-dispatcher-single`, and `stale-codegen-output` on
`node-monorepo` (whose `crossSubprojectConsistency` array is now also graded
by `score-karen-json.js`, previously an ungraded field).

## Status

Grading scripts, fixtures, and self-test pairs are complete and internally
verified. `mode: 'full'` in the runner is structurally complete but untested
until a real Karen skill exists to drive it — see
[EVALS-PLAN.md §9](../EVALS-PLAN.md) for the rollout plan.
