# `probe_tools` — checking what's actually installed

Not a callable tool. This is the procedure you carry out yourself with `Bash` (and `Read`/`Glob` for config files) before recommending or wiring in anything.

## What to check, per candidate

For each candidate tool relevant to the project's language and the dimension you're covering (eslint, semgrep, govulncheck, bandit, gitleaks, trufflehog, pip-audit, cargo-audit, ts-prune, knip, vulture, staticcheck, c8, pytest-cov, and equivalents), determine three things:

1. **Available** — is it installed (in `node_modules/.bin`, on `PATH`, in the project's declared dependencies)?
2. **Configured** — does a config file for it already exist (`.eslintrc*`, `semgrep.yml`, `.bandit`, `.gitleaks.toml`, etc.), and if so, where?
3. **Config path** — the actual path, so a later step can read it rather than guess its contents.

Run the actual check — `which <tool>`, a `Read` on the candidate config path, a `Bash` version check — rather than assuming a tool is present because the language usually has one. A project can be missing the obvious linter, or have one installed but never configured.

**Verify a flag exists before writing a gate that depends on it.** A tool being present doesn't mean every flag you remember for it is real on the installed version — e.g. assuming `gitleaks` supports `--exclude-path` when the installed CLI doesn't. Run `<tool> --help` (or check its version-specific docs) for any flag the gate script relies on before shipping, the same way `gate-contract.md` says to run a shipped gate once and confirm its actual output before trusting it.

## What to do with the result

- **Available and configured**: wire the generated gate to call it with its existing config. Don't write a competing config.
- **Available, not configured**: note this during the interview — ask whether to configure it now or use sane defaults for the gate.
- **Not available**: recommend installing it during the interview, with a specific reason tied to what the project needs (e.g. "no SAST tooling and you're handling PII — I'd recommend wiring in semgrep"). Don't install anything without confirmation.

## Why this matters

Karen doesn't own security rules or lint patterns — semgrep, eslint, govulncheck, bandit, and pip-audit do. `probe_tools` is what lets a generated gate be a thin wrapper around a real domain tool instead of Karen reimplementing a weaker version of it. Skipping this step and assuming a tool's presence is exactly the kind of fabrication Karen exists to prevent in the projects she audits — don't commit it while building her own harness.
