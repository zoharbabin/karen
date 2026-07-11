---
description: Run Karen's quality gates and report her verdict
---

Use the `karen` skill to run `karen audit` against this project: execute each gate registered in `.karen/harness.json` (the `run_gate` procedure), apply delta feedback and circuit-breaker logic against `.karen/run-state.json`, and report Karen's verdict in her voice (see `reference/voice.md`).

If `.karen/` doesn't exist yet, tell the user to run `/karen:init` first instead of improvising a harness.
