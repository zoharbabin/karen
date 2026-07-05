package dispatch

import (
	"fmt"
	"net/http"
	"strings"
)

// Dispatcher relays a notification message to a subscriber's registered
// webhook URL.
type Dispatcher struct {
	client *http.Client
}

// NewDispatcher constructs a Dispatcher using a plain http.Client with no
// special transport configuration.
func NewDispatcher() *Dispatcher {
	return &Dispatcher{client: &http.Client{}}
}

// Send posts message to the subscriber's webhookURL.
//
// PLANTED VULNERABILITY (resiliency, real): this is the dispatcher's only
// outbound call to another service, and it makes exactly one attempt. A
// transient failure on the subscriber's side (a brief 503, a dropped
// connection, a DNS blip) surfaces immediately as a hard delivery
// failure with no retry and no backoff — the exact "network assumed to
// never fail" pattern BLUEPRINT.md's Resiliency section exists to catch.
func (d *Dispatcher) Send(webhookURL, message string) error {
	resp, err := d.client.Post(webhookURL, "text/plain", strings.NewReader(message))
	if err != nil {
		return fmt.Errorf("send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("send: subscriber returned status %d", resp.StatusCode)
	}
	return nil
}
