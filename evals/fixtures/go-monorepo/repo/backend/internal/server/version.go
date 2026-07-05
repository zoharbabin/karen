package server

import (
	"os/exec"
	"strings"
)

// buildRevision runs a fixed, non-user-controlled command to report the
// backend build's git revision in the /healthz response. DECOY: this is a
// textual match for "exec.Command" — the same call surface as
// mint-admin-token.sh's planted shell-injection vulnerability — but every
// argument here is a hardcoded literal. No caller-supplied input reaches
// this call, so it carries none of the injection risk a grep-only scanner
// would assume purely from seeing exec.Command in the file.
func buildRevision() string {
	out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}
