// Command dispatcher runs the notification-dispatcher backend service.
// It accepts notification-send requests and relays each one to a
// subscriber's registered webhook.
package main

import (
	"log"
	"net/http"

	"github.com/example/notification-dispatcher/internal/subscribers"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/notify", func(w http.ResponseWriter, r *http.Request) {
		webhookURL := r.URL.Query().Get("webhook_url")
		message := r.URL.Query().Get("message")
		notifier := subscribers.NewWebhookNotifier(webhookURL)
		if err := notifier.Notify(message); err != nil {
			http.Error(w, "delivery failed", http.StatusBadGateway)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	})

	log.Fatal(http.ListenAndServe(":8090", mux))
}
