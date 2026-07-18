# `detect_project` — analyzing the project

Not a callable tool. This is the procedure you carry out yourself with `Glob`/`Read`/`Grep` at the start of `karen init` (and again, scoped to what changed, at the start of `karen upgrade`).

## What to gather

- **Manifests, at any depth**: `package.json`, `pyproject.toml`, `go.mod`, `Gemfile`, `Cargo.toml`, and equivalents for any other language. Don't stop at the first one found — walk the whole tree. More than one manifest means this is a poly-repo or monorepo, whether or not it declares workspaces; see `monorepo.md` before assuming a single global profile applies.
- **Frameworks**: named application/web frameworks found via manifest dependencies (e.g. `express`, `fastapi`). For a project whose only manifest is `package.json` with no more specific JS/TS framework detected, still report `"node"` in the frameworks array to record the Node.js/npm tooling identity — don't leave the array empty just because no named library framework exists. Exclude test runners (already captured separately under existing test setup) and generic HTTP client/utility libraries (e.g. `httpx`, `requests`) from this field — a dependency being present doesn't make it a framework.
- **CI configuration**: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, etc. — what already runs on push/PR.
- **Existing test setup**: test runner config, existing test files, any coverage tooling already wired in.
- **Existing compliance artifacts**: `SECURITY.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, SBOM config, provenance attestation config.
- **Agent context files**: `CLAUDE.md`, `AGENTS.md`, `.cursorrules` (or `.cursor/rules/`), `.github/copilot-instructions.md`. Note not just presence but which of these actually exist versus which the file's own text claims to cover — see the audience-mismatch check in `quality-dimensions.md`'s Agent Context Engineering section.
- **Existing quality-gate-like scripts**: docs checkers, `*_verify.mjs`/`*_verify.py`-style scripts, lint/typecheck/security steps already wired into CI, pre-commit hooks. Inventory these before writing anything — see `reconciliation.md`. Don't assume a script only covers the one dimension its name suggests; a `check-docs.mjs` might also scan for secrets.
- **Unclaimed root-level code**: source files matching a detected language's extensions that don't fall under any manifest's directory — credential-handling CLI scripts, cross-cutting `tools/`/`scripts/` utilities, a language-mixed file with no manifest of its own. Report these explicitly; see `monorepo.md`'s Unowned Root-Level Code section. Don't silently exclude them from every gate just because no manifest claims them.
- **OS/environment signals** — needed before any gate script gets written, not just for the profile:

| Signal | What it checks |
|---|---|
| OS | `uname` / an `os` environment signal (`win32` / `darwin` / `linux`) |
| Shell | `SHELL` env var; on Windows, presence of WSL, Git Bash, or PowerShell |
| Package manager | `package.json` → npm/yarn/pnpm; `Pipfile`/`pyproject.toml` → pip/uv/poetry; `go.mod` → go; `Cargo.toml` → cargo |
| CI environment | `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `BITBUCKET_PIPELINE`, etc. |
| Runtime version | Node version from `.nvmrc`/`.node-version`; Python version from `.python-version`; etc. |

Generate gate scripts as `.sh` on Unix and `.ps1` on Windows-native environments. If you detect a mixed environment (Windows host + WSL or Git Bash), ask which shell will run the gates before generating anything, and record the answer in `.karen/harness.json`.

## What this feeds

Everything gathered here shapes the interview (`interview.md`) — a project with an existing `.eslintrc` isn't asked about its linting setup; a project with no test runner configured is asked what it uses. It also determines which gates get generated versus which existing scripts get registered as `existingGates` (`reconciliation.md`), and which deployment profiles apply (`deployment-profiles.md`).

Don't infer any of this from memory of what a typical project in this language looks like — read the actual files. The whole point of `detect_project` as a procedure is that every fact it produces came from an actual `Read`/`Glob`/`Grep`, not from a guess.
