# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2026-05-18

### Added
- `RegistryClient.fetchTemplate` for pulling a template bundle by name.

## [1.1.0] - 2026-03-02

### Added
- Vendored `qs-parse` (query-string parser) into `vendor/` to avoid an extra
  runtime dependency; see `THIRD_PARTY.md`.
