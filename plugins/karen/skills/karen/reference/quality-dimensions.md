# What Karen knows

The universal quality dimensions to draw from when designing a harness. Combine this knowledge with the project's profile (from `interview.md`) to decide which checks matter, at what severity, and how to implement them with the project's own tools (via `probe-tools.md`).

---

## Supply chain & dependencies

Every external dependency is a trust decision.

| Dimension | What to check |
|---|---|
| Vulnerability status | Known CVEs in the dependency tree |
| Maintenance health | Last release recency; project actively maintained |
| License compatibility | SPDX identifier present; compatible with the project's license |
| Maturity | Pre-1.0 packages without documented justification |
| Transitive exposure | Unmaintained nodes deep in the dependency graph |

The generated gate uses the dependency audit tool the project already uses — `npm audit`, `pip-audit`, `govulncheck`, `bundle-audit`, `cargo audit`, or equivalent. If none is set up, recommend one during the interview and wire it in.

**Best signal: zero runtime dependencies.** Flag this explicitly as a strength — see Recognizing Work That Exceeds the Baseline below.

### Vendored & copied-in code

A dependency audit tool only sees what's declared in a manifest. Code copied directly into the tree — a minified library dropped into `vendor/`, `third_party/`, or `public/lib/`, a snippet pasted from Stack Overflow, a checked-in binary blob — carries the same trust and vulnerability risk as a declared dependency, but is invisible to `npm audit`/`pip-audit`/`govulncheck` because there's no manifest entry to check.

| Signal | What to flag |
|---|---|
| Recognizable third-party code with no manifest entry | A checked-in library (minified or not) that isn't a declared dependency — no version pin, no audit coverage, no update path |
| No provenance record | No comment, README note, or `NOTICE`/`THIRD_PARTY.md` entry stating what the vendored file is, its source, version, and license |
| Stale vendored copies | A vendored file with a detectable version string several major versions behind current |

Don't try to reimplement a vulnerability database for arbitrary vendored code — that's still a job for a tool (Scancode, `licensee`, or a SAST scanner's vendored-file detection), not a regex. Where none is available, the minimum bar is *presence of provenance*: every file under a recognized vendor directory must be traceable to a source, version, and license in a tracked note. An untraceable vendored file is a finding regardless of whether a scanner exists to check its CVEs.

---

## Security & trust boundaries

The patterns to scan for depend on the project's language, deployment context, and what it handles. Zero-tolerance patterns apply across all contexts:

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

**Secret scanning is a working-tree check, not a source-tree check.** A regex or AST pass over tracked source finds a secret typed directly into a `.js` file. It does not find one sitting in a captured test artifact, a `.har` file, a fixture, a screenshot's embedded metadata, or any other file that never got committed because `.gitignore` excludes it — exactly where real credentials leak from agentic test runs (env dumps, recorded network traffic, debug captures). Wire in a dedicated secret scanner (`gitleaks`, `trufflehog`, or equivalent) run against the full working directory, scoped only by an explicit exclude list (`node_modules/`, `.git/`, build output) — never scoped to tracked files only. `.gitignore` is not a security boundary; it only controls what gets committed, not what gets scanned, copied, or zipped up.

**Don't fall back to variable-name keyword matching for secrets.** If no dedicated scanner (`gitleaks`, `trufflehog`) is installed and one can't be added, a regex that only fires on names like `API_KEY`/`SECRET`/`TOKEN`/`PASSWORD` misses every secret assigned to a differently-named constant (`ENCRYPTION_KEY`, `SIGNING_SECRET_V2`, `clientAuth`, `beaconIngestKey` — the naming space is unbounded, and this list will never be complete). Detect the *shape* of the value instead: a `const`/`let` (or object literal field) assigned a string literal that's long (20+ chars), has no spaces, and mixes letters with digits is a candidate regardless of what its identifier is called. **Don't require upper AND lower AND digit all at once** — that strict-mix check misses real secrets that are routinely all-lowercase hex (`ta_enc_9f3d7c1b8a4e0f2d6c5b9a3e7f1d0c4b`) or all-uppercase; letters-plus-digits, case-insensitive, is the right bar. Rule out what's structurally not a token before flagging it: a URL or file path (contains `://` or a `/`-delimited path shape) is describing *where*, not authenticating *as whom* — `const ENDPOINT = 'https://api.example.com/v1/beacon'` matches the length/letter/digit shape but isn't a secret. A plain display string / non-credential identifier isn't one either (a hyphenated label like `'remember-me'` isn't a secret just because it's long — the digit+letter mix, not length alone, is what separates a generated token from a human-written phrase). Flag what's left, unless it's in a test file. **Don't add a keyword/prefix allow-list to suppress specific values** (e.g. skipping anything starting with `FAKE-` or `test-`) — that's the same textual-keyword shortcut this paragraph just warned against, just inverted, and it will just as easily suppress a real secret that happens to start with a common word as it will a placeholder. **This shape-based check is a fallback for when no dedicated scanner is installed — not an additional layer stacked on top of one.** If a dedicated scanner already covers secret detection (or a general-purpose SAST tool like `bandit` already flags hardcoded-credential patterns via its own rules), don't also run the shape-based AST scan against the same files — the two will independently fire on the same literal and double-count a single real secret as two findings. When more than one mechanism legitimately can fire on the same line (e.g. two independent external tools like `gosec` and `gitleaks`, each covering a different risk angle), dedupe by file:line before reporting rather than emitting one line per tool. **Verify a SAST tool's actual rule scope before assuming it doesn't already cover a case — don't guess from a rule's typical example.** Bandit's `B105`/`B106`/`B107` (hardcoded password) fire on module-level and class-level string-constant assignments whose name matches a password/secret/token/key pattern, not just function-signature defaults, even though most write-ups of the rule only show the function-default case. A shape-based supplement scoped to "whatever bandit's own rules don't already reach" needs that scope checked against a real run of the tool, not assumed from a rule ID's typical example — assuming too narrow a scope reintroduces exactly the double-count this paragraph already warns against, just via a different blind spot than "no scanner installed."

**Bandit's `B603`/`B607` subprocess rules fire on any `subprocess` call regardless of whether the arguments are actually attacker-controlled.** A fixed, non-interpolated argv list passed with `shell=False` (e.g. `subprocess.run(["ls", "-la"], shell=False)`) carries no injection risk — there's no shell parsing step and no user-influenced string reaching the command — but bandit flags it anyway because its rule is syntactic ("subprocess used"), not data-flow-aware. Per the structural-over-textual principle above, post-filter bandit's raw B603/B607 findings: a call site with an entirely literal argv array and `shell=False` is safe and should not be reported; a call site with any variable-derived element in argv, or `shell=True`, keeps the finding.

**Gate design principle — structural over textual.** Surface-level text matching is fragile. A pattern written in a comment, a string literal, or a variable name triggers a false positive. Generated gates should audit structural intent, not raw text:
- Parse the source into its AST or call graph before evaluating patterns. A regex match on `eval` fires on `// never use eval` in a comment; an AST match on `CallExpression[callee.name=eval]` does not.
- For languages without a fast AST tool, use structural context clues: is the match inside a string literal? A comment token? A test assertion? If yes, skip it, or mark the line for human review rather than hard-fail.
- The `// karen-ignore` directive is the last resort for legitimate exceptions in non-test production code, not the first. Minimize how often it's needed by being precise about what actually matches.

This applies to every generated gate, not just security. A completeness gate that flags `pass` in Python shouldn't fire on `password` or a variable named `bypass`.

Deployment-context additions are added by profile — see `deployment-profiles.md`. If the project's own runtime calls an LLM or runs agentic behavior — not just "built by an AI coding agent" — the security gate also adds the OWASP LLM/Agentic threat checks under the `ai-agent` profile.

---

## Code completeness

Every public capability must be fully implemented, tested, and documented. "Fully" means all three — any one missing is a gate failure, unless it's a declared known gap.

| Signal | Flag |
|---|---|
| Stub implementations | `throw new Error('not implemented')`, `pass`, `raise NotImplementedError` in public API |
| Undocumented public symbols | Exported functions, classes, methods without docstrings or equivalent |
| Untested public symbols | No test covering each public API entry point |
| Broken TODO markers | `TODO`, `FIXME`, `HACK`, `XXX` in production code |
| Placeholder content | `Lorem ipsum`, `example.com`, `TODO: replace` in shipped output |

**Report the line of the offending statement itself, not the enclosing declaration.** A stub is rarely a one-liner — `def page_on_call(...):` and its `raise NotImplementedError(...)` body live on different lines, same for a multi-line `export function foo(...): void { ... throw new Error("not implemented"); }`. The finding belongs at the line containing the actual `throw`/`raise`/`pass`, since that's the statement a human (or a diff) needs to look at to fix it — not the signature line a structural scan happened to match first while walking forward to find it. Matching on the declaration and reporting that line number instead is a real, easy-to-write bug: it still finds every real stub (no false negatives) and never false-positives on decoys, so it passes every other check, but it silently points at the wrong line for every multi-line case.

### Known gaps vs. exceptions

Not every incomplete-looking thing is a defect. A capability can be intentionally unimplemented — gated by a third-party backend, deferred by design, out of scope for this release — and still be honestly documented rather than hidden.

**An exception says "this is wrong, but acceptable until a date."** It has an expiry. An expired exception is a failure.

**A known gap says "this is not wrong — it's a boundary, and it's tracked."** No expiry. Stays valid as long as the project's own tracker (a `GAPS.md`, a linked issue, a roadmap doc) still lists it. Don't invent this distinction unprompted — during `karen init`, if you find a stub, an unimplemented branch, or a `not implemented` throw, ask: *"Is this a known limitation, or work in progress?"* If the project already maintains a gaps/backlog file, ask whether to treat entries there as known gaps automatically rather than asking per-stub.

**When auto-treating a tracker's entries as `knownGaps`, copy `pattern` and `scope` verbatim from the tracker's own row — don't re-derive them from the code the stub lives in.** A `GAPS.md` table already names the exact capability in `pattern` and the exact file in `scope`; transcribe those two columns, don't look at the stub itself and invent a different (also-valid) matchable string. A function name like `verify_signature` and the tracker's own phrase `webhook signature verification` can both substring-match the same `NotImplementedError` message, so the code offers no signal for which one is "more correct" — only the tracker does. Writing anything other than the tracker's own text breaks the entry's traceability back to the record that's supposed to be its source of truth, even though the stub still gets suppressed either way.

**"Work in progress" gets no `knownGaps` entry at all — the stub stays a live, unsuppressed finding.** A known gap suppresses a pattern precisely because it's a deliberate, tracked boundary, not a to-do item. If the answer is "it's on the roadmap, not wired up yet" rather than "the backend can't do this" or "out of scope by design," that capability is still an open defect gate-2-completeness should keep reporting every run — writing a `knownGaps` entry for it would hide exactly the finding the user needs to see, and a `reason` admitting "still in progress, not a tracked limitation" directly contradicts the field's own definition. Only write the entry when the answer names an actual boundary — never as a synonym for "not done yet."

**Before writing any `knownGaps` entry, run this check on the interview answer itself, not on the `reason` text you're about to write.** It's possible to compose a `reason` string that correctly recites this section's own rule — "not built yet, no tracker, so this should stay a live finding" — while still writing the entry anyway, because the check that matters is whether the *user's actual answer* named a real tracker artifact (a linked issue, a `GAPS.md` line, a roadmap doc), not whether the entry's prose sounds compliant. If the interview answer was "not built yet" with no artifact named, the correct action is to write no entry at all — never an entry whose `reason` field narrates that fact. Confirming the tracker reference exists is the gate; a well-worded `reason` is not a substitute for it.

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

A known gap entry needs `pattern` (what to match), `scope` (a file, a directory, or omitted for project-wide), `reason` (why it's intentional, in the project's own words), `tracker` (the file or URL where the gap is the canonical record), and `kind`. Don't validate that the tracker entry itself still exists — that's the project's responsibility — but every `karen audit` summary should name every active known gap so it stays visible, not buried.

**`kind` carries forward the project's own backlog taxonomy instead of flattening it.** Many projects distinguish "the platform genuinely can't do this" from "it's a nice-to-have DX improvement" from "it's on the competitive roadmap." `kind` is not a fixed enum — if the project's own tracker has a taxonomy, ask whether to reuse those labels verbatim rather than forcing them into an invented set. Common values seen in practice: `capability-gap`, `dx-improvement`, `roadmap`, `robustness`. No `kind` is treated differently for gate-passing purposes — all known gaps suppress their pattern equally; `kind` exists for audit-summary readability and future re-triage, not enforcement.

**If a known gap stops being honest** — the backend now supports the capability, the roadmap shipped — removing the `knownGaps` entry turns the suppressed pattern back into a live gate failure. A stale known gap that should be an exception instead (the team is *actively* working it with a target date) belongs in `exceptions`, not here.

---

### Recognizing work that exceeds the baseline

A gate that only ever reports complaint counts has nothing to say about a team that has already gone well past the minimum bar. None of that extra rigor shows up in "0 issues" — and a rigorous team evaluating whether to adopt Karen will notice that their existing work is invisible to her. That's a real adoption cost.

**Every gate, not just supply-chain, can report an `exceedsBaseline` finding.** During `karen init`, whenever analysis or the interview surfaces a control, artifact, or practice that goes beyond what that gate's dimension requires at minimum, record it in `.karen.json` under `exceedsBaseline`, scoped to the gate it exceeds:

**An `exceedsBaseline` entry must be a verified, already-realized practice — never aspirational, and never contradicted by a live finding elsewhere in the same audit.** A CLAUDE.md/AGENTS.md paragraph *describing* a control ("all API calls are retried with exponential backoff") is not itself evidence the control exists in code — check the practice actually holds before crediting it, the same way a compliance overclaim check above verifies a named reference still exists rather than trusting the doc's prose. If gate-3 or another gate is independently reporting a live violation of the exact practice a doc claims, that claim doesn't earn `exceedsBaseline` — it's a doc/reality mismatch, not a strength. **A baseline-level item on the agent-context checklist above — stopping criteria present, model-selection guidance present — doesn't itself qualify as `exceedsBaseline` just by existing.** Those are the minimum bar gate-7 already checks for pass/fail; crediting their mere presence as a strength double-counts the same fact as both "gate passed" and "exceeds baseline." Reserve `exceedsBaseline` for something genuinely past that minimum (e.g. a documented, runnable eval gating every prompt change, not just a stopping condition existing at all).

```json
"exceedsBaseline": [
  { "gate": "gate-1-supply-chain", "note": "Zero runtime dependencies" },
  { "gate": "gate-5-compliance", "note": "SECURITY.md maps HIPAA, HITRUST, and OWASP LLM Top 10 control-by-control" }
]
```

**In audit output, an `exceedsBaseline` entry surfaces as a strength line, never as a substitute for the gate's own pass/fail.** A gate with recorded strengths still reports its own issue count on its own merits:

```
GATE 1  supply-chain    Karen is satisfied.  (0 issues)
  Strength noted: zero runtime dependencies.
```

Reassess this on every `karen init`/`karen upgrade`, the same as `existingGates` coverage.

**A regressed strength is reported once, not silently dropped.** Removing an `exceedsBaseline` entry with no trace would read identically to "this was never checked." The `karen upgrade` run that first detects the loss prints a one-time regression note, then removes the entry:

```
GATE 1  supply-chain    Karen is satisfied.  (0 issues)
  Strength lost: zero runtime dependencies (lodash added since last check).
```

This note appears exactly once, on the run where the regression is first detected — not persisted or repeated afterward.

---

## Documentation fidelity

Docs written separately from code will drift. Enforce parity mechanically.

| Check | What it catches |
|---|---|
| Symbol references | Docs referencing names not in the current codebase |
| Signature drift | Function signatures in docs that don't match source |
| Dead links | Internal links that resolve to 404 |
| CHANGELOG gaps | Commits since last release tag not reflected in CHANGELOG |
| Runnable examples | Examples marked `karen:runnable` that fail when executed |
| Documented interface parity | A markdown table claiming to enumerate a CLI/tool/API surface vs. the actual parser/handler/route definitions — bidirectional |

Runnable example execution is opt-in. Only blocks tagged with the `annotation` value from `.karen.json` (default: `karen:runnable`) are executed. Unannotated blocks are never run — they may be illustrative fragments or require unavailable runtimes.

**Some markdown structures are more than examples — they're a claimed contract with the code's actual surface.** A table enumerating a CLI's flags, an MCP server's tool list, or an API's endpoints is checkable bidirectionally, unlike prose: every row must still correspond to a real flag/tool/endpoint in source (the stale-doc direction), and every flag/tool/endpoint the source actually exposes must appear in the table (the undocumented-surface direction — a missing row produces no dead link and no signature mismatch to flag otherwise). Diff a table tagged as this kind of interface-enumeration contract against the corresponding parser/handler/route definitions in both directions.

---

## Compliance artifacts

Every project needs these. Check presence and minimum content.

| Artifact | Requirement |
|---|---|
| `SECURITY.md` | Present; contains vulnerability disclosure process |
| `LICENSE` | Present; SPDX identifier present |
| `CHANGELOG.md` | Present; follows Keep a Changelog format |
| `CONTRIBUTING.md` | Present for public or shared repos |
| SBOM | Generated at release for SOC2 / FedRAMP / HIPAA profiles |
| Provenance attestation | Enabled in publish config for distributed packages |

For compliance profiles, add regime-specific artifact requirements — audit log config for SOC2, PHI handling docs for HIPAA, cardholder data flow docs for PCI-DSS, FIPS config for FedRAMP.

**Presence and content are not the same thing as accuracy — a compliance doc can pass every check above and still overclaim.** A `SECURITY.md` mapping controls to a dozen named standards, a slide deck asserting broad framework alignment, a README claiming a certification the project doesn't hold — none of that is caught by checking the artifact exists and has the right sections. Don't attempt to verify regulatory claims yourself; that's a legal/audit judgment, not a static check. What's checkable is narrower and mechanical: does the compliance doc name a specific file, function, or test as backing a specific claim, and does that reference still exist? A claim with no named reference, or one whose named reference has since been deleted or renamed, is a finding — `Karen notes SECURITY.md claims "encryption at rest" but names no implementing file`.

**Compliance artifacts describe what the *project* provides, not what a deploying organization is automatically entitled to claim.** A project's controls can satisfy the technical prerequisites for SOC2 or GDPR without the project itself constituting compliance — actually reaching a named standard usually also requires organizational process the code can't attest to (a signed BAA, an operator's own audit-log retention policy, a legal review of data flows). The compliance gate doesn't certify a standard; it checks that the project's own docs are honest about this boundary — naming which parts are controls the code provides versus which remain the deploying operator's responsibility. A compliance doc reading as "install this and you're SOC2 compliant" with no such split is itself a finding, separate from whether the underlying controls are technically sound.

### Personal-data registry pattern

A project storing personal data in exactly one place can handle a GDPR/CCPA export or erasure request with a single, auditable query. A project storing it in several places — a primary user table, an analytics store, a cache, a conversation-memory store — can't, unless something ties those stores together. **Check for a specific structural pattern, not just a policy statement**: does every personal-data store register itself with a single registry (or an equivalent fan-out mechanism) that a data-subject request walks to reach all of them, or does each store handle export/erasure ad hoc, with no shared place that guarantees none was missed?

During `karen init`, if the interview or `probe_tools` surfaces more than one personal-data store, ask whether a registry pattern already exists and, if so, check every store found against it:

```
GATE 5  compliance
  src/analytics/eventStore.ts:14  writes rows keyed by (tenant, user) but never
    registers with src/consent/registry.ts — an erasure request would miss this store
  FAIL (1 issues)
```

A project with only one personal-data store, or none at all, never triggers this check.

**The gate must discover new stores every run, not just re-check the ones `.karen.json`'s `personalDataRegistry.stores` already lists.** `stores` is a snapshot from whenever it was last written — a store added after that (a new class, table, or cache keyed by user/tenant) won't appear in it, and a gate that only loops over the existing list (`for (const storeRel of registry.stores) { ... }`) never even looks at the new file, so it silently passes a real regression instead of catching it. Structurally scan the codebase for the same store-shaped pattern the existing entries match (e.g. a class or module persisting data keyed by a user/tenant identifier, via the same AST check `probe_tools`/`karen init` used to find the original stores) every time the gate runs, and flag anything that pattern-matches but isn't in `registry.stores` and isn't wired into `registry.path` — the same "unregistered-personal-data-store" finding, just triggered by discovery instead of by list membership. Keep validating the listed stores too; discovery is additive, not a replacement.

### Tiered, feature-gated compliance

A static profile picked once at `karen init` assumes the whole project carries one compliance posture for its whole life. That's often false — a product can ship a free core tier with no personal-data handling, then an opt-in analytics tier, then a personalization tier storing far more, where each tier upward *earns* new compliance obligations the tier below never triggers.

`compliance[]` entries may be a plain string (`"soc2"` — applies unconditionally) or an object naming the feature flag that activates it:

```json
"compliance": [
  "soc2",
  { "standard": "gdpr", "activatesWhen": "feature:analytics-tier", "note": "Only the analytics tier and above touch personal data broadly enough to trigger export/erasure obligations" }
]
```

Only add a tier-gated standard's artifact requirements to the harness once the interview confirms the gating feature is actually built and reachable — a forward-declared `activatesWhen` entry for a feature that doesn't exist yet is tracked but not enforced, surfaced in the `karen init` summary so the team sees it coming. Reassess on every `karen init`/`karen upgrade` — a feature flag removed or a tier retired drops its gated compliance requirements with it.

---

## Test integrity

A test suite that passes but doesn't verify anything produces false confidence. Check the quality of the tests, not just their existence.

| Check | Pass condition |
|---|---|
| Coverage | ≥ threshold per module (default 80%, configurable in `.karen.json`) |
| Assertion density | No test blocks with zero assertions |
| Live credential usage | Tests must not require real credentials to pass |
| Contract testing | Public API tested through its public interface, not internal imports |

The generated gate invokes the project's test runner and parses the coverage report. Test runner and report format are configured in `.karen.json` under `testRunner`.

**When no coverage instrumentation exists.** Many projects run tests with no coverage tool wired in at all. Don't silently skip the coverage check or silently pass it. During `karen init`, if `probe_tools` finds a test runner but no coverage output, ask: *"Your tests run but produce no coverage report. Want me to wire one in (`c8` for Node, `-coverprofile` for Go, `pytest-cov` for Python), or run coverage-less for now with the gate set to assertion-density-only?"* A project that opts out gets `"coverage": { "enabled": false, "reason": "..." }` in `.karen.json` — an explicit, visible choice. The gate still checks assertion density; it just can't enforce a percentage threshold it has no number for.

**E2E-only test suites (Playwright, Cypress, Selenium) typically produce no function-level coverage.** Don't treat "no unit coverage, only E2E" as automatically failing — flag it as a finding during `karen init` ("this project has E2E coverage but no unit tests — is that intentional for this kind of app?") and let the interview decide whether unit coverage is expected. A thin client wrapping a remote API may be legitimately E2E-only; a library with complex internal logic usually isn't.

**This decision is recorded once, under `coverage`, never duplicated into `knownGaps`.** An intentional E2E-only/coverage-less choice already has its own dedicated field — `"coverage": { "enabled": false, "reason": "..." }` — which is what gate-6 itself reads to know not to enforce a percentage threshold. `knownGaps` above is for a *different* kind of thing: an unimplemented capability or stub that some other gate would otherwise flag as a live defect. Writing a second `knownGaps` entry for the same E2E-only decision doesn't suppress anything gate-6 would have flagged (the `coverage` field already handled that) — it just adds a phantom entry with no corresponding ground-truth defect behind it.

**A non-security accuracy claim carries the same overclaim risk compliance claims do.** "This classifier is 95% accurate" or "routes correctly 98% of the time" is a claim like any other — it just isn't regulatory. Don't verify the number itself; that's a data-science judgment. What's checkable: does the claim name a real, runnable eval script or dataset backing it? A claim with no named eval artifact, or one whose named artifact no longer exists, is a finding. A claim backed by a real gold-set eval is recorded under `exceedsBaseline` on `gate-6-test-integrity` instead of flagged.

---

## Agent context engineering

If the project is AI-powered or used with LLM coding agents, add a gate that checks its agent context setup. This is a core Karen domain.

| Check | What to look for |
|---|---|
| Agent context file | `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or equivalent present |
| Stopping criteria | A deterministic, runnable, binary exit condition is defined — not necessarily Karen's own |
| Tool permission scope | Permissions scoped to minimum necessary |
| Context hygiene | No secrets or credentials in agent context files |
| Prompt injection surface | User-controlled input sanitized before LLM context insertion |
| Deterministic done-criteria | Completion defined as `count = 0` or `exit 0`, not adjectives |
| Model selection guidance | Agent context specifies model tier per task type |
| MCP server hygiene | Tools scoped to read-only where write access isn't required |

**The principle:** if the LLM has a way to self-rate as "done" without running a check, it will use it. Agent context files that name a runnable exit-0 condition remove that escape hatch entirely.

**The stopping-criteria check is not Karen-specific.** A project may already have its own deterministic quality gate — a docs-CI script, a lint-and-test command, a custom verifier — wired into its agent context file as the stopping condition. Check for *the property*, not for literal references to `karen audit`: does the agent context file name a specific, runnable command whose exit code defines done? `Run: node tools/check-docs.mjs — done when it exits 0` satisfies this exactly as well as `Run: karen audit`. If Karen is layered onto a project with an existing stopping criterion, either wire that command in as an `existingGates` entry and let it continue to anchor the stopping condition, or fold it into Karen's own audit — never require the project to switch its stopping language to hers.

**A context file's claimed audience must match which files actually exist.** `CLAUDE.md` opening with "rules the AI writes by, for Claude / Copilot / Cursor" is making a claim about reaching agent ecosystems that read different filenames — Cursor reads `.cursorrules` (or `.cursor/rules/`), Copilot reads `.github/copilot-instructions.md`, and neither exists just because `CLAUDE.md` says it's meant for them. Flag this specific mismatch as its own finding, distinct from "no agent context file present at all."

**This is a purely structural check — does the named file exist on disk, yes or no — and it fires regardless of what the context file's own prose says about the claim.** A `CLAUDE.md` that names Cursor as an audience in one place and separately self-disclaims that the claim "isn't backed" elsewhere in its own text still doesn't make `.cursorrules` exist; the disclaiming sentence is not itself the missing file. Don't let a self-aware caveat in the doc suppress the finding — check the filesystem, not the doc's own commentary about the filesystem.

---

## Code structure & elegance

Structural issues invisible to linters but that compound over time.

| Pattern | Why it matters |
|---|---|
| Duplicated logic (DRY violations) | Two copies diverge; bugs in one don't get fixed in the other |
| Premature abstraction | Abstractions serving one caller add complexity with no payoff |
| Deep nesting (>3 levels) | Usually hides missing early returns; hard to test |
| Functions exceeding single responsibility | Large functions test many things implicitly |
| Magic numbers and strings | No context for what the value means or when it changes |
| Implicit coupling | Modules sharing state through globals or ambient context |
| Dead/unreachable code | Unused exports, unreachable branches, functions with no remaining caller — finished code nobody deletes, distinct from unfinished-code signals above |

Severity is calibrated to project type: stricter for libraries and SDKs distributed to others; advisory for internal scripts and one-off tooling.

**Dead-code detection uses the project's own tooling, not an invented reachability analysis.** Wire in whatever the language already has — `ts-prune`/`knip` for TypeScript, `vulture` for Python, `deadcode`/`unused` via `go vet`/`staticcheck` for Go. Where none is configured, `probe_tools` reports the gap and a tool should be recommended during `karen init` rather than silently skipping the check.

**Not all duplication is a defect.** Two near-identical blocks can be *correctly* divergent — separate validators for two regulatory regimes that must vary independently — and merging them would itself be the bug. Treat unannotated duplication as a normal finding, but recognize a `// karen-intentional-duplicate: <reason>` marker (parallel to `// karen-ignore`) as the project's own record that the duplication is deliberate. Annotated duplication isn't flagged, and the annotation's reason is surfaced in context so a future agent sees *why* the blocks diverge before attempting to "helpfully" deduplicate them.

---

## Resiliency

Code that assumes the network never fails is code that fails in production the first time it does.

| Pattern | Why it matters |
|---|---|
| Network I/O with no retry | A transient failure surfaces as a hard user-facing error instead of resolving itself |
| Retry with no backoff or no attempt cap | Immediate or unbounded retries amplify load on a struggling downstream — the retry storm becomes the outage |
| No fallback or degraded path on a dependency failure | One downstream failure takes down the entire request instead of degrading gracefully |

Severity is calibrated to project type: a backend service's outbound calls are held to this bar; a CLI tool making one request at invocation, or an SDK that just wraps a fetch call and lets the caller decide retry policy, isn't penalized for not owning a concern that belongs to its caller. Decide which network calls this applies to during `karen init` based on the project's actual architecture, not a blanket rule.

**The generated check must scan every source file in the package this applies to, not just the file where the pattern was first spotted during `karen init`.** An outbound HTTP/RPC call with no retry in `handler.go` and the identical pattern one file over in `priority.go` are two instances of the same finding — a gate hardcoded to check only the file that happened to surface the pattern during analysis will pass a sibling file with the exact same defect. Write the check as a structural scan (same call-site AST/pattern match this dimension uses elsewhere) over the whole package/directory the profile applies to, discovered fresh on every run, the same way the personal-data-registry check above discovers new stores instead of only re-checking a snapshot list.

---

## Performance & resource bounds

Unbounded resource use is invisible in a demo and fatal at scale.

| Check | Pass condition |
|---|---|
| Unbounded payload/collection size | Every externally-influenced read (file upload, DB query, paginated API response) has an explicit size, row, or byte cap |
| Eager heavy imports or startup cost | Expensive imports, subprocess spawns, or network calls at module load time are deferred until the feature that needs them actually runs |

Which of these apply depends on project type — a request-handling backend is held to explicit payload caps; a one-shot CLI script usually isn't. Decide during `karen init`.

---

## Observability & operational readiness

Code that can't be debugged in production is incomplete.

| Check | Pass condition |
|---|---|
| Structured logging | Log statements emit structured data, not raw interpolated strings |
| Error propagation | Errors not swallowed; all catch blocks handle or re-throw |
| Health endpoint | Services expose a health check endpoint |
| Graceful shutdown | Long-running processes handle termination signals and drain |
| Correlation IDs | Request context propagated through async call chains |

Which of these apply depends on project type. A CLI tool doesn't need a health endpoint. A production API does. Decide during `karen init`.

---

For poly-repo/monorepo scoping of every gate above, see `monorepo.md`. For deployment-context-specific additions (browser, server, AI-agent-runtime), see `deployment-profiles.md`. For the full `.karen.json` schema these mechanisms write to, see `karen-json-schema.md`.
