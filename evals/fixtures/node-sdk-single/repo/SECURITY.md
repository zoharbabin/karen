# Security Policy

## Reporting a Vulnerability

Email security@example-avatar.com with a description of the issue. We aim
to acknowledge reports within 2 business days and ship a fix or mitigation
within 30 days for high-severity issues.

## Scope

This SDK loads directly into a customer's page with no sandbox. Report
any finding that would let embedded code:

- Read or write outside its mount point (`config.container`)
- Leak the customer's session or cookies
- Register a listener or timer that survives `destroy()`

## Supported Versions

Only the latest published major version receives security fixes.
