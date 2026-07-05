# Security Policy

## Reporting a Vulnerability

Email security@example.com with a description and reproduction steps.
We aim to acknowledge reports within 3 business days.

## Scope

Covers both Go modules (`backend/`, `cli/`) and the root-level
`mint-admin-token.sh` ops script, which mints admin credentials used by
`karenctl` operators and is in scope for security review even though it
is not owned by either Go module's manifest.
