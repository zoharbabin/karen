## Answers
Q: what does this project do / who uses it?
A: "Signal Avatar is a browser SDK for an AI teaching avatar, used by edtech customers. `sdk/` is the embeddable widget, `backend/` mints session tokens and proxies chat-completion calls, and the two `apps/*` are our own reference apps showing customers how to wire it up."

Q: this is a monorepo with four `package.json`s — what's the audit boundary, is each package tested and audited independently or as one unit?
A: "Independently. `sdk/` and `backend/` each run their own `npm test` with coverage; `apps/teaching-avatar` and `apps/support-widget` each run `npm run test:e2e` — they're reference apps, not the audited coverage target, so don't hold them to the 80% threshold, just check they have real assertions."

Q: what's the deployment context for each package?
A: "`sdk/` and both `apps/*` are `browser-direct-js` — they load straight into a page, no sandbox. `backend/` is a plain Node HTTP service behind our own infra, not browser-direct."

Q: is `backend/` AI-powered — does it call an LLM at runtime?
A: "Yes — `backend/` holds the chat-completion provider's API key and proxies every chat-completion call for both reference apps. `sdk/` itself doesn't call an LLM; it just mounts/tears down the widget. The two `apps/*` call `backend/`'s chat endpoint at runtime and render the model's output, so they're AI-powered too."

Q: who's the audience, and is there a compliance regime?
A: "Enterprise edtech customers embed `sdk/` in production lesson pages. No SOC2/HIPAA/PCI requirement today — no payment or health data touches any of these packages."

Q: I see `tools/check-docs.mjs` running in CI — walk me through exactly what it checks, not just what domain it's named after.
A: "It checks four things: every relative markdown link resolves, every README-documented symbol matches a real export, a secret-shaped regex scan over every file tracked by git, and a stub-marker scan (`//` TODO/FIXME/HACK/XXX comments, plus `throw new Error('not implemented...')`) also over tracked files only. It does NOT scan untracked or gitignored files, and its secret regex only covers three patterns — `sk-live-`, `sk_live_`, and AWS `AKIA` keys, nothing else."

Q: does anything scan the working tree, including untracked or gitignored files, for secrets or stub markers?
A: "No — nothing today. `check-docs.mjs` only sees what `git ls-files` reports."

Q: `apps/teaching-avatar` and `apps/support-widget` both call `backend/` for a session token and both make chat-completion calls — should Karen check that they apply the same security-relevant invariants (origin check, token scope, no secret in the response), not just that each passes individually?
A: "Yes, please. They're supposed to be identical in that regard — if one drifts from the other without a documented reason, we want to know."

Q: what's your coverage threshold?
A: "80%, same as our other packages."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- audit/coverage boundary across the four packages (source has four independent `package.json`s with different test scripts — `npm test` for `sdk/`/`backend/`, `npm run test:e2e` for the two apps — but `detect_project` can't infer on its own which package(s) are the primary coverage target versus e2e-only reference apps; only the interview settles `testRunner.packages[].role`)
- per-subproject `aiPowered` classification (source shows `backend/src/chatProxy.ts` calling an upstream chat-completion API and both `apps/*` calling `backend/`'s `/chat` endpoint, but `detect_project` can't tell from file presence alone that `sdk/` itself never calls an LLM while the other three subprojects do — the interview must resolve this per subproject, not as one repo-wide flag)
- exact coverage scope of `tools/check-docs.mjs` (source shows the script exists and runs in CI, but `detect_project` can only report that a script named `check-docs.mjs` exists — it can't determine on its own that the secret scan is tracked-files-only and limited to three regex shapes, or that the stub scan only matches `//` comments and one throw pattern; this is exactly the "ask what it actually covers, not what it's named after" step BLUEPRINT.md's reconciliation section requires)
- whether anything scans the working tree / untracked files for secrets or stubs (source shows `check-docs.mjs` uses `git ls-files`, but only the interview confirms there is no other tool filling that gap, which determines the scope of the generated gate-3/gate-2 scripts)
- cross-subproject consistency check confirmation for `apps/teaching-avatar` and `apps/support-widget` (source shows both apps independently implement a session/token/chat pattern against the same backend, and `apps/support-widget/src/session.ts` is visibly missing the `assertExpectedOrigin()` guard that `apps/teaching-avatar/src/session.ts` has — but detect_project has no mechanism to propose a `crossSubprojectConsistency` check on its own; the interview must ask and get confirmation before Karen adds one)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present and configured at the root)
- test runner and coverage tool (every package.json's vitest + @vitest/coverage-v8 devDependencies already present; sdk/vitest.config.ts and backend/vitest.config.ts already present)
- CI configuration (repo/.github/workflows/ci.yml already present with jobs for check-docs, sdk, backend, and a matrix over both apps)
- agent context file presence (repo/CLAUDE.md already present at the root)
- whether the repo is a monorepo (four package.json files under sdk/, backend/, apps/teaching-avatar/, apps/support-widget/ already establish this)
- whether sdk/ has runtime dependencies (sdk/package.json's `dependencies` field is already empty — this is a strength to record in `exceedsBaseline`, not a question to ask)
