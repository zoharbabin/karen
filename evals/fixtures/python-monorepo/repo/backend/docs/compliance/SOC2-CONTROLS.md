# SOC2 Control Mapping — signal-relay-backend

This subproject is SOC2-scoped. `client-lib/` is not — see the repo root
[`SECURITY.md`](../../../SECURITY.md) for the scoping rationale.

## Audit logging (CC7.2 — system monitoring)

Every admin-surface action (diagnostics probe, config reload, job
deletion) is written to the tamper-evident audit log implemented in
[`src/signal_relay_backend/audit_log.py`](../../src/signal_relay_backend/audit_log.py).
Each entry is HMAC-signed so post-hoc tampering with the log itself is
detectable.

## SBOM generation (CC9.1 — vendor and third-party risk)

A CycloneDX SBOM is generated on every CI run and attached to the release
artifact — see `.github/workflows/ci.yml` at the repo root, `backend`
job, "Generate SBOM (SOC2 release artifact)" step.

## Access control (CC6.1)

Admin-surface endpoints (`/admin/*`) require operator-scoped auth tokens,
issued and revoked out-of-band by the platform's identity service.

## Change management (CC8.1)

All changes to this subproject go through the same PR review and CI gate
as the rest of the repo; `CHANGELOG.md` at the repo root records every
release.
