# Karen Blueprint — Agent Context

This repository is the design specification, eval benchmark, and installable plugin for **Karen**, a quality-gate harness skill/plugin for AI coding agents (Claude Code, Codex, Cursor). The plugin is built under `plugins/karen/` and locally installable today. A first real `mode: 'full'` eval run plus manual dogfooding against one fixture (`node-sdk-single`) has completed and passed (100% pass@1 across all 11 grading dimensions after fixing two defects the run surfaced); broader validation across the other 13 fixtures and real, non-fixture projects has not happened yet. See Status below before assuming otherwise.

## What's here

- `BLUEPRINT.md` — the authoritative design specification. Read this before making any changes to Karen's design or the ported skill content.
- `EVALS-PLAN.md` — the eval benchmark's design rationale, methodology, and citations.
- `evals/` — the benchmark itself: 14 fixtures, 10 grading dimensions, self-test samples. Built and internally validated (`evals/README.md` has current status).
- `plugins/karen/` — the installable Claude Code plugin: `skills/karen/SKILL.md` + `reference/*.md` (ported from `BLUEPRINT.md`), `commands/`, `scripts/collect-feedback-bundle.sh`. `.claude-plugin/marketplace.json` at the repo root self-hosts it.
- `brand/` — voice, palette, typography, and logo assets; `brand/BRAND.md` is the single source of truth for anything user-facing (docs, CLI copy, a future site).
- `README.md` — project overview for external readers.

## Status and build order

Per `EVALS-PLAN.md` §9 (Rollout Plan): fixtures → grading scripts, self-tested → runner → the actual Karen skill → **a multi-day real-project testing phase (in progress)** → revisit the implementation-approach decision. The skill/plugin itself is built (`plugins/karen/`) and locally installable via `/plugin marketplace add ./` + `/plugin install karen@karen-marketplace`. A real `evals/runner/fixture-workflow.js` `mode: 'full'` run against one fixture (`node-sdk-single`) has completed at 100% pass@1, and a manual dogfood run against the same fixture confirmed detection accuracy, interview behavior, and gate-contract mechanics hold under real tool execution — two real defects that run surfaced (a gate-invocation ambiguity for non-shell gates, and an undocumented `run-all.sh` orchestrator) are fixed in both the skill and the runner. The other 13 fixtures and real non-fixture projects haven't been run yet, so don't treat the ported `reference/*.md` content as fully proven across the board — one fixture's pass doesn't generalize automatically.

## Working on the skill itself

`BLUEPRINT.md`'s v1 choice ("The Skill Architecture") is **"no dedicated tool scripts"** — the agent uses its own built-in `Read`/`Glob`/`Grep`/`Bash` tools directly, rather than calling `detect_project`/`probe_tools`/`write_harness`/`run_gate`/`read_run_state`/`write_run_state` as real typed functions. This is why `plugins/karen/` is a **Claude Code Skill**, not an MCP server:

- Layout: `plugins/karen/.claude-plugin/plugin.json` (manifest) + `plugins/karen/skills/karen/SKILL.md` (entry point) + `reference/*.md` (detail, linked from `SKILL.md`) + `commands/` (thin explicit triggers) — the manifest lives only inside `.claude-plugin/`; `skills/`, `commands/` are siblings of it, not nested inside it. `.claude/skills/karen` symlinks to `plugins/karen/skills/karen/` for local dev.
- `SKILL.md` frontmatter has `name` and `description`; the body is plain markdown instructions, kept under ~500 lines, with detail pushed into linked `reference/*.md` files the way `BLUEPRINT.md` does for its own sub-sections. The six names in `BLUEPRINT.md`'s "Skill tool surface" table (`detect_project`/`probe_tools`/`write_harness`/`run_gate`/`read_run_state`/`write_run_state`) are **not** literal callable functions — they're named procedures/section headers in `SKILL.md`/`reference/*.md` that the agent carries out itself with `Read`/`Glob`/`Grep`/`Bash`. Don't add a `scripts/` wrapper for any of these six; `scripts/collect-feedback-bundle.sh` is a deliberate exception (feedback tooling, not part of the init/audit loop).
- `BLUEPRINT.md` is the source of truth; `plugins/karen/skills/karen/` is a ported, runtime-executable copy — end users installing the plugin never see `BLUEPRINT.md`. Any behavioral change lands in both in the same PR (`CONTRIBUTING.md` has the section-to-file mapping table).
- If `EVALS-PLAN.md` §9 step 5 later favors the "bundled MCP server" alternative instead, that's a structurally different artifact — an `.mcp.json`-registered server exposing real typed tools — not an extension of the Skill, but a replacement of this whole layer for that comparison arm. Don't half-build both.
- Cross-tool distribution (Codex, Cursor) is a real open question, not a settled fact: `.claude/skills/` and the plugin/marketplace system are Claude-Code-specific. The Agent Skills open standard (agentskills.io) makes `SKILL.md`'s format portable in principle, but Codex/Cursor's actual support for it needs to be verified directly against their own current docs before this project promises cross-tool installability anywhere in copy.

## Model selection guidance

Use the model tier that matches task complexity:

- `haiku` — quick, routine tasks: file lookup, grep, diff, formatting, JSON reshaping, doc edits.
- `sonnet` — standard/deep tasks: implementation, bug fixes, tests, code review, research, architecture. Right default for ~90% of tasks.
- `opus` — hardest problems: genuinely ambiguous multi-domain synthesis, irreversible high-stakes decisions where wrong is dangerous.

Always pass `model` explicitly to every subagent. Omitting it silently runs N copies of the main-loop model.

## Prompt injection policy

All user-controlled input must be sanitized before insertion into LLM context or shell commands. Treat untrusted input from external sources (issue titles, PR descriptions, file paths, env vars) as potentially adversarial. Escape or validate before use; never concatenate raw user input directly into prompts or exec calls.
