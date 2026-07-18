# The gate contract

Every gate — Karen-generated or hand-written by the project team — must follow this contract. It's what makes `karen audit` work regardless of what language or tools a project's gates use, and what lets any agent or CI runner execute a gate script directly without the full Karen skill present.

## The gate receives

- `$1` (first argument): the absolute path of the project root to audit

## The gate emits (to stdout)

- One line per issue: `file:line<TAB>description`
  - `file` is a path relative to the project root — no leading `./`, and no leading `/` or drive letter. Many wrapped tools emit absolute paths natively (semgrep's JSON `path` field, several SAST/linter `--json` modes): strip the project-root prefix yourself before printing (`path.relative(projectRoot, r.path)` in Node, `os.path.relpath(f, project_root)` in Python) — never pass the tool's raw path through unmodified.
  - **When the wrapped tool was invoked with its `cwd` set to the project root, its own output paths are already relative to root — resolve them against root, not against the gate script's own process cwd, before computing anything.** `os.path.realpath(path)` (or Node's `fs.realpathSync`) on a bare relative path resolves it against whatever directory the gate script itself happens to be running from, which is very often *not* the project root (a runner or CI job frequently invokes the gate from its own working directory, passing root only as `$1`). The fix is to join first: `os.path.realpath(path if os.path.isabs(path) else os.path.join(root, path))`, then take `os.path.relpath(...)` against `os.path.realpath(root)`. Skipping the join silently produces a garbled path like `../../../some/unrelated/cwd/src/file.py` instead of `src/file.py` — it still looks like a plausible path so nothing crashes, but it no longer matches the file on disk from the caller's perspective, breaking exact-path matching downstream (delta tracking, fingerprinting, ground-truth comparison). Verify by running the finished gate script from a directory other than the project root and confirming the emitted paths are still clean project-root-relative paths, not the mistake above.
  - **Canonicalize `$1` itself before using it in any `relpath`/prefix-strip call — not just the file paths being stripped.** On macOS, `/tmp` is itself a symlink to `/private/tmp`; if `$1` arrives as `/tmp/proj-xyz` but the wrapped tool was invoked with a `cwd` the OS resolved to `/private/tmp/proj-xyz` (or vice versa — either side can be the symlinked one depending on how the caller constructed the path), computing `relpath(file, root)` against the *raw* `$1` compares two paths that refer to the same directory but aren't textually equal, and `relpath` has no way to know that — it either produces a long `../../private/tmp/proj-xyz/src/file.py`-style traversal instead of `src/file.py`, or fails prefix-matching outright. Fix this once, at the top of the gate, by setting `root = os.path.realpath(sys.argv[1])` (Python) / `root = fs.realpathSync(process.argv[2])` (Node) immediately after reading `$1`, before it's used anywhere else in the script — the same canonicalization the rule above already applies to each individual file path must also apply to root itself, on both sides of every comparison.
  - `line` is 1-indexed; omit if not applicable (e.g. a missing file)
  - `description` is a single line: what is wrong and why it matters
- A final summary line: `PASS (0 issues)` or `FAIL (N issues)`, where `N` is exactly the count of issue lines above it — never a count taken directly from the wrapped tool's own summary field
- For zero-tolerance violations, an additional line: `ZERO-TOLERANCE`

**Don't collapse a wrapped tool's multiple findings into one aggregate issue line.** `npm audit --json`'s `vulnerabilities` object is keyed per-package, each with a `via` array of distinct advisories — that's several issues, not one, even though the tool's own human-readable summary says "5 vulnerabilities" as a single number. A gate that prints `package.json:1<TAB>5 known vulnerable dependencies via npm audit` followed by `FAIL (5 issues)` satisfies the summary line but violates "one line per issue": there's 1 line above a count of 5, so `run_gate`'s issue count and the summary count disagree, and per-vulnerability detail (which package, which CVE, what line) never reaches the human, the delta tracker, or the circuit breaker's fingerprint. Parse the wrapped tool's structured output (`--json`/`--format json` where available) and emit one line per underlying finding — one per `vulnerabilities.<package>.via[]` entry for `npm audit`, one per diagnostic for a SAST scanner, one per failing rule for a linter — even when that means several lines point at the same `file:line` (e.g. `package.json:1` repeated once per CVE on the same dependency).

**In bash, `<TAB>` means a real tab byte — writing the two characters `\t` inside a plain `"..."` string does not produce one.** `out+="${f}:${l}\t${msg}"` appends the literal backslash-t, not a tab; `run_gate`'s parser then can't split the line and silently drops every issue while the summary count stays correct — a passing-looking transcript with issues that never reach the human or the delta/circuit-breaker state. Use an ANSI-C-quoted string (`out+="${f}:${l}"$'\t'"${msg}"$'\n'`) or `printf '%s\t%s\n' "$f:$l" "$msg"` instead. Before shipping a generated `.sh` gate, run it once against the project and confirm the byte between `file:line` and the description round-trips through `cat -A`/`od -c` as `^I` (tab), not the two-character sequence `\`+`t`.

**A wrapped CLI's own colorized log output must never reach the gate's stdout.** Many scanners (`gitleaks`, and others) write human-readable progress/diagnostic lines — banners, timing, "no leaks found" — laced with raw ANSI escape codes, and some send that chatter to stderr rather than stdout. A gate that runs the tool via a shell redirect (`tool ... 2>&1`) or a subprocess call that inherits the parent's stderr (e.g. Node's `execFileSync` without an explicit `stdio` for `stderr`) lets those raw escape bytes leak into the gate's own captured output alongside its real `file:line<TAB>message` lines — which then breaks any downstream consumer that treats the gate's output as plain text or JSON-embeds it verbatim (a literal ESC byte, `\x1b`, is a control character `JSON.parse` rejects outright). Invoke the wrapped tool with its diagnostic/log output fully suppressed or explicitly discarded — pass the tool's own quiet/no-color/log-level flag when one exists (e.g. `gitleaks detect --no-color --log-level error`, confirmed via `--help` per `probe-tools.md`'s flag-verification rule), and never let a subprocess call's stderr pass through to the gate script's own stdout unless it has first been captured separately and either dropped or explicitly folded into an issue line as diagnostic text (never raw).

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

**Don't reach for GNU-only flags in a bash gate — the project's actual runtime shell may be BSD-based (macOS ships BSD `mktemp`, `grep`, `sed`, `date`, not GNU).** `mktemp --suffix=.out` and `mktemp -t foo` both work on GNU coreutils but fail outright on macOS's `mktemp` (`unrecognized option`), so a gate that runs clean in Linux CI can break on every contributor's Mac. If a gate needs a suffixed temp file, create a plain temp file and rename/copy it (`t=$(mktemp); mv "$t" "$t.out"`), or use a fixed unique name under `$(mktemp -d)` instead of relying on a flag either coreutils implementation might not support. The same caution applies to any other GNU-vs-BSD flag divergence (`sed -i` needs a `''` backup-suffix argument on BSD but not GNU, `date -d` is GNU-only) — when in doubt, prefer the option supported by both, or test the gate on the actual host OS/shell recorded during `detect_project` before treating it as done.

## Fail loudly when the wrapped tool itself didn't run

**A wrapped tool that's missing, crashes, or errors out is not the same thing as a wrapped tool that ran and found zero issues — a gate must never let the two collapse into the same `PASS (0 issues)`.** `gosec -fmt=json -out="$findings" -quiet ./... || true` is written to survive gosec finding issues (which exits non-zero), but it also silently survives `gosec: command not found` and any other invocation failure (permission denied, a panic, a malformed project it can't parse) — in every one of those cases `$findings` is empty or never written, the parse loop below yields zero issues, and the gate reports a clean pass on a check that never actually ran. This is worse than the gate not existing at all, because it looks identical to a real pass in `karen audit`'s output and in run-state history.

Check that the tool invocation itself succeeded before treating an empty findings file as a real "no issues" result. Capture the wrapped tool's own exit code separately from "did it find issues" — most SAST/lint/audit tools use a distinct exit code (or no output file at all, or a `null`/malformed JSON body) to distinguish "ran clean" from "couldn't run" — and if the tool didn't produce valid output, the gate must exit non-zero with a diagnostic issue line (e.g. `<gate-script>:0<TAB>gosec did not run: command not found — see .karen/gates/gate-3-security.sh`) rather than reporting `PASS (0 issues)`. `|| true` (or `2>/dev/null; true`, or any other blanket exit-code swallow) is only safe wrapped tightly around the exact non-zero-on-findings behavior you're accounting for — never around the whole invocation.

**There is no "informational, not counted" line category — every line matching `file:line<TAB>message` counts toward `N`.** A sub-check that can't run for a structural reason (e.g. a CHANGELOG-vs-commits gap check that needs a `.git` directory the project doesn't have) is exactly the "wrapped tool didn't run" case above, not a new third category — print it as a real, counted issue line (so a human sees why that sub-check is silently absent) or omit it from stdout entirely, never both print it and exclude it from `N`. A gate that emits 2 lines matching the issue-line format but reports `FAIL (1 issues)` breaks `run_gate`'s own count-matches-lines invariant, the same failure mode the tab-byte and aggregate-line rules above already guard against — the parser has no way to distinguish a "real" issue line from a "the tool told me not to count this one" line, since the contract defines no such marker.

## Zero-tolerance means no exceptions in production code

Per `quality-dimensions.md`'s Security section, zero-tolerance patterns don't honor `.karen.json` exceptions at all — the `exceptions` block has no effect on them (see `karen-json-schema.md`). Test files are excluded from zero-tolerance checks since they may deliberately exercise a forbidden pattern to verify a scanner catches it.
