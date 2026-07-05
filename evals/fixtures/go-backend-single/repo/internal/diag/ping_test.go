package diag

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPingHandlerReturnsPong(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/diag/ping", nil)
	rec := httptest.NewRecorder()

	PingHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if rec.Body.String() != "pong" {
		t.Fatalf("expected body %q, got %q", "pong", rec.Body.String())
	}
}
