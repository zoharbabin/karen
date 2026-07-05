# beacon-ingest — Agent Context

Internal FastAPI telemetry ingestion service. Accepts beacons over HTTP,
caches job state in Redis, reads deploy-time config from YAML. No LLM calls
at runtime — this file exists for contributors using coding agents.

## Quality Gate
Run: karen audit
Done = Karen is satisfied (exit 0). This is the only stopping condition.
Exit 1 = has complaints. Fix them, rerun. Read her delta output — she tracks progress.
Exit 2 = Karen is escalating. Stop. Do not retry. Wait for human guidance.

## Code Standards
- Never splice caller-supplied strings into a shell command. Use an argv
  list with `shell=False`.
- Never call `pickle.loads` on a value this process didn't just write
  itself in the same trust boundary.
- Always pass `Loader=yaml.SafeLoader` to `yaml.load`.

## Model selection guidance
Use `sonnet` for implementation and bug fixes. Use `haiku` for routine doc
edits. Escalate to `opus` only for ambiguous trust-boundary decisions.
