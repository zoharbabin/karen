package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "karenctl.yaml")
	if err := os.WriteFile(path, []byte("apiBaseUrl: https://api.example.com\n"), 0o600); err != nil {
		t.Fatalf("writing fixture config: %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.APIBaseURL != "https://api.example.com" {
		t.Fatalf("expected apiBaseUrl %q, got %q", "https://api.example.com", cfg.APIBaseURL)
	}
}

func TestLoadMissingFile(t *testing.T) {
	_, err := Load(filepath.Join(t.TempDir(), "missing.yaml"))
	if err == nil {
		t.Fatal("expected error for missing config file, got nil")
	}
}
