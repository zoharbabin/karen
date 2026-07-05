package tools

import "testing"

func TestRunShellCommandReturnsOutput(t *testing.T) {
	out, err := RunShellCommand(RunShellCommandArgs{Command: "echo hello"})
	if err != nil {
		t.Fatalf("RunShellCommand returned error: %v", err)
	}
	if out == "" {
		t.Fatal("expected non-empty command output")
	}
}

func TestRunShellCommandPropagatesFailure(t *testing.T) {
	_, err := RunShellCommand(RunShellCommandArgs{Command: "exit 1"})
	if err == nil {
		t.Fatal("expected an error for a failing command")
	}
}
