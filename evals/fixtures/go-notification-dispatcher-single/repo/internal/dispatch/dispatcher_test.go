package dispatch

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendPostsMessageToWebhook(t *testing.T) {
	var gotBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, 64)
		n, _ := r.Body.Read(buf)
		gotBody = string(buf[:n])
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	d := NewDispatcher()
	if err := d.Send(server.URL, "hello"); err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if gotBody != "hello" {
		t.Fatalf("expected body %q, got %q", "hello", gotBody)
	}
}

func TestSendReturnsErrorOnNonSuccessStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	d := NewDispatcher()
	if err := d.Send(server.URL, "hello"); err == nil {
		t.Fatal("expected error for 500 response, got nil")
	}
}
