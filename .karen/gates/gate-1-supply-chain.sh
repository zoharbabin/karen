#!/usr/bin/env bash
set -euo pipefail
ROOT="$1"
cd "$ROOT"
ISSUES=0
# karen-ignore: add this comment to any line to suppress it from Karen gate scanning.

SUMMARY_EMITTED=0
trap '_ec=$?; if [ "$SUMMARY_EMITTED" -eq 0 ]; then printf "GATE_CRASH:0\tgate crashed (exit %s)\n" "$_ec"; echo "FAIL (1 issues)"; fi' EXIT

# --- Go supply chain ---
# go.sum is required only when the module has external dependencies.
if [ -f go.mod ] && grep -qE '^require' go.mod 2>/dev/null && [ ! -f go.sum ]; then
  printf 'go.sum\tgo.sum missing — run go mod tidy\n'
  ISSUES=$((ISSUES+1))
fi

if [ -f go.mod ] && command -v go &>/dev/null; then
  if ! go mod verify 2>/dev/null; then
    printf 'go.mod\tgo mod verify failed — dependency tampering or cache corruption\n'
    ISSUES=$((ISSUES+1))
  fi
  if command -v govulncheck &>/dev/null; then
    VULN_OUT=$(govulncheck ./... 2>&1 || true)
    if echo "$VULN_OUT" | grep -q "^Vulnerability #"; then
      while IFS= read -r line; do
        if [[ "$line" =~ ^Vulnerability ]]; then
          printf 'go.mod\t%s\n' "$line"
          ISSUES=$((ISSUES+1))
        fi
      done <<< "$VULN_OUT"
    fi
  fi
fi

# --- JS supply chain (runs only when go.mod is absent) ---
if [ ! -f go.mod ] && command -v npm &>/dev/null; then
  while IFS= read -r lockfile; do
    [ -z "$lockfile" ] && continue
    lockdir=$(dirname "$lockfile")
    rel_lockfile="${lockfile#"$ROOT"/}"
    audit_out=$(cd "$lockdir" && npm audit --audit-level=high --json 2>/dev/null || true)
    if [ -z "$audit_out" ]; then
      continue
    fi
    vuln_count=$(printf '%s' "$audit_out" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = d.get('vulnerabilities', {})
    print(sum(1 for x in v.values() if x.get('severity') in ('high', 'critical')))
except Exception:
    print(0)
" 2>/dev/null || echo "0")
    if [ "$vuln_count" -gt 0 ]; then
      vuln_names=$(printf '%s' "$audit_out" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = d.get('vulnerabilities', {})
    names = [name for name, info in v.items() if info.get('severity') in ('high', 'critical')]
    for n in names[:50]:
        print(n)
except Exception:
    pass
" 2>/dev/null || true)
      while IFS= read -r vuln_name; do
        [ -z "$vuln_name" ] && continue
        printf '%s:0\tnpm vulnerability (%s severity) — run npm audit fix\n' "$rel_lockfile" "$vuln_name"
        ISSUES=$((ISSUES+1))
      done <<< "$vuln_names"
    fi
  done < <(find "$ROOT" -maxdepth 2 -name "package-lock.json" ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null)
fi

SUMMARY_EMITTED=1
if [ "$ISSUES" -eq 0 ]; then
  echo "PASS (0 issues)"
else
  printf 'FAIL (%s issues)\n' "$ISSUES"
fi
exit 0
