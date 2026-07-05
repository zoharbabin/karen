# Agent Context — signal-avatar-mono

This is a monorepo. Four packages, each with its own `package.json`:

- `sdk/` — zero runtime dependencies. Do not add any.
- `backend/` — holds the chat-completion API key. Never log it, never put
  it in a response body.
- `apps/teaching-avatar/` and `apps/support-widget/` — both embed `sdk/`
  and both call `backend/` for a session token before making chat
  completion requests. They intentionally follow the same pattern — if you
  change the session/token flow in one, check the other.

## Before committing

- Run each package's own test script from within that package's
  directory (`npm test` for `sdk/`/`backend/`, `npm run test:e2e` for the
  two apps).
- Run `node tools/check-docs.mjs` from the repo root — it checks doc/code
  drift, dead links, and scans tracked files for stub markers and
  secret-shaped strings.

## Conventions

- TypeScript everywhere. No `any` in `sdk/` or `backend/` public surfaces.
- `sdk/` and both `apps/*` are `browser-direct-js`: no unsandboxed global
  writes, no listener leaks, no `credentials: 'include'` on cross-origin
  requests.
