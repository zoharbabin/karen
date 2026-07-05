# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.4.0] - 2026-05-04

### Added
- `load_config_safe` — a `SafeLoader`-restricted alternative to `load_config`
  for callers that don't need the full YAML tag set.

### Changed
- Left a `TODO` marker on `PrismClient.transcribe` for 429 rate-limit
  backoff, deferred to 0.5.0. Approved as a time-boxed exception rather
  than left silent — see `.karen.json` `exceptions` (expires 2026-08-15).

## [0.3.0] - 2026-02-11

### Added
- `PrismClient.get_job` for polling transcription job status.
