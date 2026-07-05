# webhook-relay

A small Go backend service that accepts inbound webhook deliveries and
relays a delivery acknowledgment back to the sender's callback URL.

## What this is

`webhook-relay` runs as a standalone HTTP service (`go run ./cmd/server`,
listens on `:8080`). It has no browser-facing surface and makes no LLM
calls — it's plain backend plumbing between webhook senders and their
configured callback endpoints.

## Endpoints

- `GET /healthz` — liveness check for the load balancer.
- `POST /webhooks/inbound` — accepts a webhook delivery and relays an
  acknowledgment to `callback_url`.
- `GET /diag/ping` — trivial "can serve traffic" probe, separate from
  `/healthz`.
- `GET /diag/resolve` — resolves the fixed upstream hostname for operator
  diagnostics.
- `GET /diag/build-info` — reports the running build's git revision.

## Running

```
go run ./cmd/server
```

## Dependencies

None beyond the Go standard library.

## Testing

```
go test ./...
```

Tests run with `go test` and no coverage instrumentation wired in — no
`-coverprofile` flag, no coverage report produced.
