package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInboundWebhookHandlerRejectsInvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/webhooks/inbound", strings.NewReader("not-json"))
	rec := httptest.NewRecorder()

	InboundWebhookHandler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid JSON, got %d", rec.Code)
	}
}
