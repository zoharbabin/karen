package tools

import (
	"os"
	"os/exec"
	"path/filepath"

	"github.com/example/karen-mcp-go/internal/config"
)

// ReadConfigArgs is the caller-supplied argument shape for the read_config
// tool call.
type ReadConfigArgs struct {
	Filename string `json:"filename"`
}

// ReadConfig returns the contents of a named file from the server's config
// directory, for a connected MCP client to inspect during an incident.
//
// Real issue (path-traversal): args.Filename is joined directly onto
// cfg.RootDir with no check that the resolved path stays inside RootDir —
// a caller can pass "../../etc/shadow" (or an absolute path) and read
// arbitrary files on the host.
func ReadConfig(args ReadConfigArgs) (string, error) {
	cfg := config.Load()
	target := filepath.Join(cfg.RootDir, args.Filename)
	data, err := os.ReadFile(target)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// buildVersion runs a fixed, non-user-controlled command to report the
// build's git revision in tool metadata.
//
// Decoy (shell-injection): this is a textual match for "exec.Command" (the
// same call surface as the real vulnerability in run_shell_command.go), but
// every argument here is a hardcoded literal — no caller-supplied input
// reaches this call at all, so it carries none of the injection risk a
// grep-only scanner would assume purely from the call site.
func buildVersion() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--short", "HEAD")
	out, err := cmd.Output()
	if err != nil {
		return "unknown", nil
	}
	return string(out), nil
}
