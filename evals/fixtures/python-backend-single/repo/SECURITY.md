# Security

`beacon-ingest` is internal-only, but treat every input as if it weren't:

- `/admin/diagnostics`'s `probe` field is an operator-supplied string. Do
  not extend it to accept input from anything but a trusted internal
  operator tool.
- Cached job records in Redis are only as trustworthy as everything with
  write access to that Redis instance — a misconfigured neighbor tenant or
  a compromised worker can plant an arbitrary value under a guessed key.
- Deploy-time YAML config may come from a pipeline or template repo outside
  this team's direct control.

Report suspected vulnerabilities to security@example.com.
