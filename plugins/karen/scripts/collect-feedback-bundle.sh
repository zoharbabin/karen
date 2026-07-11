#!/usr/bin/env bash
# Gathers a redacted feedback bundle for /karen:feedback. Deterministic
# gather-and-redact only — never calls `gh` and never sends anything anywhere.
# Redaction correctness is a safety property, not a reasoning task, which is
# why this is a fixed script rather than left to model judgment (see
# CONTRIBUTING.md's "no dedicated tool scripts" note for why this is the one
# exception to that rule).
#
# Usage:
#   collect-feedback-bundle.sh <project-root>
#
# Prints a markdown bundle to stdout. Callers should capture it to a file and
# show it to the user before it goes anywhere near `gh issue create` or a
# browser URL -- never pass its content through a shell string.

set -euo pipefail

ROOT="${1:-.}"
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_VERSION="unknown"
if [ -f "$PLUGIN_DIR/.claude-plugin/plugin.json" ]; then
  PLUGIN_VERSION=$(grep -m1 '"version"' "$PLUGIN_DIR/.claude-plugin/plugin.json" | sed -E 's/.*"version": *"([^"]+)".*/\1/')
fi

# Redacts anything that looks like a secret: long hex/base64 tokens, common
# cloud-key prefixes, bearer tokens, key=value assignments to *_KEY/*_TOKEN/*_SECRET/*_PASSWORD.
redact() {
  sed -E \
    -e 's/(AKIA[0-9A-Z]{16})/[REDACTED-AWS-KEY]/g' \
    -e 's/(ghp_[A-Za-z0-9]{20,})/[REDACTED-GH-TOKEN]/g' \
    -e 's/(sk-[A-Za-z0-9]{20,})/[REDACTED-API-KEY]/g' \
    -e 's/([Bb]earer[[:space:]]+)[A-Za-z0-9._-]{10,}/\1[REDACTED]/g' \
    -e 's/((KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD)[[:space:]]*[:=][[:space:]]*)(["\x27]?)[A-Za-z0-9._-]{6,}(["\x27]?)/\1\3[REDACTED]\4/gi' \
    -e 's/([A-Za-z0-9+\/]{40,}={0,2})/[REDACTED-LONG-TOKEN]/g'
}

echo "## Karen feedback bundle"
echo
echo "- Plugin version: $PLUGIN_VERSION"
echo "- OS: $(uname -s 2>/dev/null || echo unknown)"
echo "- Shell: ${SHELL:-unknown}"
echo "- Generated: (fill in current date/time when filing)"
echo

echo "### .karen.json (redacted)"
echo '```json'
if [ -f "$ROOT/.karen.json" ]; then
  redact < "$ROOT/.karen.json"
else
  echo "(no .karen.json found at $ROOT -- karen init may not have run yet)"
fi
echo '```'
echo

echo "### Last audit summary (.karen/run-state.json)"
echo '```json'
if [ -f "$ROOT/.karen/run-state.json" ]; then
  redact < "$ROOT/.karen/run-state.json"
else
  echo "(no run-state.json found -- karen audit may not have run yet)"
fi
echo '```'
echo

echo "### Registered gates (.karen/harness.json)"
echo '```json'
if [ -f "$ROOT/.karen/harness.json" ]; then
  redact < "$ROOT/.karen/harness.json"
else
  echo "(no harness.json found)"
fi
echo '```'
echo

echo "### Tool probe"
for tool in eslint semgrep govulncheck bandit gitleaks trufflehog pip-audit cargo-audit; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo "- $tool: available"
  else
    echo "- $tool: not found"
  fi
done
echo

echo "---"
echo "_Everything above was gathered locally and redacted by collect-feedback-bundle.sh._"
echo "_Review it before it's included in anything sent to GitHub._"
