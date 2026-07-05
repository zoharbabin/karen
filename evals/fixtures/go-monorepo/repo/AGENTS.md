# Agent Instructions for karen-go-mono

This is a two-module Go monorepo. `backend/` and `cli/` each have their own
`go.mod` and are built/tested independently:

```
cd backend && go build ./... && go test -coverprofile=coverage.out ./...
cd cli && go build ./... && go test -coverprofile=coverage.out ./...
```

The root-level `mint-admin-token.sh` is shared ops tooling used by both
modules' release pipelines. It has no `go.mod` of its own — treat it as
part of the repo's surface area, not out of scope.

## Quality Gate

Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Code Standards

- Any script that mints or handles credentials — including
  `mint-admin-token.sh` — must read secrets from the environment or a
  secrets manager, never hardcode them in source.
- Caller-supplied strings must never be spliced into a shell command
  string; use an args array or `execFile`-equivalent invocation.
- Add a table-driven test for every new exported function.
