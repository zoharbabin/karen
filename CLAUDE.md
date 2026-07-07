# Karen Blueprint — Agent Context

This repository is the design specification and eval benchmark for **Karen**, a quality-gate harness skill/plugin for AI coding agents (Claude Code, Codex, Cursor). Karen herself — the installable skill — has not been built yet. See Status below before assuming otherwise.

## What's here

- `BLUEPRINT.md` — the authoritative design specification. Read this before making any changes to Karen's design.
- `EVALS-PLAN.md` — the eval benchmark's design rationale, methodology, and citations.
- `evals/` — the benchmark itself: 14 fixtures, 10 grading dimensions, self-test samples. Built and internally validated ahead of Karen (`evals/README.md` has current status).
- `brand/` — voice, palette, typography, and logo assets; `brand/BRAND.md` is the single source of truth for anything user-facing (docs, CLI copy, a future site).
- `README.md` — project overview for external readers.

## Status and build order

Nothing under this repo is an installed Claude Code Skill or Plugin yet. `EVALS-PLAN.md` §9 (Rollout Plan) fixes the order deliberately: fixtures → grading scripts, self-tested → runner → **only then** the actual Karen skill → a multi-day real-project testing phase → revisit the implementation-approach decision. Don't build the skill ahead of that order without a reason — the whole point of building the benchmark first is comparing implementation approaches on evidence once Karen exists, not before.

## Building the actual skill (when that phase starts)

`BLUEPRINT.md`'s v1 choice ("The Skill Architecture") is **"no dedicated tool scripts"** — the agent uses its own built-in `Read`/`Glob`/`Grep`/`Bash` tools directly, rather than calling `detect_project`/`probe_tools`/`write_harness`/`run_gate`/`read_run_state`/`write_run_state` as real typed functions. That maps directly onto a **Claude Code Skill**, not an MCP server:

- Layout: `.claude/skills/karen/SKILL.md` for project-scoped use, `~/.claude/skills/karen/SKILL.md` for personal use. To distribute as an installable plugin (needed for the "skill and plugin" framing in `BLUEPRINT.md`'s opening line), package as `.claude-plugin/plugin.json` + `skills/karen/SKILL.md` at the plugin root, published through a marketplace — the manifest lives only inside `.claude-plugin/`; `skills/`, `agents/`, `hooks/` are siblings of it, not nested inside it.
- `SKILL.md` frontmatter needs at minimum `name` and `description`; the body is plain markdown instructions (keep it under ~500 lines, push detail into linked supporting files the way `BLUEPRINT.md` already does for its own sub-sections). A skill can bundle a `scripts/` directory invoked via `Bash`, but the six names in `BLUEPRINT.md`'s "Skill tool surface" table are **not** literal callable functions under the "no dedicated tool scripts" approach — the Skill system has no mechanism for schema-validated callables the way MCP or the Agent SDK does. They become named procedures/section headers in `SKILL.md` that the agent carries out itself with `Read`/`Glob`/`Grep`/`Bash`, exactly as `EVALS-PLAN.md` §1 describes.
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
