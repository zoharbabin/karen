# Known Gaps

Tracked, intentional boundaries in the Prism SDK. These are not bugs — see
each entry's reason. Remove an entry once the underlying limitation is
resolved (Prism's public API adds the capability, or the deferred item
ships).

| Kind | Pattern | Scope | Reason |
|---|---|---|---|
| capability-gap | webhook signature verification | `src/prism_sdk/webhooks.py` | Prism's webhook signing-secret rotation endpoint is still private-beta; there's no stable secret to verify against yet. Tracked upstream with the platform team. |
