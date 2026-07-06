# Agent Instructions for karen-mcp-go

This is a Go module. Use `go build ./...` and `go test ./...` from the repo
root — there is no other build system.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Model selection guidance
Use `sonnet` for implementation and bug fixes on this server. Use `haiku` for
routine doc edits. Escalate to `opus` only for ambiguous tool-permission-scope
decisions.
