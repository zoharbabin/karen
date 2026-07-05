# Security Policy

## Reporting a Vulnerability

Email security@example-internal.test with details. We aim to acknowledge
within 2 business days.

## Scope

This server executes shell commands and reads config files on behalf of a
connected LLM client. Treat every tool-call argument as untrusted input.
