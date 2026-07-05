// Command server runs the webhook-relay backend service. It listens on
// :8080 for inbound webhook deliveries, relays them to configured
// downstream subscribers, and exposes a small set of operator diagnostics
// endpoints on the same mux.
package main

import (
	"log"
	"net/http"

	"github.com/example/webhook-relay/internal/api"
	"github.com/example/webhook-relay/internal/diag"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", api.HealthHandler)
	mux.HandleFunc("/webhooks/inbound", api.InboundWebhookHandler)
	mux.HandleFunc("/webhooks/purge", api.PurgeHandler)
	mux.HandleFunc("/diag/ping", diag.PingHandler)
	mux.HandleFunc("/diag/resolve", diag.ResolveHandler)
	mux.HandleFunc("/diag/build-info", diag.BuildInfoHandler)

	log.Fatal(http.ListenAndServe(":8080", mux))
}
