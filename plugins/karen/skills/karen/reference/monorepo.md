# Poly-repo & monorepo structure

**Root `project.type` is never `"monorepo"`** — it must be one of the same software-kind labels used for subprojects (`service`, `library`, `application`, `cli-tool`, `mcp-server`, `root-utility`, or a project-specific label). Monorepo-ness is already conveyed by a populated `subprojects[]` array, so overloading `.type` with a structural label is redundant and schema-incompatible. When subprojects are explicit peers with no primary, pick one of the peers' own kind labels for the root rather than inventing a new value. See `karen-json-schema.md`.

Not every project is one manifest at the root. `detect_project` (see `detect-project.md`) walks the tree and reports every manifest it finds (`package.json`, `pyproject.toml`, `go.mod`, `Gemfile`, `Cargo.toml`, at any depth) — a project with more than one is a poly-repo or monorepo, whether or not it declares workspaces. Don't silently audit the first manifest found and call the rest out of scope; treating a multi-package repo as single-package is a coverage gap, not a simplification.

## Every gate that can be scoped by directory declares that scope explicitly

The JS/TS `testRunner.packages` list (see `deployment-profiles.md`) is the template — apply the same shape to every gate, generalized to whatever manifest kind the project uses:

| Gate | Per-subproject scoping |
|---|---|
| Gate 1 (supply-chain) | Runs the dependency auditor once per manifest found (`npm audit` per `package.json`, `pip-audit` per `pyproject.toml`, etc.) — not once at the root guessing which lockfile applies. Results are reported per subproject. |
| Gate 2 (completeness) | Scans each subproject's source tree independently; a stub in `apps/harness` and a stub in `sdk` are two distinct findings, not merged into one root-level count. |
| Gate 3 (security) | Same source-tree walk as gate 2, plus the working-tree secret scan (inherently root-wide — secrets don't respect package boundaries). |
| Gate 4 (docs-parity) | Each subproject's own README/docs are checked against its own source; a root README describing the whole repo is checked separately against the union of public entry points, not against any one subproject's internals. |
| Gate 5 (compliance) | Compliance artifacts (`SECURITY.md`, `LICENSE`, etc.) are checked at the root by default — most compliance requirements apply repo-wide — unless the interview identifies a subproject with its own distinct compliance regime (e.g. one app is SOC2-scoped, others aren't), in which case that subproject gets its own artifact set and the regime is **not** also duplicated into the root's `compliance[]` — see `karen-json-schema.md`'s `compliance[]` section. |
| Gate 6 (test-integrity) | As specified in `testRunner.packages` — see `deployment-profiles.md`. |
| Gate 7 (agent-context) | Checks for an agent context file at the root and, separately, per subproject where one plausibly should exist (a subproject with its own independent build/test/deploy lifecycle) — a root-only `CLAUDE.md` that doesn't mention a subproject's distinct conventions is a finding, not silently adequate. |

**During `karen init`,** once `detect_project` reports multiple manifests, ask which are audited and how — mirroring the gate-6 interview question ("which package, if any, is primary?") for every gate that needs it, rather than assuming a single global answer applies to all of them. `.karen.json` records subprojects explicitly (see `testRunner.packages` for the shape); other gates that need per-subproject scope follow the same `{ path, ... }` list convention under their own config key (e.g. `docsParity.packages`, `complianceArtifacts.scope`).

**`knownGaps` and `exceedsBaseline` scope per subproject too, the same as the numbered gates above.** A strength or a tracked gap that holds for one subproject doesn't hold for all of them just because they share a root `.karen.json` — a module with zero runtime dependencies sitting next to a sibling module that has a real dependency is a strength for the first module only. Check each subproject's own manifest/tooling independently rather than answering the "does this project exceed baseline / have a known gap" question once for the whole repo, and name the specific subproject in the entry's own `note`/`reason` text (e.g. `"backend module has zero runtime dependencies"`, not `"zero runtime dependencies"`) so the strength or gap doesn't read as repo-wide when it isn't.

## Cross-subproject consistency

Per-subproject scanning has a blind spot: it can't see that N subprojects independently reimplement the same security-relevant pattern and have quietly drifted apart. A repo with five reference apps that each run "server holds the credential, mints a short-lived token, exposes an API" is not five unrelated codebases — it's one pattern repeated five times, and the interesting defect is the one app that dropped a check the other four still have. Gate 2 and Gate 3, scoped purely per-directory, will happily report each app clean while missing that exact divergence.

**Add a cross-subproject consistency check whenever the interview or `detect_project` surfaces a repeated structural pattern across subprojects** — same role (e.g. multiple apps built as reference implementations on the same SDK, multiple services fronting the same kind of credential), same shape of security-relevant logic, implemented independently in each. During `karen init`, once the subproject list is established, ask: *"`apps/*` all look like they follow the same server-holds-secret-and-mints-tokens pattern — should Karen check that they all apply the same security-relevant checks (origin validation, token scope, auth guard placement), not just that each one individually passes?"* If confirmed, add a dedicated check — registered as its own entry in `.karen/harness.json` (not folded into gate-3, since its unit of analysis is "the set of subprojects" rather than one directory) — that extracts the shared pattern's key invariants from each implementation and flags any subproject whose implementation diverges from the others without a documented reason. This is intentionally light — not attempting semantic equivalence, only "did the same security-relevant control show up in every place the same pattern was implemented."

```json
"crossSubprojectConsistency": [
  {
    "pattern": "server holds admin secret, mints short-lived client token, exposes REST API",
    "subprojects": ["apps/ai-trainer", "apps/teaching-avatar", "apps/presentation-agent", "apps/earnings-avatar", "apps/harness"],
    "invariants": ["origin/CORS check present", "token scope excludes admin operations", "no secret in any response body"]
  }
]
```

**The pattern above assumes every subproject is independently hand-maintained. A subproject can instead be code-generated from another subproject** — a client SDK generated from a server's OpenAPI spec or route table, a proto-generated package — where the risk isn't independent drift, it's the generator having been run against a stale version of its source, or someone hand-editing generated output afterward. Recognize this shape when the interview or `detect_project` finds a generator config (`openapi-generator`, `protoc`, a `codegen` script) pointing from one subproject at another, and check two things instead of the "same invariant, N implementations" check above: (1) the generated subproject's tracked generation-marker — a header comment naming the source spec and a hash/version of it — matches the current state of the source subproject, and (2) no generated file has been hand-edited after generation, tracked separately from the marker check as a diff between what the generator would currently produce and what's committed. Both are reported under the same `crossSubprojectConsistency[]` entry shape, distinguished by an added `"kind": "generated"` field (omitted or absent means the independently-maintained shape above).

## Unowned root-level code

Manifest-driven subproject detection assumes every file of interest lives under some manifest's directory. It doesn't. Credential-handling CLI scripts, cross-cutting verify/lint scripts, and language-mixed utility files (a Python capture server in an otherwise all-JS repo, with no `pyproject.toml` anywhere) commonly live at the root or in a shared `tools/`/`scripts/` directory that no manifest claims. Don't silently exclude these from every gate just because they fall outside a detected subproject boundary — that's precisely where credential-handling and cross-cutting logic tends to live, and skipping it is a coverage gap disguised as scoping.

`detect_project` reports a project's **unclaimed paths**: files matching source extensions for any detected language that don't fall under a directory owning a manifest for that language. During `karen init`, surface this list and ask how it should be scoped — typically as its own pseudo-subproject (`{ "path": "tools/", "type": "root-utility", ... }` in `.karen.json`) so gates 2, 3, and 7 still walk it, rather than defaulting to "no manifest, no coverage."
