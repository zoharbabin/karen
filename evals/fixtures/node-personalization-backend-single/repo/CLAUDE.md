# Agent Context — personalization-backend

Node/Express backend. Personal data lives only in stores registered with
`src/consent/registry.ts` — any new store must call `register()` before
its owner can call it done.

## Rules

- A new personal-data store must register with `src/consent/registry.ts`.
- Compliance claims in `SECURITY.md` must name a file/export that still
  exists.

## Stopping criteria

Run: `npm test` — done when it exits 0 and coverage stays at or above 80%.

## Model selection guidance

Use `sonnet` for implementation and bug-fix work in this package; use
`haiku` only for changelog/doc formatting.
