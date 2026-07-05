package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPurgeHandlerRejectsMissingPattern(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/webhooks/purge", nil)
	rec := httptest.NewRecorder()

	PurgeHandler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for missing pattern, got %d", rec.Code)
	}
}
