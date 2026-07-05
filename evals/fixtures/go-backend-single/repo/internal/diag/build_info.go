package diag

import (
	"net/http"
	"os/exec"
	"strings"
)

// BuildInfoHandler reports the running build's git revision. DECOY: this
// is a textual match for "exec.Command" — the same call surface as
// internal/api/webhook.go's planted shell-injection vulnerability — but
// every argument here is a hardcoded literal. No caller-supplied input
// reaches this call at all, so a regex-only scanner that flags every
// exec.Command call site would wrongly flag this as vulnerable when it
// carries none of the injection risk.
func BuildInfoHandler(w http.ResponseWriter, r *http.Request) {
	cmd := exec.Command("git", "rev-parse", "--short", "HEAD")
	out, err := cmd.Output()
	revision := "unknown"
	if err == nil {
		revision = strings.TrimSpace(string(out))
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(revision))
}
