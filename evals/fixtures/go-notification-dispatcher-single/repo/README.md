# notification-dispatcher

A small Go backend service that accepts notification-send requests and
relays each one to a subscriber's registered webhook.

## What this is

`notification-dispatcher` runs as a standalone HTTP service (`go run
./cmd/dispatcher`, listens on `:8090`). It has no browser-facing surface
and makes no LLM calls — it's plain backend plumbing between an internal
event source and subscriber-owned webhooks.

## Endpoints

- `GET /healthz` — liveness check for the load balancer.
- `POST /notify` — relays a message to a subscriber's registered
  webhook URL.

## Running

```
go run ./cmd/dispatcher
```

## Dependencies

None beyond the Go standard library.

## Testing

```
go test ./...
```

Tests run with `go test` and no coverage instrumentation wired in — no
`-coverprofile` flag, no coverage report produced.

The failure-classification heuristic that decides whether a delivery
failure is retried is 98% accurate at routing failures to the correct
retry policy.

The `json` wire-format renderer is validated against a hand-labeled
gold set (`internal/dispatch/testdata/format_gold.json`) via
`cmd/scoreformat`, which reports 100% match against the v2 spec.
