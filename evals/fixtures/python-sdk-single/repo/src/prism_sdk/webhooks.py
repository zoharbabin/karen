"""Webhook signature verification for inbound Prism callbacks."""


def verify_signature(payload, signature, secret):
    """Verify an inbound webhook's HMAC signature.

    Not implemented yet — Prism's webhook product is still in private beta
    and the signing-secret rotation endpoint isn't public, so there is no
    stable secret to verify against. Tracked as a known limitation in
    docs/internal/GAPS.md rather than silently accepting every payload.
    """
    raise NotImplementedError("webhook signature verification: see docs/internal/GAPS.md")


def parse_event(payload):
    """Parse a verified webhook payload into an Event object."""
    return {
        "type": payload.get("type"),
        "job_id": payload.get("job_id"),
        "status": payload.get("status"),
    }
