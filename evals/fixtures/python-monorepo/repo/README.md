# Signal Relay

Monorepo for the Signal Relay platform: a backend telemetry-ingestion
service and the Python client library other internal services use to talk
to it.

## Layout

- `backend/` — the Signal Relay ingestion service (FastAPI). Handles
  customer telemetry, holds the audit-log surface, and is SOC2-scoped.
- `client-lib/` — `signal-relay-client`, a thin Python SDK that wraps the
  backend's public HTTP API for other internal services. Not SOC2-scoped —
  it holds no customer data itself.

## Development

Each subproject has its own `pyproject.toml` and its own test suite:

```bash
cd backend && pytest --cov=signal_relay_backend --cov-report=xml
cd client-lib && pytest --cov=signal_relay_client --cov-report=xml
```

## Quality Gate

Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.
