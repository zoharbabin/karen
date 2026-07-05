# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0] - 2026-05-14

### Added
- `backend`: structured audit-log writer for SOC2 control evidence (`audit_log.py`).

### Changed
- `client-lib`: default request timeout raised from 5s to 15s for slow ingest windows.

## [1.1.0] - 2026-03-02

### Added
- `client-lib`: `SignalRelayClient.batch_send()` for grouped telemetry submission.

## [1.0.0] - 2026-01-20

### Added
- Initial release of the backend ingestion service and the Python client SDK.
