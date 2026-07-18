# Configuration: `.karen.json`

The manifest written after `karen init`. Captures what was learned and what choices were made. Owned by the project, versioned with it.

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
    { "gate": "gate-1-supply-chain", "note": "Zero runtime dependencies" },
    { "gate": "gate-5-compliance", "note": "SECURITY.md maps HIPAA, HITRUST, OWASP LLM Top 10, and avatar/deepfake law control-by-control — beyond the minimum artifact-presence bar" }
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

## `project.subprojects`

Overrides the root profile for a poly-repo with mixed risk surfaces. A single global `type`/`deployment`/`audience`/`aiPowered` assumes the whole repo carries one risk profile — false the moment a repo mixes, say, a zero-dependency enterprise library with a demo app that calls an LLM at runtime and a throwaway internal CLI tool. Each entry is scoped by `path` and overrides only the fields it sets; anything omitted inherits the root profile. This is what lets the security gate add OWASP LLM checks to one subproject specifically without forcing every other subproject through the same runtime-AI checklist, and what lets the compliance gate hold only the SOC2-scoped subproject to SBOM/audit-log requirements instead of the whole repo. During `karen init`, once `detect_project` reports multiple manifests, ask the profile questions (type, deployment, audience, AI-powered) once per subproject that looks structurally independent (own manifest, own lifecycle) rather than assuming the first answer applies everywhere.

**Root `project.type` must always be one of the same software-kind labels used for subprojects** (`service`, `library`, `application`, `cli-tool`, `mcp-server`, `root-utility`, or a project-specific label) — never a structural shape like `"monorepo"`. Monorepo-ness is already conveyed by a populated `subprojects[]` array; `project.type` answers "what kind of thing is the root profile," a different question. When subprojects are explicit peers with no primary (the interview surfaces no reason to treat one as dominant), pick one of the peers' own kind labels for the root rather than inventing a new enum value.

**Every `subprojects[].deployment` (and the root `project.deployment`) draws only from the fixed profile list in `deployment-profiles.md`** (`browser-direct-js`, `browser-iframe`, `node-server`, `python`, `ai-agent`, `mcp-stdio`) — never append the project's implementation language into this array. Language belongs solely in `project.language`.

**`subprojects[].codeRole`** answers "what kind of code is this, independent of type/deployment/audience" — `reference-app`, `debug-tool`, `root-utility`, or a project-specific label the interview settles on. Distinct from `testRunner.packages[].role` (below), which is about coverage-reporting role, not what the subproject's code is for. It's what lets a security zero-tolerance check flex per subproject (see the `browser-direct-js` profile in `deployment-profiles.md`) without touching the check's rationale for every other subproject.

**`subprojects[].agentActions.scope`** (`least-privilege` vs. `maximal`, each with a `reason`) tells the excessive-agency check which bar applies to that subproject's tool-calling surface — a customer-facing app is held to a narrow allow-list; an internal "everything-agent" test harness is expected to be broad and checked against a different, explicitly-declared bar instead.

## `compliance[]`

Entries are either unconditional (a plain string) or feature-gated (an object with `activatesWhen`) — see Tiered, Feature-Gated Compliance in `quality-dimensions.md`. A gated entry's artifact requirements only join the harness once the named feature is confirmed built; until then it's tracked and surfaced in the `karen init` summary but not yet enforced.

**When a compliance regime is scoped to one subproject only** (the interview identifies it as that subproject's own distinct regime, not repo-wide — see Gate 5 in `monorepo.md`), it belongs solely in that subproject's own `compliance[]` entry. Do not also duplicate it into the root-level `compliance[]` array — root `compliance[]` is reserved for regimes that apply repo-wide. A regime that gates on a feature flag not yet built still needs its own `activatesWhen` entry (not just a `knownGaps`/notes mention) wherever it's scoped — the entry itself is the mechanism `karen init`'s summary surfaces it through; prose-only tracking defeats that purpose.

## `personalDataRegistry`

Names the registry (or fan-out mechanism) every personal-data store is expected to join — see Personal-Data Registry Pattern in `quality-dimensions.md`. `path` is the registry's own source file; `stores` is a best-effort list of personal-data stores found during `detect_project`/interview, checked each run against the registry to catch a new store that never joined. Omit entirely for projects with at most one personal-data store, where fan-out has nothing to miss.

## Exceptions are first-class, not workarounds

Every exception needs a reason and an expiry date. Expired exceptions are gate failures.

**`exceptions[].pattern` is a short, minimal matchable token** — e.g. `"console.log"`, `"TODO"` — not the full offending line or sentence. The gate's own exception matcher does substring containment against this pattern, so a short token still matches correctly; a verbose pattern (the entire offending statement copied verbatim) works too but is needlessly brittle to reformat and harder to review. Keep it to the shortest string that uniquely identifies the exempted construct.

## Five mechanisms, easy to confuse

| Mechanism | What it's for | Decays? |
|---|---|---|
| Generated gate (`.karen/gates/`) | A Karen-authored check wired to a tool, for a dimension (or the slice of a dimension) the project has no existing coverage of | No — lives until superseded |
| `existingGates` | A pre-existing project quality gate that's called and normalized instead of generating a competitor — `coverage[]` records which gates it satisfies and how fully, many-to-many (see `reconciliation.md`) | No — lives as long as the project keeps the gate |
| `crossSubprojectConsistency` | A check whose unit of analysis is the whole set of subprojects sharing a repeated pattern, not any one directory (see `monorepo.md`) | No — lives until the pattern is consolidated or the check is removed |
| `exceptions` | A specific, temporary violation that's acceptable for a documented reason | Yes — requires an `expires` date, becomes a failure once passed |
| `knownGaps` | A permanent, intentional architectural gap tracked in the project's own backlog, typed by `kind` | No — no expiry; removed only when the gap is closed or the tracker entry is removed |
| `exceedsBaseline` | A dimension where the project's own tooling or documentation goes beyond the minimum bar — surfaced as a strength, not folded into pass/fail | No — reassessed each `karen init`/`karen upgrade` |

Use `exceptions` for "we'll fix this by a date." Use `knownGaps` for "this is a deliberate boundary, not a defect." Use `exceedsBaseline` for "this project already does more than the minimum bar here."

## Expiry warning window

Check expiry dates on every run. If an exception will expire within `expiryWarningDays` (default: 7), emit a non-blocking warning before the gate result — the gate still passes, but the team gets lead time to fix or extend the exception before CI silently breaks on a Monday morning:

```
GATE 3  security
  Karen notes an exception expires in 4 days. Prepare a fix.
  (gate-security / console.log / src/debug.js — expires 2026-12-01)
  Karen is satisfied.  (0 issues)
```

Set `"expiryWarningDays": 0` to disable warnings. Set it higher (e.g. 14) for regulated environments where exception extensions require advance approval.

## Gate IDs

Gate IDs in `exceptions` match the gate's `id` field in `.karen/harness.json`. Zero-tolerance gates do not honor exceptions — the `exceptions` block has no effect on them.
