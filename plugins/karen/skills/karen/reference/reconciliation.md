# Reconciling existing quality tooling

Mature projects rarely arrive with zero quality tooling. They arrive with a docs-CI script that already catches secret leaks and doc drift, a hand-written "constitution" file with its own verify script, a lint step in CI, a pre-commit hook. `karen init` on a project like this must not generate a parallel, redundant harness that quietly disagrees with the one already there — two sources of truth for "is this secure" is worse than one, even if the new one is well-designed. It also must not assume one existing script covers a whole gate just because it touches that domain — most existing tools cover a *slice* of a dimension, not the whole thing.

## The reconciliation model is many-to-many, not one-id-per-tool

A single existing script commonly contributes partial coverage to several dimensions at once (a docs-CI script that also scans for secrets and checks for stub markers touches gate-4, gate-3, *and* gate-2). A single dimension commonly needs contributions from several existing scripts to be fully covered (gate-3's structural security patterns from one script, its working-tree secret scan from another). Neither side of that relationship is 1:1, so `.karen.json` records coverage per dimension, not per tool:

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

## Before writing any generated gate

Inventory every script `detect_project` found that looks like a quality check (docs checkers, `*_verify.mjs`/`*_verify.py`-style scripts, lint/typecheck/security steps already wired into CI, pre-commit hooks) and ask the interview to confirm what each one actually covers — not just what domain it's named after. "Your `check-docs.mjs` scans for secrets, but only in `git ls-files` — does anything scan your working tree, including gitignored files?" is the kind of question this step exists to ask. The answer determines whether to generate a full gate, a narrower gate scoped to the uncovered slice only, or no gate at all for that dimension.

## A generated gate's scope is exactly the gap, never the whole dimension by default

If `check-docs.mjs` already fully covers docs-parity, don't generate a second, competing docs-parity gate — register `check-docs.mjs` as `existingGates` with `"scope": "full"` for that dimension and call it directly from `run-all.sh`. If it covers secrets only for tracked files, generate a security gate scoped explicitly to "working-tree scan excluding what `check-docs.mjs` already checks" — not a second full secret scanner that duplicates and can drift from the first. `karen audit`'s per-gate result is the union of every `existingGates` entry whose coverage names that gate, plus any generated gate registered for it; a gate with only partial coverage from existing tools and no generated gate to fill the rest is itself a finding (`Karen notes gate-3-security has no check for: working-tree secret scan`) surfaced during `karen init`, not a silent gap.

## This reconciliation runs again on `karen upgrade`

If a project adds a new existing tool, or an old one's coverage changes, re-running `karen init`/`karen upgrade` re-asks the coverage question for anything `detect_project` flags as changed, so the map doesn't silently go stale while the underlying scripts evolve.
