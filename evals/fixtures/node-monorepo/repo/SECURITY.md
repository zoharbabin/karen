# Security Policy

## Reporting a Vulnerability

Email security@example-avatar.com with a description of the issue. We aim
to acknowledge reports within 2 business days and ship a fix or mitigation
within 30 days for high-severity issues.

## Scope

This repo has three security surfaces:

- `sdk/` loads directly into a customer's page with no sandbox. Report any
  finding that would let it read/write outside its mount point, leak the
  customer's session or cookies, or register a listener/timer that
  survives `destroy()`.
- `backend/` holds the chat-completion API key. Report any finding that
  would leak the key, mint an over-scoped session token, or echo the key
  back in a response body.
- `apps/teaching-avatar` and `apps/support-widget` both call `backend/`
  for a session token. Report any finding where one of them accepts a
  session token or backend response it shouldn't, or diverges from the
  other's origin/token-scope checks in a way that widens exposure.

## Supported Versions

Only the latest published major version of each package receives security
fixes.
