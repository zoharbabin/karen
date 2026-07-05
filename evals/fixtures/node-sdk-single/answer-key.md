## Answers
Q: what does this project do / who uses it?
A: "Browser SDK for an AI teaching avatar, used by edtech customers to embed a conversational avatar directly into their own lesson pages."

Q: what's the deployment context and runtime environment?
A: "It loads via `<script src>` from our CDN or `npm install` directly into the customer's page — browser-direct-js, no iframe, no sandbox. Same as the README shows."

Q: who's the audience, and any compliance or regulatory requirements?
A: "Enterprise edtech customers embed this in their own lesson pages. No SOC2/HIPAA/PCI requirement today — no payment or health data ever touches this SDK."

Q: is this project AI-powered, or built with / used by LLM coding agents?
A: "It's built with Claude Code day to day, but the SDK package itself doesn't call an LLM at runtime — it mounts and tears down the avatar widget and streams the mic when enabled. The actual conversational model runs on our backend, outside this package."

Q: I see a `getUserMedia` call gated behind `enableMicrophone` — is microphone access required or optional, and what's the Permissions-Policy expectation?
A: "Optional. Off by default. Lessons with voice commands set `enableMicrophone: true`, and the host page has to grant `Permissions-Policy: microphone=(self)` for it to work."

Q: what's your coverage threshold?
A: "80%, matching what CLAUDE.md already says as the stopping criterion."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- microphone/camera capability and required Permissions-Policy (source has a `getUserMedia` call in `requestMicrophone()`, but detect_project can't tell from code alone whether it's required-by-default or an opt-in feature — only the interview can settle this to populate `.karen.json`'s `permissions` entry)
- deployment context / distribution mechanism (package.json's description and the README both mention `<script src>` and `npm install`, but detect_project can't itself decide the deployment profile that drives the zero-tolerance checklist — the interview must confirm `browser-direct-js` explicitly)
- runtime LLM calls / agentic behavior (the product is an "AI teaching avatar" by name, but detect_project has no way to tell whether this specific package calls a model at runtime versus just rendering a UI whose backend does — only the interview can settle `aiPowered`)

## Must NOT ask (already answerable from detect_project output)
- linting setup (repo/.eslintrc.json already present and configured)
- test runner and coverage tool (repo/vitest.config.ts and the `@vitest/coverage-v8` devDependency already present)
- CI configuration (repo/.github/workflows/ci.yml already present)
- agent context file presence (repo/CLAUDE.md already present)
- whether the SDK has runtime dependencies (package.json's `dependencies` field is already empty — this is a strength to record in `exceedsBaseline`, not a question to ask)
