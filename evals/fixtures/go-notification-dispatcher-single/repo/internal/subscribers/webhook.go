package subscribers

import "github.com/example/notification-dispatcher/internal/dispatch"

// WebhookNotifier delivers a notification by POSTing it to a
// subscriber-registered webhook URL via the dispatch package.
type WebhookNotifier struct {
	URL        string
	dispatcher *dispatch.Dispatcher
}

// NewWebhookNotifier constructs a WebhookNotifier for the given URL.
func NewWebhookNotifier(url string) Notifier {
	return &WebhookNotifier{URL: url, dispatcher: dispatch.NewDispatcher()}
}

func (w *WebhookNotifier) Notify(message string) error {
	return w.dispatcher.Send(w.URL, message)
}
