package diag

import "net/http"

// jobStatusExecuting is a delivery-queue lifecycle label ("queued",
// "executing", "done") reported in relay metrics. DECOY: the word "exec"
// appears here only inside this unrelated string literal describing a job
// lifecycle state — never as a call to os/exec or any other
// command-execution sink. A textual grep for "exec" would flag this line;
// a structural scanner correctly ignores it since there is no call
// expression here at all.
const jobStatusExecuting = "executing"

// PingHandler is a trivial liveness probe distinct from HealthHandler —
// used to distinguish "process is up" from "process can serve traffic".
func PingHandler(w http.ResponseWriter, r *http.Request) {
	_ = jobStatusExecuting
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("pong"))
}
