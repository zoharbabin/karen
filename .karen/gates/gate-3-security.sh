#!/usr/bin/env bash
set -euo pipefail
ROOT="$1"
cd "$ROOT"
ISSUES=0
# karen-ignore: add this comment to any line to suppress it from Karen gate scanning.

SUMMARY_EMITTED=0
trap '_ec=$?; if [ "$SUMMARY_EMITTED" -eq 0 ]; then printf "GATE_CRASH:0\tgate crashed (exit %s)\n" "$_ec"; echo "FAIL (1 issues)"; fi' EXIT

# --- Go SAST ---
# NOTE: Go SAST uses relative paths (grep runs from '.') so exclusions are
# substring-matched (*/testdata/*). This is intentionally asymmetric with the
# JS section, which uses absolute $ROOT-anchored exclusions. The Go testdata/
# pattern follows the official Go test-data convention and is lower risk because
# go test itself enforces the testdata/ layout. Files in tests/artifacts/ ARE
# scanned for Go (no exclusion here) — unlike JS where that directory is pruned.
# If a project places sensitive Go files under a path matching */testdata/* they
# will be silently excluded; prefer storing fixtures without real credentials.

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tpotential hardcoded secret — rotate immediately\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E '(api_?key|auth_?token|secret_?key|password|passwd)[[:space:]]*[:=][[:space:]]*"[^"]{8,}"' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]]; then continue; fi
  printf '%s:%s\texec with shell -c pattern — use exec.Command with explicit args array\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E '"(sh|bash|cmd|powershell)"[[:space:]]*,[[:space:]]*"-c"' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */wizard/generator.go ]]; then continue; fi
  printf '%s:%s\tInsecureSkipVerify: true — disabled TLS certificate verification\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  'InsecureSkipVerify:[[:space:]]*true' . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tdynamic command construction — use exec.Command with literal executable and explicit args array\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E 'syscall\.Exec[[:space:]]*\(|exec\.Command[[:space:]]*\([^"]*\+' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tSQL built with fmt.Sprintf — use parameterized queries\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E 'fmt\.Sprintf[[:space:]]*\([[:space:]]*"[^"]*\b(SELECT|INSERT|UPDATE|DELETE|WHERE)\b' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tSQL built via string concatenation — use parameterized queries\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E '"[[:space:]]*(SELECT|INSERT|UPDATE|DELETE)[^"]*"[[:space:]]*\+' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tfile path assembled via concatenation — use a safe allowlist or filepath.Clean with validated prefix\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E 'os\.(Open|Create|ReadFile|WriteFile)[[:space:]]*\(.*\+|filepath\.Join[[:space:]]*\(.*\+' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tcleartext HTTP connection to external service — use https://\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E 'http\.(Get|Post|Do|Head)[[:space:]]*\([[:space:]]*"http://' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\tcredential-related name in log statement — avoid logging tokens, passwords, or secrets\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E '(log\.|fmt\.Print|fmt\.Fprintf|fmt\.Fprintln).*\b(token|password|passwd|secret|api_?key|auth|credential)\b' \
  . 2>/dev/null | head -50 || true)

while IFS=: read -r file line rest; do
  if [[ "$file" == *_test.go ]] || [[ "$file" == */testdata/* ]]; then continue; fi
  printf '%s:%s\twriting credential to file — ensure file permissions are restricted and path is not world-readable\n' "$file" "$line"
  ISSUES=$((ISSUES+1))
done < <(grep -rn --include="*.go" \
  -E 'os\.(WriteFile|Create)[[:space:]]*\(.*\b(token|secret|password|key)\b' \
  . 2>/dev/null | head -50 || true)

# --- JS SAST ---
# Run when *.js or *.mjs files exist outside excluded directories.

JS_FILES_EXIST=0
# Exclusions are root-anchored (using $ROOT prefix) to prevent nested-path bypass.
# A file at src/tests/artifacts/ must still be scanned — only top-level test output
# directories are excluded.
if find "$ROOT" \
    -path "$ROOT/node_modules" -prune -o \
    -path "$ROOT/.git" -prune -o \
    -path "$ROOT/dist" -prune -o \
    -path "$ROOT/build" -prune -o \
    -path "$ROOT/coverage" -prune -o \
    -path "$ROOT/tools" -prune -o \
    -path "$ROOT/scripts" -prune -o \
    -path "$ROOT/tests/artifacts" -prune -o \
    -path "$ROOT/tests/fixtures" -prune -o \
    -path "$ROOT/test/fixtures" -prune -o \
    -path "$ROOT/spec/fixtures" -prune -o \
    -path "$ROOT/__snapshots__" -prune -o \
    -path "$ROOT/.cache" -prune -o \
    \( -name "*.js" -o -name "*.mjs" \) -not -name "*.min.js" -print \
    2>/dev/null | grep -q .; then
  JS_FILES_EXIST=1
fi

if [ "$JS_FILES_EXIST" -eq 1 ]; then
  JS_ISSUES=0

  # Helper: grep JS files excluding standard noise dirs and minified files.
  # Playwright/Cypress trace bundles and test fixtures contain minified vendor JS;
  # tools/ and scripts/ dirs may contain scanner definitions with pattern references.
  # Usage: js_grep <grep -E pattern>
  # Outputs matching lines to stdout; caller pipes into while loop.
  js_grep() {
    # Exclusions are anchored to the project root ($ROOT) to prevent nested-path bypass
    # (e.g. src/tests/artifacts/ must not silently skip first-party source files).
    # Only top-level test output directories are excluded, not arbitrary nested paths.
    grep -rn --include="*.js" --include="*.mjs" -E "$1" -- "$ROOT" 2>/dev/null \
      | grep -v '/node_modules/' \
      | grep -v '/\.git/' \
      | grep -v '/dist/' \
      | grep -v '/build/' \
      | grep -v '/coverage/' \
      | grep -v '/tools/' \
      | grep -v '/scripts/' \
      | grep -v "${ROOT}/tests/artifacts/" \
      | grep -v "${ROOT}/tests/fixtures/" \
      | grep -v "${ROOT}/test/fixtures/" \
      | grep -v "${ROOT}/spec/fixtures/" \
      | grep -v "${ROOT}/__snapshots__/" \
      | grep -v "${ROOT}/.cache/" \
      | grep -v '\.min\.js:' \
      | grep -v 'karen-ignore' \
      | head -30 \
      || true
  }

  # 1. Hardcoded secrets
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS potential hardcoded secret — rotate immediately\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "(api_key|auth_token|secret_key|password|passwd)[[:space:]]*[=:][[:space:]]*['\"][^'\"$]{8,}['\"]" \
    | grep -v 'process\.env\|placeholder\|example\|dummy\|test' || true)

  # 2. Shell exec (child_process) — zero-tolerance in production; test files excluded.
  # BLUEPRINT: "Zero-tolerance means no exceptions in production code. Test files are
  # excluded — they may deliberately exercise these patterns to verify their scanner."
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS child_process exec/spawn — audit for unsanitized user input in arguments\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "child_process\.(exec|spawn|execSync|spawnSync)\(" \
    | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '/__tests__/' || true)

  # 3. TLS bypass — zero-tolerance in production; test files excluded.
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS rejectUnauthorized: false — disabled TLS certificate verification\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "rejectUnauthorized[[:space:]]*:[[:space:]]*false" \
    | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '/__tests__/' || true)

  # 4. eval() call — zero-tolerance in production; test files excluded.
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS eval() call — dynamic code execution; use safer alternatives\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "\beval[[:space:]]*\(" \
    | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '/__tests__/' || true)

  # 5. innerHTML assignment
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS innerHTML assignment — potential XSS; use textContent or sanitize input\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "\.innerHTML[[:space:]]*[+]?=")

  # 6. SQL string concatenation
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS SQL built via string concatenation — use parameterized queries\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "(SELECT|INSERT|UPDATE|DELETE).*\+")

  # 7. Cleartext HTTP fetch
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS cleartext HTTP fetch — use https://\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "fetch\([[:space:]]*['\"]http://")

  # 8. Credential logging
  while IFS=: read -r file line rest; do
    [ -z "$file" ] && continue
    printf '%s:%s\tJS credential-related name in console statement — avoid logging tokens, passwords, or secrets\n' "$file" "$line"
    JS_ISSUES=$((JS_ISSUES+1))
  done < <(js_grep "console\.(log|error|warn)\([^)]*\b(token|secret|password)\b" \
    | grep -v 'redact\|\*\*\*' || true)

  # Cap JS issues at 30 to avoid overwhelming output.
  if [ "$JS_ISSUES" -gt 30 ]; then
    JS_ISSUES=30
  fi

  ISSUES=$((ISSUES+JS_ISSUES))
fi

SUMMARY_EMITTED=1
if [ "$ISSUES" -eq 0 ]; then
  echo "PASS (0 issues)"
else
  printf 'FAIL (%s issues)\n' "$ISSUES"
  printf 'ZERO-TOLERANCE: Karen will not negotiate on this.\n'
fi
exit 0
