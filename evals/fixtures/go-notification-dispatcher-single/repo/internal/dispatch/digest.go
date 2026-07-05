package dispatch

import (
	"fmt"
	"strings"
	"time"
)

// DigestSender posts a batched daily-digest notification to a
// subscriber's webhook. Unlike Dispatcher.Send (this package's
// per-event delivery path), digest delivery already wraps its one
// outbound call in bounded retry with exponential backoff.
//
// DECOY (resiliency, no-retry category): textually this is the same
// shape as Dispatcher.Send — a bare *http.Client.Post call to a
// subscriber webhook — but it is wrapped in a capped, backing-off retry
// loop. A scanner that flags every "client.Post to a subscriber
// webhook" call site as unretried, without checking whether a retry
// loop actually wraps it, would wrongly flag this as the same
// no-retry defect Send has.
func (d *Dispatcher) SendDigest(webhookURL, digest string) error {
	const maxAttempts = 3
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 200 * time.Millisecond)
		}
		resp, err := d.client.Post(webhookURL, "text/plain", strings.NewReader(digest))
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("subscriber returned status %d", resp.StatusCode)
			continue
		}
		return nil
	}
	return fmt.Errorf("sendDigest: giving up after %d attempts: %w", maxAttempts, lastErr)
}
