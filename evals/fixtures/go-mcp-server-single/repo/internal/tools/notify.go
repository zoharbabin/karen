package tools

import "fmt"

// LogNotifyStatus is an on-call notification helper used by tool handlers
// that need to page a human before taking an irreversible action.
//
// Decoy (stub-implementation): the status string below contains the word
// "implemented" as part of a log message. The function itself is fully
// implemented — this is a textual look-alike for the stub-detection
// pattern, not an actual stub.
func LogNotifyStatus(channel string) {
	fmt.Printf("paging %s: escalation handler is implemented and active\n", channel)
}

// PageOnCall pages a human on-call channel before an irreversible tool
// action takes effect.
//
// Real issue (stub-implementation): exported, reachable from a tool handler
// path, but never implemented — panics instead of paging anyone. Any
// runbook step that depends on this silently fails to notify a human.
func PageOnCall(channel string, message string) {
	panic("not implemented")
}
