package dispatch

// formatters maps a wire-format name to the function that produces it.
// FormatJSONPayload is reached only through this map, never through a
// direct call site anywhere else in the codebase.
var formatters = map[string]func(subscriberID, message string) string{
	"json": FormatJSONPayload,
}

// FormatJSONPayload renders the current v2 wire format.
//
// DECOY (dead-code category): grep-only reachability finds zero direct
// call sites for FormatJSONPayload anywhere in the codebase — the exact
// textual signal FormatLegacyPayload in format.go is planted to trigger
// for real. But FormatJSONPayload is reached indirectly through the
// formatters map above (formatters["json"](...)), a live registration
// pattern a structural, call-graph-aware dead-code tool (ts-prune/
// knip-equivalent for Go: `deadcode`/`staticcheck`) correctly resolves
// and a naive grep-for-callers script does not.
func FormatJSONPayload(subscriberID, message string) string {
	return `{"subscriber":"` + subscriberID + `","message":"` + message + `"}`
}

// RenderPayload looks up the named formatter and renders message for
// subscriberID.
func RenderPayload(format, subscriberID, message string) string {
	fn, ok := formatters[format]
	if !ok {
		return ""
	}
	return fn(subscriberID, message)
}
