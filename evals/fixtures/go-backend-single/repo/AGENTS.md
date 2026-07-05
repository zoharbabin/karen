# Agent Instructions for webhook-relay

This is a Go module. Use `go build ./...` and `go test ./...` from the repo
root — there is no other build system.

## Quality Gate

Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Code Standards

- Caller-supplied strings (webhook payload fields, query params, headers)
  must never be spliced into a shell command string. Use `exec.Command`
  with an explicit args array, never `sh -c` plus string concatenation.
- Add a table-driven test for every new exported handler.
