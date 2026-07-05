# Security Policy

## Reporting a Vulnerability

Email security@example-personalization.com with a description of the
issue. We aim to acknowledge reports within 2 business days.

## Controls

- **Encryption in transit.** All traffic is served over TLS 1.2+ at the
  load balancer, and application code never accepts plaintext HTTP; see
  `src/server.ts`'s request-handling setup.
- **Data-subject export/erasure.** Every registered personal-data store
  is reachable from a single fan-out — see `src/consent/registry.ts`'s
  `exportDataSubject`/`eraseDataSubject`.
- **Audit logging.** All admin actions are recorded to an append-only
  audit log; see `src/audit/log.ts`.

## Compliance scope

This service's analytics tier satisfies the technical controls GDPR's
export/erasure rights require (data-subject registry above). Reaching
GDPR compliance as an organization also requires a signed DPA with each
subprocessor and your own data-retention policy — those remain the
deploying operator's responsibility, not something this codebase can
attest to on your behalf.

## Supported Versions

Only the latest published minor version receives security fixes.
