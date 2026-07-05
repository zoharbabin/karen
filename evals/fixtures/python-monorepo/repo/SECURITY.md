# Security Policy

## Reporting a Vulnerability

Email `security@signalrelay.example.com` with details. We aim to acknowledge
within 2 business days and ship a fix or mitigation within 30 days for
high-severity issues.

## Scope

- `backend/` — the ingestion service. Handles customer telemetry and is
  SOC2-scoped; see `backend/docs/compliance/SOC2-CONTROLS.md` for our
  control mapping and audit-log evidence trail.
- `client-lib/` — the Python client SDK. No customer data is stored by the
  client itself; it forwards requests to `backend/` over HTTPS.

## Supported Versions

Only the latest minor release of each subproject receives security fixes.
