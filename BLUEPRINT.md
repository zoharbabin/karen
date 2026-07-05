# Karen — Quality Gate Framework Blueprint

> Karen needs to speak to your manager before this ships.

Karen is a **skill and plugin for AI coding agents** — Claude Code, Codex, Cursor, and others. She is not a standalone app. She has no CLI of her own. She runs inside the agent.

She's a harness architect: she interviews you and surveys your project, then designs a custom quality gate harness — shell scripts wired to your tools, your language, your conventions. Those scripts get committed to your repo and run on every audit. The agent runs them, reads Karen's output, and refuses to sign off until every last complaint is resolved.

She's not a linter. She's thorough. There's a difference.

---

## Brand Voice & Personality

Karen has a character. Use it consistently — in agent output, docs, error messages, and README copy. The humor is the point: developers remember "Karen has complaints" in a way they don't remember "audit failed."

**The core personality:**

- She has *standards*. Vague assurances don't satisfy her. Exit 0 does.
- She escalates. She won't let a problem quietly pass because it's inconvenient.
- She's always right. When she says there's an issue, there's an issue.
- She's not the enemy. She's the last line of defense before your code becomes someone else's problem.

**Tone: dry, direct, slightly theatrical. Never mean, never apologetic.**

**In audit output — the lingo:**

| Situation | Karen says |
|---|---|
| Gate failure | `Karen has N complaints.` |
| Gate pass | `Karen is satisfied.  (0 issues)` |
| All gates pass | `Karen is satisfied. You may proceed.` |
| Expired exception | `Karen has flagged an expired exception. Deal with it.` |
| Zero-tolerance violation | `Karen will not negotiate on this.` |
| Re-run after fixes | `Karen is checking your work.` |
| First run | `Karen is reviewing your project.` |
| Progress on re-run | `Karen acknowledges progress.  (N fewer complaints)` |
| Agent loop escalation | `Karen has seen this before. She's escalating.` |
| Exception expiry warning | `Karen notes an exception expires in N days. Prepare a fix.` |
| Circuit breaker reset | `Karen is resuming. The circuit has been reset.` |

**Example passing run:**

```
[karen audit]

Karen is reviewing your project.

GATE 1  supply-chain    Karen is satisfied.  (0 issues)
GATE 2  completeness    Karen is satisfied.  (0 issues)
GATE 3  security        Karen is satisfied.  (0 issues)
GATE 4  docs-parity     Karen is satisfied.  (0 issues)
GATE 5  compliance      Karen is satisfied.  (0 issues)
GATE 6  test-integrity  Karen is satisfied.  (0 issues)

Karen is satisfied. You may proceed.

EXIT 0
```

**Example failing run (first run):**

```
[karen audit]

Karen is reviewing your project.

GATE 1  supply-chain    Karen is satisfied.  (0 issues)
GATE 2  completeness    Karen has complaints.  (3 issues)
  src/session.py:44     exported `start_stream` — no docstring
  src/agents.py:112     exported `delete_agent` — no test
  src/http.py:89        `retry` documented in README but not in API-REFERENCE.md
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
GATE 4  docs-parity     Karen is satisfied.  (0 issues)
GATE 5  compliance      Karen is satisfied.  (0 issues)
GATE 6  test-integrity  Karen is satisfied.  (0 issues)

Karen has 4 complaints. She will not let this ship. Fix it and try again.

EXIT 1
```

**Example re-run with partial progress:**

```
[karen audit]

Karen is checking your work.

GATE 1  supply-chain    Karen is satisfied.  (0 issues)
GATE 2  completeness    Karen acknowledges progress.  (1 fewer complaint)
  Karen has complaints.  (2 issues)
  src/agents.py:112     exported `delete_agent` — no test
  src/http.py:89        `retry` documented in README but not in API-REFERENCE.md
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
GATE 4  docs-parity     Karen is satisfied.  (0 issues)
GATE 5  compliance      Karen is satisfied.  (0 issues)
GATE 6  test-integrity  Karen is satisfied.  (0 issues)

Karen has 3 complaints. Progress noted. She still will not let this ship.

EXIT 1
```

**In the README and docs:**

- "Karen audits your project" not "the tool runs checks"
- "Karen has complaints" not "errors were found"
- "Satisfy Karen" not "pass the audit"
- "Karen is satisfied" not "all checks passed"

---

## What Karen Is

Karen is a **skill and plugin**, not a standalone tool. She runs inside an AI coding agent (Claude Code, Codex, Cursor, or any agent with tool-use). The agent is the runtime; Karen provides the structure.

This means two things work together:

- **The agent is the intelligence.** It conducts the interview, reasons about your project, decides which tools to probe, and writes gate scripts calibrated to what it learned. Domain knowledge — security rules for JavaScript, compliance checklists for HIPAA, test patterns for Go — lives in the model, not hardcoded in Karen.
- **Karen's tools are the determinism.** The skill exposes a set of structured tool functions: read a manifest, probe which tools are installed, write the harness to disk, run a gate script and parse its output. Every fact the agent acts on comes from a tool call — not from inference.

**What Karen does:**

1. **Analyzes** your codebase — reads manifests, CI configs, test setup, compliance artifacts, security configs, and agent context files.
2. **Interviews** you conversationally for anything analysis couldn't determine — deployment context, audience, regulatory environment, sensitive capabilities.
3. **Designs** your harness — gate scripts that wire up the right tools for your project, checking what actually matters given what she learned.
4. **Runs** the harness on demand, collects structured output from each gate, and speaks her mind about what she found.

**What she does not do:**

- Operate without an agent runtime. No agent, no Karen.
- Hardcode tool choices or security rules. She wires your tools into gates; those tools own their rules.
- Assume your language, framework, or compliance regime. She discovers them.
- Apply browser-JS security checks to a Python CLI, or HIPAA artifact checks to an internal tool.
- Impose a framework on your project. She fits to what you have.

---

## The Skill Architecture

Karen is a skill registered with the coding agent (e.g., a Claude Code skill named `karen`, or an equivalent plugin in Codex or Cursor). It exposes a set of structured tool functions. The agent calls these tools; the tools handle all deterministic filesystem and subprocess operations. The agent supplies all reasoning.

**How the responsibilities split:**

| Responsibility | Who handles it |
|---|---|
| Conversational interview | The agent — asks follow-ups, adapts to answers, reasons about what matters |
| Writing gate scripts | The agent — using its knowledge of tools, rule packs, and the project profile |
| Reading files and manifests | Karen's `detect_project` tool |
| Checking which tools are installed | Karen's `probe_tools` tool |
| Writing `.karen/` to disk | Karen's `write_harness` tool |
| Executing a gate script | Karen's `run_gate` tool |
| Tracking run state for delta/circuit-breaker | Karen's `read_run_state` / `write_run_state` tools |

The agent never guesses at filesystem state — it calls a tool and gets a fact. The tools never reason about what to check or ask — that's the agent's job. Neither does the other's work.

**Skill tool surface:**

| Tool | What it returns |
|------|----------------|
| `detect_project(path)` | Structured project profile: languages, frameworks, manifests found at any depth (including multiple/nested manifests for poly-repo and monorepo detection), CI config, existing test setup, agent context files, and an inventory of existing quality-gate-like scripts (docs checkers, constitution/verify scripts, lint/CI steps) for harness reconciliation — see [Reconciling Existing Quality Tooling](#reconciling-existing-quality-tooling) |
| `probe_tools(path, candidates)` | For each candidate (eslint, semgrep, govulncheck, bandit, gitleaks, etc.) — available: true/false, configured: true/false, config path if found |
| `write_harness(path, profile, gates)` | Writes `.karen/`, `.karen.json`, and gate scripts; returns the list of files written |
| `run_gate(script, root)` | Executes the gate script, returns structured `{file, line, message}[]` issue list + summary |
| `read_run_state(path)` | Last run's issue fingerprints per gate; null if no prior run |
| `write_run_state(path, state)` | Persists current run fingerprints; used for delta and circuit-breaker logic |

**Gate scripts are agent-written, not templated.** When `karen init` runs, the agent reads the project profile and tool availability, then writes each gate script directly — a thin shell script that calls the right tool with the right flags and normalizes the output. The agent brings knowledge of semgrep rule packs, eslint plugin configs, compliance toolchains, and output formats. No static template library can match this; the agent writes exactly what the project needs.

**The skill is the contract; the agent is the implementer.** Structured tool outputs mean the agent never fabricates a file path, issue count, or tool availability — it calls `probe_tools` and gets the truth. The intelligence lives in the model; the determinism lives in the tools.

---

## The Two Operations

Karen has two operations. Both are invoked by telling the coding agent to run them — not by typing a shell command yourself.

```
karen init     ← agent analyzes the project, interviews you, generates .karen/ harness
karen audit    ← agent runs the gate scripts, reports structured output, exits 0 or non-zero
```

**`karen init`** is fully LLM-driven. The agent calls `detect_project` and `probe_tools`, conducts a conversational interview, writes the gate scripts, and calls `write_harness` to commit everything to disk. You talk to the agent; the agent does the rest.

**`karen audit`** is deterministic. The agent calls `run_gate` for each script in `.karen/gates/`, collects the structured output, applies delta and circuit-breaker logic via `read_run_state` / `write_run_state`, and reports Karen's verdict. Because the gate scripts are plain shell files committed to the repo, any agent — or a CI runner — can execute them directly without the full Karen skill present.

**How to tell the agent to audit:**

In `CLAUDE.md` / `AGENTS.md` for any project, the stopping condition is always:

```markdown
## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.
```

The agent never needs to know how the harness works. It runs the audit, reads Karen's output, fixes what she reports, reruns — and stops cold if she escalates.

---

## The Init Conversation

`karen init` is a two-step process driven by the LLM, not a fixed wizard.

**Step 1 — Automated analysis.** Karen calls `detect_project()` to read the project: package manifests (`package.json`, `pyproject.toml`, `go.mod`, `Gemfile`, `Cargo.toml`), CI configs, existing test setup, existing compliance artifacts, security configs, and agent context files (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`). It also calls `probe_tools()` to discover what tools are available and configured — which linters, which SAST scanners, which test runners. It also inventories every existing quality-gate-like script it can find, so the interview can ask about coverage instead of guessing at it — see [Reconciling Existing Quality Tooling](#reconciling-existing-quality-tooling).

**Step 2 — Conversational interview.** The LLM conducts a real conversation to fill in what analysis couldn't determine. Questions adapt to what was already discovered. A project with an existing `.eslintrc` won't be asked about its linting setup. A project with no test runner configured will be asked what it uses, then asked why if it says none. The interview covers:

- What the project does and who uses it
- Deployment context and runtime environment
- Audience and data sensitivity (PII, payment data, health data, auth tokens)
- Compliance or regulatory requirements
- Whether it's AI-powered or used with LLM coding agents
- Coverage threshold if not found in existing config

The LLM follows up when an answer changes what matters: "you said this runs in the browser — does it handle microphone or camera access?" The depth and direction of the interview is driven by reasoning, not a fixed question list.

**After the interview.** The LLM calls `write_harness()` with the combined project profile and tool availability. The harness generated reflects what was learned — both the project's structure and the tools available to check it.

```
[karen init]

Karen is analyzing your project...

Karen: I can see this is a TypeScript monorepo with three apps. You've got
eslint configured in the root, but no SAST tooling and no audit lockfile.

Karen: What does this project do and who uses it?

> It's a browser SDK for enterprise video players. Used by media companies.

Karen: Got it — browser-direct deployment, enterprise audience. Does it
handle any sensitive capabilities? I see microphone references in the source.

> Yes, it uses the mic for voice commands. And we'll need SOC2 compliance.

Karen: That'll add a PERMISSIONS-CHARTER.md requirement and SBOM generation
at release. I'll wire in semgrep for SAST since eslint alone won't cover
injection patterns. Do you want me to add it as a dev dependency?

> Yes.

Karen: What's your coverage threshold?

> 80% is fine.

Generating harness...
Writing .karen/
Writing .karen.json
Writing PERMISSIONS-CHARTER.md
Done. Run `karen audit` to see your current gate status.
```

**Non-interactive mode — for agents bootstrapping a new project:**

When an agent is initializing a new project without a human in the loop, Karen can accept a structured description as its interview input:

```bash
karen init --non-interactive --description "TypeScript SDK for browser voice conversations, enterprise audience, browser-direct-js deployment, handles microphone, SOC2 compliance, 85% coverage target, AI-powered project"
```

The LLM interprets the description, calls `detect_project()` to see if anything exists, and calls `write_harness()` with a profile derived from both. Any critical ambiguity that can't be resolved from the description produces a conservative default (stricter, not permissive) with a note in `.karen.json` that `karen init` should be re-run interactively once requirements are confirmed.

The LLM Prompt Pattern for greenfield projects adds a Phase 0 before any coding begins:

```
## Phase 0 — Bootstrap Karen (new projects only)
Run: karen init --non-interactive --description "[project description]"
Then run: karen audit
Share Karen's output before writing any source files.
```

---

## What Gets Generated

`karen init` produces a harness in `.karen/` and a manifest in `.karen.json`.

```
.karen/
  harness.json             ← gate manifest: ids, names, script paths, run order
  run-state.json           ← written after each audit; powers delta + circuit breaker
  gates/
    gate-1-supply-chain    ← thin wrapper: calls npm audit / govulncheck / pip-audit
    gate-2-completeness    ← thin wrapper: calls eslint / pylint / go vet + doc checks
    gate-3-security        ← thin wrapper: calls semgrep / bandit / govulncheck
    gate-4-docs-parity     ← thin wrapper: link checker + symbol diff + changelog check
    gate-5-compliance      ← thin wrapper: artifact presence + content checks
    gate-6-test-integrity  ← thin wrapper: runs your test runner, parses coverage
    [additional gates based on interview: compliance regime, deployment profile, etc.]
.karen.json                ← manifest, project profile, exceptions, config
PERMISSIONS-CHARTER.md     ← if the project handles sensitive capabilities
```

**Gate scripts are LLM-generated thin wrappers.** Each gate calls the tool that owns the domain — the dependency auditor for supply chain, the SAST scanner for security, the test runner for coverage — then normalizes the output into the `FILE:LINE\tmessage` contract. Karen does not roll her own grep-based security rules. She does not reimplement what semgrep, eslint, or govulncheck already does. The gate's job is orchestration and normalization, not the domain check itself.

The LLM that generates the gate script brings knowledge of the appropriate tool flags, rule sets, and output formats: which semgrep rule packs to activate for the project's language and deployment context, which eslint plugins cover the relevant risk surface, how to parse the tool's JSON output and map it to `FILE:LINE`. This is richer than any static template — and it stays current because the knowledge lives in the model, not frozen in Karen's source.

**Gate scripts belong to your project.** They live in your repo, are versioned with it, and can be customized. Karen designed them; you own them.

Additional project-specific gates can be added to `.karen/gates/` and registered in `.karen/harness.json`. Karen will run them alongside the generated ones.

---

## Reconciling Existing Quality Tooling

Mature projects rarely arrive with zero quality tooling. They arrive with a docs-CI script that already catches secret leaks and doc drift, a hand-written "constitution" file with its own verify script, a lint step in CI, a pre-commit hook. `karen init` on a project like this must not generate a parallel, redundant harness that quietly disagrees with the one already there — two sources of truth for "is this secure" is worse than one, even if Karen's is well-designed. It must also not assume one existing script covers a whole gate just because it touches that domain — most existing tools cover a *slice* of a dimension, not the whole thing.

**The reconciliation model is many-to-many, not one-id-per-tool.** A single existing script commonly contributes partial coverage to several of Karen's dimensions at once (a docs-CI script that also scans for secrets and checks for stub markers touches gate-4, gate-3, *and* gate-2). A single dimension commonly needs contributions from several existing scripts to be fully covered (gate-3's structural security patterns from one script, its working-tree secret scan from another). Neither side of that relationship is 1:1, so the schema Karen writes to `.karen.json` records coverage per dimension, not per tool:

```json
"existingGates": [
  {
    "id": "check-docs",
    "command": "node tools/check-docs.mjs",
    "outputFormat": "exit-code",
    "coverage": [
      { "gate": "gate-4-docs-parity", "scope": "full", "reason": "Checks doc↔code drift, dead links, GFM compliance across every tracked doc" },
      { "gate": "gate-3-security", "scope": "partial", "detail": "Secret regex scan over tracked files only — does not cover the working tree", "reason": "Karen's secret scanner still needs to be generated to cover untracked/gitignored files" },
      { "gate": "gate-2-completeness", "scope": "partial", "detail": "Checks SDK invariants (zero-deps, no-stub markers) but not per-symbol doc/test coverage", "reason": "Karen still needs to generate the symbol-level completeness check" }
    ]
  }
]
```

**During `karen init`, before writing any generated gate:** the agent inventories every script `detect_project` found that looks like a quality check (docs checkers, `*_verify.mjs`/`*_verify.py` style scripts, lint/typecheck/security steps already wired into CI, pre-commit hooks) and asks the interview to confirm what each one actually covers — not just what domain it's named after. "Your `check-docs.mjs` scans for secrets, but only in `git ls-files` — does anything scan your working tree, including gitignored files?" is the kind of question this step exists to ask. The answer determines whether Karen generates a full gate, a narrower gate scoped to the uncovered slice only, or no gate at all for that dimension.

**A generated gate's scope is exactly the gap, never the whole dimension by default.** If `check-docs.mjs` already fully covers docs-parity, Karen does not generate a second, competing docs-parity gate — she registers `check-docs.mjs` as `existingGates` with `"scope": "full"` for that dimension and calls it directly from `run-all.sh`. If it covers secrets only for tracked files, Karen generates a gate-3 script scoped explicitly to "working-tree scan excluding what `check-docs.mjs` already checks" — not a second full secret scanner that duplicates and can drift from the first. `karen audit`'s per-gate result is the union of every `existingGates` entry whose coverage names that gate, plus any generated gate registered for it; a gate with only partial coverage from existing tools and no generated gate to fill the rest is itself a finding (`Karen notes gate-3-security has no check for: working-tree secret scan`) surfaced during `karen init`, not a silent gap.

**This reconciliation runs again on `karen upgrade`.** If a project adds a new existing tool, or an old one's coverage changes, re-running `karen init`/`karen upgrade` re-asks the coverage question for anything `detect_project` flags as changed, so the map doesn't silently go stale while the underlying scripts evolve.

---

## The Gate Contract

Every gate — whether Karen-generated or hand-written — must follow this contract. This is what makes `karen audit` work regardless of what language or tools your gates use.

**The gate receives:**

- `$1` (first argument): the absolute path of the project root to audit

**The gate emits (to stdout):**

- One line per issue: `file:line  description`
  - `file` is a path relative to the project root
  - `line` is 1-indexed; omit if not applicable (e.g. a missing file)
  - `description` is a single line: what is wrong and why it matters
- A final summary line: `PASS (0 issues)` or `FAIL (N issues)`
- For zero-tolerance violations, an additional line: `ZERO-TOLERANCE`

**The gate exits:**

- `0` — satisfied, no issues
- `1` — has complaints

**Example gate output (failing):**

```
src/auth.py:42    hardcoded API key — credential leak via repository
src/auth.py:91    subprocess with shell=True and user input
FAIL (2 issues)
ZERO-TOLERANCE
```

**Example gate output (passing):**

```
PASS (0 issues)
```

`karen audit` calls each gate, collects output, translates to Karen's voice, and produces the final exit code. Structured output (`--format json`) is also supported for CI dashboards — the data model is always `{ gate, status, issues: [{ file, line, message }] }`.

---

## Run State, Delta Feedback, and the Circuit Breaker

These three mechanisms are what separate Karen from a script that just runs checks. They exist specifically because AI agents — left unchecked — will retry the same failing strategy indefinitely, or declare success without verifying it.

---

### Run State

Karen writes `.karen/run-state.json` after every `karen audit` call. It stores the issue fingerprint per gate from the most recent run. On the next run, Karen compares current results to the saved state.

```json
{
  "run": 4,
  "timestamp": "2026-06-27T23:38:00Z",
  "gates": {
    "gate-2-completeness": { "count": 2, "fingerprint": ["a1b2c3:src/agents.py", "d4e5f6:src/http.py"] },
    "gate-3-security": { "count": 1, "fingerprint": ["7a8b9c:src/wire.py"] }
  },
  "total": 3
}
```

**Fingerprint identity is content-based, not `file:line`.** A raw `file:line` string breaks the moment an unrelated edit shifts line numbers above the issue — a docstring added, an import inserted, a formatter run. The same unresolved issue then reads as "new," `staleCount` resets to zero, and the circuit breaker never trips even though the agent has been stuck on the identical complaint for ten runs. Each fingerprint entry is instead a short hash of `(file, normalized description)` — the description with numeric/variable noise stripped (e.g. line numbers, timestamps, specific variable names where the rule itself is what matters) — paired with the file path for human-readable delta output. The same defect at a shifted line still hashes identically; a genuinely different issue in the same file does not. This state is how delta feedback and circuit breaking both work. Without it, Karen would have no memory of whether a re-run is improving, stuck, or going backward.

---

### Delta Feedback (Principle 6: Process Reward Modeling)

Pass/fail at the end of a large task gives an AI agent almost no signal to improve. It doesn't know if its last set of changes helped or hurt. Karen provides dense, intermediate feedback by comparing each run to the previous one.

**Rules:**

- If a gate's count dropped: `Karen acknowledges progress.  (N fewer complaint[s])`
- If a gate's count stayed the same: no delta line — Karen just reports the count
- If a gate's count increased: `Karen notes a regression.  (N more complaint[s])`
- If total across all gates reached zero: `Karen is satisfied. You may proceed.`

This makes partial progress visible and stable. An agent that fixed 3 of 5 issues knows it's on the right path. An agent that introduced a regression sees it immediately — on the gate that regressed, not only in the final summary.

**Delta is informational; it never relaxes gate enforcement.** A gate with 2 remaining issues still fails regardless of how many have been fixed. The exit code is determined only by current issue counts.

---

### The Circuit Breaker (Principle 4: Stateful Failure Memory)

An AI agent in a loop has no natural stopping condition except success. If it can't succeed, it retries — indefinitely, burning tokens, making lateral moves that don't help, sometimes making things worse. Karen detects this.

**Circuit breaker logic:**

1. After each run, Karen compares the per-gate issue fingerprint (the set of content-hash identifiers described above) to the previous run's fingerprint for the same gate.
2. If the fingerprint is identical — same issues, by content, regardless of line drift — Karen increments a `staleCount` for that gate.
3. If `staleCount` reaches the threshold (default: 3, configurable as `"circuitBreaker": { "threshold": 3 }` in `.karen.json`), Karen trips the circuit for that gate.

**When a circuit trips:**

```
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
  Karen has seen this before. She's escalating.
  This exact issue has appeared in 3 consecutive runs without change.
  Karen is halting. A human needs to review this.

EXIT 2
```

Exit code `2` signals human escalation — distinct from `1` (normal gate failure) and `0` (satisfied). CI pipelines should treat exit `2` as a hard block with mandatory human review before retry is allowed.

**Automatic reset:** the circuit resets automatically when the issue fingerprint changes — meaning any code change that shifts what's reported. Attempting a different approach is progress; repeating the same failure is not. Automatic reset is the common case for agent workflows.

**Manual reset after human intervention:** when a human directly edits the tripped file, the agent cannot resume until the circuit is reset. Karen does not auto-detect human edits — it only watches run fingerprints, and the staleCount is still at the threshold from before the human stepped in.

Tell the agent to reset the circuit. The agent calls `write_run_state` to clear the staleCount for the affected gate(s):

```
# Reset a specific tripped issue (most precise)
Tell the agent: "Reset the circuit for src/wire.py:201"

# Reset all tripped circuits in a gate
Tell the agent: "Reset all circuits in gate-3-security"

# Reset all circuits in the project
Tell the agent: "Reset all Karen circuits"
```

After a reset, the next audit opens with `Karen is resuming. The circuit has been reset.` and treats the run as a fresh fingerprint baseline.

**Configuring the threshold:**

```json
{
  "circuitBreaker": {
    "threshold": 3,
    "exitCode": 2
  }
}
```

Set `threshold` higher for complex gates where the same surface issue may require multiple intermediate steps to resolve. Set it to `1` for zero-tolerance gates where a single repeat is always agent confusion, never a multi-step fix.

---

## What Karen Knows

These are the universal quality dimensions Karen draws from when designing your harness. She combines this knowledge with your project's profile to decide which checks matter, at what severity, and how to implement them with your tools.

---

### Supply Chain & Dependencies

Every external dependency is a trust decision.

| Dimension | What Karen checks |
|---|---|
| Vulnerability status | Known CVEs in the dependency tree |
| Maintenance health | Last release recency; project actively maintained |
| License compatibility | SPDX identifier present; compatible with your license |
| Maturity | Pre-1.0 packages without documented justification |
| Transitive exposure | Unmaintained nodes deep in the dependency graph |

The gate Karen generates uses the dependency audit tool your project already uses — `npm audit`, `pip-audit`, `govulncheck`, `bundle-audit`, `cargo audit`, or equivalent. If none is set up, Karen recommends one and wires it in.

**Best signal:** zero runtime dependencies. Karen flags this explicitly as a strength — a specific instance of the general [exceeds-baseline](#recognizing-work-that-exceeds-the-baseline) signal every gate can report, not a one-off special case.

#### Vendored & Copied-In Code

A dependency audit tool only sees what's declared in a manifest. Code copied directly into the tree — a minified library dropped into a `vendor/`, `third_party/`, or `public/lib/` directory, a snippet pasted from Stack Overflow, a checked-in binary blob — carries the same trust and vulnerability risk as a declared dependency, but is invisible to `npm audit`/`pip-audit`/`govulncheck` because there's no manifest entry to check. This is a distinct risk category, not a subset of "undeclared code is someone else's problem":

| Signal | What Karen flags |
|---|---|
| Recognizable third-party code with no manifest entry | A checked-in library (minified or not) that isn't a declared dependency — no version pin, no audit coverage, no update path |
| No provenance record | No comment, README note, or `NOTICE`/`THIRD_PARTY.md` entry stating what the vendored file is, its source, its version, and its license |
| Stale vendored copies | A vendored file with a detectable version string that's several major versions behind current — the exact blind spot a dependency audit would normally catch |

Karen does not try to reimplement a vulnerability database for arbitrary vendored code — that's still a job for a tool, not a regex. Where a project's stack has one (e.g. Scancode, `licensee`, or a SAST scanner's vendored-file detection), the gate wires it in. Where none is available, the gate's minimum bar is *presence of provenance*: every file under a recognized vendor directory must be traceable to a source, version, and license in a tracked note. An untraceable vendored file is a finding regardless of whether a scanner exists to check its CVEs — "we don't know what this is or where it came from" is itself the defect.

---

### Security & Trust Boundaries

The patterns Karen scans for depend on your language, deployment context, and what your project handles. Zero-tolerance patterns that apply across all contexts:

**Injection and code execution:**

- Dynamic code evaluation (`eval`, `exec`, string-based `Function()`)
- SQL string concatenation instead of parameterized queries
- Shell commands built from unsanitized user input
- Path traversal via user-supplied filenames

**Credential and data handling:**

- Hardcoded secrets, tokens, passwords in source
- Auth material in client-accessible storage
- PII or tokens in log statements
- Cleartext (non-TLS) connections to external services

**Zero-tolerance means no exceptions in production code.** Test files are excluded — they may deliberately exercise these patterns to verify their scanner.

**Secret scanning is a working-tree check, not a source-tree check.** A regex or AST pass over tracked source finds a secret typed directly into a `.js` file. It does not find one sitting in a captured test artifact, a `.har` file, a fixture, a screenshot's embedded metadata, or any other file that never got committed because `.gitignore` already excludes it — which is exactly where real credentials leak from agentic test runs (env dumps, recorded network traffic, debug captures). Those files are real, on disk, and copyable regardless of git status. Karen's supply-chain/security gate generation therefore wires in a dedicated secret scanner (`gitleaks`, `trufflehog`, or equivalent — `probe_tools` checks for one and Karen recommends installing one if none is found) run against the full working directory, scoped only by an explicit exclude list (`node_modules/`, `.git/`, build output) — never scoped to tracked files only. `git-ignored` is not a security boundary; it only controls what gets committed, not what gets scanned, copied, or zipped up.

**Gate design principle — structural over textual (Principle 5):** Surface-level text matching is fragile. A pattern written in a comment, a string literal, or a variable name triggers a false positive. Gates Karen generates should audit structural intent, not raw text:

- Parse the source into its AST or call graph before evaluating patterns. A regex match on `eval` fires on `// never use eval` in a comment. An AST match on `CallExpression[callee.name=eval]` does not.
- For languages without a fast AST tool, use structural context clues: is the match inside a string literal? A comment token? A test assertion? If yes, skip it — or mark the line for human review rather than hard-fail.
- The `// karen-ignore` directive is the last resort for legitimate exceptions in non-test production code, not the first. Gate design should minimize how often it's needed by being precise about what it actually matches.

This applies to all Karen-generated gates, not just security. A completeness gate that flags `pass` in Python code should not fire on `password` or a variable named `bypass`.

Deployment-context additions are added by profile (see Profiles section). If the project's *own runtime* calls an LLM or runs agentic behavior — not just "built by an AI coding agent" — the security gate also adds the OWASP LLM/Agentic threat checks under the [ai-agent profile](#ai-agent).

---

### Code Completeness

Every public capability must be fully implemented, tested, and documented. "Fully" means all three — any one missing is a gate failure, unless it's a declared known gap (see below).

| Signal | Karen flags |
|---|---|
| Stub implementations | `throw new Error('not implemented')`, `pass`, `raise NotImplementedError` in public API |
| Undocumented public symbols | Exported functions, classes, methods without docstrings or equivalent |
| Untested public symbols | No test covering each public API entry point |
| Broken TODO markers | `TODO`, `FIXME`, `HACK`, `XXX` in production code |
| Placeholder content | `Lorem ipsum`, `example.com`, `TODO: replace` in shipped output |

#### Known Gaps vs. Exceptions

Not every incomplete-looking thing is a defect. A capability can be intentionally unimplemented — gated by a third-party backend, deferred by design, or out of scope for this release — and still be honestly documented rather than hidden.

**An exception says "this is wrong, but acceptable until a date."** It has an expiry. Karen treats an expired exception as a failure.

**A known gap says "this is not wrong — it's a boundary, and it's tracked."** A known gap has no expiry. It stays valid as long as the project's own tracker (a `GAPS.md`, a linked issue, a roadmap doc) still lists it. Karen does not invent this distinction on her own — during `karen init`, if the agent finds a stub, an unimplemented branch, or a `not implemented` throw, it asks: *"Is this a known limitation, or work in progress?"* If the project already maintains a gaps/backlog file, the agent asks whether to treat entries there as known gaps automatically rather than asking per-stub.

```json
"knownGaps": [
  {
    "kind": "capability-gap",
    "pattern": "partner-config/update writes",
    "scope": "src/management/intellects.js",
    "reason": "Backend returns 403 for partner admin KS today — tracked upstream, not a missing implementation",
    "tracker": "docs/internal/GAPS.md"
  }
]
```

A known gap entry needs `pattern` (what to match), `scope` (where it applies — a file, a directory, or omitted for project-wide), `reason` (why it's intentional, in the project's own words), `tracker` (the file or URL where the gap is the canonical record), and `kind`. Karen does not validate that the tracker entry itself still exists — that's the project's responsibility — but a `karen audit` summary names every active known gap so it stays visible, not buried.

**`kind` carries forward the project's own backlog taxonomy instead of flattening it.** Many projects that already maintain a gaps/backlog file don't lump everything into one bucket — they distinguish "the platform genuinely can't do this" from "it's a nice-to-have DX improvement" from "it's on the competitive roadmap," precisely so a reader doesn't mistake a wishlist item for a defect. Collapsing that distinction into a single undifferentiated `knownGaps` list would lose information the project already invested in capturing. `kind` is not a fixed enum — during `karen init`, if the project's own tracker has a taxonomy (a "Kind" column, a labeled category), the agent asks whether to reuse those labels verbatim as `kind` values rather than forcing them into a Karen-invented set. Common values seen in practice: `capability-gap` (platform/backend genuinely can't do it), `dx-improvement` (works today, just not ergonomically), `roadmap` (planned, not yet started), `robustness` (works, but has a known edge case). Karen does not treat any `kind` differently for gate-passing purposes — all known gaps suppress their pattern equally — `kind` exists for the audit summary's readability and for the project's own future re-triage, not to change enforcement.

**If a known gap stops being honest** — the backend now supports the capability, the roadmap shipped — removing the `knownGaps` entry turns the suppressed pattern back into a live gate failure. Stale known gaps that should be exceptions instead (e.g. the team is *actively* working it with a target date) belong in `exceptions`, not here.

---

#### Recognizing Work That Exceeds the Baseline

A gate that only ever reports complaint counts has nothing to say about a team that has already gone well past the minimum bar. A project can map its security controls to HIPAA, HITRUST, and the OWASP LLM Top 10 control-by-control; annotate every CLI subcommand with a read/write/idempotency contract stricter than Karen's own Agent Context Engineering check asks for; hold itself to a stricter internal constitution than any generated gate would think to check. None of that shows up in "0 issues" — and a rigorous team evaluating whether to adopt Karen will notice that their existing rigor is invisible to her. That's a real adoption cost, not a cosmetic one: a tool that can only subtract points, never acknowledge work already done, reads as generic to a team that put in the extra work specifically to be more than generic.

**Every gate, not just supply-chain, can report an `exceedsBaseline` finding.** During `karen init`, whenever the agent's analysis or the interview surfaces a control, artifact, or practice that goes beyond what that gate's dimension requires at minimum — a compliance doc that maps controls beyond the presence check in [Compliance Artifacts](#compliance-artifacts), a documentation contract finer-grained than [Documentation Fidelity](#documentation-fidelity) requires, an isolation/security "constitution" enforced by the project's own verify script beyond what [Security & Trust Boundaries](#security--trust-boundaries) or [Code Structure & Elegance](#code-structure--elegance) ask for — it's recorded in `.karen.json` under `exceedsBaseline`, scoped to the gate it exceeds:

```json
"exceedsBaseline": [
  { "gate": "gate-1-supply-chain", "note": "Zero runtime dependencies" },
  { "gate": "gate-5-compliance", "note": "SECURITY.md maps HIPAA, HITRUST, and OWASP LLM Top 10 control-by-control" }
]
```

**In audit output, an `exceedsBaseline` entry surfaces as a strength line on that gate's result, never as a substitute for it.** A gate with recorded strengths still reports its own issue count on its own merits — exceeding the baseline in one respect doesn't buy slack on an unrelated defect in the same gate:

```
GATE 1  supply-chain    Karen is satisfied.  (0 issues)
  Strength noted: zero runtime dependencies.
```

This is reassessed on every `karen init`/`karen upgrade`, the same as `existingGates` coverage — a strength that regresses (a new dependency added, a compliance doc that stops being maintained) should stop being reported the next time the harness is regenerated, not linger as a stale compliment.

**A regressed strength is reported once, not silently dropped.** Removing an `exceedsBaseline` entry with no trace would read identically to "this was never checked" — a team that earned the strength has no way to tell "we lost it" from "Karen never noticed it." The `karen upgrade` run that first detects the loss (dependency added where there were none, compliance doc no longer present or no longer naming the control it used to) prints a one-time regression note on that gate's result, then removes the entry from `.karen.json`:

```
GATE 1  supply-chain    Karen is satisfied.  (0 issues)
  Strength lost: zero runtime dependencies (lodash added since last check).
```

This note appears exactly once, on the `karen upgrade` run where the regression is first detected — it is not persisted or repeated on subsequent runs, since by then it's simply the absence of a strength, not new information.

---

### Documentation Fidelity

Docs written separately from code will drift. Karen enforces parity mechanically.

| Check | What it catches |
|---|---|
| Symbol references | Docs referencing names not in the current codebase |
| Signature drift | Function signatures in docs that don't match source |
| Dead links | Internal links that resolve to 404 |
| CHANGELOG gaps | Commits since last release tag not reflected in CHANGELOG |
| Runnable examples | Examples marked `karen:runnable` that fail when executed |

Runnable example execution is opt-in. Only blocks tagged with the `annotation` value from `.karen.json` (default: `karen:runnable`) are executed. Unannotated blocks are never run — they may be illustrative fragments or require unavailable runtimes.

---

### Compliance Artifacts

Every project needs these. Karen checks presence and minimum content.

| Artifact | Requirement |
|---|---|
| `SECURITY.md` | Present; contains vulnerability disclosure process |
| `LICENSE` | Present; SPDX identifier present |
| `CHANGELOG.md` | Present; follows Keep a Changelog format |
| `CONTRIBUTING.md` | Present for public or shared repos |
| SBOM | Generated at release for SOC2 / FedRAMP / HIPAA profiles |
| Provenance attestation | Enabled in publish config for distributed packages |

For compliance profiles, Karen adds regime-specific artifact requirements to the harness — audit log config for SOC2, PHI handling docs for HIPAA, cardholder data flow docs for PCI-DSS, FIPS config for FedRAMP.

**Presence and content are not the same thing as accuracy — a compliance doc can pass every check above and still overclaim.** A `SECURITY.md` that maps controls to a dozen named standards, a slide deck asserting broad framework alignment, a README claiming a certification the project doesn't hold — none of that is caught by checking that the artifact exists and contains the right sections. Karen does not attempt to verify regulatory claims herself; that's a legal/audit judgment, not a static check. What she can and does check is narrower and mechanical: does the compliance doc name a specific file, function, or test as backing a specific claim, and does that reference still exist? A claim with no named reference at all, or one whose named reference has since been deleted or renamed, is a finding — `Karen notes SECURITY.md claims "encryption at rest" but names no implementing file`. This is the same drift Documentation Fidelity (above) catches for API docs, applied to compliance claims specifically, because a stale or unfounded compliance claim is a worse failure mode than a stale code example — it's the thing a customer or auditor is most likely to act on directly.

**Compliance artifacts describe what the *project* provides, not what a deploying organization is automatically entitled to claim.** A project's controls can satisfy the technical prerequisites for SOC2 or GDPR without the project itself constituting compliance — actually reaching a named standard usually also requires organizational process the code can't attest to: a signed BAA, an operator's own audit logging retention policy, a legal review of data flows. Karen's compliance gate does not claim to certify a standard; it checks that the project's own docs are honest about this boundary — naming, for standards it claims alignment with, which parts are controls the code provides versus which parts remain the deploying operator's responsibility. A compliance doc that reads as "install this and you're SOC2 compliant" with no such split is itself a finding, separate from whether the underlying controls are technically sound.

---

#### Personal-Data Registry Pattern

A project that stores personal data in exactly one place can handle a GDPR/CCPA export or erasure request with a single, auditable query. A project that stores it in several places — a primary user table, an analytics store, a cache, a conversation-memory store — can't, unless something ties those stores together. **Karen's compliance gate checks for a specific structural pattern, not just a policy statement:** does every personal-data store in the project register itself with a single registry (or an equivalent fan-out mechanism) that a data-subject request walks to reach all of them, or does each store handle export/erasure ad hoc, independently, with no shared place that guarantees none was missed?

This is the same "structural over textual" principle Security & Trust Boundaries applies to secrets and injection, applied to data-subject rights: a `SECURITY.md` that says "we honor erasure requests" is a textual claim; a registry that every new personal-data store must join *before its owner can call it done* — enforced by a test, not a comment — is the structural version. During `karen init`, if the interview or `probe_tools` surfaces more than one personal-data store (a new one is easy to miss — it's often added months after the registry was built, by someone who never read the doc that explains why the registry exists), Karen asks whether a registry pattern already exists and, if so, checks every store she can find against it:

```
GATE 5  compliance
  src/analytics/eventStore.ts:14  writes rows keyed by (tenant, user) but never
    registers with src/consent/registry.ts — an erasure request would miss this store
  FAIL (1 issues)
```

A project with only one personal-data store, or no personal data at all, never triggers this check — it exists for the specific shape where fan-out can silently drop a store, not as a mandate that every project build a registry it has no use for.

---

#### Tiered, Feature-Gated Compliance

A static profile picked once at `karen init` — "this project is SOC2-scoped" — assumes the whole project carries one compliance posture for its whole life. That's often false: a product can ship a free core tier with no personal-data handling at all, then an opt-in analytics tier, then a personalization tier that stores far more — where each tier upward *earns* new compliance obligations the tier below never triggers. Flattening that into one root-level `compliance` array either over-requires artifacts the free tier has no reason to carry, or under-requires them the moment personalization ships.

`compliance[]` entries may be a plain string (`"soc2"` — applies unconditionally, the existing behavior) or an object naming the feature flag that activates it:

```json
"compliance": [
  "soc2",
  { "standard": "gdpr", "activatesWhen": "feature:analytics-tier", "note": "Only the analytics tier and above touch personal data broadly enough to trigger export/erasure obligations" }
]
```

Karen only adds a tier-gated standard's artifact requirements to the harness once the interview confirms the gating feature is actually built and reachable — a `activatesWhen` entry for a feature that doesn't exist yet is a forward-declared requirement, tracked but not yet enforced, surfaced in the `karen init` summary so the team sees it coming rather than being surprised by a new gate failure the day the feature ships. This is reassessed on every `karen init`/`karen upgrade` the same as `exceedsBaseline` — a feature flag removed or a tier retired drops its gated compliance requirements with it, rather than leaving a stale artifact check enforced against a capability that no longer exists.

---

### Test Integrity

A test suite that passes but doesn't verify anything produces false confidence. Karen checks the quality of your tests, not just their existence.

| Check | Pass condition |
|---|---|
| Coverage | ≥ threshold per module (default 80%, configurable in `.karen.json`) |
| Assertion density | No test blocks with zero assertions |
| Live credential usage | Tests must not require real credentials to pass |
| Contract testing | Public API tested through its public interface, not internal imports |

The generated gate invokes your test runner and parses the coverage report. Test runner and report format are configured in `.karen.json` under `testRunner`.

**When no coverage instrumentation exists.** Many projects run tests with no coverage tool wired in at all — `node:test` with no `c8` or `--experimental-test-coverage`, a Playwright/Cypress E2E suite with no instrumentation hook, `go test` without `-coverprofile`. Karen does not silently skip the coverage check or silently pass it. During `karen init`, if `probe_tools` finds a test runner but no coverage output, the agent asks: *"Your tests run but produce no coverage report. Want me to wire one in (`c8` for Node, `-coverprofile` for Go, `pytest-cov` for Python), or run coverage-less for now with the gate set to assertion-density-only?"*

A project that opts out of coverage measurement gets `"coverage": { "enabled": false, "reason": "..." }` in `.karen.json` — an explicit, visible choice, not a quiet gap. The gate still runs and checks assertion density; it just can't enforce a percentage threshold it has no number for.

**E2E-only test suites (Playwright, Cypress, Selenium) typically produce no function-level coverage.** Karen does not treat "no unit coverage, only E2E" as automatically failing — she flags it as a finding during `karen init` ("this project has E2E coverage but no unit tests — is that intentional for this kind of app?") and lets the interview decide whether unit coverage is expected for this project's profile. A thin client wrapping a remote API may be legitimately E2E-only; a library with complex internal logic usually isn't.

---

### Agent Context Engineering

If your project is AI-powered or used with LLM coding agents, Karen adds a gate that checks your agent context setup. This is a core Karen domain — she knows what makes agentic work reliable and what makes it drift.

| Check | What Karen looks for |
|---|---|
| Agent context file | `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or equivalent present |
| Stopping criteria | A deterministic, runnable, binary exit condition is defined — not necessarily Karen's |
| Tool permission scope | Permissions scoped to minimum necessary |
| Context hygiene | No secrets or credentials in agent context files |
| Prompt injection surface | User-controlled input sanitized before LLM context insertion |
| Deterministic done-criteria | Completion defined as `count = 0` or `exit 0`, not adjectives |
| Model selection guidance | Agent context specifies model tier per task type |
| MCP server hygiene | Tools scoped to read-only where write access is not required |

**The principle:** if the LLM has a way to self-rate as "done" without running a check, it will use it. Agent context files that name a runnable exit-0 condition remove that escape hatch entirely.

**The stopping-criteria check is not Karen-specific.** A project may already have its own deterministic quality gate — a docs-CI script, a lint-and-test command, a custom verifier — wired into its agent context file as the stopping condition. Karen's gate checks for *the property*, not for literal references to `karen audit`: does the agent context file name a specific, runnable command whose exit code defines done? `Run: node tools/check-docs.mjs — done when it exits 0` satisfies this exactly as well as `Run: karen audit`. If Karen herself is layered onto a project with an existing stopping criterion, she should either wire that command in as an `existingGates` entry (see `.karen.json` schema) and let it continue to anchor the stopping condition, or fold it into her own audit — never require the project to switch its stopping language to hers.

**A context file's claimed audience must match which files actually exist.** `CLAUDE.md` that opens with "rules the AI writes by, for Claude / Copilot / Cursor" is making a claim about reaching agent ecosystems that read different filenames — Cursor reads `.cursorrules` (or `.cursor/rules/`), Copilot reads `.github/copilot-instructions.md`, and neither exists just because `CLAUDE.md` says it's meant for them. Karen's gate flags this specific mismatch as its own finding, distinct from "no agent context file present at all": a project can pass the base Agent context file check (something exists) while still failing this one (what exists doesn't cover what it claims to cover).

---

### Code Structure & Elegance

Structural issues invisible to linters but that compound over time.

| Pattern | Why it matters |
|---|---|
| Duplicated logic (DRY violations) | Two copies diverge; bugs in one don't get fixed in the other |
| Premature abstraction | Abstractions serving one caller add complexity with no payoff |
| Deep nesting (>3 levels) | Usually hides missing early returns; hard to test |
| Functions exceeding single responsibility | Large functions test many things implicitly |
| Magic numbers and strings | No context for what the value means or when it changes |
| Implicit coupling | Modules sharing state through globals or ambient context |
| Dead/unreachable code | Unused exports, unreachable branches, and functions with no remaining caller — finished code nobody deletes, distinct from the unfinished-code signals in [Code Completeness](#code-completeness) |

Severity is calibrated to project type: stricter for libraries and SDKs distributed to others; advisory for internal scripts and one-off tooling.

**Dead-code detection uses the project's own tooling, not a Karen-invented reachability analysis.** The gate wires in whatever the language already has — `ts-prune`/`knip` for TypeScript, `vulture` for Python, `deadcode`/`unused` via `go vet`/`staticcheck` for Go — the same "orchestration, not reimplementation" principle as every other gate. Where no such tool is configured, `probe_tools` reports the gap and Karen recommends one during `karen init` rather than silently skipping the check.

---

### Resiliency

Code that assumes the network never fails is code that fails in production the first time it does.

| Pattern | Why it matters |
|---|---|
| Network I/O with no retry | A transient failure (DNS blip, reset connection, brief upstream outage) surfaces as a hard user-facing error instead of resolving itself |
| Retry with no backoff or no attempt cap | Immediate or unbounded retries amplify load on a struggling downstream instead of easing it — the retry storm becomes the outage |
| No fallback or degraded path on a dependency failure | One downstream failure takes down the entire request instead of degrading to a partial or cached response |

Severity is calibrated to project type: a backend service's outbound calls to other services are held to this bar; a CLI tool making one request at invocation time, or an SDK that just wraps a fetch call and lets the caller decide retry policy, isn't penalized for not owning a concern that belongs to its caller. Karen decides which network calls this applies to during `karen init` — the project's own architecture, not a blanket rule, determines what "the network fails" means for that codebase.

---

### Performance & Resource Bounds

Unbounded resource use is invisible in a demo and fatal at scale.

| Check | Pass condition |
|---|---|
| Unbounded payload/collection size | Every externally-influenced read (file upload, DB query, paginated API response) has an explicit size, row, or byte cap |
| Eager heavy imports or startup cost | Expensive imports, subprocess spawns, or network calls made at module load time are deferred until the feature that needs them actually runs — a caller who never uses the feature shouldn't pay its startup cost |

Which of these apply depends on project type — a request-handling backend is held to explicit payload caps; a one-shot CLI script usually isn't. Karen decides during `karen init`.

---

### Observability & Operational Readiness

Code that can't be debugged in production is incomplete.

| Check | Pass condition |
|---|---|
| Structured logging | Log statements emit structured data, not raw interpolated strings |
| Error propagation | Errors not swallowed; all catch blocks handle or re-throw |
| Health endpoint | Services expose a health check endpoint |
| Graceful shutdown | Long-running processes handle termination signals and drain |
| Correlation IDs | Request context propagated through async call chains |

Which of these apply depends on project type. A CLI tool does not need a health endpoint. A production API does. Karen decides during `karen init`.

---

### Poly-repo & Monorepo Structure

Not every project is one manifest at the root. `detect_project` walks the tree and reports every manifest it finds (`package.json`, `pyproject.toml`, `go.mod`, `Gemfile`, `Cargo.toml`, at any depth) — a project with more than one is a poly-repo or monorepo, whether or not it declares workspaces. Karen does not silently audit the first manifest found and call the rest out of scope; treating a multi-package repo as single-package is a coverage gap, not a simplification.

**Every gate that can be scoped by directory declares that scope explicitly, not just gate-6.** The JS/TS profile's `testRunner.packages` list (below) is the template — Karen applies the same shape to every gate, generalized to whatever manifest kind the project uses:

| Gate | Per-subproject scoping |
|---|---|
| Gate 1 (supply-chain) | Runs the dependency auditor once per manifest found (`npm audit` per `package.json`, `pip-audit` per `pyproject.toml`, etc.) — not once at the root guessing which lockfile applies. Results are reported per subproject. |
| Gate 2 (completeness) | Scans each subproject's source tree independently; a stub in `apps/harness` and a stub in `sdk` are two distinct findings, not merged into one root-level count. |
| Gate 3 (security) | Same source-tree walk as gate 2, plus the working-tree secret scan (which is inherently root-wide — secrets don't respect package boundaries). |
| Gate 4 (docs-parity) | Each subproject's own README/docs are checked against its own source; a root README describing the whole repo is checked separately against the union of public entry points, not against any one subproject's internals. |
| Gate 5 (compliance) | Compliance artifacts (`SECURITY.md`, `LICENSE`, etc.) are checked at the root by default — most compliance requirements apply repo-wide — unless the interview identifies a subproject with its own distinct compliance regime (e.g. one app is SOC2-scoped, others aren't), in which case that subproject gets its own artifact set. |
| Gate 6 (test-integrity) | As specified in `testRunner.packages` below. |
| Gate 7 (agent-context) | Checks for an agent context file at the root and, separately, per subproject where one plausibly should exist (a subproject with its own independent build/test/deploy lifecycle) — a root-only `CLAUDE.md` that doesn't mention a subproject's distinct conventions is a finding, not silently adequate. |

**During `karen init`,** once `detect_project` reports multiple manifests, the agent asks which are audited and how — mirroring the gate-6 interview question ("which package, if any, is primary?") for every gate that needs it, rather than assuming a single global answer applies to all of them. The resulting `.karen.json` records subprojects explicitly (see `testRunner.packages` for the shape); other gates that need per-subproject scope follow the same `{ path, ... }` list convention under their own config key (e.g. `docsParity.packages`, `complianceArtifacts.scope`).

#### Cross-Subproject Consistency

Per-subproject scanning has a blind spot: it cannot see that N subprojects independently reimplement the same security-relevant pattern and have quietly drifted apart. A repo with five reference apps that each run "server holds the credential, mints a short-lived token, exposes an API" is not five unrelated codebases — it's one pattern repeated five times, and the interesting defect is the one app that dropped a check the other four still have. Gate 2 and Gate 3, scoped purely per-directory, will happily report each app clean while missing that exact divergence.

**Karen adds a cross-subproject consistency check whenever the interview or `detect_project` surfaces a repeated structural pattern across subprojects** — same role (e.g. multiple apps built as reference implementations on the same SDK, multiple services fronting the same kind of credential), same shape of security-relevant logic, implemented independently in each. During `karen init`, once the subproject list is established, the agent asks: *"`apps/*` all look like they follow the same server-holds-secret-and-mints-tokens pattern — should Karen check that they all apply the same security-relevant checks (origin validation, token scope, auth guard placement), not just that each one individually passes?"* If confirmed, Karen adds a dedicated check — registered as its own entry in `.karen/harness.json` (not folded into gate-3, since its unit of analysis is "the set of subprojects" rather than one directory) — that extracts the shared pattern's key invariants from each implementation and flags any subproject whose implementation diverges from the others without a documented reason. This is intentionally light — it is not attempting semantic equivalence, only "did the same security-relevant control show up in every place the same pattern was implemented."

```json
"crossSubprojectConsistency": [
  {
    "pattern": "server holds admin secret, mints short-lived client token, exposes REST API",
    "subprojects": ["apps/ai-trainer", "apps/teaching-avatar", "apps/presentation-agent", "apps/earnings-avatar", "apps/harness"],
    "invariants": ["origin/CORS check present", "token scope excludes admin operations", "no secret in any response body"]
  }
]
```

#### Unowned Root-Level Code

Manifest-driven subproject detection assumes every file of interest lives under some manifest's directory. It doesn't. Credential-handling CLI scripts, cross-cutting verify/lint scripts, and language-mixed utility files (a Python capture server in an otherwise all-JS repo, with no `pyproject.toml` anywhere) commonly live at the root or in a shared `tools/`/`scripts/` directory that no manifest claims. Karen does not silently exclude these from every gate just because they fall outside a detected subproject boundary — that is precisely where credential-handling and cross-cutting logic tends to live, and skipping it is a coverage gap disguised as scoping.

`detect_project` reports a project's **unclaimed paths**: files matching source extensions for any detected language that do not fall under a directory owning a manifest for that language. During `karen init`, the agent surfaces this list and asks how it should be scoped — typically as its own pseudo-subproject (`{ "path": "tools/", "type": "root-utility", ... }` in `.karen.json`) so gates 2, 3, and 7 still walk it, rather than defaulting to "no manifest, no coverage."

---

## Configuration: `.karen.json`

The manifest Karen writes after `karen init`. Captures what she learned and what choices were made. Owned by the project, versioned with it.

```json
{
  "version": "1.0.0",
  "project": {
    "type": "library",
    "language": ["typescript"],
    "deployment": ["browser-direct-js"],
    "audience": "enterprise",
    "aiPowered": true,
    "subprojects": [
      {
        "path": "apps/teaching-avatar",
        "type": "application",
        "deployment": ["browser-direct-js"],
        "aiPowered": true,
        "codeRole": "reference-app",
        "agentActions": { "scope": "least-privilege", "reason": "Customer-facing showcase — tool-call allow-list kept minimal" },
        "reason": "Calls an LLM at runtime and renders model output — ai-agent runtime profile applies here but not to the SDK itself"
      },
      {
        "path": "apps/browser-explorer",
        "type": "application",
        "codeRole": "debug-tool",
        "agentActions": { "scope": "maximal", "reason": "Intentional full-surface API explorer for protocol verification — not customer-facing" },
        "reason": "Internal debug/exploration tool with an intentional verbose wire log — console.* zero-tolerance relaxed for this subproject only"
      },
      {
        "path": "tools/",
        "type": "root-utility",
        "reason": "Unclaimed by any manifest but handles credentials (KS token minting) — scoped as its own pseudo-subproject so gates 2/3/7 still walk it"
      }
    ]
  },
  "compliance": [
    "soc2",
    { "standard": "gdpr", "activatesWhen": "feature:analytics-tier", "note": "Only the analytics tier and above touch personal data broadly enough to trigger export/erasure obligations" }
  ],
  "personalDataRegistry": {
    "path": "src/consent/registry.ts",
    "stores": ["src/db/userTable.ts", "src/analytics/eventStore.ts"]
  },
  "coverage": { "threshold": 80 },
  "testRunner": {
    "command": "npm test",
    "coverageReport": "coverage/lcov.info",
    "format": "lcov"
  },
  "doctest": {
    "files": ["README.md", "docs/**/*.md"],
    "languages": ["js", "ts"],
    "annotation": "karen:runnable"
  },
  "permissions": {
    "microphone": "Required — voice conversation; product cannot function without it"
  },
  "circuitBreaker": {
    "threshold": 3,
    "exitCode": 2
  },
  "expiryWarningDays": 7,
  "existingGates": [
    {
      "id": "check-docs",
      "command": "node tools/check-docs.mjs",
      "outputFormat": "exit-code",
      "coverage": [
        { "gate": "gate-4-docs-parity", "scope": "full", "reason": "Checks doc↔code drift, dead links, GFM compliance across every tracked doc" },
        { "gate": "gate-3-security", "scope": "partial", "detail": "Secret regex scan over tracked files only", "reason": "Karen's generated gate-3 script covers the working-tree/gitignored gap this leaves open" }
      ]
    }
  ],
  "crossSubprojectConsistency": [
    {
      "pattern": "server holds admin secret, mints short-lived client token, exposes REST API",
      "subprojects": ["apps/ai-trainer", "apps/teaching-avatar", "apps/presentation-agent", "apps/earnings-avatar", "apps/harness"],
      "invariants": ["origin/CORS check present", "token scope excludes admin operations", "no secret in any response body"]
    }
  ],
  "knownGaps": [
    {
      "kind": "capability-gap",
      "pattern": "partner-config/update writes",
      "scope": "sdk/src/management/intellects.js",
      "reason": "Deployment-gated by the backend (403 for partner admin KS) — tracked as P2 in docs/internal/GAPS.md, not a missing implementation",
      "tracker": "docs/internal/GAPS.md"
    }
  ],
  "exceedsBaseline": [
    {
      "gate": "gate-1-supply-chain",
      "note": "Zero runtime dependencies"
    },
    {
      "gate": "gate-5-compliance",
      "note": "SECURITY.md maps HIPAA, HITRUST, OWASP LLM Top 10, and avatar/deepfake law control-by-control — beyond the minimum artifact-presence bar"
    }
  ],
  "exceptions": {
    "gate-security": [
      {
        "pattern": "console.log",
        "file": "src/debug.js",
        "reason": "Debug helper — always behind IS_DEBUG guard; stripped in prod build",
        "expires": "2026-12-01"
      }
    ]
  }
}
```

**`project.subprojects` overrides the root profile for a poly-repo with mixed risk surfaces.** A single global `type`/`deployment`/`audience`/`aiPowered` assumes the whole repo carries one risk profile. That's false the moment a repo mixes, say, a zero-dependency enterprise library with a demo app that calls an LLM at runtime and a throwaway internal CLI tool — three different answers to "does this need SOC2 artifacts," "does the ai-agent runtime profile apply," "how strict should code-structure severity be." Each entry in `subprojects` is scoped by `path` and overrides only the fields it sets; anything it omits inherits the root profile. This is what lets Gate 3's security scan add the OWASP LLM checks to `apps/teaching-avatar` specifically without forcing every other subproject through the same runtime-AI checklist, and what lets Gate 5 hold only the SOC2-scoped subproject to SBOM/audit-log requirements instead of the whole repo. During `karen init`, once `detect_project` reports multiple manifests, the agent asks the profile questions (type, deployment, audience, AI-powered) once per subproject that looks structurally independent (own manifest, own lifecycle) rather than assuming the first answer applies everywhere — the same principle as the per-gate scoping in [Poly-repo & Monorepo Structure](#poly-repo--monorepo-structure), applied to the profile that drives *which* checks exist, not just *where* they run.

**`subprojects[].codeRole`** answers "what kind of code is this, independent of type/deployment/audience" — `reference-app`, `debug-tool`, `root-utility`, or a project-specific label the interview settles on. (Distinct from `testRunner.packages[].role`, which is about coverage-reporting role — `primary`/`e2e-only` — not about what the subproject's code is for.) It's what lets a security zero-tolerance check flex per subproject (see [browser-direct-js](#browser-direct-js)) without touching the check's rationale for every other subproject. **`subprojects[].agentActions.scope`** (`least-privilege` vs. `maximal`, each with a `reason`) tells Gate 3's excessive-agency check which bar applies to that subproject's tool-calling surface — a customer-facing app is held to a narrow allow-list, an internal "everything-agent" test harness is expected to be broad and is checked against a different, explicitly-declared bar instead of the customer-facing one.

**`compliance[]` entries are either unconditional (a plain string) or feature-gated (an object with `activatesWhen`)** — see [Tiered, Feature-Gated Compliance](#tiered-feature-gated-compliance). A gated entry's artifact requirements only join the harness once the named feature is confirmed built; until then it's tracked and surfaced in the `karen init` summary but not yet enforced.

**`personalDataRegistry`** names the registry (or fan-out mechanism) every personal-data store is expected to join — see [Personal-Data Registry Pattern](#personal-data-registry-pattern). `path` is the registry's own source file; `stores` is Karen's best-effort list of personal-data stores found during `detect_project`/interview, checked each run against the registry to catch a new store that never joined. Omitted entirely for projects with at most one personal-data store, where fan-out has nothing to miss.

**Exceptions are first-class, not workarounds.** Every exception needs a reason and an expiry date. Karen reports expired exceptions as gate failures.

**`existingGates` vs. generated gates vs. `knownGaps` vs. `crossSubprojectConsistency` vs. `exceedsBaseline`:** five different mechanisms, easy to confuse.

| Mechanism | What it's for | Decays? |
|---|---|---|
| Generated gate (`.karen/gates/`) | Karen-authored check wired to a tool, for a dimension (or the slice of a dimension) the project has no existing coverage of | No — lives until superseded |
| `existingGates` | A pre-existing project quality gate Karen calls and normalizes instead of generating a competitor — `coverage[]` records which gates it satisfies and how fully, many-to-many (see [Reconciling Existing Quality Tooling](#reconciling-existing-quality-tooling)) | No — lives as long as the project keeps the gate |
| `crossSubprojectConsistency` | A check whose unit of analysis is the whole set of subprojects sharing a repeated pattern, not any one directory | No — lives until the pattern is consolidated or the check is removed |
| `exceptions` | A specific, temporary violation that's acceptable for a documented reason | Yes — requires an `expires` date, becomes a failure once passed |
| `knownGaps` | A permanent, intentional architectural gap (unimplemented capability, deployment-gated feature) tracked in the project's own backlog, typed by `kind` | No — no expiry; removed only when the gap is closed or the tracker entry is removed |
| `exceedsBaseline` | A dimension where the project's own tooling or documentation goes beyond Karen's minimum bar — surfaced as a strength, not folded into pass/fail | No — reassessed each `karen init`/`karen upgrade` |

Use `exceptions` for "we'll fix this by a date." Use `knownGaps` for "this is a deliberate boundary, not a defect" — see [Known Gaps vs. Exceptions](#known-gaps-vs-exceptions) below. Use `exceedsBaseline` for "we already do more than Karen requires here" — see [Recognizing Work That Exceeds the Baseline](#recognizing-work-that-exceeds-the-baseline).

**Expiry warning window:** Karen checks expiry dates on every run. If an exception will expire within `expiryWarningDays` (default: 7), she emits a non-blocking warning before the gate result — the gate still passes, but the team gets lead time to fix or extend the exception before CI silently breaks on a Monday morning:

```
GATE 3  security
  Karen notes an exception expires in 4 days. Prepare a fix.
  (gate-security / console.log / src/debug.js — expires 2026-12-01)
  Karen is satisfied.  (0 issues)
```

Set `"expiryWarningDays": 0` to disable warnings. Set it higher (e.g. 14) for regulated environments where exception extensions require advance approval.

**Gate IDs in exceptions** match the gate's `id` field in `.karen/harness.json`. Zero-tolerance gates do not honor exceptions — the `exceptions` block has no effect on them.

---

## Deployment Context Profiles

Profiles are knowledge Karen applies based on what you told her in `karen init`. They shape the security gate and may add additional gates. Selected via interview or set in `.karen.json` under `project.deployment`.

---

### browser-direct-js

*Your code loads via `<script src>` or `npm install` into the customer's page.*\
*There is no sandbox. You are a trusted guest in someone else's house.*\
*Every violation affects the customer's entire page, not just yours.*

**Additional zero-tolerance checks Karen adds:**

- Global scope writes (`window.*`, `globalThis.*` outside constructor opt-in)
- Event listeners without paired removal in `destroy()`
- Prototype modifications (`Array.prototype.*`, etc.)
- `setInterval`/`setTimeout` without cleanup reference
- `console.*` outside debug-mode guard
- `credentials: 'include'` in fetch/XHR

**Zero-tolerance checks flex by subproject code role, not just by per-line exception.** These patterns are calibrated for code a customer embeds — a library or SDK entry point. They are not calibrated for a subproject whose entire purpose is to exercise or debug that surface: an API explorer with an intentional verbose wire log, a capture tool that deliberately logs raw traffic for protocol verification. Forcing those through the same zero-tolerance bar as the SDK itself either produces noise the team has to `// karen-ignore` line-by-line forever, or trains them to ignore the gate. Karen's `project.subprojects` entries (see [Configuration](#configuration-karenjson)) carry a `codeRole` field — e.g. `"codeRole": "debug-tool"` — that the interview sets when a subproject's stated purpose is internal debugging, protocol capture, or API exploration rather than customer-facing distribution. A `debug-tool` code role relaxes exactly the checks whose rationale doesn't apply to it (`console.*` outside debug-guard, for one) while leaving the rest of the zero-tolerance list — credential leaks, `eval`, path traversal — fully in force, since those risks don't depend on who the audience is. The relaxation is declared once per subproject in `.karen.json`, not re-justified per line with a decaying exception.

**Required architectural pattern — instance isolation:**

```js
const sdk = new MySDK({ container: '#target', ...config })
// All state held internally. Nothing outside #target is touched.
// No unscoped page-level listeners registered.

sdk.destroy()
// Every listener removed. Every timer cleared. Every reference nulled.
// Page is identical to pre-instantiation state.
```

**SRI requirements (for CDN-loaded assets):**

- Release notes include `integrity` hash
- README default example uses `integrity` + `crossorigin="anonymous"`
- CDN URL uses explicit version; never `/latest/`

**Documented capabilities** — any of these require a `permissions` entry in `.karen.json` with plain-English justification:

| Capability | Minimum required policy |
|---|---|
| `microphone` | `Permissions-Policy: microphone=(self)` |
| `camera` | `Permissions-Policy: camera=(self)` |
| `blob:` / `mediastream:` URLs | `media-src blob: mediastream:` |
| WebSocket to external domains | `connect-src wss://exact-domain.com` — no wildcard TLD |
| Autoplay | Documented fallback for browsers requiring prior user gesture |

The SDK must never require the customer to add `unsafe-eval`, `unsafe-inline` in `script-src`, or `*` in any CSP directive.

---

### JavaScript & TypeScript Projects

*SDK and library projects written in JavaScript, TypeScript, or Node.js.*

Karen's gates 1–4, 6–7 now include language-specific behavior for JavaScript and TypeScript projects. Detection is automatic: if `package.json` is present and `go.mod` is absent, Karen activates JS/TS checks alongside the standard gates.

**Gate 1 (supply-chain):** Gate generates an npm branch using `npm audit` when a `package-lock.json` or `yarn.lock` is detected, run once per `package.json` found (see [Poly-repo & Monorepo Structure](#poly-repo--monorepo-structure)). Also checks any `vendor/`, `public/vendor/`, or `third_party/` directory for provenance per [Vendored & Copied-In Code](#vendored--copied-in-code) — a minified library dropped into a static assets folder is common in browser-facing JS/TS projects and won't appear in `package.json` at all.

**Gate 2 (completeness):** Scans for unimplemented stubs across `*.js`, `*.mjs`, `*.ts`, `*.tsx` files (excluding `node_modules/`, `dist/`, `coverage/`, and any vendor directory identified above). Flags:
- `throw new Error('not implemented')` in source files
- `TODO`, `FIXME`, `HACK`, `XXX` markers in production code
- Undocumented public exports (JSDoc or TypeScript `@public` required)

**Gate 3 (security):** Applies JavaScript-specific patterns:
- `eval()` and `Function()` constructor calls
- `require()` with dynamic user-supplied strings
- `child_process.exec()` without parameter array (must use `execFile`)

**Gate 4 (docs-parity):** Runs markdown doctest blocks tagged `js`, `ts`, `javascript`, or `typescript` (configurable via `.karen.json` `doctest.languages`).

**Gate 6 (test-integrity):** Supports Node.js coverage tools:
- `c8` (recommended; generates LCOV reports)
- Built-in V8 coverage via `node --experimental-coverage` (Node 22+)
- Jest `--coverage`

Set `testRunner.coverageReport` in `.karen.json` to the LCOV or JSON coverage file path. Karen parses coverage and enforces the threshold per module.

**Gate 7 (agent-context):** Checks for `CLAUDE.md`, `.cursorrules`, or `.github/copilot-instructions.md` in monorepo root or per-package.

**Exclusion rationale:** `node_modules/`, `dist/`, `.next/`, `build/`, `coverage/`, and any `vendor/`-style directory of copied-in third-party code are build artifacts, dependency trees, or unowned code — not project source. Scanning them would generate hundreds of false positives (stubs in dependencies, TODOs in transitive code, incomplete-looking patterns in minified vendor files). Gate precision requires excluding them from completeness and structure checks. This exclusion is about noise reduction for *those* gates only — it does not exempt vendored code from the supply-chain risk it represents; see [Vendored & Copied-In Code](#vendored--copied-in-code) below.

**Monorepo support (JS/TS instantiation):** this is the language-specific case of the general [Poly-repo & Monorepo Structure](#poly-repo--monorepo-structure) pattern above. Multiple `package.json` files are supported. Gate-6 (test integrity) does not stop at the first `package.json` with a test script — that's a coverage gap, not a feature. Instead, `.karen.json` declares which packages are audited and how:

```json
"testRunner": {
  "packages": [
    { "path": "sdk", "command": "npm test", "coverageReport": "sdk/coverage/lcov.info", "role": "primary" },
    { "path": "apps/harness", "command": "npm run test:fake", "coverageReport": null, "role": "e2e-only" },
    { "path": "apps/teaching-avatar", "command": "npm run eval:probes", "coverageReport": null, "role": "e2e-only" }
  ]
}
```

Each package gets its own gate-6 result line. A package marked `"role": "e2e-only"` is checked for assertion density and test presence but not held to the coverage threshold (see "When no coverage instrumentation exists" above). A package marked `"primary"` is the one whose coverage number Karen reports as the headline figure; others report individually but don't block on a number they can't produce. During `karen init`, the agent discovers every `package.json` with a test script and asks which one (if any) is the primary coverage target, rather than guessing the first one found.

**Configuration profile for JS/TS SDK projects:**

```json
{
  "project": {
    "type": "library",
    "language": ["javascript", "typescript"],
    "deployment": ["browser-direct-js"],
    "audience": "enterprise",
    "aiPowered": true
  },
  "testRunner": {
    "command": "npm test",
    "coverageReport": "coverage/lcov.info",
    "format": "lcov"
  },
  "doctest": {
    "files": ["README.md", "docs/**/*.md"],
    "languages": ["js", "ts"],
    "annotation": "karen:runnable"
  }
}
```

---

### browser-iframe

*Your product is hosted on your domain; the customer embeds via `<iframe>`.*\
*The iframe boundary is a free sandbox. The threat shifts to cross-origin messaging.*

**Additional checks:**

- `postMessage(data, '*')` with session or auth payload — must use exact origin
- `message` event handlers missing `event.origin` validation
- Trusted origin allowlist not locked at build time

Document COOP/COEP incompatibilities if `SharedArrayBuffer` is used.

---

### node-server

*Server-side Node.js, Deno, or Bun applications and services.*

**Additional checks:**

- `child_process.exec` with unsanitized input — use `execFile` with an args array
- `require()` with dynamic user-supplied string
- Unhandled promise rejections
- Secrets read from environment without startup validation
- No rate limiting on public HTTP endpoints

---

### python

*Python applications, services, and packages.*

**Additional checks:**

- `subprocess` with `shell=True` and unsanitized input
- `pickle.loads` on untrusted data
- `yaml.load` without `Loader=yaml.SafeLoader`
- `eval()` / `exec()` on user-supplied strings

---

### ai-agent

This profile covers two distinct things — a project can be either, or both, and the interview tells them apart:

**The project is built using LLM coding agents** (Claude Code, Cursor, etc., write its code). This activates the Agent Context Engineering gate (see above) — it's about how the agent that *writes* the project's code stays disciplined, not about the product itself.

**The project's runtime *is* an AI product** — it calls an LLM, runs agentic tool-calling, renders model output to users, or exposes a conversational surface. This is a different, additional security surface: the threat isn't "the coding agent drifted," it's "the product's own AI can be attacked or can misbehave toward end users." Karen's security gate (not just the agent-context gate) adds checks mapped to OWASP's Top 10 for LLM Applications and the Agentic Security Initiative:

| Threat class | What Karen's security gate checks |
|---|---|
| Prompt injection (LLM01) | Untrusted/user-controlled text reaching a system prompt or tool-call context without a documented input filter |
| Improper output handling (LLM05) | Model output written to the DOM via `innerHTML` or unescaped interpolation instead of a safe sink |
| Excessive agency (LLM06 / ASI 01-02) | Agent-initiated actions (tool calls, navigation, side effects) with no gate/allow-list/human-in-the-loop checkpoint before they take effect — the bar for what counts as "adequately gated" is set per subproject via `agentActions.scope` (below) |
| Unbounded consumption (LLM10) | No rate limit or turn cap on a conversational loop that can be driven by user input |
| Supply chain (LLM03) | Model/weights/prompt-template provenance — distinct from Karen's standard dependency audit, which still applies in parallel |

A project is `aiPowered: true` in `.karen.json` if *either* condition holds. The interview asks both questions separately — "is this built with AI coding agents?" and "does this product call an LLM or run agentic behavior at runtime?" — because a project can be one without the other, and the checks that follow are different in each case.

**A tool-provider server — an MCP server, a plugin, a webhook handler invoked by someone else's agent loop — is `aiPowered: true` even though it never itself calls an LLM.** This is a third case the two questions above can miss if read too literally: the project doesn't call an LLM, and it wasn't necessarily built by a coding agent either, yet its runtime is still driven by tool-call arguments an LLM decided to send. The threat model is the same one the runtime-AI branch exists for — LLM01 (a connecting model's tool-call arguments are untrusted input reaching this server exactly like a network request), LLM06/ASI excessive agency (the server executes actions an agent initiated, whether or not that agent lives in this process) — so exempting it because "we never call the model ourselves" would silently drop coverage from the exact tool-call surface (`run_shell_command`, `apply_config_patch`, or equivalent) that needs it most. During `karen init`, if `detect_project` finds an MCP SDK dependency, a plugin manifest, or another tool-provider shape, the interview asks the runtime-AI question as "are you invoked by an LLM's tool-calling loop, even if you never call one yourself?" — not just "do you call an LLM" — precisely so a plain tool-provider doesn't get waved through as `aiPowered: false` by a literal reading of the first two questions.

**The excessive-agency bar is not one-size-fits-all across a repo with multiple tool-calling surfaces.** A repo can legitimately contain both a customer-facing app with a deliberately narrow, least-privilege tool-call allow-list and an internal test harness whose entire purpose is exercising the *maximal* tool surface for QA — checking both against the same bar either fails the harness for doing its job or passes the customer-facing app on a bar too loose to mean anything. Each `project.subprojects` entry with `aiPowered: true` carries an `agentActions.scope` field — `least-privilege` or `maximal` — with a `reason`, set during the interview per subproject rather than once globally (see [Configuration](#configuration-karenjson)). Gate 3 checks a `least-privilege`-scoped subproject against "every agent-initiated action has an explicit allow-list entry or human-in-the-loop checkpoint" and checks a `maximal`-scoped subproject against a looser, explicitly-declared bar — e.g. "every action the harness exercises is logged and reviewable" rather than "the surface is minimal." Declaring `maximal` does not exempt a subproject from the *other* OWASP checks in the table above — prompt injection, output handling, and unbounded consumption still apply at full strength regardless of `agentActions.scope`; only the excessive-agency bar itself flexes.

Also adds, when the runtime-AI condition holds:

- Human-in-the-loop checkpoints documented for irreversible agent-initiated actions
- Model selection rationale documented (for the project's *own* LLM calls, not Karen's)
- `// karen-ignore` or equivalent escape documented for scanner definition files

---

## The LLM Prompt Pattern

The gate manifest never goes in the prompt. It lives in Karen. The prompt is always the same three-phase structure:

```
## What you're doing
[One paragraph: what the project does, who uses it, deployment context]

## Phase 1 — Let Karen review (no code changes)
Run: karen audit
Share Karen's complete output before touching any source file.

## Phase 2 — Address Karen's complaints
Work through failing gates in order (Gate 1 first, last gate last).
After fixing each gate, rerun: karen audit
Do not advance to the next gate until Karen is satisfied with the current one.
Karen will acknowledge progress (fewer complaints) or flag regressions (more
complaints) on each re-run — read her delta output before deciding what to fix next.

## Escalation rule
If karen audit exits 2, Karen has detected a stuck loop.
Stop immediately. Do not retry. Report the output and wait for human guidance.
Attempting the same fix a fourth time will not succeed.

## Stopping rule
The task is complete when and only when Karen is satisfied —
`karen audit` exits 0 with all gates passing and all existing tests green.
"Looks good" is not a stopping condition. Karen's satisfaction is.
```

**Why it works:**

- The LLM never reads the gate taxonomy — it runs a command and responds to output
- Karen gives precise targets (`file:line`), not subjective feedback to interpret
- Delta output (progress/regression) gives dense intermediate signal after each fix
- Fix-verify loop prevents hiding regressions under later fixes
- Exit code 0 is binary — no self-rating escape hatch
- Exit code 2 is a hard stop — no retry loops past the circuit breaker threshold
- "Karen is satisfied" is unambiguous in a way "high quality" never will be

---

## Teaching Karen New Complaints

Karen's quality knowledge lives in two places: this blueprint (the authoritative spec), and the LLM model that generates gate scripts from it.

**For project-specific complaints:** edit the gate script in `.karen/gates/` directly and register any new gate in `.karen/harness.json`. The gate contract is stable — anything that emits `FILE:LINE\tmessage` lines and a `PASS/FAIL (N issues)` summary will work.

**For patterns that belong in all projects:** update the relevant quality dimension in this blueprint, then run `karen init` (or `karen upgrade`) to regenerate the harness. The LLM picks up the new guidance and generates updated gate scripts. You're updating a specification, not patching gate scripts manually.

**When a better tool emerges:** if a superior SAST scanner, linter, or auditor becomes available, you don't patch Karen's source — you re-run `karen init` with the updated tool list, and the LLM generates gate scripts that call the new tool. The domain expert changed; Karen's orchestration layer didn't.

Her complaint list only ever grows. She never forgets — but she delegates the checking to tools that are maintained by experts in each domain.

**Upgrade contract:** new checks introduced in a Karen update are warning-only for the first release cycle. Projects can opt in to immediate enforcement with `"strictUpgrades": true` in `.karen.json`. After one cycle, they become blocking.

---

## Integration

Because gate scripts are plain shell files committed to your repo, they run anywhere — no agent runtime required outside of `karen init`. CI, pre-commit hooks, and local dev all execute the same scripts the agent generated.

**CI (GitHub Actions) — Karen blocks the merge:**

```yaml
- name: Karen's Review
  run: bash .karen/run-all.sh .
  # exit 1 = Karen is not satisfied; exit 2 = Karen is escalating, page a human
```

**Pre-commit — fast security check before you commit:**

```bash
bash .karen/gates/gate-3-security.sh .
```

**Full audit — run by the agent or manually:**

```bash
bash .karen/run-all.sh .
```

**Gradual rollout for existing codebases** — tell the agent to initialize Karen in warn-only mode:

```bash
bash .karen/run-all.sh . --warn       # reports issues, exits 0 — for baselining
bash .karen/run-all.sh . --baseline   # snapshots current counts into .karen/baseline.json
bash .karen/run-all.sh .              # blocks only regressions beyond the baseline
```

Same scripts everywhere. The agent's audit, CI, and local dev all run the same committed shell files. No environment drift. No "it passed locally."

**OS and environment detection — before generating scripts:**

During `karen init`, the agent probes the environment before writing a single gate script. Getting this wrong means generating bash scripts for a Windows host or PowerShell scripts for Linux CI — both silently fail at the worst moment.

The `detect_project` tool returns:

| Signal | What it checks |
|---|---|
| OS | `uname` / `os` environment signal (`win32` / `darwin` / `linux`) |
| Shell | `SHELL` env var; on Windows, presence of WSL, Git Bash, or PowerShell |
| Package manager | `package.json` → npm/yarn/pnpm; `Pipfile`/`pyproject.toml` → pip/uv/poetry; `go.mod` → go; `Cargo.toml` → cargo |
| CI environment | `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `BITBUCKET_PIPELINE`, etc. |
| Runtime | Node version from `.nvmrc`/`.node-version`; Python version from `.python-version`; etc. |

Gates are generated as shell scripts (`.sh`) on Unix and as PowerShell (`.ps1`) on Windows-native environments. If the agent detects a mixed environment (Windows host + WSL or Git Bash), it asks which shell will run the gates before generating, and documents the answer in `.karen/harness.json`.

**Coding agent hooks — enforcing harness timing:**

The gate harness is only as reliable as the agent's discipline in running it. Agents with hook systems let you make that discipline structural rather than instructional. During `karen init`, the agent generates the appropriate hook configuration for the agent system in use.

Because the gate scripts are committed shell files, hooks invoke them directly — no Karen skill required at hook-run time.

*Claude Code (`~/.claude/settings.json` or project `.claude/settings.json`):*

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .karen/gates/gate-3-security.sh ."
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .karen/run-all.sh ."
          }
        ]
      }
    ]
  }
}
```

The `PostToolUse` hook runs a fast security gate after every file write. The `Stop` hook runs the full audit before the agent ends its turn — the agent cannot report completion until all gates pass. If any gate exits non-zero, the hook output lands in the agent's context on the next turn.

*Other agent systems:*

| Agent | Hook point | Mechanism |
|---|---|---|
| Cursor | After each file save | `.cursor/rules` — invoke the relevant gate script directly |
| GitHub Copilot Workspace | Pre-completion | Workspace task invoking `.karen/run-all.sh` |
| Aider | After each commit | `--auto-test "bash .karen/run-all.sh ."` flag |
| Custom agents | After any tool call that writes files | Shell-out to the gate scripts; treat non-zero exit as continuation/escalation signal |

For agents with no hook system, the `CLAUDE.md`/`AGENTS.md` prompt pattern (see The LLM Prompt Pattern) is the fallback — it makes the stopping condition explicit in the agent's context even without structural enforcement.

---

## Mental Models

**"High quality" is an escape hatch. "Karen is satisfied" is not.**
Every aspirational quality property must decompose into a count that can reach zero. If Karen can't check it, it's not a completion criterion — it's a wish.

**Karen is a harness architect, not a domain expert.**
She doesn't own security rules, compliance checklists, or linting patterns — semgrep, govulncheck, eslint, pip-audit, and bandit own those. Karen knows what dimensions matter for your project and which tools to wire together to check them. A generic linter applies its own rules to your code; Karen designs a harness where each rule is owned and maintained by the right tool, calibrated to your project's actual risk surface.

**The skill is the structure; the LLM is the intelligence.**
Karen's deterministic tools handle all filesystem and subprocess operations. The LLM handles discovery, reasoning, and generation. Neither can do the other's job — and neither tries.

**Karen re-runs after every fix. Not just the gate you touched.**
Regressions in Gate 1 caused by a Gate 4 fix are real. Karen catches them. Self-review doesn't. The loop is: fix → full re-run → advance only when green.

**Exceptions must expire.**
Every documented exception in `.karen.json` needs three things: what it is, why the project cannot function without it, and an expiry date. Karen treats expired exceptions as gate failures. This turns AppSec from a blocker into a sign-off — not asking for forgiveness, showing documented justification.

**Karen never lets docs and code drift apart.**
Gate 4 enforces parity mechanically. No process, no discipline, no code review catches this as reliably as a check that fails the build.

**In browser-embedded code, your code is a guest in someone else's house.**
Never exceed the authority you need. Always clean up. The test: after `destroy()`, the page must be identical to its pre-instantiation state.

**The less you require customers to weaken their posture, the faster you ship.**
Every CSP relaxation you don't need is an AppSec conversation you don't have. Karen documents every relaxation you *do* need — with justification — so regulated enterprise customers can approve your component in an afternoon instead of a month.

**Agent context files are contracts, not suggestions.**
An LLM that doesn't have a binary stopping condition will invent one. "Looks good" is the invented one. Karen's gate contract is the real one. The agent context file is where you make sure the LLM knows the difference.

**Gates must audit structure, not text.**
A pattern match on raw source code fires on comments, strings, variable names, and documentation that happen to contain the forbidden word. Karen-generated gates use AST analysis or structural context wherever the language supports it. False positives erode trust in the gate; an agent that learns to `// karen-ignore` its way through a gate has defeated the purpose. Gate precision is a correctness property.

**Partial progress is signal; the bar doesn't move.**
When an agent fixes 3 of 5 issues, Karen acknowledges it — `3 fewer complaints`. That acknowledgment stabilizes the agent's direction. But the gate still fails. "Progress noted" and "you may proceed" are different things. Never conflate them in gate design, in prompt wording, or in CI configuration.

**A stuck agent needs a human, not another retry.**
An agent that attempts the same failing strategy three times in a row is not getting better information on the fourth try. The circuit breaker exists to convert an infinite token-burn loop into a bounded, human-reviewable event. Exit code 2 is not a failure mode to suppress in CI — it's the most useful signal Karen can send. Wire it to a notification, not a retry.
