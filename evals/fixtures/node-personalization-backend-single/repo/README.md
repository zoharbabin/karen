# personalization-backend

Backend service for a tiered avatar personalization product.

## Tiers

- **Core** (always on) — avatar rendering and session handling. No
  personal-data store at all.
- **Analytics** (`feature:analytics-tier`, enabled) — usage-event
  tracking keyed by `(tenant, user)` via `src/datastores/eventStore.ts`.
- **Personalization** (`feature:personalization-tier`, not yet built) —
  will store a per-user preference profile once shipped.

## Data subject requests

`GET /data-subject/:tenant/:user/export` and
`DELETE /data-subject/:tenant/:user` walk every store registered with
`src/consent/registry.ts`.

## Development

```bash
npm install
npm test
```

## Support

See [SECURITY.md](./SECURITY.md) for the vulnerability disclosure process.
