/**
 * On-call notification helper used by tool handlers that need to page a human
 * before taking an irreversible action.
 */

// Decoy: logs a message containing the word "implemented" as part of a status
// string. The function itself is fully implemented — this is a textual
// look-alike for the stub-detection pattern, not an actual stub.
export function logNotifyStatus(channel: string): void {
  console.log(`Paging ${channel}: escalation handler is implemented and active`);
}

// Real issue (stub-implementation): exported, reachable from a tool handler
// path, but never implemented — throws instead of paging anyone. Any runbook
// step that depends on this silently fails to notify a human.
export function pageOnCall(_channel: string, _message: string): void {
  throw new Error("not implemented");
}
