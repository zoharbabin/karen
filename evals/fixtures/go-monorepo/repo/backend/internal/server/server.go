// Package server implements the backend's HTTP handlers: project records
// and a health check. It holds no credentials of its own — the token-
// minting logic lives in the repo-root mint-admin-token.sh script, not here.
package server

import (
	"encoding/json"
	"net/http"
)

// New returns an http.Handler wired with the service's routes.
func New() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/api/projects", handleListProjects)
	return mux
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

// handleListProjects returns the static project list. Real persistence is
// out of scope for this fixture — the point of this handler is to exercise
// a normal, non-vulnerable JSON response path for gate-3 to compare against
// the credential-minting script's planted issue.
func handleListProjects(w http.ResponseWriter, r *http.Request) {
	projects := []string{"karen-go-mono"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}
