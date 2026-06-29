#!/usr/bin/env bash
set -euo pipefail
ROOT="$1"
cd "$ROOT"
ISSUES=0
# karen-ignore: add this comment to any line to suppress it from Karen gate scanning.

SUMMARY_EMITTED=0
trap '_ec=$?; if [ "$SUMMARY_EMITTED" -eq 0 ]; then printf "GATE_CRASH:0\tgate crashed (exit %s)\n" "$_ec"; echo "FAIL (1 issues)"; fi' EXIT

# Read releasesManaged from .karen.json
RELEASES_MANAGED=false
if [ -f "$ROOT/.karen.json" ]; then
  if command -v jq >/dev/null 2>&1; then
    RELEASES_MANAGED=$(jq -r '.releasesManaged // false' "$ROOT/.karen.json" 2>/dev/null || echo "false")
  else
    grep -q '"releasesManaged"[[:space:]]*:[[:space:]]*true' "$ROOT/.karen.json" 2>/dev/null && RELEASES_MANAGED=true || true
  fi
fi

# SECURITY.md: accept at root or any first-level subdirectory (monorepo: sdk/SECURITY.md etc.)
SECURITY_FOUND=$(find . -maxdepth 2 -name "SECURITY.md" -not -path "./.git/*" 2>/dev/null | head -1)
if [ -z "$SECURITY_FOUND" ]; then
  printf 'SECURITY.md:0\trequired compliance artifact missing\n'
  ISSUES=$((ISSUES+1))
elif ! grep -qi "vuln\|disclos\|report\|CVE" "$SECURITY_FOUND" 2>/dev/null; then
  printf 'SECURITY.md:0\tSECURITY.md lacks vulnerability disclosure process\n'
  ISSUES=$((ISSUES+1))
fi

for f in "LICENSE" "CONTRIBUTING.md"; do
  if [ ! -f "$f" ]; then
    printf '%s:0\trequired compliance artifact missing\n' "$f"
    ISSUES=$((ISSUES+1))
  fi
done

if [ "$RELEASES_MANAGED" = "true" ]; then
  : # CHANGELOG.md check suppressed — releasesManaged is true in .karen.json
else
  if [ ! -f CHANGELOG.md ]; then
    printf 'CHANGELOG.md:0\tmissing compliance artifact — create CHANGELOG.md or set "releasesManaged": true in .karen.json\n'
    ISSUES=$((ISSUES+1))
  fi
fi

if [ -f LICENSE ]; then
  if ! grep -qi "apache\|mit\|SPDX\|GPL\|BSD\|ISC" LICENSE; then
    printf 'LICENSE:0\tLICENSE file type cannot be determined\n'
    ISSUES=$((ISSUES+1))
  fi
fi

SUMMARY_EMITTED=1
if [ "$ISSUES" -eq 0 ]; then
  echo "PASS (0 issues)"
else
  echo "FAIL ($ISSUES issues)"
fi
exit 0
