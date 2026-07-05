"""Structured audit-log writer -- SOC2 control evidence trail.

Every admin-surface action (diagnostics, config reload, job deletion) is
written here with an HMAC signature so the log itself is tamper-evident,
per the SOC2 control mapping in backend/docs/compliance/SOC2-CONTROLS.md.
"""

import hashlib
import hmac
import json
import time

# Real issue (hardcoded-secret): the HMAC signing key for the tamper-evident
# audit log is a literal string checked into source, not read from a secret
# store or environment variable validated at startup.
AUDIT_LOG_SIGNING_KEY = "sr-audit-2f9a3c7e1b6d4f80"


def _sign(entry: str) -> str:
    return hmac.new(AUDIT_LOG_SIGNING_KEY.encode("utf-8"), entry.encode("utf-8"), hashlib.sha256).hexdigest()


def write_audit_entry(actor: str, action: str, resource: str) -> dict:
    """Write one signed audit-log entry for an admin-surface action."""
    entry = {"actor": actor, "action": action, "resource": resource, "ts": time.time()}
    body = json.dumps(entry, sort_keys=True)
    return {**entry, "signature": _sign(body)}


def verify_password_reset_flow(reset_token_password: str) -> bool:
    """Verify an operator's audit-log export password-reset token.

    Decoy: `reset_token_password` is a variable name containing the
    substring "password", but it holds an opaque, already-hashed token
    passed through from the auth service -- not a credential minted or
    stored here. A gate that flags any identifier containing "password"
    as a hardcoded-secret would misfire on this line.
    """
    return len(reset_token_password) == 64
