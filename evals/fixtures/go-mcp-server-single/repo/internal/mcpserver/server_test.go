package mcpserver

import (
	"bytes"
	"strings"
	"testing"
)

func TestServeListsTools(t *testing.T) {
	input := strings.NewReader(`{"id":1,"method":"tools/list"}` + "\n")
	var out bytes.Buffer

	if err := Serve(input, &out); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}
	if !strings.Contains(out.String(), "run_shell_command") {
		t.Fatalf("expected tools/list to include run_shell_command, got: %s", out.String())
	}
}

func TestServeUnknownToolReturnsError(t *testing.T) {
	input := strings.NewReader(`{"id":2,"method":"tools/call","params":{"name":"nope","arguments":{}}}` + "\n")
	var out bytes.Buffer

	if err := Serve(input, &out); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}
	if !strings.Contains(out.String(), "unknown tool") {
		t.Fatalf("expected unknown-tool error, got: %s", out.String())
	}
}
