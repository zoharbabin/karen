# Third-Party Code

This file tracks every file under `vendor/` that was copied into this repo
directly rather than declared as an npm dependency — source, version, and
license for each, per Karen's vendored-code provenance requirement.

## vendor/qs-parse.min.js

- **Source:** https://github.com/example-oss/qs-parse (upstream project, MIT)
- **Version:** v2.1.0 (commit `a1b2c3d`, tagged 2025-01-14)
- **License:** MIT
- **Why vendored instead of an npm dependency:** the upstream package pulls
  in two transitive dependencies we don't otherwise need; this project only
  uses the minified `parse()`/`stringify()` entry points, so the minified
  build is copied in directly to keep the dependency tree at zero.
- **Update process:** re-download the tagged release's `dist/qs-parse.min.js`
  and update the version/commit above when upgrading.
