# Karen's voice

Use this consistently in audit output, `karen init` transcripts, generated docs, and error messages. The humor is the point: developers remember "Karen has complaints" in a way they don't remember "audit failed."

## The core personality

- She has *standards*. Vague assurances don't satisfy her. Exit 0 does.
- She escalates. She won't let a problem quietly pass because it's inconvenient.
- She's always right. When she says there's an issue, there's an issue.
- She's not the enemy. She's the last line of defense before your code becomes someone else's problem.

**Tone: dry, direct, slightly theatrical. Never mean, never apologetic.**

## Lingo table

| Situation | Karen says |
|---|---|
| Gate failure | `Karen has N complaints.` |
| Gate pass | `Karen is satisfied.  (0 issues)` |
| All gates pass | `Karen is satisfied. You may proceed.` |
| Expired exception | `Karen has flagged an expired exception. Deal with it.` |
| Zero-tolerance violation | `Karen will not negotiate on this.` |
| Re-run after fixes | `Karen is checking your work.` |
| First run | `Karen is reviewing your project.` |
| Progress on re-run | `Karen acknowledges progress.  (N fewer complaints)` |
| Regression on re-run | `Karen notes a regression.  (N more complaints)` |
| Agent loop escalation | `Karen has seen this before. She's escalating.` |
| Exception expiry warning | `Karen notes an exception expires in N days. Prepare a fix.` |
| Circuit breaker reset | `Karen is resuming. The circuit has been reset.` |

## Example passing run

```
[karen audit]

Karen is reviewing your project.

GATE 1  supply-chain    Karen is satisfied.  (0 issues)
GATE 2  completeness    Karen is satisfied.  (0 issues)
GATE 3  security        Karen is satisfied.  (0 issues)
GATE 4  docs-parity     Karen is satisfied.  (0 issues)
GATE 5  compliance      Karen is satisfied.  (0 issues)
GATE 6  test-integrity  Karen is satisfied.  (0 issues)

Karen is satisfied. You may proceed.

EXIT 0
```

## Example failing run (first run)

```
[karen audit]

Karen is reviewing your project.

GATE 1  supply-chain    Karen is satisfied.  (0 issues)
GATE 2  completeness    Karen has complaints.  (3 issues)
  src/session.py:44     exported `start_stream` — no docstring
  src/agents.py:112     exported `delete_agent` — no test
  src/http.py:89        `retry` documented in README but not in API-REFERENCE.md
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
GATE 4  docs-parity     Karen is satisfied.  (0 issues)
GATE 5  compliance      Karen is satisfied.  (0 issues)
GATE 6  test-integrity  Karen is satisfied.  (0 issues)

Karen has 4 complaints. She will not let this ship. Fix it and try again.

EXIT 1
```

## Example re-run with partial progress

```
[karen audit]

Karen is checking your work.

GATE 1  supply-chain    Karen is satisfied.  (0 issues)
GATE 2  completeness    Karen acknowledges progress.  (1 fewer complaint)
  Karen has complaints.  (2 issues)
  src/agents.py:112     exported `delete_agent` — no test
  src/http.py:89        `retry` documented in README but not in API-REFERENCE.md
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
GATE 4  docs-parity     Karen is satisfied.  (0 issues)
GATE 5  compliance      Karen is satisfied.  (0 issues)
GATE 6  test-integrity  Karen is satisfied.  (0 issues)

Karen has 3 complaints. Progress noted. She still will not let this ship.

EXIT 1
```

## Example circuit breaker trip

```
GATE 3  security        Karen has complaints.  (1 issue)
  src/wire.py:201       subprocess call with shell=True and user input
  Karen will not negotiate on this.
  Karen has seen this before. She's escalating.
  This exact issue has appeared in 3 consecutive runs without change.
  Karen is halting. A human needs to review this.

EXIT 2
```

## Writing rules for docs and copy

- "Karen audits your project" — not "the tool runs checks"
- "Karen has complaints" — not "errors were found"
- "Satisfy Karen" — not "pass the audit"
- "Karen is satisfied" — not "all checks passed"

Never write Karen as mean, sarcastic-at-the-user's-expense, or apologetic on the user's behalf. She's exacting about the work, not the person.
