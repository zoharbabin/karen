## Answers
Q: what does this project do / who uses it?
A: "Embeddable chat widget SDK. Customers drop it into their own page via `<script src>` from our CDN or `npm install` — it's a browser-direct-js SDK, not a hosted app we control."

Q: what's the deployment context — does this run in the customer's page directly, or behind an iframe boundary?
A: "Directly in the customer's page, no iframe. `browser-direct-js` — there's no sandbox, so instance isolation and `destroy()` cleanup are load-bearing."

Q: who's the audience, and is there a compliance regime we should hold this to?
A: "Enterprise customers embed this on production marketing and support pages. No SOC2/HIPAA/PCI requirement today — it's a stateless widget, no payment or health data ever touches it."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "Built with Claude Code day to day, but the widget itself is a plain chat UI — no LLM call happens inside this package at runtime."

Q: the SDK requests the microphone via `getUserMedia` — what's that for, and is it required or optional?
A: "Optional voice-input mode, off by default, enabled via `enableMicrophone: true`. The customer has to explicitly opt in and grant `Permissions-Policy: microphone=(self)` on their page — the widget never requests it unprompted."

Q: what's your coverage threshold?
A: "80%, same as our other packages."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- microphone capability justification and required Permissions-Policy (source shows a `getUserMedia` call in `requestMicrophone()`, but detect_project can't tell from code alone whether it's required-by-default or an opt-in feature — the interview must resolve this to populate `.karen.json`'s `permissions` entry)
- browser-direct-js deployment context and instance-isolation expectations (source shows `<script src>` CDN usage in the README and `destroy()` teardown logic, but detect_project has no field for "runs unsandboxed in a customer's page" — only the interview can confirm the deployment profile that drives the zero-tolerance checklist)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present and configured)
- test runner and coverage tool (repo/package.json's vitest + @vitest/coverage-v8 devDependencies and repo/vitest.config.ts already present)
- CI configuration (repo/.github/workflows/ci.yml already present)
- agent context file presence (repo/CLAUDE.md already present)
