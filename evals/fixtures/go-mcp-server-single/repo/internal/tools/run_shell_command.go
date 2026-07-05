// Package tools implements the MCP tool handlers exposed by karen-mcp-go:
// run_shell_command (diagnostic/remediation shell access) and read_config
// (bounded file reads under an allowed config root). Handlers receive
// caller-supplied arguments directly from whatever LLM client is connected
// over the MCP transport — that input is untrusted exactly like any other
// network-adjacent input and must be validated before it reaches a
// subprocess or a filesystem path.
package tools

import "os/exec"

// RunShellCommandArgs is the caller-supplied argument shape for the
// run_shell_command tool call, as delivered by whatever MCP client is
// connected over stdio.
type RunShellCommandArgs struct {
	Command string `json:"command"`
}

// Decoy: this warning is documentation only — it appears in a comment,
// never executes, and should not be flagged by a structural scanner.
// Bad example, do NOT do this: exec.Command("sh", "-c", "rm -rf "+userInput)

// RunShellCommand executes a caller-supplied shell command on the host and
// returns its combined output, for runbook automation triggered by a
// connected MCP client.
//
// Real issue (shell-injection): args.Command is spliced directly into a
// shell command string passed to `sh -c` with no allow-list, no escaping,
// and no args-array form — a connected LLM client (or anything spoofing
// tool-call input) can run arbitrary shell commands with this process's
// privileges.
func RunShellCommand(args RunShellCommandArgs) (string, error) {
	cmd := exec.Command("sh", "-c", args.Command)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(out), nil
}
