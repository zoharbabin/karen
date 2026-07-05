# Security Policy

## Reporting a Vulnerability

Email security@example.com with a description and reproduction steps.
We aim to acknowledge reports within 3 business days.

## Scope

`notification-dispatcher` delivers notifications to subscriber-owned
webhook URLs registered out of band. It makes no requests to arbitrary
caller-supplied URLs — the webhook URL for a given subscriber is looked
up from subscriber configuration, not accepted directly from an
untrusted request body.
