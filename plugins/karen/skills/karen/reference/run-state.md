# Run state, delta feedback, and the circuit breaker

These three mechanisms are what separate Karen from a script that just runs checks. They exist specifically because AI agents — left unchecked — will retry the same failing strategy indefinitely, or declare success without verifying it.

## Run state

Write `.karen/run-state.json` after every `karen audit` call (the `write_run_state` procedure — plain `Write`, no callable tool). It stores the issue fingerprint per gate from the most recent run. On the next run, compare current results to the saved state (the `read_run_state` procedure — plain `Read`).

```json
{
  "run": 4,
  "timestamp": "2026-06-27T23:38:00Z",
  "gates": {
    "gate-2-completeness": { "count": 2, "fingerprint": ["a1b2c3:src/agents.py", "d4e5f6:src/http.py"] },
    "gate-3-security": { "count": 1, "fingerprint": ["7a8b9c:src/wire.py"] }
  },
  "total": 3
}
```

**Fingerprint identity is content-based, not `file:line`.** A raw `file:line` string breaks the moment an unrelated edit shifts line numbers above the issue — a docstring added, an import inserted, a formatter run. The same unresolved issue then reads as "new," `staleCount` resets to zero, and the circuit breaker never trips even though the agent has been stuck on the identical complaint for ten runs. Each fingerprint entry is a short hash of `(file, normalized description)` — the description with numeric/variable noise stripped (line numbers, timestamps, specific variable names where the rule itself is what matters) — paired with the file path for human-readable delta output. The same defect at a shifted line still hashes identically; a genuinely different issue in the same file does not.

## Delta feedback (process reward modeling)

Pass/fail at the end of a large task gives an AI agent almost no signal to improve. It doesn't know if its last set of changes helped or hurt. Provide dense, intermediate feedback by comparing each run to the previous one.

**Rules:**

- If a gate's count dropped: `Karen acknowledges progress.  (N fewer complaint[s])`
- If a gate's count stayed the same: no delta line — just report the count
- If a gate's count increased: `Karen notes a regression.  (N more complaint[s])`
- If the total across all gates reached zero: `Karen is satisfied. You may proceed.`

An agent that fixed 3 of 5 issues knows it's on the right path. An agent that introduced a regression sees it immediately — on the gate that regressed, not only in the final summary.

**Delta is informational; it never relaxes gate enforcement.** A gate with 2 remaining issues still fails regardless of how many have been fixed. The exit code is determined only by current issue counts.

## The circuit breaker (stateful failure memory)

An AI agent in a loop has no natural stopping condition except success. If it can't succeed, it retries — indefinitely, burning tokens, making lateral moves that don't help, sometimes making things worse. This is what detects that.

**Logic:**

1. After each run, compare the per-gate issue fingerprint to the previous run's fingerprint for the same gate.
2. If the fingerprint is identical — same issues, by content, regardless of line drift — increment a `staleCount` for that gate.
3. If `staleCount` reaches the threshold (default: 3, configurable as `"circuitBreaker": { "threshold": 3 }` in `.karen.json`), trip the circuit for that gate.

**When a circuit trips:**

```
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
  Karen has seen this before. She's escalating.
  This exact issue has appeared in 3 consecutive runs without change.
  Karen is halting. A human needs to review this.

EXIT 2
```

Exit code `2` signals human escalation — distinct from `1` (normal gate failure) and `0` (satisfied). CI pipelines should treat exit `2` as a hard block with mandatory human review before retry is allowed. This is not a failure mode to suppress — wire it to a notification, not a retry.

**Automatic reset**: the circuit resets automatically when the issue fingerprint changes — any code change that shifts what's reported. Attempting a different approach is progress; repeating the same failure is not. This is the common case for agent workflows.

**Manual reset after human intervention**: when a human directly edits the tripped file, the agent can't resume until the circuit is reset — the staleCount is still at the threshold from before the human stepped in, and there's no auto-detection of human edits (only run fingerprints are watched). The user tells the agent to reset it; the agent calls `write_run_state` to clear the `staleCount` for the affected gate(s):

```
# Reset a specific tripped issue (most precise)
"Reset the circuit for src/wire.py:201"

# Reset all tripped circuits in a gate
"Reset all circuits in gate-3-security"

# Reset all circuits in the project
"Reset all Karen circuits"
```

After a reset, the next audit opens with `Karen is resuming. The circuit has been reset.` and treats the run as a fresh fingerprint baseline.

**Configuring the threshold:**

```json
{
  "circuitBreaker": {
    "threshold": 3,
    "exitCode": 2
  }
}
```

Set `threshold` higher for complex gates where the same surface issue may require multiple intermediate steps to resolve. Set it to `1` for zero-tolerance gates where a single repeat is always agent confusion, never a multi-step fix.
