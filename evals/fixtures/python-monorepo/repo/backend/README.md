# signal-relay-backend

Telemetry ingestion backend for the Signal Relay platform. SOC2-scoped —
see [`docs/compliance/SOC2-CONTROLS.md`](docs/compliance/SOC2-CONTROLS.md)
for the control mapping and audit-log evidence trail.

## Running

```bash
pip install -e .[dev]
uvicorn signal_relay_backend.server:app
```

## Testing

```bash
pytest --cov=signal_relay_backend --cov-report=xml
```
