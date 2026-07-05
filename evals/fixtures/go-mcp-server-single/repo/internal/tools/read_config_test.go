package tools

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadConfig(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "runbook.yaml"), []byte("steps: []\n"), 0o600); err != nil {
		t.Fatalf("writing fixture config: %v", err)
	}
	t.Setenv("OPS_MCP_ROOT", dir)

	cases := []struct {
		name     string
		filename string
		wantErr  bool
	}{
		{name: "reads an existing file", filename: "runbook.yaml", wantErr: false},
		{name: "errors on a missing file", filename: "missing.yaml", wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ReadConfig(ReadConfigArgs{Filename: tc.filename})
			if tc.wantErr && err == nil {
				t.Fatal("expected an error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
