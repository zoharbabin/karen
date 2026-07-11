# Integration

Because gate scripts are plain shell files committed to the repo, they run anywhere — no Karen skill required outside of `karen init`/`karen upgrade`. CI, pre-commit hooks, and local dev all execute the same scripts written during init.

## The LLM prompt pattern

The gate manifest never goes in the prompt — it lives in `.karen/harness.json` and the gate scripts themselves. The prompt is always this three-phase structure, written into the project's `CLAUDE.md`/`AGENTS.md`:

```markdown
## What you're doing
[One paragraph: what the project does, who uses it, deployment context]

## Phase 1 — Let Karen review (no code changes)
Run: karen audit
Share Karen's complete output before touching any source file.

## Phase 2 — Address Karen's complaints
Work through failing gates in order (Gate 1 first, last gate last).
After fixing each gate, rerun: karen audit
Do not advance to the next gate until Karen is satisfied with the current one.
Karen will acknowledge progress (fewer complaints) or flag regressions (more
complaints) on each re-run — read her delta output before deciding what to fix next.

## Escalation rule
If karen audit exits 2, Karen has detected a stuck loop.
Stop immediately. Do not retry. Report the output and wait for human guidance.
Attempting the same fix a fourth time will not succeed.

## Stopping rule
The task is complete when and only when Karen is satisfied —
`karen audit` exits 0 with all gates passing and all existing tests green.
"Looks good" is not a stopping condition. Karen's satisfaction is.
```

**Why it works:**

- The calling LLM never reads the gate taxonomy — it runs a command and responds to output
- Karen gives precise targets (`file:line`), not subjective feedback to interpret
- Delta output (progress/regression) gives dense intermediate signal after each fix — see `run-state.md`
- The fix-verify loop prevents hiding regressions under later fixes
- Exit code 0 is binary — no self-rating escape hatch
- Exit code 2 is a hard stop — no retry loops past the circuit breaker threshold
- "Karen is satisfied" is unambiguous in a way "high quality" never will be

## Teaching Karen new complaints

Karen's quality knowledge lives in two places: `quality-dimensions.md` (and the other reference files — the authoritative spec) and your own reasoning as the LLM generating gate scripts from it.

**For project-specific complaints:** edit the gate script in `.karen/gates/` directly and register any new gate in `.karen/harness.json`. The gate contract is stable — anything emitting `FILE:LINE\tmessage` lines and a `PASS/FAIL (N issues)` summary will work.

**For patterns that belong in all projects:** that's a change to this skill's own reference files, not something to patch per-project. If you're the one maintaining this skill, see the plugin repo's `CONTRIBUTING.md` for how `BLUEPRINT.md` and `reference/*.md` stay in sync.

**When a better tool emerges:** if a superior SAST scanner, linter, or auditor becomes available, don't try to patch around it — re-run `karen init`/`karen upgrade` with the updated tool list, and generate gate scripts that call the new tool. The domain expert changed; the orchestration layer didn't need to.

Karen's complaint list only ever grows. She never forgets — but she delegates the checking to tools maintained by experts in each domain.

**Upgrade contract:** new checks introduced in a Karen update are warning-only for the first release cycle. Projects can opt in to immediate enforcement with `"strictUpgrades": true` in `.karen.json`. After one cycle, they become blocking.

## CI (GitHub Actions) — Karen blocks the merge

```yaml
- name: Karen's Review
  run: bash .karen/run-all.sh .
  # exit 1 = Karen is not satisfied; exit 2 = Karen is escalating, page a human
```

## Pre-commit — fast security check before committing

```bash
bash .karen/gates/gate-3-security.sh .
```

## Full audit — run by the agent or manually

```bash
bash .karen/run-all.sh .
```

## Gradual rollout for existing codebases

Initialize Karen in warn-only mode:

```bash
bash .karen/run-all.sh . --warn       # reports issues, exits 0 — for baselining
bash .karen/run-all.sh . --baseline   # snapshots current counts into .karen/baseline.json
bash .karen/run-all.sh .              # blocks only regressions beyond the baseline
```

Same scripts everywhere. The agent's audit, CI, and local dev all run the same committed shell files. No environment drift. No "it passed locally."

## Coding agent hooks — enforcing harness timing

The gate harness is only as reliable as the agent's discipline in running it. Agents with hook systems let you make that discipline structural rather than instructional. During `karen init`, generate the appropriate hook configuration for the agent system in use.

Because the gate scripts are committed shell files, hooks invoke them directly — no Karen skill required at hook-run time.

**Claude Code (`~/.claude/settings.json` or project `.claude/settings.json`):**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .karen/gates/gate-3-security.sh ."
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .karen/run-all.sh ."
          }
        ]
      }
    ]
  }
}
```

The `PostToolUse` hook runs a fast security gate after every file write. The `Stop` hook runs the full audit before the agent ends its turn — the agent can't report completion until all gates pass. If any gate exits non-zero, the hook output lands in the agent's context on the next turn.

**Other agent systems:**

| Agent | Hook point | Mechanism |
|---|---|---|
| Cursor | After each file save | `.cursor/rules` — invoke the relevant gate script directly |
| GitHub Copilot Workspace | Pre-completion | Workspace task invoking `.karen/run-all.sh` |
| Aider | After each commit | `--auto-test "bash .karen/run-all.sh ."` flag |
| Custom agents | After any tool call that writes files | Shell-out to the gate scripts; treat non-zero exit as continuation/escalation signal |

For agents with no hook system, the `CLAUDE.md`/`AGENTS.md` prompt pattern above is the fallback — it makes the stopping condition explicit in the agent's context even without structural enforcement.

**Note on this skill's own bundled hooks:** this plugin does not ship a `PostToolUse`/`Stop` hook of its own — hooks run unsandboxed with no extra permission gate, and auto-wiring one into a stranger's project without an explicit, reviewed step would be exactly the kind of silent action Karen exists to prevent elsewhere. Generating a project's own hook config, as described above, is something the agent does deliberately during `karen init` with the user watching — never something this skill does to itself on install.
