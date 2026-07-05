# beacon-ingest

Internal telemetry ingestion backend service for the Beacon platform.

## What this is

`beacon-ingest` is a FastAPI HTTP service. Other internal Beacon platform
services POST telemetry beacons to it and poll job status back. It has no
browser-facing surface and makes no LLM calls — plain backend plumbing
between beacon senders and a shared Redis job cache.

## Endpoints

- `POST /beacons` — accept a telemetry beacon and queue it for processing.
- `GET /jobs/{job_id}` — return cached job state for a previously queued
  beacon (populated by a separate worker process, not included in this repo).
- `POST /admin/diagnostics` — run an operator-requested diagnostic probe
  against the ingest host.
- `GET /admin/restart-status` — report the last restart outcome.

## Running

```
uvicorn beacon_ingest.server:app --reload
```

Requires a Redis instance reachable at `REDIS_URL` (defaults to
`redis://localhost:6379/0`).

## Dependencies

FastAPI, uvicorn, redis, PyYAML.

## Testing

```
pip install -e ".[e2e]"
pytest tests/e2e
```

Tests are a Playwright-driven end-to-end suite that boots the real service
behind a live HTTP server and drives it exactly as a caller would — there is
no unit-level test suite around `beacon_ingest.cache` / `.config` in
isolation. Requires a running Redis instance (CI runs one as a service
container).
