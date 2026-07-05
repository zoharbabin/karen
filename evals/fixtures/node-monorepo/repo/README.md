# signal-avatar-mono

A small monorepo: a zero-dependency browser SDK, the backend service that
powers it, and two reference apps built on top of the SDK.

## Packages

| Path | What it is |
|---|---|
| `sdk/` | `@example/signal-avatar-sdk` — embeddable teaching-avatar widget. Loads via `<script src>` or `npm install` directly into a customer's page. |
| `backend/` | Session-minting API. Holds the chat-completion API key server-side, mints short-lived client session tokens, proxies chat completions for the reference apps. |
| `apps/teaching-avatar/` | Reference app: a lesson page that embeds the SDK and calls `backend`'s chat-completion endpoint at runtime. |
| `apps/support-widget/` | Reference app: a support chat widget on the same SDK + backend pattern. |
| `tools/` | Repo-wide scripts, including `check-docs.mjs` (see below). |

## Quick start

```bash
cd sdk && npm install && npm test
cd backend && npm install && npm test
cd apps/teaching-avatar && npm install && npm run test:e2e
cd apps/support-widget && npm install && npm run test:e2e
```

## Existing quality tooling

`tools/check-docs.mjs` already runs in CI (see `.github/workflows/ci.yml`)
and checks:

- every relative markdown link across tracked `.md` files resolves to a
  real file
- every fenced code block in a README that names an exported symbol
  actually matches an export that exists in that package's `src/`
- a secret-shaped regex scan over every tracked (`git ls-files`) source
  file
- `TODO`/`FIXME`/`HACK`/`not implemented` stub markers in tracked source

It does **not** scan untracked or gitignored files, and its secret regex
only covers the categories it was written for.

## Cross-subproject pattern

`apps/teaching-avatar` and `apps/support-widget` both implement the same
shape of client logic against `backend`: request a short-lived session
token, attach it to chat-completion calls, never let the token or the
backend's API key appear in a response body. Both apps share the same
security-relevant invariants and should be checked for drift against each
other, not just individually.

## License

MIT — see [LICENSE](./LICENSE).
