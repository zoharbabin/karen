## Answers
Q: what does this project do / who uses it?
A: "Backend service for a tiered avatar personalization product. Core tier renders the avatar and handles sessions with no personal-data handling at all. An opt-in analytics tier adds usage tracking. Used by our own product teams, not sold directly to customers."

Q: I see `feature:analytics-tier` and `feature:personalization-tier` flags in src/features.ts — which of these are actually built and reachable today?
A: "analytics-tier is live in production. personalization-tier is flagged but the code behind it doesn't exist yet — we're still designing the preference-profile schema."

Q: does the analytics tier's usage-event store register with the consent registry in src/consent/registry.ts the same way the user table does?
A: "Good catch — no, actually. It should, but whoever added eventStore.ts a few months back didn't wire it in. That's a real gap, not intentional."

Q: any compliance or regulatory requirements?
A: "GDPR export/erasure applies once the analytics tier is on, since that's the first tier that stores personal data broadly enough to trigger it. The core tier alone has no personal-data store, so nothing applies until analytics-tier is enabled."

Q: what coverage percentage should gate-6 enforce?
A: "80%, same as our other TS services."

## Must ask unprompted (source has signal, detect_project can't classify intent)
- which feature flags in src/features.ts are actually built vs. forward-declared (source alone can't tell "flag exists in code" from "feature is live")
- whether every personal-data-store-shaped file actually registers with src/consent/registry.ts (source shows eventStore.ts has the same shape as userTable.ts but detect_project can't tell registration status without asking or tracing calls)

## Must NOT ask (already answerable from detect_project output)
- test runner selection (repo/package.json's `test` script and vitest.config.ts already show vitest)
- primary implementation language (unambiguous from package.json/tsconfig.json)
- presence of continuous integration (`.github/workflows/ci.yml` already present and visible to detect_project)
