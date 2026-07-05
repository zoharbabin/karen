package subscribers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWebhookNotifierNotifyDeliversMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	n := NewWebhookNotifier(server.URL)
	if err := n.Notify("hello"); err != nil {
		t.Fatalf("Notify returned error: %v", err)
	}
}
