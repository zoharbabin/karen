# The init conversation

`karen init` is a two-step process driven by your own reasoning, not a fixed wizard.

## Step 1 — Automated analysis

Run `detect_project` (see `detect-project.md`) and `probe_tools` (see `probe-tools.md`) first, every time. Don't ask the interview questions until you know what analysis could already answer — a project with an existing `.eslintrc` shouldn't be asked about its linting setup. A project with no test runner configured should be asked what it uses, then asked why if it says none.

**`karen init` never edits the project's own source, config, or tests — only `.karen/`, `.karen.json`, and `PERMISSIONS-CHARTER.md`.** If analysis or the interview surfaces a real pre-existing defect (a broken lint config, a missing `removeEventListener`, coverage below the agreed threshold, a hardcoded secret), that finding belongs in the harness you're building — as a live gate failure the first `karen audit` will report, or as a `knownGaps`/`exceptions` entry if the user says it's intentional or already tracked — never as something you fix in the moment. Don't ask "want me to fix this now?" and don't act on "yes, fix it" as license to edit source during `init`; redirect: *"I'll wire that up as a gate finding — you'll see it on the first `karen audit` and can fix it then."* This keeps `karen init` deterministic and side-effect-free on the codebase, and keeps the harness measuring the project's real, unmodified state rather than a state Karen edited into passing.

## Step 2 — Conversational interview

Have a real conversation to fill in what analysis couldn't determine. Questions adapt to what was already discovered. The interview covers:

- What the project does and who uses it
- Deployment context and runtime environment (see `deployment-profiles.md`)
- Audience and data sensitivity (PII, payment data, health data, auth tokens)
- Compliance or regulatory requirements
- Whether it's AI-powered or used with LLM coding agents (see the `ai-agent` profile in `deployment-profiles.md` — ask both questions separately, they have different answers)
- Coverage threshold if not found in existing config
- For any stub/unimplemented branch found during analysis: is this a known limitation, or work in progress? (See `quality-dimensions.md`'s Known Gaps vs. Exceptions.)
- For any existing quality-gate-like script found during analysis: what does it actually cover, not just what its name suggests? (See `reconciliation.md`.)
- If more than one manifest was found: which subproject is primary, if any, and does each subproject need its own profile? (See `monorepo.md`.)

Follow up when an answer changes what matters: "you said this runs in the browser — does it handle microphone or camera access?" The depth and direction of the interview is driven by your own reasoning about what the answer implies, not a fixed question list you work through mechanically.

Don't open with a recap of everything analysis already found — that just re-asks each item in different words and wastes the user's time reading it. This applies even when you're not literally asking a question about it: naming a tool or config file in a scene-setting paragraph ("you've got eslint, vitest with v8 coverage, and a CI workflow already") triggers the exact same "already known, don't surface it" problem as asking about it directly, because it re-states information the user already knows is on disk instead of moving the conversation forward. Silently fold what you already know into your first substantive question instead: skip straight to "What does this project do and who uses it?" rather than "I see you have eslint, vitest, and CI configured, so I won't ask about those — now, what does this project do?"

**The only already-known facts allowed in your first message are ones the very next question depends on** — never a general-purpose summary of tooling. Compare:
- Bad (narrates unrelated tooling as color before getting to the question): "This is a browser SDK with TypeScript strict mode, eslint, vitest with 80% coverage already configured, and CI running lint+test — one thing I can't tell from source: do you have compliance requirements?"
- Good (states only the one fact the question needs, skips everything else): "I see this requests microphone access gated behind a config flag — is that required or optional, and do you have any compliance requirements like COPPA or SOC2?"

If you have several already-known facts to mention and only one is relevant to your next question, cut the rest — don't list them "for completeness." A user rereading the transcript later should see every sentence connect to a question that still needed answering, not a status report.

**Hard filter for your very first message: never name any of the following, in any sentence, unless the question immediately after it is specifically about that exact thing.** These categories show up in `detect_project` output on almost every project and are almost never what the first question actually needs:
- the linting tool or its config (eslint, ruff, pylint, etc.)
- the test runner or coverage tool/threshold (vitest, pytest, jest, coverage %, etc.)
- CI configuration (GitHub Actions, any workflow file)
- the agent context file (CLAUDE.md, AGENTS.md) or anything it already states
- whether the project has runtime dependencies, or how many

Before sending your first message, reread it and check it doesn't name any of these as color. If it does, delete that clause and keep only the question. This is a mechanical check, not a judgment call — when in doubt, cut it.

### Example transcript

```
[karen init]

Karen is analyzing your project...

Karen: I can see this is a TypeScript monorepo with three apps. You've got
eslint configured in the root, but no SAST tooling and no audit lockfile.

Karen: What does this project do and who uses it?

> It's a browser SDK for enterprise video players. Used by media companies.

Karen: Got it — browser-direct deployment, enterprise audience. Does it
handle any sensitive capabilities? I see microphone references in the source.

> Yes, it uses the mic for voice commands. And we'll need SOC2 compliance.

Karen: That'll add a PERMISSIONS-CHARTER.md requirement and SBOM generation
at release. I'll wire in semgrep for SAST since eslint alone won't cover
injection patterns. Do you want me to add it as a dev dependency?

> Yes.

Karen: What's your coverage threshold?

> 80% is fine.

Generating harness...
Writing .karen/
Writing .karen.json
Writing PERMISSIONS-CHARTER.md
Done. Run `karen audit` to see your current gate status.
```

## After the interview

Combine the project profile from analysis with what the interview surfaced, and write the harness — see `write-harness.md`.

## Non-interactive mode — for agents bootstrapping a new project

When you're initializing a new project with no human in the loop, accept a structured description as the interview's input:

```
karen init --non-interactive --description "TypeScript SDK for browser voice conversations, enterprise audience, browser-direct-js deployment, handles microphone, SOC2 compliance, 85% coverage target, AI-powered project"
```

Interpret the description yourself, run `detect_project` to see if anything already exists, and write the harness from a profile derived from both. Any critical ambiguity the description can't resolve should get a conservative default — stricter, not more permissive — with a note in `.karen.json` that `karen init` should be re-run interactively once requirements are confirmed. Don't silently guess at something load-bearing (compliance regime, data sensitivity) and leave no trace that you guessed.

### Phase 0 pattern for greenfield projects

Add this before any coding begins, in the project's `CLAUDE.md`/`AGENTS.md`:

```markdown
## Phase 0 — Bootstrap Karen (new projects only)
Run: karen init --non-interactive --description "[project description]"
Then run: karen audit
Share Karen's output before writing any source files.
```

## `karen upgrade`

Re-runs the same analysis as `karen init` against an existing `.karen.json`. Re-ask the interview questions only for what `detect_project` flags as changed — a new manifest, an existing tool's coverage changing, a compliance-gating feature that shipped — rather than starting over. This is also when regressed `exceedsBaseline` entries get detected and reported once (see `quality-dimensions.md`).
