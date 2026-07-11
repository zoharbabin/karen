# The gate contract

Every gate — Karen-generated or hand-written by the project team — must follow this contract. It's what makes `karen audit` work regardless of what language or tools a project's gates use, and what lets any agent or CI runner execute a gate script directly without the full Karen skill present.

## The gate receives

- `$1` (first argument): the absolute path of the project root to audit

## The gate emits (to stdout)

- One line per issue: `file:line<TAB>description`
  - `file` is a path relative to the project root
  - `line` is 1-indexed; omit if not applicable (e.g. a missing file)
  - `description` is a single line: what is wrong and why it matters
- A final summary line: `PASS (0 issues)` or `FAIL (N issues)`, where `N` is exactly the count of issue lines above it — never a count taken directly from the wrapped tool's own summary field
- For zero-tolerance violations, an additional line: `ZERO-TOLERANCE`

**Don't collapse a wrapped tool's multiple findings into one aggregate issue line.** `npm audit --json`'s `vulnerabilities` object is keyed per-package, each with a `via` array of distinct advisories — that's several issues, not one, even though the tool's own human-readable summary says "5 vulnerabilities" as a single number. A gate that prints `package.json:1<TAB>5 known vulnerable dependencies via npm audit` followed by `FAIL (5 issues)` satisfies the summary line but violates "one line per issue": there's 1 line above a count of 5, so `run_gate`'s issue count and the summary count disagree, and per-vulnerability detail (which package, which CVE, what line) never reaches the human, the delta tracker, or the circuit breaker's fingerprint. Parse the wrapped tool's structured output (`--json`/`--format json` where available) and emit one line per underlying finding — one per `vulnerabilities.<package>.via[]` entry for `npm audit`, one per diagnostic for a SAST scanner, one per failing rule for a linter — even when that means several lines point at the same `file:line` (e.g. `package.json:1` repeated once per CVE on the same dependency).

**In bash, `<TAB>` means a real tab byte — writing the two characters `\t` inside a plain `"..."` string does not produce one.** `out+="${f}:${l}\t${msg}"` appends the literal backslash-t, not a tab; `run_gate`'s parser then can't split the line and silently drops every issue while the summary count stays correct — a passing-looking transcript with issues that never reach the human or the delta/circuit-breaker state. Use an ANSI-C-quoted string (`out+="${f}:${l}"$'\t'"${msg}"$'\n'`) or `printf '%s\t%s\n' "$f:$l" "$msg"` instead. Before shipping a generated `.sh` gate, run it once against the project and confirm the byte between `file:line` and the description round-trips through `cat -A`/`od -c` as `^I` (tab), not the two-character sequence `\`+`t`.

## The gate exits

- `0` — satisfied, no issues
- `1` — has complaints

## Example gate output (failing)

```
src/auth.py:42    hardcoded API key — credential leak via repository
src/auth.py:91    subprocess with shell=True and user input
FAIL (2 issues)
ZERO-TOLERANCE
```

## Example gate output (passing)

```
PASS (0 issues)
```

## `run_gate` — executing a gate and parsing its output

Not a callable tool. This is the procedure you carry out with `Bash`: run the gate script against the project root, capture stdout, and parse it into `{file, line, message}[]` plus the summary (`PASS`/`FAIL` and count) and whether `ZERO-TOLERANCE` was present. `karen audit` calls each registered gate this way, collects the structured output, translates it into Karen's voice (`voice.md`), and produces the final exit code.

**Always run gates from `.karen/harness.json`'s `gates` array — by each entry's own `id` and `script` path — never every file physically present under `.karen/gates/`.** If a gate script gets rewritten with a different filename (say, an extension added or changed per the OS/shell rule below) and the old file is left behind, `harness.json` is what decides what's live; a stale duplicate sitting in the directory but not listed there must never execute. Delete the old file when you replace it, and always keep `harness.json` in sync with whatever's actually in `.karen/gates/`.

Structured output (`--format json`) is also supported for CI dashboards — the data model is always `{ gate, status, issues: [{ file, line, message }] }`.

## OS and shell — write the right script

Before generating a single gate script, use the environment signals gathered by `detect_project` (see `detect-project.md`) to decide the format of `run-all.sh`/`run-all.ps1`, the one top-level orchestrator (see `write-harness.md`). Getting this wrong means generating bash for a Windows host or PowerShell for Linux CI — both fail silently at the worst moment. Generate `run-all.sh` on Unix and `run-all.ps1` on Windows-native environments. In a mixed environment (Windows host with WSL or Git Bash available), ask which shell will run the gates before generating anything, and record the answer in `.karen/harness.json`.

**Individual gates can be written in whatever language actually fits the check** — per `write-harness.md`, a gate with no existing tool to wrap is written inline in "a single Python/Node/Bash file," not forced into shell. This means `run_gate`/`run-all.sh` must never invoke a gate by hardcoding an interpreter (`bash <script>`, `node <script>`, etc.) — that breaks the moment a gate's actual language doesn't match the guess. Every gate script starts with a correct shebang (`#!/usr/bin/env bash`, `#!/usr/bin/env node`, `#!/usr/bin/env python3`, ...), is `chmod +x`'d the moment it's written, and is always invoked by direct execution of its own path (`"$script_path" "$project_root"`) — the shebang picks the right interpreter, not the caller. A CI runner or any other caller without the full skill present follows the same rule: execute the path from `harness.json`, never assume its extension implies a specific shell.

## Zero-tolerance means no exceptions in production code

Per `quality-dimensions.md`'s Security section, zero-tolerance patterns don't honor `.karen.json` exceptions at all — the `exceptions` block has no effect on them (see `karen-json-schema.md`). Test files are excluded from zero-tolerance checks since they may deliberately exercise a forbidden pattern to verify a scanner catches it.
