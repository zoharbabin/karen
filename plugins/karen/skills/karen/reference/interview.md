# The init conversation

`karen init` is a two-step process driven by your own reasoning, not a fixed wizard.

## Step 1 — Automated analysis

Run `detect_project` (see `detect-project.md`) and `probe_tools` (see `probe-tools.md`) first, every time. Don't ask the interview questions until you know what analysis could already answer — a project with an existing `.eslintrc` shouldn't be asked about its linting setup. A project with no test runner configured should be asked what it uses, then asked why if it says none.

**`karen init` never edits the project's own source, config, or tests — only `.karen/`, `.karen.json`, and `PERMISSIONS-CHARTER.md`.** If analysis or the interview surfaces a real pre-existing defect (a broken lint config, a missing `removeEventListener`, coverage below the agreed threshold, a hardcoded secret), that finding belongs in the harness you're building — as a live gate failure the first `karen audit` will report, or as a `knownGaps`/`exceptions` entry if the user says it's intentional or already tracked — never as something you fix in the moment. Don't ask "want me to fix this now?" and don't act on "yes, fix it" as license to edit source during `init`; redirect: *"I'll wire that up as a gate finding — you'll see it on the first `karen audit` and can fix it then."* This keeps `karen init` deterministic and side-effect-free on the codebase, and keeps the harness measuring the project's real, unmodified state rather than a state Karen edited into passing.

## Step 2 — Conversational interview

Have a real conversation to fill in what analysis couldn't determine. Questions adapt to what was already discovered. The interview covers:

- What the project does and who uses it
- Deployment context and runtime environment (see `deployment-profiles.md`)
- Audience segment for `project.audience` (`enterprise`/`internal`/etc.) and distribution scope (internal-only vs. external, and for a published package, who can install it and where it runs once they do) are two different questions — ask them as two separate questions, never combined into one "internal-only, or external too?" prompt. A public registry listing tells you nothing about whether the actual users are enterprise customers, individual developers, or an internal team, so a distribution-scope answer ("external customers install it") must never get silently written into the `audience` field without a distinct follow-up asking who those customers actually are — even within the same turn, ask the distribution question, get its answer, then ask the audience question as its own sentence with its own question mark, rather than presenting both as branches of one question. This still applies when distribution scope itself has more than two branches (internal team vs. enterprise customer vs. open-source/community) — folding all of those branches into one question is the same bundling mistake, just with three options instead of two, and it still leaves the audience-segment question unasked:
  - Bad (three-way distribution-scope branch standing in for the audience question): "Are the teams installing this your own internal team, external enterprise customers, or is this an open-source package anyone can install?"
  - Good (distribution scope first, then audience as its own sentence): "Who installs this today — your own team, or people outside your organization?" ... "And for those outside users, are they enterprise customers, individual developers, or the general open-source community?"
- Audience and data sensitivity (PII, payment data, health data, auth tokens)
- Compliance or regulatory requirements
- Whether it's AI-powered or used with LLM coding agents (see the `ai-agent` profile in `deployment-profiles.md` — ask both questions separately, they have different answers). "AI-powered" means the project itself makes runtime LLM calls (a prompt-injection/output-handling surface); "used with LLM coding agents" means the project is *authored or maintained* by tools like Claude Code/Copilot (an agent-context-file surface). A project can be either, both, or neither, and one is not evidence for the other:
  - Bad (runtime LLM usage folded in as a parenthetical aside on the authorship question): "Is this project built with an AI coding agent like Claude Code or Copilot (and does it also happen to call an LLM at runtime)?"
  - Good (two separate questions, each with its own question mark): "Do you use an AI coding agent like Claude Code or Copilot to write this project?" ... "Separately — does the project itself make calls to an LLM at runtime, e.g. to answer user queries or generate content?"
- Coverage threshold if not found in existing config
- For any stub/unimplemented branch found during analysis: is this a known limitation, or work in progress? (See `quality-dimensions.md`'s Known Gaps vs. Exceptions.)
- For a parameter, variable, or identifier *name* that would trip a keyword-based gate check but carries no actual secret value (a parameter literally named `password`/`secret`/`token` that a nearby comment says is just a pass-through, never persisted or logged, or an `eval`-named variable that never calls `eval`): ask the human to confirm the claim rather than accepting the comment as settled — a comment asserting intent is source signal, not interview confirmation. Once confirmed, record it as a passthrough-parameter note; there's no secret-shaped value here to suppress.
- For an actual secret-*shaped* literal (a string constant matching the length/letter+digit heuristic in `quality-dimensions.md`'s Security section) whose own comment claims it's a fake/placeholder (`DEFAULT_API_KEY = "FAKE-..."`, "must never ship in a tagged release"): still ask, to understand the intent — but confirming the claim is true never turns into a suppression, allowlist entry, or exception written to `.karen.json`. Zero-tolerance secret scanning has no "confirmed fake" exception (see `quality-dimensions.md`: "Zero-tolerance means no exceptions in production code" and "Don't add a keyword/prefix allow-list to suppress specific values... it will just as easily suppress a real secret"). Keep the finding live until the value actually moves out of source — an env var, a `.env.example` placeholder, something generated at install time — and tell the human that's what needs to happen, not that the finding will be waived.
- For any existing quality-gate-like script found during analysis: what does it actually cover, not just what its name suggests? (See `reconciliation.md`.)
- If more than one manifest was found: which subproject is primary, if any, and does each subproject need its own profile? (See `monorepo.md`.)

Follow up when an answer changes what matters: "you said this runs in the browser — does it handle microphone or camera access?" The depth and direction of the interview is driven by your own reasoning about what the answer implies, not a fixed question list you work through mechanically.

**Analysis often surfaces more than one distinct candidate topic of the same kind — e.g. several separate network call sites with different resiliency postures, or several separate trust-boundary questions about different endpoints.** Ask about each one individually as its own topic rather than folding multiple distinct candidates into a single combined question — a combined question reads efficient but usually gets a combined, non-specific answer that only actually resolves one of the topics, leaving the others silently unconfirmed.

**A term the user volunteers as color while answering a different question is not the same as that topic being confirmed.** If a user's answer to "what does this do" happens to mention "it's a browser-direct-js SDK" or "we publish it on PyPI," that's a label, not a confirmation of the specific things Karen's harness needs from that topic — deployment context needs the instance-isolation/cleanup expectations behind `browser-direct-js` specifically, distribution scope needs to know who can actually install and run the thing, not just that a registry exists. Don't cross a topic off the interview list because the word for it appeared somewhere in the transcript; ask the concrete follow-up that turns the label into an actionable answer, the same way you'd follow up on "it handles payment data" by asking which compliance regime that implies, rather than treating the mention itself as done.

**This also applies to a signal Karen herself surfaces, not just one the user volunteers — naming a deployment context in your own message doesn't excuse skipping its concrete follow-up.** If you tell the user "got it, browser-direct-js deployment" and the very next thing you ask about is a different topic (audience size, traffic volume), the instance-isolation/`destroy()`-teardown question behind `browser-direct-js` still hasn't been asked — don't let the next question you happen to reach for become a substitute for the one the signal you just named actually calls for:
  - Bad (names the deployment context, then the next question pivots away to something unrelated): "Got it — this instantiates directly in the browser per page load. And roughly how many end users hit this per day?"
  - Good (the next question follows up on the exact signal just named): "Got it — this instantiates directly in the browser per page load. When a page navigates away or a component unmounts, does anything call a `destroy()`/cleanup method to tear the instance down, or could multiple instances pile up over a session?"

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

## Pre-finalization checkpoint

**Before writing `.karen.json` or generating the harness, reconcile the transcript against the required-topics list above** (what/who, deployment context, audience segment, distribution scope, data sensitivity, compliance, both AI-powered questions asked separately, coverage threshold, stub/known-gaps reconciliation, gate-flaggable-identifier reconciliation, existing-gate reconciliation, monorepo profile-per-subproject). For each topic, confirm it was actually asked and substantively answered in this conversation — not merely inferred from source signal, not merely mentioned as color while answering a different question (see above), and not skipped because a turn went sideways (a malformed reply, a confused user response, an emission attempt that didn't land as a real question). A plausible source-derived inference is not a substitute for asking a topic the interview is specifically required to settle, even when the inferred value turns out to match the right answer — the value being right by luck doesn't make the process correct, and the next project won't be as lucky. If any required topic was never actually covered, ask it now before proceeding. Only once every required topic has a real answer in the transcript should you move on to writing the harness.

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
