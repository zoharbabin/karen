---
description: Build a redacted feedback bundle and help file it as a GitHub issue against the Karen repo
---

Help the user file feedback about Karen (the skill) or the eval benchmark, using this exact procedure — never skip straight to `gh issue create` without showing the bundle first.

## Step 1 — Build the bundle

Run the bundled script and capture its output to a temp file rather than a shell variable, so nothing it contains is ever re-interpreted as shell syntax:

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/collect-feedback-bundle.sh" . > /tmp/karen-feedback-bundle.md
```

## Step 2 — Show the user the exact bundle

Read `/tmp/karen-feedback-bundle.md` back and show its full contents to the user before anything is sent anywhere. Ask them to confirm it's safe to share — the script redacts common secret shapes (AWS keys, GitHub tokens, `sk-` API keys, bearer tokens, `*_KEY`/`*_TOKEN`/`*_SECRET`/`*_PASSWORD` assignments, long base64/hex blobs) but pattern-based redaction can miss project-specific secrets, so a human look is still required. Let the user edit the file directly if they want to strip anything else.

Also ask what kind of feedback this is, so the right issue template is used:

- **Skill bug report** — Karen misbehaved on their project
- **Eval benchmark issue** — a fixture, grading script, or methodology problem in `evals/`
- **Feature request** — a new gate, deployment profile, or fixture

Ask for a one-line title and a short description of what happened / what they expected, to go above the bundle in the issue body.

## Step 3 — File it

Check whether `gh` is installed and authenticated:

```
gh auth status
```

**If `gh` is available and authenticated:** offer to run it directly. Write the title and body to temp files first (never interpolate user-provided text into an inline shell string), then reference those files with `--body-file`:

```
gh issue create --repo zoharbabin/karen --title "$(cat /tmp/karen-feedback-title.txt)" --label <bug|enhancement> --body-file /tmp/karen-feedback-body.md
```

Compose `/tmp/karen-feedback-body.md` as the user's description followed by the bundle from Step 1. This still goes through the normal tool-approval prompt, which is the user's actual consent step — don't treat Step 2's confirmation as a substitute for it.

**If `gh` is unavailable or not authenticated:** don't attempt to post anything. Instead, build a pre-filled issue URL and give it to the user to open in their browser:

```
https://github.com/zoharbabin/karen/issues/new?title=<url-encoded title>&body=<url-encoded body>&labels=<bug|enhancement>
```

URL-encode the title and body yourself (e.g. with `node -e "console.log(encodeURIComponent(require('fs').readFileSync('/tmp/karen-feedback-body.md','utf8')))"` reading from the temp file, not by inlining the text into the `-e` string) — this keeps the user's text out of any shell command entirely.

## Notes

- Nothing in this flow runs automatically or on a schedule. It only runs when the user explicitly asks for `/karen:feedback`.
- Clean up the temp files under `/tmp/karen-feedback-*` after filing, since they may contain project specifics even after redaction.
