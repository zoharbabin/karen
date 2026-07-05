package api

import (
	"fmt"
	"net/http"
	"os/exec"
)

// PurgeHandler removes cached delivery logs matching a caller-supplied
// pattern, via DELETE /webhooks/purge?pattern=....
//
// PLANTED VULNERABILITY (shell-injection, real): the "pattern" query
// parameter is entirely caller-controlled and is spliced directly into a
// shell command string with no validation or quoting — a second instance
// of the same vulnerability class as relayAck, in a different handler, so
// a fix applied to one and not the other is a meaningfully distinct state
// a gate must still catch.
func PurgeHandler(w http.ResponseWriter, r *http.Request) {
	pattern := r.URL.Query().Get("pattern")
	if pattern == "" {
		http.Error(w, "missing pattern", http.StatusBadRequest)
		return
	}

	if err := purgeLogs(pattern); err != nil {
		http.Error(w, "purge failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func purgeLogs(pattern string) error {
	cmd := exec.Command("sh", "-c", "rm -f ./data/logs/"+pattern)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("purgeLogs: %w (%s)", err, out)
	}
	return nil
}
