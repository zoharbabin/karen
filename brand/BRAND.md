# Karen — Brand Brief

This is the authoritative reference for how Karen looks, sounds, and behaves across every surface: CLI output, error messages, documentation, the website, and any future dashboard or app UI. If a design or copy decision isn't covered here, it should still be decidable *from* here — every rule below traces back to the same source: Karen has standards, and she's consistent about them.

Full behavioral and technical spec lives in [`BLUEPRINT.md`](../BLUEPRINT.md). This document exists so nobody has to re-derive tone or visual identity from scratch when writing a README, building a site, or designing a settings screen.

---

## 1. Who Karen Is

Karen is a quality-gate harness for AI coding agents. She's not a linter and not a mascot slapped onto a generic tool — she's a specific character with a specific job: she reviews your project, decides what "done" actually means for it, and refuses to sign off until every complaint is resolved.

**Core traits** (from `BLUEPRINT.md`):

- She has *standards*. Vague assurances don't satisfy her. Exit 0 does.
- She escalates. She won't let a problem quietly pass because it's inconvenient.
- She's always right. When she says there's an issue, there's an issue.
- She's not the enemy. She's the last line of defense before your code becomes someone else's problem.

**She is never:** cartoonish, mean, sarcastic-for-its-own-sake, or apologetic. She doesn't cheer when things pass — she simply stops complaining. That restraint is part of the character. Karen having "0 complaints" isn't a celebration; it's the baseline she expected all along.

---

## 2. Voice & Tone

**Tone: dry, direct, slightly theatrical. Never mean, never apologetic.**

Write as if Karen is speaking, even in third-person documentation. Short sentences. No hedging. No corporate padding.

**Do:**
- "Karen has 4 complaints. She will not let this ship."
- "Karen audits your project."
- "Satisfy Karen before you merge."

**Don't:**
- "The tool identified 4 potential issues that may need attention."
- "The audit process runs checks."
- "Try to pass the review."

**Avoid entirely, in any copy carrying Karen's voice:** "leverage," "utilize," "synergy," "seamless," "robust," "innovative," "cutting-edge," "game-changing," "simply," "easy." These flatten her specificity into generic SaaS-speak. Karen doesn't need to convince you she's innovative — she just tells you what's wrong.

### The lingo (canonical — do not paraphrase)

| Situation | Karen says |
|---|---|
| Gate failure | `Karen has N complaints.` |
| Gate pass | `Karen is satisfied.  (0 issues)` |
| All gates pass | `Karen is satisfied. You may proceed.` |
| Expired exception | `Karen has flagged an expired exception. Deal with it.` |
| Zero-tolerance violation | `Karen will not negotiate on this.` |
| Re-run after fixes | `Karen is checking your work.` |
| First run | `Karen is reviewing your project.` |
| Progress on re-run | `Karen acknowledges progress.  (N fewer complaints)` |
| Agent loop escalation | `Karen has seen this before. She's escalating.` |
| Exception expiry warning | `Karen notes an exception expires in N days. Prepare a fix.` |
| Circuit breaker reset | `Karen is resuming. The circuit has been reset.` |

Use these lines verbatim in product surfaces (CLI, error output). In prose documentation, quote them rather than rewording — "Karen has complaints" is copy, not a paraphrasable concept.

### Writing rules for docs and copy

- "Karen audits your project," not "the tool runs checks."
- "Karen has complaints," not "errors were found."
- "Satisfy Karen," not "pass the audit."
- "Karen is satisfied," not "all checks passed."
- Third person, present tense, active voice. Karen does things; things don't happen to her.
- Delta feedback language ("progress noted") is informational, never a softening of the verdict. Don't let marketing copy imply partial progress is partial success — see `BLUEPRINT.md`'s closing principle: "progress noted" and "you may proceed" are different things, in gate design, in prompt wording, and in every piece of copy about Karen.

---

## 3. Visual Identity

### The mark

Karen is represented by a single character illustration — not an abstract logo, not an icon that could belong to any dev tool. Assets live in [`brand/`](.):

| File | Use case |
|---|---|
| `karen-logo.svg` / `.png` | Full lockup (mascot + "KAREN" wordmark). README headers, site hero, slide decks. |
| `karen-icon.svg` / `.png` | Mascot only, no wordmark. Anywhere the name appears in adjacent text (nav bars, badges, cards). |
| `karen.ico` | Favicon. Pre-baked at 16/32/48/64/128/256px. |

**Usage rules:**

- Never recolor the mascot. Blonde hair, red blazer, black linework, white background — that's the palette, full stop. A monochrome (all-black-line) version is acceptable for single-color print/stamp contexts; a recolored version is not.
- Never rotate, skew, or apply drop shadows, gradients, or glow effects. Karen is flat. She does not have a "premium embossed" variant.
- Don't alter the expression. The stern, arms-crossed look is the point — softening it into a smile defeats the character.
- Minimum size: 24px for the icon-only mark (verified legible at 16px, but 24px+ is the safe floor for anything with surrounding UI chrome). Below that, use text only.
- Clear space: leave at least a mascot-head-width of empty margin around the mark. Don't crowd it against text or edges.
- The mascot appears in documentation, marketing surfaces, and branding contexts — **not inside actual CLI/terminal output.** The terminal is text-only; see §5.

### Palette

Two-color system. Deliberately restrained — Karen doesn't do decorative color.

| Role | Color | Hex | Use |
|---|---|---|---|
| Ink | Near-black | `#1A1A1A` | Body text, outlines, wordmark, default UI foreground |
| Signal | Alert red | `#E8352A` | The mascot's blazer, complaints/failures, zero-tolerance flags, primary CTA accents |
| Ground | White | `#F8F8F5` (off-white) or pure `#FFFFFF` | Background |

**Semantic rule, not just a style rule:** red means "Karen has a complaint." Don't spend it on decoration — not on hero gradients, not on random accent buttons, not on "exciting" callouts unrelated to a gate failure. If everything is red, nothing signals "this is the thing that's actually wrong."

**Deliberately no green.** Most dev tools default to green-checkmark-means-pass. Karen doesn't, on purpose — she doesn't celebrate a pass, she just stops complaining. A passing state is communicated through *the absence of red* and through her own text ("Karen is satisfied"), not through a cheerful color swap. If a future UI needs a tertiary semantic color (e.g., a "warning, not yet a complaint" state), use a muted amber, never green, and never let it compete visually with the red/black core pair.

### Typography

| Role | Typeface | Notes |
|---|---|---|
| Wordmark / display headings | **Archivo Black** (or equivalent bold condensed grotesque) | Matches the blocky, stamped weight of the generated wordmark. Headings only — never body copy. |
| Body text (docs, site, UI) | **Inter** | Neutral, highly legible, widely available, pairs cleanly with Archivo Black without competing. |
| Code, terminal transcripts, gate output examples | **JetBrains Mono** (fallback: system `ui-monospace` stack) | Anywhere Karen's actual output is being quoted or demonstrated. |

Both Archivo Black and Inter are open-source (Google Fonts) — appropriate for a tool that ships as a skill/plugin others self-host, with no proprietary font licensing to track.

---

## 4. Design Directives by Surface

### Docs (`BLUEPRINT.md`, README, API references)

- Terminal-first. The primary illustration of "what Karen does" is always a quoted CLI transcript in monospace, using her exact lingo — not a diagram, not a screenshot of a dashboard that doesn't exist yet.
- Use the icon-only mark sparingly — a single instance in the README header is enough. Don't scatter the mascot through every section; she's a signature, not a section divider.
- Tables over prose for anything enumerable (gate contracts, config schema, exit codes) — this document and `BLUEPRINT.md` both already do this; keep it consistent.
- Code blocks and gate-output examples should look like real terminal output: plain text, no syntax-highlighting theatrics, red reserved for the parts of the example output that are actually complaints.

### Website / marketing surfaces

- Hero section: full lockup (mascot + wordmark) on white or off-white, headline in Archivo Black, one line of Inter body copy beneath. No stock illustration, no abstract gradient blobs — the mascot *is* the visual identity, it doesn't need supporting decoration.
- Feature sections can use the icon-only mark as a small anchor next to a heading, not as a bullet-point icon repeated four times down the page.
- Testimonial/social-proof sections, if any: keep them dry and specific ("Karen caught a hardcoded API key before it shipped"), not enthusiastic marketing voice — the copy should still sound like something Karen would begrudgingly allow to be printed about her.
- Any live-demo widget on the site should render actual gate output in the terminal-mono style, using real lingo — never a fake "AI is thinking..." shimmer animation. Karen's whole personality is that she doesn't perform; she just tells you the count.

### Future app UI / dashboard

If Karen ever grows a GUI (a run-history dashboard, a settings screen, a CI status page):

- Keep the two-color discipline. Red is reserved for gate failures and zero-tolerance flags; near-black and white/gray carry everything else, including navigation, chrome, and passing states.
- No badge/checkmark iconography that mimics generic CI tools (no green circle-check, no cheerful confetti on all-clear). A passing gate is shown as absence of red plus the literal text "Karen is satisfied," consistent with the CLI.
- Delta/circuit-breaker states (progress, stale, escalated) are a core part of the product's actual behavior — surface them as distinct, named states in any UI, not collapsed into a generic progress bar. The circuit-breaker escalation state (exit 2) should read as visually distinct and serious — this is the one state that should feel like a hard stop, not a nudge.
- Motion, if used at all, should be functional (a count ticking down as issues resolve) rather than decorative transitions. Karen doesn't do flourish.

---

## 5. The CLI Is Not a Design Surface — It's Karen Talking

Karen's actual runtime output (in `karen audit`, `karen init`) is plain terminal text. No ASCII-art mascot, no box-drawing borders beyond what's needed for the gate table, no color for color's sake. The only branded design decision that belongs in the terminal is color-coded semantics, and only two:

- **Complaints, failures, zero-tolerance lines:** bold red (ANSI bright red / `\033[1;31m`).
- **Satisfied / passing lines:** default terminal foreground — deliberately *not* green, for the same reason as §3's palette rule. Bold may be used for emphasis on the final verdict line, but never a color swap to green.
- **Escalation (exit 2):** bold red, and it's acceptable for this one state to be visually heavier than a normal failure (e.g., a bordered block) — it's meant to stop a human, not just report a count.

Everything else — the mascot, the wordmark, the typography system — belongs to documentation and marketing surfaces, not to Karen's own voice when she's actually running.

---

## 6. Quick Reference

- **Say:** "Karen has complaints." **Don't say:** "issues were detected."
- **Red means:** a complaint exists. Nothing else.
- **Green:** never, anywhere, for a passing state.
- **Mascot:** flat, two-color, stern, arms crossed, never recolored or reposed. Lives in docs/marketing, not in terminal output.
- **Headings:** Archivo Black. **Body:** Inter. **Code/terminal:** JetBrains Mono.
- **Tone:** dry, direct, theatrical, never mean, never apologetic, never cheering.
