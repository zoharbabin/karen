package dispatch

import "testing"

func TestRenderPayloadUsesJSONFormatter(t *testing.T) {
	got := RenderPayload("json", "sub1", "hello")
	want := `{"subscriber":"sub1","message":"hello"}`
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestRenderPayloadReturnsEmptyForUnknownFormat(t *testing.T) {
	if got := RenderPayload("carrier-pigeon", "sub1", "hello"); got != "" {
		t.Fatalf("expected empty string for unknown format, got %q", got)
	}
}
