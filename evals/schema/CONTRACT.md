# Karen Evals — Ground Truth & Run-Capture Contract

Authoritative interface every fixture, grading script, and the runner must agree on.
Read alongside [BLUEPRINT.md](../../BLUEPRINT.md) and [EVALS-PLAN.md](../../EVALS-PLAN.md).
Nothing here is free to vary per-fixture or per-grader — if a shape needs to change, change it here first.

---

## 1. Per-fixture ground truth files (author-time, never mutated by a run)

Layout matches EVALS-PLAN.md §3/§8: `evals/fixtures/<name>/`.

### `repo/`
The fake project tree. Copied to a scratch dir before every run; the committed copy is never mutated in place.

### `fixture-manifest.json`
Ground truth for `detect_project`-equivalent output.

```json
{
  "languages": ["typescript"],
  "manifests": [
    { "path": "package.json", "language": "typescript" }
  ],
  "frameworks": ["node"],
  "ciConfig": [".github/workflows/ci.yml"],
  "existingTestSetup": {
    "runner": "vitest",
    "coverageTool": "c8",
    "coverageReport": "coverage/lcov.info"
  },
  "agentContextFiles": ["CLAUDE.md"],
  "existingGates": [
    {
      "id": "check-docs",
      "command": "node tools/check-docs.mjs",
      "outputFormat": "exit-code",
      "coverage": [
        { "gate": "gate-4-docs-parity", "scope": "full", "reason": "..." },
        { "gate": "gate-3-security", "scope": "partial", "detail": "...", "reason": "..." }
      ]
    }
  ],
  "subprojects": [
    { "path": "sdk", "manifestPath": "sdk/package.json", "language": "typescript" }
  ],
  "unclaimedPaths": ["tools/capture.py"]
}
```

- `subprojects: []` for single-package fixtures.
- `unclaimedPaths: []` when nothing is unowned (only fixture 8 — `go-monorepo` — is required to have a non-empty list, per EVALS-PLAN.md §2 row 8).
- Field names here are the ones `score-detection.js` diffs against; a real `detect_project` implementation's output must be mapped into this exact shape by whatever adapter feeds the runner (out of scope for the benchmark itself — see §2 below).

### `answer-key.md`
Interview simulation contract. Exact format (already fixed by EVALS-PLAN.md §3):

```markdown
## Answers
Q: what does this project do / who uses it?
A: "Browser SDK for an AI teaching avatar, used by edtech customers"

## Must ask unprompted (source has signal, detect_project can't classify intent)
- microphone/camera capability (source has `getUserMedia` calls)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present)
```

Parsing rule for graders: sections are matched by the exact `## ` headers above (`## Answers`, `## Must ask unprompted...`, `## Must NOT ask...`); each `Q:`/`A:` pair is one turn; each `- ` line under the ask/skip sections is one keyword-matchable topic string.

### `expected-karen.json`
The target `.karen.json`, full shape per BLUEPRINT.md §"Configuration: `.karen.json`". Must be valid against that shape (version, project, compliance, coverage, testRunner, existingGates, knownGaps, exceedsBaseline, exceptions, circuitBreaker, expiryWarningDays). `compliance[]` entries may be a plain string or a gated object (`{ standard, activatesWhen, note }` — BLUEPRINT.md §"Tiered, Feature-Gated Compliance"); `personalDataRegistry: { path, stores }` is present only for fixtures with more than one personal-data store (BLUEPRINT.md §"Personal-Data Registry Pattern"). Both are diffed by `score-karen-json.js` (§4.3).

### `planted-issues.json`
```json
[
  { "file": "src/auth.ts", "line": 42, "category": "hardcoded-secret", "isDecoy": false },
  { "file": "src/util.ts", "line": 7,  "category": "eval-in-comment",  "isDecoy": true }
]
```
`category` is free text but must be stable within a fixture (used for per-category TP/FP in `score-gate-issues.js`). Every non-decoy issue must map to exactly one `expected-gates.json` entry via `category` → `coversCategories`.

### `expected-gates.json`
```json
[
  {
    "id": "gate-3-security",
    "tool": "semgrep",
    "coversCategories": ["hardcoded-secret", "eval-in-comment", "shell-injection"],
    "zeroTolerance": true
  }
]
```
`coversCategories` must be a superset of every `category` in `planted-issues.json` that the fixture expects that gate to catch — including decoy categories (a gate is expected to see the decoy and correctly not flag it).

The following categories are conventionally emitted by an existing gate and graded "for free" by `score-gate-issues.js`'s existing category mechanism — no dedicated grading script needed for any of them, since each is just a `FILE:LINE\tmessage` finding like any other gate:
- `compliance-overclaim` (`gate-5-compliance`) — a compliance doc (e.g. `SECURITY.md`) names a specific claim with no backing file/reference, or a reference that no longer exists (BLUEPRINT.md §"Compliance Artifacts" — "Presence and content are not the same thing as accuracy"). Decoys for this category are claims that *do* name a still-existing reference.
- `unregistered-personal-data-store` (`gate-5-compliance`) — a personal-data store found during `detect_project`/interview never registers with `personalDataRegistry.path` (BLUEPRINT.md §"Personal-Data Registry Pattern"). Decoys for this category are store-shaped files that don't actually hold personal data (e.g. a TTL'd session-token cache keyed by user id but holding no personal data itself).
- `unlabeled-tool-output` (`gate-3-security`) — a tool result splices externally-sourced content (command output, file contents) into the text returned to a connecting LLM with no delimiter marking it as data rather than instructions — an outbound/indirect prompt-injection vector (BLUEPRINT.md §"ai-agent" — content producer for someone else's agent). Decoys for this category wrap the same kind of externally-sourced content in a clearly delimited block.
- `doc-contract-drift` (`gate-4-docs-parity`) — a markdown table claiming to enumerate a CLI's flags, an MCP server's tool list, or an API's endpoints no longer matches the actual code surface, in either direction — a stale row or an undocumented flag/tool/endpoint (BLUEPRINT.md §"Documentation Fidelity" — Documented interface parity). Decoys for this category are table rows that still match a real flag/tool/endpoint.
- `unannotated-intentional-duplication` (`gate-2-completeness`) — two structurally-similar blocks that are deliberately divergent (e.g. per-jurisdiction logic) but carry no `// karen-intentional-duplicate: <reason>` marker (BLUEPRINT.md §"Code Structure & Elegance"). Decoys for this category are duplicated pairs that already carry the marker.
- `accuracy-overclaim` (`gate-6-test-integrity`) — a non-security accuracy claim ("98% accurate") names no backing eval script/dataset, or names one that no longer exists (BLUEPRINT.md §"Test Integrity" — same overclaim risk as `compliance-overclaim`, applied to accuracy claims). Decoys for this category are claims backed by a real, runnable gold-set eval.
- `stale-codegen-output` (`gate-2-completeness`) — a generated subproject's generation-marker (a header comment naming its source spec and a hash/version) no longer matches the current state of the source subproject (BLUEPRINT.md §"Cross-Subproject Consistency" — the `"kind": "generated"` shape). Decoys for this category are generated files whose marker still matches the source's current state.
- `agent-context-audience-overclaim` (`gate-7-agent-context`) — an agent-context file (`CLAUDE.md`/`AGENTS.md`) claims a tool as an audience (e.g. Cursor) but the tool-specific file that claim would require (`.cursorrules`) does not exist anywhere in the repo (BLUEPRINT.md §"Agent Context Engineering"). Decoys for this category are audience claims that are actually backed (e.g. a Claude Code claim, satisfied by the file itself being `CLAUDE.md`).

`personalDataRegistry.stores` in `expected-karen.json`/`init.karenJson` is Karen's discovered list of personal-data stores regardless of registry membership — diffed by `score-karen-json.js` (§4.3, field-accuracy, not planted-issue precision/recall). Whether each discovered store actually joined the registry is a separate, structural runtime check, graded via the `unregistered-personal-data-store` category above.

### `patches/`
Unified diffs (`git apply`-compatible), applied in order against the scratch copy of `repo/`:

| Patch | Purpose | Grading dimension |
|---|---|---|
| `01-partial-fix.patch` | Fixes some but not all planted (non-decoy) issues | §4.6 delta — fewer complaints |
| `02-regression.patch` | Introduces one new real issue | §4.6 delta — more complaints |
| `03-noop-line-shift.patch` | Inserts an unrelated line above an unfixed issue, changes nothing else | §4.7 fingerprint stability |
| `04-repeat-noop.patch` | Empty diff (zero hunks) OR a no-op comment-only change; applied 3× consecutively | §4.8 circuit breaker |

Each patch file has a matching `<name>.json` sidecar (e.g. `01-partial-fix.json`) declaring what the grader should expect, so grading isn't re-deriving expectations from the diff itself:

```json
{ "fixedIssueIds": ["src/auth.ts:42:hardcoded-secret"], "expectedDelta": { "gate-3-security": -1 } }
```
```json
{ "newIssue": { "file": "src/session.ts", "line": 10, "category": "hardcoded-secret" }, "expectedDelta": { "gate-3-security": 1 } }
```

Issue identity string format (used everywhere an issue needs a stable ID across ground truth and captured output): `"<file>:<line>:<category>"`.

---

## 2. Run-capture — the one artifact every grading script actually reads

Karen doesn't exist yet (EVALS-PLAN.md §6). Every grader must run identically whether its input came from a real `karen init`/`karen audit` session (future) or a hand-authored self-test sample (now). That common input is a single JSON file: **`run-capture.json`**.

The runner (`fixture-workflow.js`) is responsible for producing this file from a live two-agent session (§5 of the plan). `self-test/golden/<fixture>/run-capture.json` and `self-test/broken/<fixture>/run-capture.json` are the hand-authored equivalents. No grading script ever talks to an agent, a transcript format, or a shell process directly — it reads this file and the fixture's ground truth files, nothing else.

```json
{
  "fixture": "node-sdk-single",
  "init": {
    "detectProjectOutput": { "...": "same shape as fixture-manifest.json" },
    "transcript": [
      { "role": "karen", "text": "What does this project do and who uses it?" },
      { "role": "user",  "text": "Browser SDK for an AI teaching avatar, used by edtech customers" }
    ],
    "karenJson": { "...": "the actual .karen.json produced, same shape as expected-karen.json" },
    "gateScripts": {
      "gate-1-supply-chain": "#!/usr/bin/env bash\n...raw script source as written to .karen/gates/...",
      "gate-3-security": "#!/usr/bin/env bash\n..."
    }
  },
  "auditRuns": [
    {
      "trigger": "initial",
      "gateResults": {
        "gate-1-supply-chain": { "stdout": "PASS (0 issues)\n", "exitCode": 0 },
        "gate-3-security": { "stdout": "src/auth.ts:42\thardcoded API key\nFAIL (1 issues)\nZERO-TOLERANCE\n", "exitCode": 1 }
      },
      "runState": { "...": "the .karen/run-state.json written after this run" }
    },
    {
      "trigger": "01-partial-fix",
      "gateResults": { "...": "..." },
      "runState": { "...": "..." }
    },
    {
      "trigger": "02-regression",
      "gateResults": { "...": "..." },
      "runState": { "...": "..." }
    },
    {
      "trigger": "03-noop-line-shift",
      "gateResults": { "...": "..." },
      "runState": { "...": "..." }
    },
    {
      "trigger": "04-repeat-noop-1",
      "gateResults": { "...": "..." },
      "runState": { "...": "..." }
    },
    {
      "trigger": "04-repeat-noop-2",
      "gateResults": { "...": "..." },
      "runState": { "...": "..." }
    },
    {
      "trigger": "04-repeat-noop-3",
      "gateResults": { "...": "..." },
      "runState": { "...": "..." }
    }
  ]
}
```

Rules:

- `gateResults[gateId].stdout` is the **raw** text the gate script printed — exactly the `FILE:LINE\tmessage` / `PASS|FAIL (N issues)` / `ZERO-TOLERANCE` contract from BLUEPRINT.md §"The Gate Contract". Nothing pre-parsed. `score-gate-contract.js` (§4.5) validates this raw text directly; every other grader that needs issues parses it via the shared parser (`grading/lib/parse-gate-output.js`) rather than re-implementing parsing.
- `runState` is the full `.karen/run-state.json` shape from BLUEPRINT.md §"Run State" (`run`, `timestamp`, `gates: {id: {count, fingerprint}}`, `total`).
- `auditRuns` is always exactly 7 entries in this fixed trigger order for fixtures that ship all four patches. A fixture may omit trailing repeat-noop entries only if `planted-issues.json` has zero non-decoy issues for every gate the patches target — in that case its `patches/` dir may contain fewer files and `auditRuns` stops after `initial`. (Only `go-backend-single` among the 14 fixtures in EVALS-PLAN.md §2 hits this exception today; it exists for that case and future fixtures.)
- `init.gateScripts` keys must exactly match `expected-gates.json[].id` plus any `existingGates` id the fixture's `expected-karen.json` records (existing-gate commands are not re-captured here since they're not Karen-generated — reconciliation grading reads `karenJson.existingGates` directly).

---

## 3. Grading script CLI contract

Every `evals/grading/score-*.js` is a standalone Node script, zero dependencies, invoked:

```bash
node evals/grading/score-<dimension>.js <fixtureDir> <runCaptureFile>
```

- `<fixtureDir>` — path to `evals/fixtures/<name>/` (or a self-test fixture dir containing the same ground-truth filenames).
- `<runCaptureFile>` — path to a `run-capture.json`.

Every script prints exactly one JSON object to stdout and exits `0` regardless of the score (non-zero exit is reserved for a grader crash — a bug, not a low score):

```json
{
  "dimension": "detection",
  "fixture": "node-sdk-single",
  "metrics": { "precision": 1.0, "recall": 0.83, "f1": 0.90 },
  "pass": false,
  "details": [
    { "field": "frameworks", "falseNegatives": ["node"], "falsePositives": [] }
  ]
}
```

- `metrics` shape varies per dimension (precision/recall/f1 for set-detection dimensions; boolean-list pass/fail for contract-conformance dimensions; delta-correctness booleans for §4.6–4.8) — each script defines its own `metrics` keys, documented in a header comment, but every script has `dimension`, `fixture`, `pass`, `details` at minimum.
- `pass` is that dimension's own binary pass/fail per the thresholds defined in that script (documented in-file) — aggregate-report.js does not redefine per-dimension pass criteria, only rolls them up.
- Shared parsing/diffing helpers live in `evals/grading/lib/` (`parse-gate-output.js`, `set-metrics.js`, `issue-id.js`) — every scorer requires from there rather than reimplementing gate-output parsing or precision/recall math.

`aggregate-report.js` takes N score-JSON files (one run's worth, or across k repeated runs for a fixture) and prints a combined report: per-dimension mean ± SD across runs where k>1, plus overall pass/fail per fixture and across the fixture suite.

---

## 4. Self-test contract (EVALS-PLAN.md §6)

For every fixture:

- `self-test/golden/<fixture>/run-capture.json` — hand-authored, must score at or above maximum on every dimension applicable to that fixture (§4.1–§4.10, whichever apply).
- `self-test/broken/<fixture>/run-capture.json` — hand-authored, contains **exactly one** deliberate flaw per dimension category (documented in a sibling `self-test/broken/<fixture>/flaws.json`):

```json
{
  "flaws": [
    { "dimension": "gate-issues", "description": "src/auth.ts:42 hardcoded-secret (real, non-decoy) is never emitted by gate-3-security's stdout", "expectedGraderFinding": "false negative on hardcoded-secret" },
    { "dimension": "gate-issues", "description": "src/util.ts:7 eval-in-comment (decoy) IS emitted by gate-3-security's stdout", "expectedGraderFinding": "false positive on eval-in-comment" }
  ]
}
```

A grader run against `broken/<fixture>/run-capture.json` must report a finding matching every entry in `flaws.json` for dimensions it covers, and must not report an unrelated dimension as broken — golden and broken share every field except the ones `flaws.json` calls out.

---

## 5. Naming conventions

- Gate ids: `gate-1-supply-chain`, `gate-2-completeness`, `gate-3-security`, `gate-4-docs-parity`, `gate-5-compliance`, `gate-6-test-integrity`, `gate-7-agent-context` — fixed, per BLUEPRINT.md's generated harness. Fixtures only omit gates that genuinely don't apply (e.g. no compliance regime → no `gate-5-compliance` entry in `expected-gates.json`), never renumber.
- Patch trigger strings: `initial`, `01-partial-fix`, `02-regression`, `03-noop-line-shift`, `04-repeat-noop-1`, `04-repeat-noop-2`, `04-repeat-noop-3` — exact strings, used as dictionary keys by `score-delta.js`, `score-fingerprint-stability.js`, `score-circuit-breaker.js`.
- Issue identity string: `"<file>:<line>:<category>"` — used in `planted-issues.json` cross-references, patch sidecars, and grader diffing.
