# Karen — Blueprint

> Karen needs to speak to your manager before this ships.

This repository contains the design specification for **Karen** — a harness-design intelligence that interviews your project and generates a deterministic quality gate for AI coding agents.

## What is Karen?

Karen is a CLI tool that:
- Analyzes your project (language, deployment, dependencies, structure)
- Interviews you about compliance, coverage, and audience
- Generates a custom set of quality gate scripts tailored to your stack
- Runs those gates and refuses to proceed until Karen is satisfied

She's not a linter. She's thorough. There's a difference.

## This repository

`BLUEPRINT.md` is the full design specification: architecture, gate contract, run-state schema, Karen's voice, all six gate types, circuit breaker, exception system, deployment profiles, LLM prompt patterns, and how to teach Karen new complaints.

## The implementation

Karen is implemented in Go at **[github.com/zoharbabin/karen](https://github.com/zoharbabin/karen)**.

```bash
go install github.com/zoharbabin/karen/cmd/karen@latest
karen init          # interview your project → generate .karen/ harness
karen audit         # run all gates; exit 0 = satisfied, 1 = complaints, 2 = escalate
karen reset <file:line>     # reset a specific tripped circuit after human review
karen reset --gate <name>   # reset all circuits in one gate
karen reset --all            # reset all circuits project-wide
karen upgrade       # regenerate harness from existing .karen.json (after karen update)
karen version       # print version
```

Use `karen reset` after a human has directly edited a tripped file. Pick the narrowest form — `file:line` when one issue was fixed, `--gate` when a whole gate was reworked, `--all` after a significant manual intervention across the project.

**Example output:**

```
$ karen audit
...
Karen is satisfied. You may proceed.
```

## Headless Mode

When an agent is bootstrapping a new project and can't sit at an interactive prompt, pass all answers as flags:

```bash
karen init \
  --headless \
  --description "TypeScript SDK for browser voice conversations" \
  --type library \
  --language typescript \
  --deployment browser-direct-js \
  --audience enterprise \
  --handles mic \
  --compliance soc2 \
  --ai-powered \
  --coverage 85
```

Every flag maps directly to a wizard question. Any flag omitted falls back to Karen's analysis of the project directory, then to the default.

The LLM Prompt Pattern for greenfield projects adds a Phase 0 before any coding begins:

```
## Phase 0 — Bootstrap Karen (new projects only)
Run: karen init --headless [flags matching the project spec above]
Then run: karen audit
Share Karen's output before writing any source files.
```

## Integration

**CI (GitHub Actions) — Karen blocks the merge:**

```yaml
- name: Karen's Review
  run: karen audit
  # exit 1 = Karen is not satisfied; exit 2 = Karen is escalating, page a human
```

**Pre-commit — fast security check before you commit:**

```bash
karen audit --gates gate-3-security
```

**Gradual rollout for existing codebases:**

```bash
karen audit --warn       # reports issues, exits 0 — use this to baseline without blocking
karen audit --baseline   # snapshots current counts into .karen-baseline.json — locks the floor
karen audit              # blocks only regressions beyond the baseline — use this in CI
```

## Upgrading

Run `karen upgrade` after updating the Karen binary to regenerate your harness from the existing `.karen.json`.

**Upgrade contract:** checks introduced in a minor Karen version are warning-only for the first release cycle — they report issues but do not cause `karen audit` to exit 1. After one cycle they become blocking. To enforce new checks immediately, add `"strictUpgrades": true` to `.karen.json`.

## Configuration

Karen writes `.karen.json` after `karen init`. You own this file — version it with your project.

**Minimal config snippet showing key user-facing fields:**

```json
{
  "circuitBreaker": {
    "threshold": 3,
    "exitCode": 2
  },
  "expiryWarningDays": 7,
  "exceptions": {
    "gate-3-security": [
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

**Exceptions** require all four fields: `pattern`, `file`, `reason`, and `expires`. Karen treats expired exceptions as gate failures. Zero-tolerance gates ignore exceptions entirely — the `exceptions` block has no effect on them.

**Expiry warning window:** `expiryWarningDays` controls the lead-time warning before an exception expires. Default is 7 days. Set to `0` to disable. Raise to `14` for regulated environments where exception extensions require advance approval.

### Circuit Breaker

The circuit breaker detects stuck agent loops and exits with code `2`. When the same issue fingerprint appears in `threshold` consecutive runs without change, Karen trips the circuit and halts — forcing human review before the agent can retry.

```json
{
  "circuitBreaker": {
    "threshold": 3,
    "exitCode": 2
  }
}
```

- **Default threshold: 3.** Set to `1` for zero-tolerance gates where any repeat is agent confusion, never a multi-step fix. Set higher for complex gates requiring multi-step resolutions.
- **Exit code 2** is a hard block. CI pipelines must treat it as mandatory human review — not a regular failure to suppress or retry automatically.
- After human intervention, use `karen reset` to resume. The next `karen audit` opens with `Karen is resuming. The circuit has been reset.` and treats the run as a fresh fingerprint baseline.

## Extending Karen

To add a new quality check or gate type, follow the four-step process in **BLUEPRINT.md § Teaching Karen New Complaints** — the authoritative guide for extending her complaint vocabulary across projects.

## License

Apache 2.0 — see [LICENSE](LICENSE).
