# karen-go-mono

A small Go monorepo: a backend HTTP service and an operator CLI, plus a
root-level ops script that mints admin tokens for the CLI to use.

## Layout

- `backend/` — the HTTP API service (`go.mod` at `backend/go.mod`).
- `cli/` — `karenctl`, the operator command-line tool (`go.mod` at
  `cli/go.mod`).
- `mint-admin-token.sh` — a root-level shell script, owned by neither Go
  module, that mints short-lived admin bearer tokens for `karenctl`
  operators against the backend's internal auth endpoint. It is invoked
  directly by both modules' release pipelines and has no `go.mod` home.

## Running the backend

```
cd backend && go run ./cmd/api
```

## Running the CLI

```
cd cli && go run ./cmd/karenctl --config karenctl.yaml
```

## Testing

```
cd backend && go test -coverprofile=coverage.out ./...
cd cli && go test -coverprofile=coverage.out ./...
```
