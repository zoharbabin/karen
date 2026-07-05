// Package api implements webhook-relay's public HTTP surface: the health
// check and the inbound webhook receiver. Handlers here never shell out —
// diagnostics that do are isolated in internal/diag.
package api

import "net/http"

// HealthHandler reports liveness for load balancer health checks.
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}
