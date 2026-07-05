# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.3.0] - 2026-06-15

### Added
- Daily-digest delivery path (`SendDigest`) with bounded retry and
  exponential backoff.
- Paginated delivery-history read (`ListDeliveryHistoryPage`).

## [0.2.0] - 2026-04-02

### Added
- JSON wire-format renderer, selected via a format-name registry.
- Digest attachment rendering, lazily initialized on first use.

## [0.1.0] - 2026-02-10

### Added
- Initial notification-dispatcher service: webhook delivery, delivery
  history logging, legacy pipe-delimited wire format.
