"""On-call notification helper used by tool handlers that need to page a
human before taking an irreversible action.
"""


# Decoy: logs a message containing the word "implemented" as part of a status
# string. The function itself is fully implemented — this is a textual
# look-alike for the stub-detection pattern, not an actual stub.
def log_notify_status(channel: str) -> None:
    print(f"Paging {channel}: escalation handler is implemented and active")


# Real issue (stub-implementation): exported, reachable from a tool handler
# path, but never implemented — raises instead of paging anyone. Any incident
# step that depends on this silently fails to notify a human.
def page_on_call(channel: str, message: str) -> None:
    raise NotImplementedError("not implemented")
