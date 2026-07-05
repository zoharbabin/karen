package dispatch

import "fmt"

// PLANTED ISSUE (dead-code, real): the pre-v2 wire format this function
// produces was retired when the dispatcher moved to JSON-only delivery.
// Nothing in this codebase calls FormatLegacyPayload anymore — no direct
// call site, no interface satisfaction, no test coverage — but it's
// still exported and still shipped, so no one has noticed it's dead.
func FormatLegacyPayload(subscriberID, message string) string {
	return fmt.Sprintf("%s|%s", subscriberID, message)
}
