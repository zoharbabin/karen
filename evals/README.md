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

Every grader consumes one common artifact — `run-capture.json` — never a
live agent session directly, whether that capture was hand-authored
(`self-test/`) or produced by a real run against the installed Karen plugin
(`mode: 'full'`). That decoupling is what let `self-test/` validate the
benchmark itself before Karen was built, and lets the same graders score her
now that she is.

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

`mode: 'grade-only'` (default) grades the hand-authored self-test samples.
`mode: 'full'` drives a real `karen init`/`karen audit` session against the
installed Karen plugin (`plugins/karen/`); if no karen skill/plugin is found
it prints `KAREN_NOT_INSTALLED` and returns null instead of a capture.

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
against itself, independent of whatever the live plugin actually produces:
golden must score at/above the pass threshold on every applicable dimension,
and broken must fail exactly the dimensions `flaws.json` declares and nothing
else.

Run it with `node self-test/run-self-test.js` (also wired into CI via
`.github/workflows/evals-selftest.yml` on every push/PR touching `evals/`).

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
verified — `node self-test/run-self-test.js` passes all 14 fixtures × 10
dimensions (280 checks). Karen herself is built (`plugins/karen/`), and
`mode: 'full'` in the runner has completed a real validation run against her
across all 14 fixtures. That run surfaced several real defects, since fixed
in the skill/reference docs and the runner (not the fixtures or graders):
absolute/leading-`./` gate paths not normalized to project-root-relative,
GNU-only flags (`mktemp --suffix`) breaking on macOS's BSD toolchain, nested
bash/Python quoting in inline JSON-parsing one-liners, a gate shelling out to
a `tools/` helper script that was never written (silently producing `PASS (0
issues)` with zero real analysis), a runner schema gap that let a `done:
true` turn validate without its result fields, a permission-denied race
on a freshly-written gate script's executable bit, a `|| true` masking
pattern that let a gate report a false clean pass when its wrapped tool was
missing rather than when it actually found zero issues, and a relpath-join
bug that garbled a wrapped tool's already-root-relative output paths when
resolved against the gate script's own process cwd instead of the project
root. Triage also found and fixed four fixture-authoring bugs unrelated to
Karen herself: a gate-issues grader matching false positives across
unrelated gates' categories at a shared `file:line`; a patch whose
replacement line tripped an undeclared lint regression; `go-mcp-server-single`'s
`expected-karen.json` expecting `audience: "developer-tooling"`, a value with
no basis in `BLUEPRINT.md`'s documented examples and contradicted by the
fixture's own `answer-key.md` (fixed to `"internal"`, matching every other
MCP-server fixture); and one genuine skill/doc defect a real run caught —
the known-gaps guidance told the agent to ask "known limitation or work in
progress?" but never said what a "work in progress" answer should do, so an
agent suppressed a live completeness finding behind a `knownGaps` entry
whose own `reason` admitted it wasn't actually a tracked limitation (fixed
in `quality-dimensions.md`/`BLUEPRINT.md`: work-in-progress gets no
`knownGaps` entry). One environment/tool limitation was also confirmed
(gosec's entropy-truncation heuristic missing a planted secret whose first
16 characters were low-entropy). See [EVALS-PLAN.md §9](../EVALS-PLAN.md) for
the rollout plan and current step.

A live `mode: 'full'` re-run against the 8 fixtures affected by this round of
fixes confirmed 3 pass cleanly across every dimension
(`go-monorepo`, `node-personalization-backend-single`, `python-sdk-single`),
and traced every failing dimension in 3 more (`go-backend-single`,
`go-mcp-server-single`, `node-mcp-server-single`) to a specific cause: the
`audience` and known-gaps fixes above (both now applied), plus gosec/
govulncheck/staticcheck being unavailable to those specific sub-agents'
shells during capture — a `$PATH` gap in that spawned shell's environment,
not a Karen or eval-harness defect (a fresh shell resolves both tools
correctly, and a sibling fixture's agent in the same run invoked gosec
successfully). A clean re-run of the remaining 2 fixtures in that batch
(`python-mcp-server-single`, `python-monorepo`) surfaced three more real
causes, all now fixed. `python-mcp-server-single`'s `delta` failure on
`regression.gate-3-security` traced entirely to the already-fixed
`gate-3-security.sh` nested-quoting bug above (the gate can never report a
nonzero count, so no delta could ever be observed — no new fix needed).
Its `gate-issues` mismatch traced to a genuine, previously-undocumented gap
in `quality-dimensions.md`/`BLUEPRINT.md`'s "Stub implementations" signal:
neither doc said which line to report for a stub whose declaration and
`throw`/`raise` body span two lines, so a live gate matched the declaration
line and reported that instead of the statement's own line — fixed by
adding the rule explicitly, and cross-checking it against every other
stub-implementation fixture's golden sample. `python-monorepo`'s `delta`
failure traced to `evals/runner/fixture-workflow.js`'s audit-relay schema
only requiring each trigger's top-level key, not its nested `gateResults`/
`runState` fields — a live relay call silently dropped one trigger's
`runState`, starving `score-delta.js` of the previous run's per-gate counts
and producing a fully empty `actualDeltas` object instead of a real delta
or an explicit error; fixed by requiring both fields per-trigger in the
schema. All 14 fixtures now pass self-test after these fixes. A fresh live re-run
confirmed both fixes hold under a new generation — but it also caught a
more serious defect in the runner itself: the `mode: 'full'` Karen-turn
agent has unrestricted filesystem access to this whole repo, including
each fixture's own grading ground truth. On this specific re-run, the
agent read `evals/self-test/golden/python-mcp-server-single/run-capture.json`
mid-interview, declared "this is exactly the same interview content as
our conversation," and jumped straight to `done` — skipping two documented
"must ask unprompted" items (AI-powered classification, coverage
threshold) and copying the golden capture's values verbatim instead
(confirmed by the `interviewFollowupJudge` dimension dropping to a 0.64
mean, below the 0.7 threshold, the only dimension this exposed on this
run). **Every prior `mode: 'full'` result reported above, including every
fixture already marked passing, ran under this same exposure and must be
treated as unconfirmed until re-run under the fix.** Fixed by explicitly
forbidding the Karen-turn prompt from reading `evals/self-test/`,
`answer-key.md`, `expected-karen.json`, `planted-issues.json`,
`expected-gates.json`, or `fixture-manifest.json` for the fixture under
test. A full re-run across every fixture under this fix ran and surfaced two
more real runner defects, both now fixed, both traced entirely on
`node-mcp-server-single`. First: `evals/runner/fixture-workflow.js`'s fixed
run-state-updater script uses CommonJS `require()` but was written to a
plain `.js` path, so on the one fixture whose `package.json` declares
`"type": "module"` Node treated it as ESM and crashed with `require is not
defined in ES module scope` on every audit trigger — fixed by writing it to
a `.cjs` path instead, which Node always treats as CommonJS regardless of
the target package's own `"type"` field. Second, and more consequential: a
transcript trace showed the karen-turn agent call that ultimately signaled
`done: true` had, moments before its final tool call, explicitly stated its
plan to copy already-correct, already-on-disk `.karen.json`/`harness.json`/
gate-script content (confirmed present, ~28KB across 7 real gate scripts)
into its structured-output response — but the actual tool call's argument
generation collapsed to `karenJson: {}, gateScripts: {}, harnessJson: {}`
(confirmed via the call's own `output_tokens: 400`, far too small to hold
that content), a verbatim-reproduction failure the schema's `if/then`
didn't catch because it only required the three fields be *present* when
`done: true`, not non-empty. That degenerate result then flowed through
persist-harness, which faithfully (and correctly, given its instructions)
overwrote the real prior `.karen.json`/`harness.json` with `{}` — and
separately, the ESM crash above caused the audit-relay step to pick up a
stale, hours-old leftover `-initial-audit.json` from an earlier run instead
of a fresh (or explicitly failed) result, because `runAuditSequence`'s
per-trigger check only looked for a `PATCH_FAILED:` marker or a falsy
response, not for the trigger's own `DONE` completion marker. Fixed three
ways: `minProperties: 1` added to `karenJson`/`gateScripts`/`harnessJson` in
the karen-turn schema so a degenerate empty result fails validation and
retries; each trigger's `outPath` is now deleted before that trigger's turn
runs, so a failed turn leaves it absent rather than stale; and the
`:run` step's own failure check now requires the trigger's `DONE` marker,
aborting the whole fixture capture explicitly instead of silently
proceeding to relay whatever happens to be on disk.

A subsequent live `mode: 'full'` re-run across all 14 fixtures returned
`fixturesSucceeded: 3` — traced to a structural gap rather than a skill or
fixture defect: `captureFromLiveKaren` is dozens of sequential `agent()`
calls per fixture (karen turns, persist-harness, 7 audit runs, merge,
relay), and any single transient upstream error anywhere in that chain
(Bedrock 503s, generic "unexpected error during processing," mid-response
server errors, or a structured-output retry-cap exhaustion) sacrificed the
entire fixture, since there was no fixture-level retry — only the
underlying `agent()` primitive's own call-level stall retry. Fixed by
wrapping each fixture's live capture in a retry loop (`fixtureRetries`,
default 3, overridable via `args`), and by adding a `failedFixtures` field
to the runner's returned result so a caller can see which fixtures dropped
out without digging through ephemeral task logs. Separately, this same
investigation surfaced and fixed a real fixture-authoring bug in
`python-backend-single`: `patches/01-partial-fix.json` claimed fixing the
`/admin/diagnostics` shell-injection issue nets `gate-3-security`'s count
`-1`, but per `quality-dimensions.md`'s documented B603/B607 post-filter
rule, removing `shell=True` while still passing a variable-derived `probe`
argv element trades one bandit finding (B602 shell=True) for two more
(B603/B607 subprocess-with-variable-argv) — the real delta is `+1`, not
`-1`. Fixed in the sidecar JSON and propagated through both the golden and
broken self-test `run-capture.json` samples; all 14 fixtures still pass
self-test after the fix. A single live sample from the failure-rate
investigation also showed `python-sdk-single` failing `interview`
(`mustAskRecall: 0.6`) and `interviewFollowupJudge` (`meanScore: 0.34`) —
re-running it several times to confirm this is systematic rather than
one-run variance, per the standard multi-run judge-dimension practice
above, is in progress. The same sample surfaced `python-backend-single`
scoring `knownGaps` `f1: 0.0`: the live agent recorded its E2E-only,
coverage-less decision correctly under `coverage: { enabled: false,
reason: "..." }`, but also duplicated it into a `knownGaps` entry that has
no corresponding ground truth (`expected-karen.json`'s `knownGaps` is
`[]`) — a real, previously-undocumented ambiguity: neither
`quality-dimensions.md` nor `BLUEPRINT.md` said the E2E-only-coverage
decision belongs in `coverage` only, never duplicated into `knownGaps`,
which is reserved for a stub/unimplemented capability some other gate
would otherwise flag. Fixed by adding that clarification to both docs;
needs verification in a future live re-run.

A subsequent live re-run of `python-sdk-single` and `python-backend-single`
surfaced one more real runner defect: `captureFromLiveKaren`'s final
`persist:<fixture>` step writes `run-capture.json` to a fixed
`/tmp/karen-eval-<fixture>-run-capture.json` path that's reused across
separate invocations (same reuse pattern already handled for each trigger's
`outPath`/`captureDir`, but this one path had no equivalent guard). When that
path already held a stale file from an earlier run, the `Write` tool's own
"read it first" guard rejected the first write attempt; the persisting agent
recovered by re-reading and reporting on the *stale* file's plausible-looking
top-level keys instead of retrying the write, printing `WRITTEN` despite the
fresh capture never landing on disk. `python-backend-single`'s reported
`delta` failure (`partialFix.gate-3-security` expected `1`, actual `0`) was
graded entirely off that stale leftover — the real gate output and the
per-trigger/merged audit files all show the correct `3→4` count. Fixed by
having the persist step `rm -f` the path first, then read the write back and
verify its top-level keys before reporting success, and by having the
workflow itself abort the capture on a `PERSIST_FAILED`/missing result
instead of trusting the agent's own claim. `python-sdk-single`'s separate
total capture failure (`"agent stalled on all 6 attempts"`) is a distinct,
not-yet-investigated issue. A fresh live re-run across all 14 fixtures to
confirm this fix and re-check `python-sdk-single` is the next step before
100% confidence.

This benchmark is a high-priority investment for the project, not an
internal-only QA tool — see [EVALS-PLAN.md §11](../EVALS-PLAN.md#11-benchmark-integrity--investment-priority)
for what's still ahead before scores from this suite get used to make the
implementation-approach decision (§9 step 5) or get published outside this
repo: a held-out fixture tier never committed to this repo, a per-fixture
Specificity/Solvability/Integrity audit, judge-rubric calibration against a
human-labeled reference set, versioning this benchmark itself once the
fixture matrix stabilizes, and reporting per-dimension results rather than
one blended score.
