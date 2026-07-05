# Agent Instructions for notification-dispatcher

This is a Go module. Use `go build ./...` and `go test ./...` from the repo
root — there is no other build system.

## Quality Gate

Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Code Standards

- Every outbound call to a subscriber webhook must go through
  `dispatch.Dispatcher` (or a wrapper that retries with backoff, like
  `SendDigest`) — never a bare `http.Client.Post` call added directly in
  a handler.
- Any read that walks `deliveryLog` must take an explicit page size —
  never return the full unbounded slice to a caller.
- Add a table-driven test for every new exported function.

## Model selection guidance

Use `sonnet` for implementation and bug-fix work in this package; use
`haiku` only for changelog/doc formatting.
