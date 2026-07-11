# `write_harness` — what gets generated

Not a callable tool. This is the procedure you carry out yourself with `Write`/`Edit`, once the interview (`interview.md`) is done and you have a combined project profile.

## Output layout

```
.karen/
  harness.json             ← gate manifest: ids, names, script paths, run order
  run-state.json           ← written after each audit; powers delta + circuit breaker
  run-all.sh               ← orchestrator: runs every gate in harness.json in order, aggregates exit code
  gates/
    gate-1-supply-chain.sh     ← thin wrapper: calls npm audit / govulncheck / pip-audit
    gate-2-completeness.sh     ← thin wrapper: calls eslint / pylint / go vet + doc checks
    gate-3-security.sh         ← thin wrapper: calls semgrep / bandit / govulncheck
    gate-4-docs-parity.sh      ← thin wrapper: link checker + symbol diff + changelog check
    gate-5-compliance.sh       ← thin wrapper: artifact presence + content checks
    gate-6-test-integrity.sh   ← thin wrapper: runs the project's test runner, parses coverage
    [additional gates based on the interview: compliance regime, deployment profile, etc.]
.karen.json                ← manifest, project profile, exceptions, config — see karen-json-schema.md
PERMISSIONS-CHARTER.md     ← only if the project handles sensitive capabilities
```

(`.sh` extension shown for a Unix host — `gate-contract.md` covers `.ps1` on Windows-native and the mixed-environment ask. A gate itself can be written in a non-shell language when that's the better fit for the check — see "Gate scripts are written by you, not templated" below — but `run-all.sh`/`run-all.ps1`, the one orchestrator, always matches the host shell decided in `gate-contract.md`'s OS section. Never write both an extensioned and an extensionless copy of the same gate — `harness.json`'s `script` path is the single source of truth for what actually runs, and `karen audit`/`run_gate` execute exactly the scripts listed there, never every file found in `gates/`.)

## `run-all.sh` — the one orchestrator

Write `.karen/run-all.sh` (or `.karen/run-all.ps1` on Windows-native, per `gate-contract.md`) once per project, alongside `harness.json`. It's the single entry point every integration in `integration.md` calls (CI, hooks, `karen audit` itself, a human running it by hand) — nothing else needs to know the gate list or execute gates individually. It:

1. Reads `.karen/harness.json`'s `gates` array and runs each entry's `script` path, in `runOrder`, by direct execution of that path (`chmod +x` already set when the gate was written) — never by guessing an interpreter from the extension; each gate's own shebang picks that.
2. Captures each gate's stdout/exit code, aggregates: exit `0` only if every gate exits `0`; otherwise exit `1`, or `2` if `run_gate`'s circuit-breaker check (`run-state.md`) says a gate is stuck.
3. Supports the flags `integration.md`'s gradual-rollout section documents: `--warn` (report but always exit `0`, for baselining an existing codebase), `--baseline` (snapshot current per-gate issue counts to `.karen/baseline.json` instead of comparing), and no flag (normal blocking mode — regressions past the baseline fail).

Same rule as gate scripts: written by you from this description, not templated, calibrated to the shell decided during init. This is the one orchestration file `write_harness` is responsible for beyond the gates themselves.

## Gate scripts are written by you, not templated

When you write each gate script, you're using your own knowledge of the tool it wraps — semgrep rule packs, eslint plugin configs, compliance toolchains, output formats — calibrated to what `detect_project`/`probe_tools`/the interview actually found for this project. No static template can match this because the knowledge needs to be current and project-specific; write exactly what this project needs, not a generic stub.

**Orchestration, not reimplementation.** A gate calls the tool that owns its domain — the dependency auditor for supply chain, the SAST scanner for security, the test runner for coverage — then normalizes that tool's output into the `FILE:LINE\tmessage` contract (see `gate-contract.md`). Don't write your own grep-based security rules, and don't reimplement what semgrep, eslint, or govulncheck already does well. The gate's job is calling the right tool with the right flags and translating its output, not performing the check itself.

**Gate scripts belong to the project.** They live in the repo, are versioned with it, and can be hand-edited afterward. You design them; the project owns them from that point on.

**Each gate script is one self-contained file — never split logic into sibling helper files it shells out to.** `write_harness` writes exactly one file per registered gate; there's no companion mechanism for a `tools/` directory or shared helper modules, so a script that calls out to one is calling something that doesn't exist the moment it's written. If a check needs real logic and no existing tool covers it (no semgrep, no bandit, nothing installed that fits), write that logic inline in the gate script itself — a single Python/Node/Bash file is fine, however long, as long as it stands alone.

**A tool that can't run must make the gate fail loudly — never let its absence read as a clean pass.** This is broader than just `|| true`: any pattern that converts a missing binary, a failed invocation, or empty/malformed output into a fabricated "no findings" result has the same effect — `semgrep ... 2>/dev/null || echo '{"results":[]}'` is exactly as wrong as `|| true`, because feeding a synthetic empty-results JSON into the rest of the script produces `PASS (0 issues)` with the same silence a real clean scan would produce. There is no way to tell those two outcomes apart downstream, which is the actual harm — a project can go from "tool ran, found nothing" to "tool never ran" without anyone noticing, on a gate that may be `zeroTolerance`. Guard against this at the front of the script, not by catching the wrapped tool's own failure after the fact: check the tool is actually present (`command -v semgrep`, `python3 -m bandit --version`, etc.) before invoking it, and if it's missing, skip straight to emitting a `FAIL` with an issue line naming the missing tool, then `exit 1` (or the gate's zero-tolerance exit code) — never fall through to a 0-issues summary. If the tool is present but the invocation itself fails or returns something the parser can't read, treat that the same way: an issue line saying what broke, `FAIL (1 issues)`, non-zero exit. The only way a gate legitimately reports `PASS (0 issues)` is a real, completed scan that found nothing.

**Structural over textual (see `quality-dimensions.md`'s Security section).** Prefer AST/call-graph analysis over regex matching wherever the language and available tooling support it. A regex match on `eval` fires on a comment saying "never use eval"; a structural match on the actual call expression doesn't. This applies to every gate you write, not just security — a completeness gate that flags `pass` in Python shouldn't fire on a variable named `bypass`.

**Additional project-specific gates** can be added to `.karen/gates/` and registered in `.karen/harness.json` at any time, by the project team directly. `karen audit` runs them alongside the generated ones without distinction.

## `PERMISSIONS-CHARTER.md`

Generate this file only when the project handles a sensitive capability the interview surfaced (microphone, camera, blob/mediastream URLs, external WebSocket connections, autoplay) — see the `browser-direct-js` profile's Documented Capabilities table in `deployment-profiles.md` for what belongs in it and what policy each capability requires.

## Registering everything in `.karen/harness.json`

Every gate — generated or existing (`reconciliation.md`), plus any `crossSubprojectConsistency` check (`monorepo.md`) — needs an entry here: id, name, script path, run order. `run_gate` and `karen audit` read this file to know what to execute and in what sequence. Gate order matters for the LLM prompt pattern in `integration.md` — gates are worked through in the order registered, first gate first.
