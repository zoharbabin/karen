# Karen Eval Benchmark — Design Plan

> Build the yardstick before the thing it measures. Whatever implementation Karen ends up with — Node scripts, an MCP server, or something else — this benchmark stays the same and scores it the same way.

Status: **fixtures, graders, and self-test are built and internally verified; Karen herself is built as a Claude Code plugin (`plugins/karen/`). The runner's `mode: 'full'` path has completed a real validation run against her for one fixture (`node-sdk-single`, 100% pass@1 across all 11 dimensions after fixing two defects the run surfaced) — the other 13 fixtures haven't run yet.** See [evals/README.md](./evals/README.md) for the current state of everything under `evals/`. This document is the design rationale and the plan for what's still ahead of it.

**This benchmark is a first-class investment for this project, not a QA side-quest.** Karen's entire pitch is that she catches things a human reviewer would miss and doesn't flag things a naive regex-matcher would — both of those are empirical claims, and empirical claims need a benchmark, not a demo. A benchmark that's "good enough to unblock building Karen" and a benchmark that's "good enough to be the public evidence for why Karen is trustworthy" are different bars. §11 below sets out what closing that gap requires, on top of everything already built.

---

## 1. Why

[BLUEPRINT.md](./BLUEPRINT.md) defines Karen as a harness architect: she detects a project, interviews the user, generates gate scripts, and enforces a stateful audit loop (delta feedback + circuit breaker). That's four genuinely different capabilities, each failable in a different way:

1. **Detection can be wrong** — missed manifests, wrong language, missed monorepo structure.
2. **The interview can be bad** — asking things detection already answered, missing follow-ups a human interviewer would catch.
3. **Generated gates can be wrong** — missing real issues (false negatives), flagging decoys (false positives, the exact failure mode the blueprint's "structural over textual" principle exists to prevent — BLUEPRINT.md §"Security & Trust Boundaries").
4. **The stateful loop can be wrong** — delta/regression misreported, fingerprints unstable under line drift, circuit breaker never trips or trips on genuine progress.

BLUEPRINT.md §"The Skill Architecture" describes a tool surface — `detect_project`, `probe_tools`, `write_harness`, `run_gate`, `read_run_state`, `write_run_state` — that a real implementation can satisfy in more than one way. Three implementation approaches are under consideration for this project:

- **No dedicated tool scripts** — the agent uses its own built-in `Read`/`Glob`/`Grep`/`Bash` tools directly against the project instead of custom functions for `detect_project`, `probe_tools`, etc. Simplest to build, adds no new code to maintain, but every "tool call" is a prompt-shaped convention rather than a typed, testable function.
- **Node.js CLI scripts** — small scripts invoked via `Bash`, taking JSON in and emitting JSON out, each one implementing one blueprint tool function directly.
- **A bundled MCP server** — a long-running process exposing the blueprint's tool functions as real typed MCP tool calls, giving the agent structured inputs and outputs instead of shell-command conventions.

This project's v1 starts with the first approach — no dedicated tool scripts — for speed and zero added dependencies, with a plan to test it against several real projects over the following days before deciding whether the added structure of the other two approaches is worth the implementation cost. **The only way to compare that starting choice against either alternative later, on equal footing, is a fixed, repeatable benchmark that doesn't change when the implementation does.** Building the benchmark first, and validating the benchmark's own correctness before Karen was built (§6), keeps that future comparison evidence-based instead of impression-based.

This also matches the explicit project instruction already in this repo's `CLAUDE.md`/`AGENTS.md` conventions: define a verifiable goal and a concrete check per step before building.

---

## 2. What — Scope and Fixture Matrix

**Languages:** Node/TypeScript, Go, Python — the languages this project's real-world usage targets.
**Repo shapes:** single-package and monorepo/poly-repo (BLUEPRINT.md §"Poly-repo & Monorepo Structure").
**Project types:** MCP server, backend service, client-side app, SDK/library.

A full cross product (3 languages × 2 shapes × 4 types = 24) over-tests combinations that don't occur in practice (a Go browser client, a Python client-side app) and under-tests the blueprint mechanics that actually differentiate implementations. Instead, **14 fixtures** cover every language, every repo shape, and every project type at least once, chosen so each fixture also stresses a specific blueprint mechanic that a shallow implementation would get wrong:

| # | Fixture | Lang | Shape | Type | Blueprint mechanic stressed |
|---|---|---|---|---|---|
| 1 | `node-sdk-single` | Node/TS | single | SDK/library | Baseline: zero-dep strength signal (§"Recognizing Work That Exceeds the Baseline"), browser-direct-js zero-tolerance |
| 2 | `node-client-app-single` | Node/TS | single | client-side app | Full browser-direct-js profile: instance isolation, SRI, `permissions` charter |
| 3 | `node-mcp-server-single` | Node/TS | single | MCP server | `aiPowered` classification nuance — is an MCP server itself "AI-powered runtime" or just agent-adjacent tooling? (§"ai-agent" profile, the two distinct conditions); documented interface parity (§"Documentation Fidelity" — a tools table drifting from `src/tools/`); Agent Context Engineering claimed-audience check (§"Agent Context Engineering" — a `CLAUDE.md` Cursor claim with no `.cursorrules` backing it) |
| 4 | `node-monorepo` | Node/TS | mono | SDK + backend + client (mixed) | `subprojects[]` overrides, cross-subproject consistency (§"Cross-Subproject Consistency"), existing-tooling reconciliation (ships a working `check-docs.mjs` + eslint already); generated-sibling drift (§"Cross-Subproject Consistency" — the `"kind": "generated"` shape, an SDK client stale against the backend's OpenAPI spec) |
| 5 | `node-vendored-single` | Node/TS | single | SDK/library | Vendored & Copied-In Code (§) — a minified lib dropped in `vendor/` with no manifest entry and no provenance note |
| 6 | `go-backend-single` | Go | single | backend service | Go security patterns (`os/exec`, unsanitized input), no-coverage-instrumentation branch (`go test` without `-coverprofile`) |
| 7 | `go-mcp-server-single` | Go | single | MCP server | Cross-language check that MCP-server classification isn't JS-specific logic accidentally baked in |
| 8 | `go-monorepo` | Go | mono | backend + CLI | Multi-module detection (multiple `go.mod`), unowned root-level code (§"Unowned Root-Level Code") — a credential-minting script at the repo root claimed by no module |
| 9 | `python-sdk-single` | Python | single | SDK/library | Known Gaps vs. Exceptions classification (§) — ships both an intentional gap with a tracker and a temporary exception with an expiry |
| 10 | `python-backend-single` | Python | single | backend service | `subprocess(shell=True)`, `pickle.loads`, `yaml.load` without `SafeLoader`; E2E-only test suite branch |
| 11 | `python-mcp-server-single` | Python | single | MCP server | Python is the most common real-world MCP server language — parity check against fixtures 3 and 7; outbound indirect-prompt-injection risk (§"ai-agent" — content producer for someone else's agent, a tool result splicing unlabeled external output into returned text) |
| 12 | `python-monorepo` | Python | mono | backend + client-lib | Multiple `pyproject.toml`, one subproject SOC2-scoped and others not (§"subprojects overrides the root profile") |
| 13 | `node-personalization-backend-single` | Node/TS | single | backend service | Compliance Artifacts overclaim check, Personal-Data Registry Pattern, tiered feature-gated compliance (§"Tiered, Feature-Gated Compliance") — a store that never registers, a `SECURITY.md` claim with no backing file, and a `compliance[]` entry that only activates behind an unshipped feature flag; annotated-vs-unannotated intentional duplication (§"Code Structure & Elegance" — the `// karen-intentional-duplicate` marker) |
| 14 | `go-notification-dispatcher-single` | Go | single | backend service | Dead-code-as-named-check (§"Code Structure & Elegance"), Resiliency (§"Resiliency" — no-retry on an outbound webhook call), Performance & Resource Bounds (§"Performance & Resource Bounds" — unbounded-payload read, eager-heavy-startup subprocess spawn); accuracy-claim overclaim check (§"Test Integrity" — an unbacked "98% accurate" claim vs. a decoy backed by a real gold-set eval) |

Every fixture also plants **decoys** — patterns that look like violations but structurally aren't (`eval` inside a comment, a variable named `password` that isn't a credential, `pass` as a Python keyword vs. a stub) — because false-positive rate on decoys is the direct, measurable proxy for the blueprint's "structural over textual" requirement (§"Gate design principle — structural over textual (Principle 5)").

This is a **v1 set**. Nothing here is exhaustive of the blueprint (compliance regimes beyond SOC2, `browser-iframe`, `node-server` beyond what fixture 6/10 cover, PowerShell/Windows-native generation) — those extend the matrix later, once the core loop has been validated against the initial round of real-project testing described in §1.

---

## 3. Ground Truth Schema — What Each Fixture Ships

Every fixture is a directory under `evals/fixtures/<name>/` with:

```text
evals/fixtures/<name>/
  repo/                       # the fake project tree — copied to a scratch dir before every run, never mutated in place
  fixture-manifest.json       # ground truth for detect_project
  answer-key.md               # interview Q&A + ask/skip expectations, for the fake-user subagent
  expected-karen.json         # target .karen.json field values
  planted-issues.json         # every deliberate issue: file, line, category, isDecoy
  expected-gates.json         # which gates should exist, which tool each should wire in
  patches/
    01-partial-fix.patch      # fixes some but not all planted issues — tests delta "fewer complaints"
    02-regression.patch       # introduces a new issue — tests delta "more complaints"
    03-noop-line-shift.patch  # inserts an unrelated line above an unfixed issue — tests fingerprint stability
    04-repeat-noop.patch      # applied 3x with no fix — tests circuit breaker trip at threshold
```

**`fixture-manifest.json`** — ground truth for `detect_project`-equivalent output: exact manifest paths, languages, frameworks, CI config presence, existing test setup, agent-context files present, every existing quality-gate-like script with **its real coverage** (so reconciliation grading has something to check against — BLUEPRINT.md §"Reconciling Existing Quality Tooling"), the subproject list for monorepo fixtures, and unclaimed/unowned paths.

**`answer-key.md`** — the interview simulation contract (detail in §5). Format:

```markdown
## Answers
Q: what does this project do / who uses it?
A: "Browser SDK for an AI teaching avatar, used by edtech customers"

## Must ask unprompted (source has signal, detect_project can't classify intent)
- microphone/camera capability (source has `getUserMedia` calls)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present)
```

**`planted-issues.json`** — the OWASP-Benchmark-style ground truth (methodology below, §4.4):

```json
[
  { "file": "src/auth.ts", "line": 42, "category": "hardcoded-secret", "isDecoy": false },
  { "file": "src/util.ts", "line": 7,  "category": "eval-in-comment",  "isDecoy": true }
]
```

---

## 4. Grading Dimensions

Ten dimensions, each mapped to an established methodology rather than invented from scratch.

### 4.1 Detection accuracy — precision / recall / F1

`detect_project`'s output (language set, manifest paths, framework list, subproject list, unclaimed paths) is a **set-detection task**, not free text. Standard practice for this shape of problem is precision/recall/F1 computed per-field against ground truth, micro-averaged across fixtures:

- Precision = TP / (TP + FP), Recall = TP / (TP + FN) — canonical definitions per scikit-learn's `precision_recall_fscore_support` [1].
- Micro-averaging across fixtures (rather than macro) is the dominant convention in the closest established analog — named-entity-style set detection (CoNLL-2003 [2], confirmed still dominant by SeqScore [3]).
- Grading is **deterministic, code-based** — no LLM involved. Anthropic's own eval guidance ranks code-based grading first specifically because it's fast, cheap, and 100% repeatable [4, 5].

### 4.2 Interview quality — split into deterministic + judged sub-parts

Two of the three interview checks are actually deterministic, not qualitative, and should be graded as such — only the third genuinely needs a judge:

- **Precision on "shouldn't have asked"** — deterministic keyword/topic match against `answer-key.md`'s "must NOT ask" list. If detection already knows eslint is configured and the transcript contains a linting question, that's a countable defect, not a matter of taste.
- **Recall on "should have asked"** — deterministic keyword/topic match against the "must ask unprompted" list.
- **Follow-up quality** ("did Karen's next question meaningfully adapt to an answer that changed what matters," e.g. BLUEPRINT.md's mic/camera example) — this is genuinely qualitative and uses an **LLM judge**.

For the judged sub-part, mitigate the two best-documented judge failure modes:
- **Position bias** — Zheng et al. [6] show swap-consistency testing and declaring a tie on disagreement as the standard mitigation; not directly applicable here since there's no pairwise comparison, but the same paper's **reference-guided grading** (giving the judge the fixture's ground truth as a reference, not just the transcript) is directly applicable — in their math-grading experiment, adding a reference answer cuts judge failure count from 70% (default prompt) to 15% (reference-guided) [6].
- **Verbosity bias** — the judge prompt scores against the answer-key reference, not "how thorough does this sound."
- Run the judge **3 times per fixture and average**, flagging disagreement rather than silently smoothing it — repetition-count practice for LLM evals ranges from OpenAI's 5-run τ-bench reporting [7] to Terminal-Bench 2.0's 5-run minimum with 95% CIs [8] up to the ≥10-seed floor argued for small benchmarks by Madaan et al. [9]. **3 runs is a v1 starting point for cost, explicitly under-powered per [9] — scale to 5–10 once the harness is stable enough to justify the spend**, matching this project's general approach of testing broadly first and tightening rigor once a specific implementation is a serious candidate (see §7). Note a real counterpoint to the "more runs = more reliable" assumption: Haldar & Hockenmaier's "Rating Roulette" study of judge self-consistency [13] found intra-rater agreement plateaus by k=3 for most tasks and doesn't improve significantly out to k=10 — repeated runs mainly buy majority-vote stability, not narrower variance per se. Don't treat a higher k as a substitute for validating the rubric itself (§11.3); k buys consensus, not correctness.
- **Judge-panel option, deferred to the same trigger as k=5+.** Verga et al.'s PoLL method [14] shows a panel of 3 smaller, diverse judge models correlates with human ratings at least as well as one strong judge (e.g. GPT-4-class), at roughly 7x lower cost, and reduces each model family's own self-preference bias. If judge cost or single-model bias becomes a real concern once this benchmark is run against a real Karen implementation, swapping the single judge for a 3-model panel is a cheaper lever than raising k on one model — track this as an option, not a v1 requirement.

### 4.3 `.karen.json` field accuracy

Deterministic diff against `expected-karen.json`. Scalar fields (`project.type`, `aiPowered`) are exact-match; array/set fields (`subprojects[]`, `knownGaps[]`, `exceedsBaseline[]`) use the same precision/recall treatment as §4.1.

### 4.4 Generated-gate correctness — planted-issue precision/recall

This is the benchmark's central dimension and follows the most directly relevant established precedent: the **OWASP Benchmark Project** [10], which scores static analyzers by running them against thousands of test cases each deliberately containing either a real exploitable pattern (true positive) or a safe look-alike (false positive), pre-labeled per category in a ground-truth CSV, with per-category TP/FP scorecards computed from the tool's actual output.

Karen's gates get the identical treatment: run the generated gate script against `repo/`, diff its emitted `FILE:LINE` lines against `planted-issues.json`. An emitted line matching a real (non-decoy) planted issue is a TP; matching a decoy is an FP — this is the direct, measurable proxy for the blueprint's "structural over textual" requirement, since every decoy exists specifically to trip up a regex-only implementation.

This category mechanism is generic — it grades whatever categories a fixture's `planted-issues.json` declares, with no dimension-specific code. Fixture 13 exercises two categories this way that no earlier fixture stressed: `compliance-overclaim` (a compliance doc names a claim with no backing file or reference, per BLUEPRINT.md §"Compliance Artifacts") and `unregistered-personal-data-store` (a personal-data store never joins the consent registry, per BLUEPRINT.md §"Personal-Data Registry Pattern"). Fixture 14 exercises four more: `dead-code` (an exported function with no call site, no interface satisfaction, and no indirect lookup-table reference, per BLUEPRINT.md §"Code Structure & Elegance"), `no-retry` (an outbound network call made once with no retry/backoff, per BLUEPRINT.md §"Resiliency"), `unbounded-payload` and `eager-heavy-startup` (an unbounded in-memory-log read and a subprocess spawned at package-init time, both per BLUEPRINT.md §"Performance & Resource Bounds"). None of the six needed a new grading script.

### 4.5 Gate contract conformance

Deterministic: does the script accept `$1`, emit `file:line\tmessage` lines, end with `PASS (0 issues)` / `FAIL (N issues)`, exit 0/1 correctly, emit `ZERO-TOLERANCE` when the blueprint says it must (BLUEPRINT.md §"The Gate Contract")? No judgment involved — this is a format-conformance check, closer to a schema validator than an eval.

### 4.6 Delta feedback correctness

Apply `01-partial-fix.patch`, rerun the gate, confirm Karen reports "N fewer complaints" on exactly the gate that changed. Apply `02-regression.patch` next, confirm "N more complaints." This mirrors SWE-bench's `FAIL_TO_PASS`/`PASS_TO_PASS` pairing [11] — a fixed patch that must flip specific outcomes, plus a regression guard that must not silently break something that was passing.

A zero-tolerance gate's exact delta is graded by exact match — its finding count is a real, tool-verified fact. A non-zero-tolerance gate's exact delta is graded directionally instead (fix must decrease, regression must increase, net-zero must stay exactly zero): BLUEPRINT.md leaves those gate scripts' scope up to the implementing agent, so the exact count after a fix is agent-design-dependent, not a fixed ground truth — an exact-match check there would fail a correct implementation for choosing a differently-scoped, equally valid gate script.

### 4.7 Fingerprint stability under line drift

Apply `03-noop-line-shift.patch` (insert an unrelated line above an unfixed issue) and confirm the issue's content-hash fingerprint is unchanged and `staleCount` does not reset — directly testing BLUEPRINT.md's explicit requirement that fingerprints be "content-based, not `file:line`" (§"Run State").

### 4.8 Circuit breaker correctness

Apply `04-repeat-noop.patch` (or rerun with zero changes) three consecutive times against the same gate; confirm exit code flips to 2 exactly at the configured threshold, not before or after; confirm the reset behavior (a fingerprint-changing patch resets `staleCount`; a manual `write_run_state` reset clears it independent of fingerprint change).

### 4.9 Reconciliation correctness (fixture 4 only)

Deterministic check that the generated `existingGates[].coverage[]` entries match what `fixture-manifest.json` says `check-docs.mjs` actually covers, and — critically — that Karen did **not** generate a competing full gate for a dimension the fixture manifest says is already fully covered (BLUEPRINT.md §"A generated gate's scope is exactly the gap, never the whole dimension by default").

### 4.10 Known-gaps vs. exceptions classification (fixture 9 only)

Deterministic check that the tracker-backed, no-expiry gap lands in `knownGaps` and the dated, temporary one lands in `exceptions` — not swapped, not both in one bucket (BLUEPRINT.md §"Known Gaps vs. Exceptions").

---

## 5. Runner Architecture — Interview Simulation and Execution

`karen init` is conversational by design (BLUEPRINT.md §"The Init Conversation" — "questions adapt to what was already discovered"). A benchmark that only runs `--non-interactive --description "..."` mode would never exercise that adaptivity, which the blueprint treats as core to interview quality, not incidental. So the runner drives a **real two-agent conversation** per fixture:

- **Agent A ("Karen")** — runs `karen init` for real against the copied fixture repo.
- **Agent B ("fake user")** — a second agent, briefed with `answer-key.md`'s Q&A pairs, that answers Karen's questions as they come, staying in character and not volunteering information Karen didn't ask for (so recall on "must ask unprompted" is actually testable).

The full transcript (every question Karen asked, every answer given, the resulting `.karen.json`, the generated gate scripts) is captured and handed to the deterministic graders in §4, plus the judge for §4.2's follow-up-quality sub-part.

**Execution mechanism:** this two-agent conversation plus the patch/rerun sequence (§4.6–4.8) is exactly the shape the `Workflow` tool exists for — per-fixture independent pipelines (`pipeline()`, not `parallel()`, since fixtures don't share state), each running init → audit → patch → audit → regress → audit → repeat-noop ×3 → audit, with a deterministic grading stage immediately after each fixture's transcript completes. Real `mode: 'full'` runs against the built plugin are how this gets exercised now — the benchmark itself does not require the Workflow tool to be *buildable*, only to be *run*.

**Isolation:** each fixture run copies `repo/` to a fresh scratch directory; nothing is ever run in place against the committed fixture. This follows Anthropic's own documented incident of an agent gaining an unfair advantage from prior-trial state leakage when isolation wasn't enforced [5] — the exact failure mode this guards against.

---

## 6. Self-Test — Validating the Benchmark Before Karen Exists

Karen (the skill) was built after this benchmark, deliberately. The benchmark had to be verifiably correct on its own before it was ever pointed at a real implementation — otherwise a broken grader could silently report "0 issues" against a broken Karen, or reject a correct one.

For each fixture, hand-author two static, non-agent-generated sample outputs (a captured `.karen.json` + gate script + transcript, written by a human, not run through any agent):

- **`self-test/golden/<fixture>/`** — what a perfect Karen implementation would produce. Every grader in §4 must score this at (or above, for exceeds-baseline fields) the maximum.
- **`self-test/broken/<fixture>/`** — a deliberately flawed version: one real issue not caught, one decoy wrongly flagged, one unnecessary interview question asked, a `knownGaps`/`exceptions` swap. Every grader must catch its corresponding deliberate flaw and no other.

This is the same "validate any model-based grader by manually reading samples" principle Anthropic's cookbook recommends before trusting a grader at all [12], generalized to the deterministic graders too — a grading script with a bug is exactly as dangerous as a bad judge prompt.

---

## 7. Statistical Methodology

- **Per-fixture, deterministic dimensions (§4.1, 4.3–4.10):** single run is sufficient once the runner's isolation is correct — these have no LLM-sampling variance in the grading step itself, though the *thing being graded* (Karen's output) does vary run to run against the live plugin.
- **When graded against the real Karen implementation:** report **pass@1** (did this specific run succeed) and, per Anthropic's agent-eval framing [5], **pass@k** (probability of ≥1 success in k runs) for exploratory "can it work at all" questions, and **pass^k** (all k runs succeed) for anything safety-critical — the circuit breaker and zero-tolerance gates specifically, where "usually works" is not an acceptable bar.
- **Repetition count:** start at **k=3** for cost during the initial exploratory week, when the goal is testing broadly across many real projects rather than squeezing precision out of any one score; scale to **k=5** (OpenAI/Terminal-Bench precedent [7, 8]) once a specific implementation is a serious candidate, and to **k≥10** (Madaan et al.'s floor for small benchmarks [9]) before using benchmark scores to make a final architecture decision. Report **95% confidence intervals alongside every point estimate** once k≥5, matching Terminal-Bench 2.0's reporting convention [8] — a bare mean pass rate across 14 fixtures invites over-reading noise as signal.
- **Don't over-invest repetition count in the judge specifically.** Per §4.2's note on Rating Roulette [13], judge self-consistency plateaus by k=3 for most tasks — pushing the *judge* to k=10 mostly buys majority-vote stability among already-converged runs, not new information. Reserve k≥10 budget for dimensions where the thing varying is Karen's own behavior (detection, generated gates, circuit breaker), not the judge's rating of a fixed transcript.

---

## 8. File Layout

```text
evals/
  README.md                        # how to run, how to read a report
  fixtures/
    node-sdk-single/                ...(§3 layout)
    node-client-app-single/
    node-mcp-server-single/
    node-monorepo/
    node-vendored-single/
    go-backend-single/
    go-mcp-server-single/
    go-monorepo/
    python-sdk-single/
    python-backend-single/
    python-mcp-server-single/
    python-monorepo/
    node-personalization-backend-single/
    go-notification-dispatcher-single/
  grading/                          # plain Node, zero dependencies
    score-detection.js              # §4.1
    score-interview.js              # §4.2 deterministic sub-parts
    judge-interview-followup.md     # §4.2 judge prompt, reference-guided
    score-karen-json.js             # §4.3
    score-gate-issues.js            # §4.4
    score-gate-contract.js          # §4.5
    score-delta.js                  # §4.6
    score-fingerprint-stability.js  # §4.7
    score-circuit-breaker.js        # §4.8
    score-reconciliation.js         # §4.9
    score-known-gaps.js             # §4.10
    aggregate-report.js             # combines all scores, mean ± SD across k runs
  runner/
    fixture-workflow.js             # Workflow script: per-fixture pipeline (§5)
    fake-user-agent-brief.md        # template for Agent B
  self-test/
    golden/<fixture>/...            # §6
    broken/<fixture>/...            # §6
```

All grading and runner code is plain Node.js with no external dependencies — consistent with the "no dedicated tool scripts" starting approach chosen for Karen's own v1 implementation (§1), and with the blueprint's own recognition of zero-runtime-dependencies as a strength worth holding itself to (BLUEPRINT.md §"Supply Chain & Dependencies").

---

## 9. Rollout Plan

1. **Build the 14 fixtures** (repo trees, planted issues + decoys, ground truth files, answer keys, patches).
2. **Build the grading scripts**, validate each against hand-authored golden/broken pairs (§6) — the benchmark must pass its own self-test before touching Karen.
3. **Build the runner** (`fixture-workflow.js`) — dry-run it against the `self-test/golden` outputs (bypassing real agent execution) to confirm the pipeline plumbing works end to end.
4. **Done:** the Karen skill is built using the "no dedicated tool scripts" approach described in §1 (`plugins/karen/`). **In progress:** pointing the runner at it (`mode: 'full'`) and the multi-day testing phase across several real projects — using this benchmark alongside that ad hoc real-project testing, not instead of it.
5. **Not yet started:** revisit the implementation-approach decision from §1 — no dedicated tool scripts vs. Node.js CLI scripts vs. a bundled MCP server — using benchmark scores as one input, not the only input. Depends on step 4 completing.

---

## 10. Open Questions / Risks

- **Judge cost at k=3–10 across 14 fixtures** is not free — each judged run is a full LLM call. Track actual token spend during the first exploratory week before committing to k=10 for every dimension; §4.2's judge sub-part is the only dimension that needs it at all.
- **Fixture realism** — hand-authored fixtures risk not matching what real repos actually look like. The multi-day, multi-project real-world testing phase described in §1 and §9 is the correction mechanism for this, not something the benchmark can fix on its own; consider promoting a real project's anonymized structure into a 13th fixture if the hand-authored ones prove too clean.
- **MCP-server `aiPowered` classification (fixtures 3, 7, 11) — resolved.** An MCP server is invoked by an LLM's tool-calling loop but doesn't itself call one; BLUEPRINT.md's ai-agent profile now names this explicitly as a third case (see "A tool-provider server..." under [ai-agent](./BLUEPRINT.md#ai-agent)) — `aiPowered: true` even with no outbound LLM call, because the excessive-agency and prompt-injection threat classes apply to the tool-call surface regardless of which side of the connection issues the LLM call. All three fixtures' `expected-karen.json` now agree (fixture 7's `go-mcp-server-single` was previously the one inconsistent case, still `aiPowered: false` with no rationale while 3 and 11 had already been corrected to `true` — fixed after cross-referencing a real Go MCP server, `web-researcher-mcp`, with the identical shape and the same classification in its own security docs). Corresponding self-test golden/broken samples for fixture 7 were updated to match; all 168 self-test checks across the 12 fixtures still pass.
- **Compliance-claim-to-reference drift and the personal-data-registry gap — resolved.** Fixture 13 (`node-personalization-backend-single`) now plants both a `compliance-overclaim` decoy pair (a `SECURITY.md` claim naming a still-existing file vs. one naming `src/audit/log.ts`, which doesn't exist) and an `unregistered-personal-data-store` decoy pair (a TTL'd session-token cache that correctly never registers vs. a usage-event store that should but doesn't), graded via §4.4's existing category mechanism with no new grading script. The Agent Context Engineering claimed-audience check (see [Agent Context Engineering](./BLUEPRINT.md#agent-context-engineering)) is resolved separately below.
- **Dead-code-as-named-check, Resiliency, and Performance & Resource Bounds coverage — resolved.** These three BLUEPRINT.md mechanics (added under Code Structure & Elegance, and as two new top-level sections) had no fixture stressing them. Fixture 14 (`go-notification-dispatcher-single`) now plants four real/decoy pairs: `dead-code` (an exported legacy formatter with no call site vs. a decoy reached indirectly through a `formatters` lookup table — the exact structural-vs-textual distinction Principle 5 exists to catch), `no-retry` (a single-attempt outbound webhook call vs. a decoy already wrapped in retry+backoff), `unbounded-payload` (an uncapped in-memory delivery-log read vs. a decoy with an explicit page-size cap), and `eager-heavy-startup` (a subprocess spawned at package-init time vs. a decoy lazily built behind `sync.Once`) — all graded via §4.4's existing category mechanism, no new grading script. Self-test golden scores maximum across all 10 applicable dimensions; self-test broken reproduces exactly one false negative (`format.go:10`, the real dead-code issue) and one false positive (`registry.go:20`, the dead-code decoy), matching `flaws.json`.
- **KAREN-VS-WEB-RESEARCHER-MCP.md gaps A–F — resolved.** Six findings from comparing Karen's design against a real MCP-server project were closed with BLUEPRINT.md prose plus fixture extensions, all graded via §4.4's existing category mechanism (no new grading script needed for any of them): **Gap A** (outbound/indirect prompt injection — a tool-provider's own responses becoming untrusted input inside a *downstream* agent's context, added under [ai-agent](./BLUEPRINT.md#ai-agent)) → `unlabeled-tool-output` on fixture 11 (`python-mcp-server-single`), gate-3-security. **Gap B** (a markdown table enumerating a CLI/tool/API surface as a bidirectionally-checkable contract, added under [Documentation Fidelity](./BLUEPRINT.md#documentation-fidelity)) → `doc-contract-drift` on fixture 3 (`node-mcp-server-single`), gate-4-docs-parity. **Gap C** (the `// karen-intentional-duplicate: <reason>` escape hatch for deliberately-divergent duplication, added under [Code Structure & Elegance](./BLUEPRINT.md#code-structure--elegance)) → `unannotated-intentional-duplication` on fixture 13 (`node-personalization-backend-single`), gate-2-completeness. **Gap D** (self-applied gold-set evals as baseline-exceeding work, and non-security accuracy-overclaim as the same risk shape as `compliance-overclaim`, added under [Recognizing Work That Exceeds the Baseline](./BLUEPRINT.md#recognizing-work-that-exceeds-the-baseline) and [Test Integrity](./BLUEPRINT.md#test-integrity)) → `accuracy-overclaim` on fixture 14 (`go-notification-dispatcher-single`), gate-6-test-integrity — the decoy claim is backed by a real `internal/dispatch/testdata/format_gold.json` gold set plus a `cmd/scoreformat` scorer that actually builds and runs. **Gap E** (a generated subproject's generation-marker going stale against its source, the `"kind": "generated"` shape, added under [Cross-Subproject Consistency](./BLUEPRINT.md#cross-subproject-consistency)) → `stale-codegen-output` on fixture 4 (`node-monorepo`), gate-2-completeness, plus a fix to `score-karen-json.js` (previously `crossSubprojectConsistency` was never diffed by `arrayFieldMetrics` at all — now fixed and confirmed graded). **Gap F** (the already-existing Agent Context Engineering claimed-audience prose finally gets a fixture) → `agent-context-audience-overclaim` on fixture 3 (`node-mcp-server-single`, stacked alongside Gap B's `doc-contract-drift`), gate-7-agent-context — a `CLAUDE.md` claiming Cursor as an audience with no `.cursorrules` anywhere in the repo, decoy is the correctly-satisfied Claude Code claim. A separate pre-existing bug was also fixed opportunistically: fixture 7 (`go-mcp-server-single`)'s manifest, self-test transcript, and gate-7 script all referenced `repo/AGENTS.md`, which didn't exist — added.

---

## 11. Benchmark Integrity & Investment Priority

Everything in §1–§10 describes a benchmark sized to unblock building Karen: enough fixtures to exercise every blueprint mechanic once, enough grading rigor to trust a self-test pass, enough statistical scaffolding to compare implementation approaches without hand-waving. That bar is met — see [evals/README.md](./evals/README.md)'s status line. This section is the plan for the next bar: treating the benchmark itself as a durable, public-facing asset that has to keep being trustworthy as Karen changes, as the fixtures age, and as anyone outside this repo starts checking our claims against it. None of this blocks building Karen; all of it should land before benchmark scores are used to make the v1-vs-v2 implementation call in §9 step 5, or before any score is published outside this repo.

### 11.1 A held-out fixture tier, never committed to the public repo

All 14 fixtures are committed in plain text under `evals/fixtures/`. That's necessary for the benchmark to be reproducible and auditable, but it's also exactly the condition under which a benchmark stops discriminating: SWE-bench went from a single public set to a three-way split — public, held-out-but-same-distribution, and fully private — specifically because a benchmark that's entirely public gets memorized (by training-time contamination) or gamed (an agent that can search the web mid-run finds its own answer key) [13, 14, 15]. The held-out tier isn't a hypothetical defense for Karen either — an agent running `karen init`/`karen audit` inside this benchmark has the same `Bash`/web-search tool access a real coding agent has, so nothing stops it from grepping this repo's own `planted-issues.json` for the fixture it's currently being graded on unless that file simply isn't reachable.

**Plan:** once the fixture matrix is judged stable (post §9 step 4's real-project testing phase), author 3–4 additional fixtures — same shape and rigor as the existing 14, one per language — and keep them **out of version control**, distributed only to whoever runs the benchmark for real (a local untracked directory, or a private companion repo). Score them alongside the public 14 but report their aggregate separately; a large gap between public-fixture and held-out-fixture scores is itself a finding (it means something is overfitting to the specific 14, whether that's Karen's own prompt tuning or an agent noticing repo-internal ground-truth files). Until this tier exists, treat the public 14's scores as an upper bound, not a ground truth.

**Sandbox note, not a new mechanic:** whatever agent sandbox eventually runs `karen init`/`karen audit` for real (§5, §9 step 4) should run with outbound network access disabled during graded runs. This is the practical mitigation for "search-time contamination" [15] — an agent that can search the live web mid-run can find this repo (or its held-out companion, if that ever leaks) and read the answer key directly, which no amount of held-out-fixture design can fix on its own.

### 11.2 A per-fixture integrity checklist, borrowed from Terminal-Bench 2.0

Terminal-Bench 2.0's task-acceptance process runs every task through a three-part human audit before it ships — **Specificity** (the grading check passes if and only if the task is actually done correctly, not just superficially), **Solvability** (a real oracle solution exists and passes the grading check), and **Integrity** (no exploitable shortcut lets an agent pass without doing the task) [16] — plus an automated adversarial pass that specifically tries to find ways to cheat each task before trusting it. Karen's fixtures have never been run through an equivalent checklist; §6's self-test validates that the *graders* work against hand-authored golden/broken samples, but nothing currently confirms that each fixture's planted issues are unambiguous, that a real minimal fix exists and would satisfy the gate, or that there's no shortcut that scores well without actually fixing anything.

**Plan, applied per fixture:**
- **Specificity** — for every entry in `planted-issues.json`, confirm the category is unambiguous: would two different competent reviewers agree it's a real issue (or, for decoys, agree it's safe)? Where existing fixtures already have this reviewed informally (§10's six resolved gap-closing entries went through exactly this kind of scrutiny), record that; where they haven't, review and record it.
- **Solvability** — author a minimal oracle fix per fixture (a patch that resolves every non-decoy planted issue and nothing else) and confirm the fixture's own gate scripts, once generated correctly, would pass against it. `01-partial-fix.patch` already exists per fixture for delta-feedback testing (§3) but is deliberately incomplete; the oracle fix is a new, separate patch that must be *complete*.
- **Integrity** — for each fixture, spend one deliberate pass asking "how would a lazy or hostile agent get a passing gate without actually fixing the planted issues" (e.g., deleting the file the gate script scans, redefining a decoy string so a naive gate matches on filename instead of content, disabling a test rather than fixing the code it tests). Where a shortcut is found, either the fixture or the corresponding grading dimension needs to close it before that fixture's score is trusted.

This checklist is cheap relative to what it buys: it's the same rigor Karen's own gate contract expects from a generated gate (BLUEPRINT.md's "structural over textual" principle), applied reflexively to the benchmark's own ground truth.

### 11.3 Judge validation, before trusting §4.2's judge at any k

§4.2 and §7 already plan to run the follow-up-quality judge 3–10 times and average; that protects against *judge variance* but does nothing to confirm the judge's *rubric* is actually calibrated to what a human would say. Rating Roulette's finding that self-consistency plateaus by k=3 [13] makes this the more important gap to close, not less — extra runs of an uncalibrated judge just produce a stable wrong number faster.

**Plan:** before the judge prompt (`judge-interview-followup.md`) is trusted at any k against a real Karen implementation, build a small calibration set — 6–10 hand-written follow-up-question transcripts spanning the full quality range (a clearly good adaptive follow-up, a clearly bad redundant one, and a couple of deliberately ambiguous middle cases), each with a human-assigned reference score. Run the judge against this set and compute agreement (weighted Cohen's kappa is the emerging standard for judge-vs-human agreement [17]); a kappa below roughly 0.6 means rewrite the rubric before using the judge on real fixtures, not average away the disagreement. Re-run this calibration whenever the judge prompt or judge model changes — a judge that was calibrated against one model generation isn't guaranteed calibrated against the next. If cost allows once this benchmark is scored against a real implementation, a 3-model judge panel (PoLL [14]) is a cheaper, bias-reducing alternative to raising k on a single judge model — see §4.2's note.

### 11.4 Benchmark versioning — this is a versioned artifact, not a snapshot

Nothing currently tracks which fixtures existed, which grading dimensions applied, or what a given score meant at a specific point in this project's history — every change so far has landed as an in-place edit (§10's "resolved" entries are the closest thing to a changelog, embedded in prose). That's fine for a benchmark still being built; it stops being fine once scores get compared across time ("did switching to an MCP-server implementation actually improve detection recall, or did fixture 3 change underneath the comparison?"). MLPerf's answer to this exact problem is a numbered-round system: each benchmark round has its own frozen rule set, and a task is formally marked deprecated (with "latest version available" recorded) rather than silently dropped or altered [18].

**Plan:** once the fixture matrix and grading dimensions are stable (post §9 step 4), tag this benchmark itself with a version number (starting at `v1`), and require any future change that alters what a fixture tests, adds/removes a grading dimension, or changes a threshold to bump that version with a short changelog entry (a new `evals/CHANGELOG.md`, not buried in `EVALS-PLAN.md` prose). Scores get reported against the benchmark version that produced them. This is deliberately deferred, not skipped — versioning something still under active construction produces churn with no payoff; versioning it right before it starts being used for real comparisons is when the discipline pays for itself.

### 11.5 Publish methodology, not a single number

Karen's benchmark is close to unprecedented ground on its own terms: there is no published, independent methodology for scoring an LLM-driven (not static-analysis) code reviewer's false-positive/false-negative rate the way this benchmark's §4.4 does — every AI PR-reviewer vendor (CodeRabbit, Greptile, Cursor Bugbot, Copilot code review) benchmarks itself, on its own chosen sample, and reports whatever number makes it look best, with no shared methodology and no independent verification [19]. The credibility move available here isn't "publish a leaderboard score" — a bare number invites the same skepticism vendor self-benchmarks already get, and OWASP-Benchmark-style public scores are increasingly treated as contamination-prone once a benchmark is old and public enough [20]. It's publishing the **fixtures, the decoys, and the grading scripts themselves**, so any claim about Karen's precision/recall is independently reproducible by whoever's evaluating whether to adopt her. That transparency — not a headline percentage — is what should get called out in this project's public-facing docs (`BLUEPRINT.md`, any future README/site copy) once there's a real score to talk about.

**Practical corollary:** don't collapse the 10 grading dimensions into one aggregate "Karen score" for external consumption. Report per-dimension results (detection F1, gate-issue precision/recall by category, circuit-breaker correctness, etc.) the way Rafter's five-dimension methodology does for AI security review tools [19] — a single blended number is easier to game and harder to act on than a scorecard that shows exactly where an implementation is weak.

### 11.6 Re-run on every underlying-model change, not just on Karen-implementation changes

Once this benchmark runs against a real Karen implementation, its scores are a function of two things that can each change independently: Karen's own prompts/tools, and whichever underlying model is running her. A model upgrade can shift false-positive rates overnight even with zero changes to Karen [19]. **Plan:** whenever the primary model Karen runs on changes (a new Claude release, or a switch to a different underlying model for a specific integration), re-run at least the k=3 exploratory pass across all 14 fixtures before trusting that prior scores still describe current behavior. This is a cadence commitment, not new mechanics — nothing in §4–§8 needs to change to support it, it just needs to actually happen and not get silently skipped because "nothing about Karen changed."

### 11.7 Where this benchmark is genuinely novel, and where it should keep borrowing

Worth stating plainly, since it shapes where further investment is highest-leverage: §4.4's decoy-based grading of an LLM-authored gate script, and §4.8's circuit-breaker/escalation-correctness dimension, have no direct published precedent to borrow rigor from — the closest adjacent work (BFCL's tool-call correctness [21] for orchestration, and scattered "retry loop" agent-failure-mode taxonomies for circuit breakers) is suggestive, not a methodology this benchmark can adopt wholesale. That's fine — it means those two dimensions are where hand-review (§11.2's Integrity check, especially) matters most, since there's no external check to lean on. By contrast, §4.2's interview-quality dimension now has a close, very recent published analog worth adopting metrics from: ClarifyCodeBench [22] and its companion ReqElicitGym [23] both score an LLM's clarifying-question behavior against annotated key questions, including a "turn-discounted" penalty for asking redundant follow-ups — directly applicable to sharpening the "must NOT ask" precision check in §4.2 beyond simple keyword matching, once there's a real transcript to score.

---

## Sources

[1] scikit-learn, `precision_recall_fscore_support` — https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_fscore_support.html
[2] Tjong Kim Sang & De Meulder, "Introduction to the CoNLL-2003 Shared Task," ACL Anthology W03-0419 — https://aclanthology.org/W03-0419/
[3] Palen-Michel et al., "SeqScore," ACL Anthology 2021.eval4nlp-1.5
[4] Anthropic, "Define success criteria and build evaluations" — https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
[5] Anthropic Engineering, "Demystifying evals for AI agents" — https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
[6] Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena," arXiv:2306.05685 (NeurIPS 2023)
[7] OpenAI, GPT-4.1 / o3 launch pages (τ-bench averaged across 5 runs) — https://openai.com/index/gpt-4-1/, https://openai.com/index/introducing-o3-and-o4-mini/
[8] "Terminal-Bench 2.0," arXiv:2601.11868 (≥5 runs, 95% CIs)
[9] Madaan et al., "A Sober Look at Progress in Language Model Reasoning," arXiv:2504.07086 (≥10 seeds for small benchmarks)
[10] OWASP Benchmark Project — https://owasp.org/www-project-benchmark/
[11] Jimenez et al., "SWE-bench," arXiv:2310.06770; https://github.com/princeton-nlp/SWE-bench
[12] Anthropic Cookbook, `building_evals.ipynb` — https://github.com/anthropics/anthropic-cookbook/blob/main/misc/building_evals.ipynb
[13] Haldar & Hockenmaier, "Rating Roulette: Self-Inconsistency in LLM-as-a-Judge Frameworks," Findings of ACL: EMNLP 2025 — https://aclanthology.org/2025.findings-emnlp.1361/
[14] Verga et al., "Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models," arXiv:2404.18796
[15] "SWE-Bench Pro: Can AI Agents Solve Long-Horizon Software Engineering Tasks?", arXiv:2509.16941 (Scale AI) — public/held-out/private three-way split; https://labs.scale.com/leaderboard/swe_bench_pro_public
[16] "Terminal-Bench 2.0," arXiv:2601.11868 — Specificity/Solvability/Integrity task-acceptance audit, adversarial exploit-agent pass
[17] Cohen's-kappa-based judge-vs-human agreement reporting, per Autorubric, arXiv:2603.00077, and industry LLM-judge best-practice guidance (2026)
[18] MLCommons, MLPerf Training Rules — versioned rounds and deprecated-benchmark tracking — https://github.com/mlcommons/training_policies/blob/master/training_rules.adoc
[19] Rafter, "Benchmarking AI Code Security Agents" (2026) — five-dimension public methodology for AI code-review tools, re-benchmark-on-model-change guidance — https://rafter.so/blog/benchmarking-ai-code-security-agents; DeepSource, "There is no SWE-bench for code review" blog retrospective — https://deepsource.com/blog
[20] Anthropic Engineering, "Demystifying evals for AI agents" — contamination/staleness discussion for long-lived public benchmarks — https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
[21] Berkeley Function-Calling Leaderboard (BFCL v4) — tool-call-orchestration correctness precedent — https://gorilla.cs.berkeley.edu/leaderboard.html
[22] Fang et al., "ClarifyCodeBench: Evaluating LLMs on Clarifying Ambiguous Requirements for Code Generation," arXiv:2607.00711
[23] "ReqElicitGym: An Evaluation Environment for Interview Competence in Conversational Requirements Elicitation," arXiv:2602.18306

The `Workflow` tool referenced in §5 is a Claude Code agent orchestration tool (fan-out/pipeline execution across subagents), available to whichever agent runs this benchmark — not an external library requiring its own citation, since it governs how *this benchmark* gets executed, not the blueprint's design.
