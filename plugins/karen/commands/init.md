---
description: Run Karen's project analysis and interview, then generate a custom quality-gate harness
---

Use the `karen` skill to run `karen init` against this project: analyze the project (`detect_project`/`probe_tools` procedures), conduct the conversational interview, then write `.karen/` and `.karen.json`.

If the user passed arguments to this command, treat them as `--non-interactive --description "..."` input per the skill's non-interactive mode (see `reference/interview.md`) — otherwise run the normal interactive flow.

$ARGUMENTS
