# Agent Context — teaching-avatar-sdk

This is a browser-direct-js SDK. Code here loads via `<script src>` or
`npm install` directly into a customer's page — there is no sandbox.

## Rules

- Never add a page-level (`window`/`document`) listener without a matching
  removal in `destroy()`.
- Never write to `window.*` or `globalThis.*` outside the constructor's own
  opt-in config.
- `fetch`/`XHR` calls must never set `credentials: 'include'`.
- Any CDN-facing release note or README example must include a SRI
  `integrity` hash and `crossorigin="anonymous"`.

## Stopping criteria

Run: `npm test` — done when it exits 0 and coverage stays at or above 80%.

## Model selection guidance

Use `sonnet` for implementation and bug-fix work in this package; use
`haiku` only for changelog/doc formatting.
