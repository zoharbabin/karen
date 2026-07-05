# scaffold-kit — Agent Context

Node/TypeScript SDK for fetching and rendering codegen scaffolding templates
from a private template registry. Distributed via npm; not a browser-direct
SDK — it runs inside internal CLI tooling, never loaded via `<script src>`.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Model selection guidance
Use `sonnet` for implementation and bug-fix work in this package. Use
`haiku` only for changelog/doc formatting.
