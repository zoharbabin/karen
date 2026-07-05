# prism-sdk — Agent Context

Python client library for the Prism transcription platform. Distributed via
pip to data-engineering teams; not a service, not browser-facing.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Model selection guidance
Use `sonnet` for implementation and bug-fix work in this package. Use
`haiku` only for changelog/doc formatting. Escalate to `opus` only for
ambiguous known-gap-vs-exception classification calls.

## Known gaps and exceptions
See `docs/internal/GAPS.md` for tracked, intentional boundaries. See
`.karen.json` `exceptions` for time-boxed, dated allowances — check the
`expires` date before assuming an exception is still valid.
