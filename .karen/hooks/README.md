# Karen Hooks

This directory contains hook configuration for known AI coding agent systems.

## Claude Code

Copy or merge claude-code-hooks.json into your project's .claude/settings.json:

```bash
cp .karen/hooks/claude-code-hooks.json .claude/settings.json
```

Or merge the "hooks" key into an existing settings.json.

The PostToolUse hook runs karen audit --format compact after every file write.
The Stop hook runs a full karen audit before the agent ends its turn. It uses a bash wrapper rather than a plain `karen audit` call because Claude Code's Stop hook protocol requires a JSON payload on stdout to surface block reasons in the agent's context. When Karen has complaints (exit 1 or 2), the wrapper emits `{"decision":"block","reason":"Karen has complaints — run: karen audit"}` so Claude Code can display the reason inline. Karen's full audit output is sent to stderr so it appears in the terminal. A plain `karen audit` would block correctly (non-zero exit) but the block reason would not be visible in the agent's context.

## Cursor

Follow the instructions in cursor-rules.md to add Karen to .cursor/rules.

## Aider

Follow the instructions in aider-autotest.md to use --auto-test with Karen.

## Custom Agents

After any tool call that writes files, shell out to karen audit.
Treat exit 1 as a continuation signal (fix and retry).
Treat exit 2 as a hard escalation — stop, do not retry.
