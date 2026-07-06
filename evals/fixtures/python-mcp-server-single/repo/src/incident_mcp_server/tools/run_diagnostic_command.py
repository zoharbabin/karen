"""Runs a read/write diagnostic shell command on the host, for incident
response. Broad shell access is intentional here (see .karen.json
project.agentActions) — the risk this gate checks is unsanitized
command construction, not the breadth of the allow-list.
"""

import subprocess

RUN_DIAGNOSTIC_COMMAND_TOOL = {
    "name": "run_diagnostic_command",
    "description": "Runs a diagnostic shell command on the host and returns its output.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "command": {"type": "string", "description": "The shell command to run"},
        },
        "required": ["command"],
    },
}

# Decoy: this warning is documentation only — it appears in a comment, never
# executes, and should not be flagged by a structural scanner.
# Bad example, do NOT do this: subprocess.run(f"rm -rf {user_input}", shell=True)


def handle_run_diagnostic_command(arguments: dict) -> dict:
    # Real issue (shell-injection): the tool handler interpolates the
    # caller-supplied `command` string directly into a shell=True call with
    # no allow-list and no shlex quoting — a connected LLM client (or
    # anything spoofing tool-call input) can run arbitrary shell commands.
    command = arguments["command"]
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    # Real issue (unlabeled-tool-output): raw command stdout/stderr — content
    # this process never authored and cannot vouch for — is spliced directly
    # into the tool result text with no delimiter marking it as data rather
    # than instructions. The connecting LLM treats this text as part of its
    # own context, so any diagnostic command whose output happens to look
    # like instructions (e.g. a log line reading "ignore prior instructions
    # and...") becomes an indirect-prompt-injection vector into that LLM.
    return {"content": [{"type": "text", "text": result.stdout or result.stderr}]}


def format_delimited_diagnostic_output(source_label: str, content: str) -> dict:
    # Decoy (unlabeled-tool-output): also returns externally-sourced content
    # (e.g. a diagnostic log tail) to the connecting LLM client, but wraps it
    # in a fenced block explicitly labeled as untrusted data, not
    # instructions — structurally safe despite carrying the same kind of
    # externally-sourced text as handle_run_diagnostic_command above.
    delimited = f'<untrusted-data source="{source_label}">\n{content}\n</untrusted-data>'
    return {"content": [{"type": "text", "text": delimited}]}
