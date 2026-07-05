# Karen vs. `web-researcher-mcp` — A Reality Check

A comparative read of [BLUEPRINT.md](./BLUEPRINT.md) (Karen's design spec) against a real,
mature project: [`web-researcher-mcp`](/opt/homebrew/var/www/GitHub/web-researcher-mcp) — a
solo-maintained, MIT-licensed Go+Python MCP server with ~800 lines of README, ~5,000 lines
of `docs/`, a 23-standards compliance deck, and CI enforcing doc/schema/annotation drift on
every PR.

This document is read-only research. Nothing in either project was modified to produce it.

---

## 1. How would Karen behave against this project, today?

Karen doesn't exist yet — this is a walkthrough of what `karen init` / `karen audit` would
plausibly do, reasoning from BLUEPRINT.md's stated behavior.

### `detect_project` output

Karen would detect a **poly-repo-flavored single project** (BLUEPRINT.md §"Poly-repo &
Monorepo Structure" — the profile is not a clean monorepo of independent subprojects, but one
Go module with a bundled Python client under `python/`, which is closer to fixture-9-style
`subprojects[]` treatment than a true `node-monorepo`-style split):

- **Manifests:** `go.mod` (Go 1.25.11), `pyproject.toml` (Python client + test config).
- **Languages:** Go (primary/server), Python (SDK client + build scripts).
- **Frameworks/deps:** `modelcontextprotocol/go-sdk`, go-rod+stealth, bluemonday, prometheus
  client, go-redis, golang.org/x/time — all MIT/Apache/BSD, consistent with the project's own
  "Minimum dependencies... justify in PR" rule (`CLAUDE.md` Security Rule 10).
- **CI config:** `.github/workflows/{ci.yml,codeql.yml,docs.yml,release.yml}`.
- **Existing test setup:** `go test -race ./...`, `-tags=e2e`, `-tags=live`, plus a labeled
  gold-set precision/recall eval (`make test-eval`) and a full Python test suite (`make
  test-python`).
- **Agent-context files:** `CLAUDE.md` (199 lines) present and unusually rigorous; `AGENTS.md`,
  `.cursorrules`, `.github/copilot-instructions.md` absent.
- **Existing quality gates:** an enormous amount of pre-existing enforcement — `golangci-lint`,
  `gosec`, `govulncheck` (all pinned via `go.mod` `tool` directives), CodeQL
  (`security-extended,security-and-quality`), a docs-drift test (`TestToolsDocMatchesRegistry`),
  a Python-drift test, an annotation-coverage test (`TestAllToolsHaveAnnotations`), an
  embedded-lens-drift test, and a git pre-commit hook (`.githooks/`, `make hooks`).
- **Unclaimed paths:** likely none of consequence — `bin/install.sh` and `scripts/` are
  explicitly claimed and documented in `CLAUDE.md`'s architecture map; the two `Dockerfile`s
  and two `install.sh` variants are explicitly justified in prose ("Two Dockerfiles are
  intentional...Two installers are intentional..."), which is itself the kind of note the
  Unowned Root-Level Code check exists to demand.

### The interview

Given how much `detect_project` can already answer from `CLAUDE.md` alone (commands, design
rules, security rules, doc structure, reference-docs table), a well-implemented Karen should
ask very little. Per BLUEPRINT.md's own principle ("questions adapt to what was already
discovered"), a good interview here would:

- **Skip:** linting/formatting setup (`golangci-lint` pinned and documented), test runner
  (`go test -race`, documented), security scanning tool choice (`gosec`/`govulncheck` already
  named), commit format (already specified in `CLAUDE.md`), how to add a tool/provider
  (`EXTENSION_GUIDE.md` + `CLAUDE.md` already answer this exhaustively).
- **Must ask unprompted** (signal in source/docs that `detect_project` can't classify without a
  judgment call):
  - **Is this project itself "AI-powered" per the ai-agent deployment profile, or "built by AI
    coding agents" only?** This is the exact ambiguity EVALS-PLAN.md §10 flags for fixtures 3/7/11
    — and `web-researcher-mcp` makes an unusually explicit, documented argument for its own
    answer: `docs/SECURITY_AND_COMPLIANCE.md`'s OWASP Agentic Top 10 row says the project owns
    "the tool-provider slice only" and explicitly disclaims "goal/intent manipulation, cascading
    hallucination, multi-agent trust, the agent permission model" as **host-owned**. A good
    interview surfaces this distinction rather than assuming; a bad one either skips the
    ai-agent profile entirely (missing LLM01/LLM05/LLM06 relevance) or wrongly treats it as a
    full "runtime IS an AI product" case and demands host-side controls this server explicitly
    and correctly says aren't its job.
  - **Deployment context split (STDIO vs. HTTP).** The security posture bifurcates hard
    (`docs/SECURITY.md` Principle 4: "STDIO is zero-trust-by-default"). Karen's `browser-direct-js`
    vs. `node-server` profile selection logic doesn't map cleanly onto "one binary, two postures
    depending on an env var" — this needs a human answer, not a manifest scan.
  - **Regulated-data tiers (memory, analytics, workspace).** These are opt-in, consent-gated
    features (`internal/consent`, `internal/datasubject`) that don't exist until an operator
    turns them on. Karen can't know from static analysis alone whether this deployment will ever
    activate them — but if it does, GDPR/CCPA gate requirements change materially.
  - **Compliance-deck claims vs. code.** `decks/compliance/compliance-deck.md` asserts 23-standard
    alignment. A careful interview would ask whether the maintainer wants Karen's Compliance
    Artifacts gate to *verify* deck claims against code (the deck itself invites this — "Read the
    code, not the marketing" — its closing slide) or treat the deck as out of scope.
- **Must NOT ask** (already answerable): supply-chain scanning tool choice, release signing
  mechanism (`docs/RELEASE_SIGNING.md`), SSRF defense approach (`docs/SECURITY.md` Layer 1, in
  exhaustive detail), how audit logs are redacted (`audit.MaskSecrets`, documented function name
  and file).

### Generated gates — what Karen would (and wouldn't) need to write

This is the most interesting outcome: **most of Karen's default gate surface is already
covered**, and by BLUEPRINT.md's own "Reconciling Existing Quality Tooling" rule, Karen should
generate *nothing* for a dimension `existingGates[].coverage[]` already marks `scope: full`.

| Karen's dimension (BLUEPRINT.md §"What Karen Knows") | Existing coverage in this project | Karen's correct move |
|---|---|---|
| Supply Chain & Dependencies | `govulncheck`, `gosec`, CodeQL, Dependabot, `go mod verify`, dependency policy in `CLAUDE.md` Security Rule 10 | Reconcile as `scope: full`; generate nothing |
| Security & Trust Boundaries (zero-tolerance secrets/injection) | `gosec`, `.gitguardian.yaml`, `audit.MaskSecrets`, `subtle.ConstantTimeCompare` rule already codified in `CLAUDE.md` | Mostly `scope: full`; a partial gap may remain (see §3) |
| Code Completeness / Known Gaps | `docs/LESSONS_LEARNED.md`, GitHub Issues (`#94`, `#85`, `#108` etc. referenced inline in docs) are the de facto backlog | Karen's `knownGaps[]` schema wants a typed `kind` + tracker; this project tracks gaps via prose + issue numbers, not a structured file — a reconciliation gap, not a missing capability |
| Documentation Fidelity | `TestToolsDocMatchesRegistry`, `TestOutputSchemaMatchesResponse`, `TestToolDescriptionQuality`, docs-drift CI job | `scope: full` — likely stronger than Karen's own baseline check (see §2) |
| Compliance Artifacts | `docs/SECURITY_AND_COMPLIANCE.md` Standards Alignment table + compliance deck | Partial — deck/table exist, but nothing mechanically checks they still match code (see §3) |
| Test Integrity | `go test -race`, E2E build tags, a **labeled-gold-set precision/recall eval** (`make test-eval`) that "fails on any false positive" | `scope: full`, and arguably exceeds Karen's baseline expectation (see §2) |
| Agent Context Engineering | `CLAUDE.md` present, structured, drift-tested against itself in spirit (docs guidelines demand file+function references); `AGENTS.md`/`.cursorrules` absent | Karen would likely flag: no `AGENTS.md`/`.cursorrules` fallback for non-Claude agents, even though `CLAUDE.md` explicitly claims to be "Rules the AI writes by... for Claude / Copilot / Cursor" |
| Observability & Operational Readiness | Prometheus metrics, `diagnostics://` resources, admin dashboard, audit logging with request correlation | `scope: full` |
| Poly-repo & Monorepo Structure | Go+Python split is real but is not a `subprojects[]`-style independent-package layout; more like "one product, two SDKs" | Karen would need a judgment call here — likely a single `codeRole` with the Python client treated as a generated-artifact subdirectory, not a true subproject |

**Net effect:** a well-implemented Karen `karen init` on this project should generate very
few new gate scripts. Its highest-value contribution would be at the *reconciliation and gap*
layer — turning implicit backlog references and prose compliance claims into Karen's own typed,
trackable schema — not at inventing new checks the project lacks.

---

## 2. What does this project have that Karen's blueprint doesn't articulate?

Real, load-bearing practices in `web-researcher-mcp` with **no corresponding concept** in
BLUEPRINT.md:

1. **Consent-gated, purpose-typed personal-data primitives as first-class architecture.**
   `internal/consent` (record → verify → honor, fail-closed `HasConsent(ctx, Purpose)` per call
   site) and `internal/datasubject` (a *registry* every personal-data store must join, fanning
   `(tenant,user)` export/erasure requests across all of them) go well beyond BLUEPRINT.md's
   Compliance Artifacts table, which treats compliance as documentation to check for, not as a
   structural registry pattern to verify code *implements*. Karen's blueprint has no mechanism
   that would catch "a new feature stores personal data but forgot to register its Eraser" —
   this project's own CI does, via a dedicated release-gate test (`internal/session/
   datasubject_test.go`, "the #85 release gate," per the compliance deck).

2. **A tiered compliance model, where higher tiers earn more infrastructure.** The
   "Tier 1–4" model in `docs/SECURITY_AND_COMPLIANCE.md` (core retrieval → analytics →
   machine-formatted output → personalization) is a genuinely different design idea from
   anything in BLUEPRINT.md's Compliance Artifacts section: compliance *scales with which
   features are turned on*, not with a static profile choice made once at `karen init` time.
   Karen's `.karen.json` has no equivalent of "this gate only applies once feature X is enabled."

3. **An explicit, load-bearing "controls vs. certificate" honesty line.** The
   Operator & Hosted-Service Responsibilities table (who owns what across project /
   operator / hosted-SaaS) is a mature articulation that BLUEPRINT.md doesn't have a slot for:
   Karen's Compliance Artifacts gate as written checks for the *presence* of compliance
   documents, not whether those documents correctly scope what a repository can and cannot
   promise on behalf of a deploying organization. This project's docs draw that line explicitly
   and repeatedly ("read the code, not the marketing"); Karen's blueprint has no mechanism that
   would flag an *overclaiming* compliance doc as a defect, only a missing one.

4. **A named, agentic-specific threat this server itself creates, with an architectural
   answer.** "Agency sharpens one old threat (SSRF) and adds a new one (indirect prompt
   injection)" — the trust-boundary marker (`"trust": "untrusted-external-content"`, in the
   envelope, never in content, enforced by a cross-tool drift test) is a concrete pattern for
   **outbound** LLM-facing trust labeling. BLUEPRINT.md's ai-agent profile covers OWASP LLM01
   (prompt injection) only from the angle of *this project being built by agents* or *this
   project being an LLM-app surface that itself must resist injection from users* — it has no
   language for "this tool's job is to fetch attacker-controlled content and hand it to a
   downstream model it doesn't control," which is a third, distinct role this project occupies
   (content producer for someone else's agent loop) that the blueprint's two ai-agent sub-cases
   don't cleanly capture.

5. **A drift-test philosophy applied to *documentation itself*, not just gate behavior.**
   `TestToolsDocMatchesRegistry`, `TestOutputSchemaMatchesResponse`, `TestToolDescriptionQuality`
   parse `docs/TOOLS.md` at build time and fail CI on any mismatch with the live tool registry.
   BLUEPRINT.md's Documentation Fidelity section checks that docs *exist* and *aren't
   obviously stale*, but doesn't describe machine-parseable doc-as-spec enforcement to this
   degree (parsing markdown headers as a contract, enforced every PR, including docs-only PRs).
   This is a stronger, more mechanical instantiation of "structural over textual" than
   BLUEPRINT.md's own principle 5 currently describes for *docs* specifically (the principle is
   scoped to security gates in the blueprint text).

6. **A labeled gold-set precision/recall eval for the product's own trust logic** (`make
   test-eval`, `internal/tools/trust_eval_live_test.go` — "fails on any false positive"). This is
   the project applying an OWASP-Benchmark-style methodology to its *own domain-classification
   signal* (source trust scoring), independent of any blueprint or eval-harness concept. Karen's
   Test Integrity section talks about coverage and E2E-only branches, not about a project running
   its own internal precision/recall eval against a hand-labeled ground truth set — which is,
   notably, structurally identical to what this repo's own `evals/` benchmark does for Karen
   (§4.4). Neither BLUEPRINT.md nor Karen's design currently asks "does the target project itself
   maintain this kind of eval for its non-security-critical accuracy claims?"

7. **Two-installer / two-Dockerfile intentional duplication, justified inline.** BLUEPRINT.md's
   Unowned Root-Level Code check would likely flag `install.sh` + `bin/install.sh` and two
   `Dockerfile`s as suspicious duplication unless it reads the prose justification in `CLAUDE.md`
   line 73. This project's answer — "explain the duplication in the agent-context file itself so
   an agent doesn't 'fix' it" — is a practice with no named slot in BLUEPRINT.md's Agent Context
   Engineering table (which covers *presence* of context files, not this specific *defensive
   annotation of things that look wrong but aren't* pattern).

---

## 3. What does Karen's blueprint require that this project may be missing?

Genuine gaps, evaluated against BLUEPRINT.md's own stated mechanisms — not just "things Karen
would generate a gate for," but specific requirements the blueprint states explicitly:

1. **No `AGENTS.md` or `.cursorrules`.** BLUEPRINT.md's Agent Context Engineering table lists
   `CLAUDE.md`/`AGENTS.md`/`.cursorrules` as the check, precisely because different agent
   ecosystems read different files. `CLAUDE.md` here explicitly says its rules are meant for
   "Claude / Copilot / Cursor" — but Cursor reads `.cursorrules` (or `.cursor/rules/`), not
   `CLAUDE.md`, and Copilot reads `.github/copilot-instructions.md`, neither of which exists.
   This is a real, checkable gap: the intent is stated but the mechanism to reach non-Claude
   agents is absent.

2. **No content-hash fingerprinting / circuit-breaker equivalent for its own internal drift
   gates.** BLUEPRINT.md's Run State mechanism exists specifically so repeat violations are
   tracked *per issue*, survive line drift, and escalate (staleCount → circuit breaker) rather
   than being re-reported identically forever. This project's CI gates (`docs-drift`,
   `python-drift`, `gosec`, `golangci-lint`) are binary pass/fail per run with no persistent
   state across runs — there's no mechanism analogous to "this exact violation has now failed
   3 times unchanged, escalate," because Karen's specific delta-feedback/circuit-breaker
   *stateful* loop is a Karen-specific concept this project has no reason to have built
   independently. This is the cleanest example of "blueprint articulates something genuinely
   absent," as opposed to "present under a different name."

3. **No expiry-dated exceptions distinct from open-ended known gaps.** BLUEPRINT.md's Known
   Gaps vs. Exceptions split (no-expiry tracked gap vs. dated temporary exception that becomes
   a failure once passed) has no visible equivalent here. The roadmap section of
   `docs/SECURITY.md` ("DPoP token binding," "hash-chained audit logs," etc.) is a known-gaps
   list in spirit but has no expiry dates and isn't machine-checked — there's nothing that would
   fail a build if, say, "UK Cyber Essentials certification" silently sat in the roadmap for two
   years past an implicit target. Karen's `exceptions{}` schema with a hard `expires` date has
   no analog.

4. **Compliance-deck claims are not mechanically verified against code**, despite the deck's own
   "each claim names the file that backs it" promise. That promise is enforced by *convention and
   review*, not by a test. This is the one place where the deck's own stated design principle
   ("the docs are tested, not trusted" — a whole slide of the deck) doesn't yet cover *itself*:
   the 23-standard table and the 8-properties claim are asserted in three different documents
   (deck, `SECURITY_AND_COMPLIANCE.md`, `SECURITY.md`) with no drift test tying them together
   the way `TestToolsDocMatchesRegistry` ties `docs/TOOLS.md` to the tool registry. BLUEPRINT.md's
   Compliance Artifacts gate, if implemented faithfully, is exactly the missing mechanical check.

5. **No visible cross-subproject consistency check for the Go/Python split.** BLUEPRINT.md's
   Cross-Subproject Consistency mechanism looks for repeated security-relevant patterns (e.g. a
   sanitization rule) enforced in one subproject but silently absent in a sibling. The
   Go→Python client is code-generated (`make gen-python-client`) and drift-tested for *schema*
   parity, but nothing in the visible docs checks that a *security* pattern added to the Go
   server (e.g. a new redaction rule) is meaningfully mirrored in the Python client's own
   handling of secrets/keys, since the Python client is a thin HTTP wrapper and largely inherits
   server-side guarantees — this may be a non-issue in practice, but it's exactly the kind of
   judgment call the blueprint's cross-subproject check exists to make explicit rather than
   assumed.

6. **`exceedsBaseline[]` reporting is implicit, not structured.** The project clearly exceeds
   many baselines (FIPS build option, cosign+SBOM+Syft, OAuth 2.1 with DPoP on the roadmap,
   consent primitives) — but this is communicated entirely through prose ("what compliance means
   for this project," the compliance deck) rather than through any structured, reassessed-per-
   release mechanism resembling Karen's `exceedsBaseline` schema. This isn't a defect so much as
   confirmation that the *concept* Karen names is real and valuable here, just currently
   expressed as marketing/docs rather than as machine-checkable metadata.

---

## 4. Does the evals benchmark cover what this real project's requirements demand?

Short answer: **the benchmark's 10 dimensions and 12 fixtures cover Karen's core mechanics well
but were not designed against this shape of project, and this project surfaces at least three
real gaps in the benchmark's coverage.**

### Where the benchmark's existing design already covers this project's shape well

- **Fixtures 3/7/11 (`node-mcp-server-single`, `go-mcp-server-single`, `python-mcp-server-single`)**
  exist specifically to stress the MCP-server `aiPowered` classification ambiguity — and
  EVALS-PLAN.md §10 explicitly names this as an open, deliberately-not-defaulted question. This
  project **is** exactly that ambiguous case in the wild, and its own docs resolve the ambiguity
  explicitly (§1 above) — meaning this project is genuinely useful evidence for finally deciding
  `expected-karen.json`'s `aiPowered` value for those fixtures, rather than deciding it in the
  abstract.
- **§4.4 (planted-issue precision/recall) and its decoy methodology** map directly onto what this
  project already does to itself via `make test-eval`'s labeled gold set "fails on any false
  positive" rule — the benchmark's central dimension and this project's own internal QA
  philosophy are the same idea, applied to different targets (Karen's gates vs. this project's
  trust-scoring signal).
- **§4.9 (Reconciliation)** is the dimension most directly exercised by this project's actual
  situation: an enormous amount of pre-existing `existingGates`-shaped tooling (`golangci-lint`,
  `gosec`, docs-drift, annotation-coverage) that a correct Karen must reconcile against rather
  than duplicate. Fixture 4 (`node-monorepo`) tests this with one `check-docs.mjs` script; this
  real project would stress it with **six or more** existing gates simultaneously — a
  meaningfully harder version of the same test.

### Gaps the benchmark does not currently cover, exposed by this project

1. **No fixture models a project with a datasubject/consent registry pattern.** None of the 12
   fixtures' `fixture-manifest.json`/`expected-karen.json` shapes have a slot for "personal-data
   stores must each register an exporter/eraser" as a structural pattern to detect and reconcile.
   Since §2 above identifies this as a real practice BLUEPRINT.md itself doesn't articulate, the
   benchmark inherits that same blind spot by construction — it can't grade Karen on a mechanic
   neither the blueprint nor any fixture describes. This is a benchmark gap that traces directly
   back to a blueprint gap, not an independent oversight.
2. **No fixture stresses the "tiered compliance, feature-gated infrastructure" idea.** Fixture 9
   (`python-sdk-single`) tests known-gaps-vs-exceptions classification but not "this compliance
   requirement only activates once feature X is turned on" — a genuinely different shape of
   correctness than a static known-gap/exception label.
3. **No fixture plants a *documentation-overclaim* decoy** — a compliance doc or `CLAUDE.md`
   claim that doesn't match the code, distinct from `planted-issues.json`'s code-level decoys.
   §3.4 above shows this is a real risk category even in a project this disciplined; the
   benchmark's Documentation Fidelity coverage lives inside §4.3 (`.karen.json` accuracy) and
   §4.9 only implicitly, with no dedicated planted "doc says X, code does Y" ground-truth case.
4. **The benchmark's monorepo fixtures (4, 8, 12) model peer subprojects, not a
   "one product, two SDKs where one is code-generated from the other" shape.** This project's
   actual structure — a canonical Go server with a generated Python client — doesn't map cleanly
   onto any of the three monorepo fixtures' `subprojects[]` ground truth, which all assume
   independently-authored sibling packages. This is a real repo shape (SDK generation pipelines
   are common) that the current 12-fixture matrix doesn't represent, and EVALS-PLAN.md §2 itself
   flags the matrix as "a v1 set... nothing here is exhaustive."
5. **No dimension grades "does Karen correctly decline to generate a gate for something the
   project already exceeds the baseline on."** §4.9's reconciliation check is about not
   *duplicating* existing coverage; it doesn't test the `exceedsBaseline[]` reporting path itself
   (whether Karen correctly recognizes and records a strength like "FIPS build option" or
   "consent primitives" as exceeding baseline, rather than either ignoring it or wrongly treating
   it as a gap). No fixture currently plants a deliberate exceeds-baseline signal for a grader to
   check against.

### Verdict on §4's question specifically

The benchmark faithfully covers everything BLUEPRINT.md itself specifies — that's exactly what
it was built to do, and the earlier self-test results (120/120 golden checks, 105/120 broken
checks failing exactly their declared flaws) confirm it does that correctly. But "requirements
and assessments required by [this real] project" is a strictly larger set than "mechanics
BLUEPRINT.md articulates," because — as §2 shows — this real project has independently
converged on compliance/privacy patterns (consent registries, tiered compliance, doc-overclaim
defense) that the blueprint hasn't caught up to yet. The benchmark cannot be blamed for not
testing blueprint mechanics that don't exist; but EVALS-PLAN.md §10's own "fixture realism" risk
— explicitly naming "promoting a real project's anonymized structure into a 13th fixture" as the
correction mechanism — is precisely what this project is a strong candidate for. If a 13th
fixture is ever added, this project (anonymized) would be a better stress test than any of the
12 hand-authored ones for the SDK-generation-pipeline shape and the compliance-as-architecture
pattern specifically.

---

## Summary

| Question | One-line answer |
|---|---|
| 1. How would Karen behave? | Detect a Go+Python MCP server; ask few questions (most answered by `CLAUDE.md`); generate very few new gates because most dimensions are already at `scope: full`; the one real interview question worth asking is the `aiPowered`/tool-provider-vs-AI-product framing this project already argues for itself |
| 2. What does the project have that the blueprint misses? | Consent/datasubject registry pattern, tiered feature-gated compliance, an explicit controls-vs-certificate honesty line, a third "content producer for someone else's agent" LLM-risk role, doc-as-enforced-spec drift testing, and a self-applied labeled-eval methodology |
| 3. What does the blueprint require that the project may be missing? | No non-Claude agent-context file, no stateful fingerprint/circuit-breaker equivalent for its own drift gates, no expiry-dated exceptions, no mechanical crosswalk tying the compliance deck's claims to code, no explicit cross-subproject security-pattern check for the Go→Python generation boundary |
| 4. Does the evals benchmark cover this project's real requirements? | It fully covers everything BLUEPRINT.md specifies (verified by self-test), but inherits the blueprint's blind spots (consent registries, tiered compliance, doc-overclaim decoys, SDK-generation-shaped monorepos) — making this project a strong candidate for a future 13th, real-project-derived fixture |
