#!/usr/bin/env bash
set -euo pipefail
ROOT="$1"
cd "$ROOT"
ISSUES=0
# karen-ignore: add this comment to any line to suppress it from Karen gate scanning.

SUMMARY_EMITTED=0
trap '_ec=$?; if [ "$SUMMARY_EMITTED" -eq 0 ]; then printf "GATE_CRASH:0\tgate crashed (exit %s)\n" "$_ec"; echo "FAIL (1 issues)"; fi' EXIT

# --- Go: TODO/FIXME markers ---
while IFS=: read -r file line rest; do
  printf '%s:%s\tbroken TODO/FIXME marker — incomplete implementation in production code\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" --exclude="*_test.go" \
  -E '(//|#)[[:space:]]*(TODO|FIXME|HACK|XXX)[: ]' . 2>/dev/null | grep -v '.git' | head -50 || true)

# --- Go: stub implementations ---
while IFS=: read -r file line rest; do
  printf '%s:%s\tstub implementation — panic or not-implemented placeholder\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" --exclude="*_test.go" \
  -E 'panic\("(not implemented|TODO|unimplemented)"' . 2>/dev/null | grep -v '.git' | head -50 || true)

# --- JS/TS: scan when files exist ---
JS_FILES=()
while IFS= read -r jsfile; do
  JS_FILES+=("$jsfile")
done < <(find "$ROOT" -maxdepth 4 -type f \( -name "*.js" -o -name "*.mjs" -o -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/coverage/*" 2>/dev/null || true)

if [ "${#JS_FILES[@]}" -gt 0 ]; then
  for jsf in "${JS_FILES[@]}"; do
    relfile="${jsf#$ROOT/}"
    while IFS= read -r rawline; do
      [ -z "$rawline" ] && continue
      # Extract line number and content
      lineno="${rawline%%:*}"
      content="${rawline#*:}"
      # Skip karen-ignore lines
      echo "$content" | grep -q 'karen-ignore' && continue
      if [ "$ISSUES" -ge 50 ]; then break; fi
      printf '%s:%s\tJS: TODO/FIXME/stub comment\n' "$relfile" "$lineno"
      ISSUES=$((ISSUES+1))
    done < <(grep -n 'TODO\|FIXME\|HACK\|XXX' "$jsf" 2>/dev/null || true)

    while IFS= read -r rawline; do
      [ -z "$rawline" ] && continue
      lineno="${rawline%%:*}"
      content="${rawline#*:}"
      echo "$content" | grep -q 'karen-ignore' && continue
      if [ "$ISSUES" -ge 50 ]; then break; fi
      printf '%s:%s\tJS: not-implemented stub\n' "$relfile" "$lineno"
      ISSUES=$((ISSUES+1))
    done < <(grep -n "throw new Error(['\"]not implemented" "$jsf" 2>/dev/null || true)
  done
fi

SUMMARY_EMITTED=1
if [ "$ISSUES" -eq 0 ]; then
  echo "PASS (0 issues)"
else
  printf 'FAIL (%s issues)\n' "$ISSUES"
fi
exit 0
