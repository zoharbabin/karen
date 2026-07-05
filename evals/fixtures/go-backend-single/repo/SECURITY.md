# Security Policy

## Reporting a Vulnerability

Email security@example.com with a description and reproduction steps.
We aim to acknowledge reports within 3 business days.

## Scope

`webhook-relay` accepts inbound HTTP requests from third-party webhook
senders. Treat every field of an inbound payload — including
`callback_url` — as untrusted input from an external, potentially
adversarial network peer.
