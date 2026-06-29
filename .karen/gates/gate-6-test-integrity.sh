#!/usr/bin/env bash
set -euo pipefail
ROOT="$1"
cd "$ROOT"
ISSUES=0
# karen-ignore: add this comment to any line to suppress it from Karen gate scanning.

SUMMARY_EMITTED=0
trap '_ec=$?; if [ "$SUMMARY_EMITTED" -eq 0 ]; then printf "GATE_CRASH:0\tgate crashed (exit %s)\n" "$_ec"; echo "FAIL (1 issues)"; fi' EXIT

# ── Go branch ────────────────────────────────────────────────────────────────
if [ -f go.mod ]; then
  COVERAGE_FILE="/tmp/karen-self-coverage-$$.out"

  if ! go test ./... -race -coverprofile="$COVERAGE_FILE" -covermode=atomic >/dev/null 2>&1; then
    printf 'go.mod:0\ttest suite failed — fix failing tests before proceeding\n'
    ISSUES=$((ISSUES+1))
    SUMMARY_EMITTED=1
    echo "FAIL ($ISSUES issues)"
    exit 0
  fi

  THRESHOLD=80
  if command -v jq &>/dev/null && [ -f "$ROOT/.karen.json" ]; then
    CONFIGURED=$(jq -r '.coverage.threshold // empty' "$ROOT/.karen.json" 2>/dev/null)
    [ -n "$CONFIGURED" ] && THRESHOLD="$CONFIGURED"
  fi

  if [ -f "$COVERAGE_FILE" ]; then
    COV_LINE=$(go tool cover -func="$COVERAGE_FILE" 2>/dev/null | tail -1)
    COV_PCT=$(echo "$COV_LINE" | awk '{print $3}' | tr -d '%')
    if [ -n "$COV_PCT" ]; then
      INT_COV=$(echo "$COV_PCT" | cut -d. -f1)
      if [ "$INT_COV" -lt "$THRESHOLD" ]; then
        printf 'go.mod:0\ttest coverage %s%% is below %d%% threshold\n' "$COV_PCT" "$THRESHOLD"
        ISSUES=$((ISSUES+1))
      fi
    fi
    rm -f "$COVERAGE_FILE"
  fi

  # Assertion density: no test blocks with zero assertions
  while IFS= read -r -d '' f; do
    rel="${f#$ROOT/}"
    while IFS=: read -r lineno funcname; do
      funcbody=$(awk "NR==$lineno,/^func / && NR>$lineno" "$f" | tail -n +2)
      if ! echo "$funcbody" | grep -qE 't\.(Error|Fatal|Fail|Errorf|Fatalf)|assert\.|require\.|if.*t\.'; then
        printf '%s:%s\t%s — test function has no assertions — produces false confidence\n' "$rel" "$lineno" "$funcname"
        ISSUES=$((ISSUES+1))
      fi
    done < <(grep -nE '^func Test[^(]+\(' "$f" | sed -E 's/^([0-9]+):func ([^(]+)\(.*/\1:\2/' || true)
  done < <(find "$ROOT" -name '*_test.go' -not -path '*/vendor/*' -print0 2>/dev/null)

  # Live credential usage: tests must not require real credentials to pass
  while IFS= read -r -d '' f; do
    rel="${f#$ROOT/}"
    if grep -nE 'os\.(Getenv|LookupEnv)[[:space:]]*\([[:space:]]*"[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)[A-Z_]*"' "$f" | \
       grep -qvE '^\s*(//|t\.Skip)'; then
      lineno=$(grep -nE 'os\.(Getenv|LookupEnv)[[:space:]]*\([[:space:]]*"[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)[A-Z_]*"' "$f" | head -1 | cut -d: -f1)
      printf '%s:%s\tlive credential read in test — add t.Skip when credential is absent\n' "$rel" "$lineno"
      ISSUES=$((ISSUES+1))
    fi
  done < <(find "$ROOT" -name '*_test.go' -not -path '*/vendor/*' -print0 2>/dev/null)

  SUMMARY_EMITTED=1
  if [ "$ISSUES" -eq 0 ]; then
    echo "PASS (0 issues)"
  else
    echo "FAIL ($ISSUES issues)"
  fi
  exit 0
fi

# ── JS branch (no go.mod) ────────────────────────────────────────────────────

# Discover testable package: check $ROOT/package.json then $ROOT/sdk/package.json
TEST_PKG_DIR=""
for candidate_dir in "$ROOT" "$ROOT/sdk"; do
  candidate="$candidate_dir/package.json"
  if [ -f "$candidate" ] && grep -q '"test"' "$candidate"; then
    TEST_PKG_DIR="$candidate_dir"
    break
  fi
done

if [ -z "$TEST_PKG_DIR" ]; then
  SUMMARY_EMITTED=1
  echo "PASS (0 issues)"
  exit 0
fi

# Enforce coverage threshold for JS projects (Go uses go test -cover).
# Run tests exactly once: either via c8 (which invokes node --test internally),
# via Node v22+ --experimental-test-coverage, or via npm test as a last resort.
# Never re-run tests after a coverage pass — that would double execution time and
# risk stateful side-effects.
THRESHOLD=$(jq -r ".coverage.threshold // 80" "$ROOT/.karen.json" 2>/dev/null || echo "80")
TMPLOG="/tmp/karen-js-test-$$"
cd "$TEST_PKG_DIR"

if command -v c8 >/dev/null 2>&1; then
  # c8 runs node --test with V8 coverage in a single pass — no separate npm test needed.
  set +e
  c8 --check-coverage --lines "$THRESHOLD" --functions "$THRESHOLD" --branches "$THRESHOLD" \
    node --test 2>&1 | tee "$TMPLOG"
  C8_EXIT=${PIPESTATUS[0]}
  set -e
  if [ "$C8_EXIT" -ne 0 ]; then
    # Parse TAP "not ok" lines for test failures, cap at 20.
    TAP_COUNT=0
    while IFS= read -r line; do
      [ "$TAP_COUNT" -ge 20 ] && break
      trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
      case "$trimmed" in
        "not ok"*)
          desc=$(echo "$trimmed" | sed -E 's/^not ok[[:space:]]+[0-9]+[[:space:]]*//' | sed 's/^not ok //')
          printf 'package.json:0\ttest failed — %s\n' "$desc"
          ISSUES=$((ISSUES+1))
          TAP_COUNT=$((TAP_COUNT+1))
          ;;
      esac
    done < "$TMPLOG"
    # If no TAP failures parsed but exit was non-zero, it may be a coverage threshold miss.
    if [ "$TAP_COUNT" -eq 0 ]; then
      printf 'package.json:0\tJS test coverage below threshold %s%%\n' "${THRESHOLD}"
      ISSUES=$((ISSUES+1))
    fi
  fi
else
  NODE_MAJ=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ -n "$NODE_MAJ" ] && [ "$NODE_MAJ" -ge 22 ] 2>/dev/null; then
    # Node v22+ has built-in coverage; runs tests and collects coverage in one pass.
    set +e
    node --experimental-test-coverage --test 2>&1 | tee "$TMPLOG"
    NODE_EXIT=${PIPESTATUS[0]}
    set -e
    if [ "$NODE_EXIT" -ne 0 ]; then
      TAP_COUNT=0
      while IFS= read -r line; do
        [ "$TAP_COUNT" -ge 20 ] && break
        trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
        case "$trimmed" in
          "not ok"*)
            desc=$(echo "$trimmed" | sed -E 's/^not ok[[:space:]]+[0-9]+[[:space:]]*//' | sed 's/^not ok //')
            printf 'package.json:0\ttest failed — %s\n' "$desc"
            ISSUES=$((ISSUES+1))
            TAP_COUNT=$((TAP_COUNT+1))
            ;;
        esac
      done < "$TMPLOG"
      [ "$TAP_COUNT" -eq 0 ] && { printf 'package.json:0\ttest suite failed — fix failing tests before proceeding\n'; ISSUES=$((ISSUES+1)); }
    fi
    # Parse coverage summary from output.
    ALL_LINE=$(grep -iE "^all files" "$TMPLOG" | tail -1 || true)
    if [ -n "$ALL_LINE" ]; then
      COV_PCT=$(echo "$ALL_LINE" | grep -oE '[0-9]+\.[0-9]+' | head -1)
      if [ -n "$COV_PCT" ]; then
        INT_COV=$(echo "$COV_PCT" | cut -d. -f1)
        if [ "$INT_COV" -lt "$THRESHOLD" ] 2>/dev/null; then
          printf 'package.json:0\tJS test coverage %s%% is below %s%% threshold\n' "$COV_PCT" "${THRESHOLD}"
          ISSUES=$((ISSUES+1))
        fi
      fi
    fi
  else
    # No coverage tool available — run npm test once for pass/fail, warn on coverage.
    set +e
    npm test 2>&1 | tee "$TMPLOG"
    TEST_EXIT=${PIPESTATUS[0]}
    set -e
    if [ "$TEST_EXIT" -ne 0 ]; then
      TAP_COUNT=0
      while IFS= read -r line; do
        [ "$TAP_COUNT" -ge 20 ] && break
        trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
        case "$trimmed" in
          "not ok"*)
            desc=$(echo "$trimmed" | sed -E 's/^not ok[[:space:]]+[0-9]+[[:space:]]*//' | sed 's/^not ok //')
            printf 'package.json:0\ttest failed — %s\n' "$desc"
            ISSUES=$((ISSUES+1))
            TAP_COUNT=$((TAP_COUNT+1))
            ;;
        esac
      done < "$TMPLOG"
      [ "$TAP_COUNT" -eq 0 ] && { printf 'package.json:0\ttest suite failed — fix failing tests before proceeding\n'; ISSUES=$((ISSUES+1)); }
    fi
    printf 'package.json:0\tJS coverage threshold enforcement requires c8 (npm install -g c8) or Node.js v22+\n'
    ISSUES=$((ISSUES+1))
  fi
fi
rm -f "$TMPLOG"
cd "$ROOT"

# Assertion density check
while IFS= read -r f; do
  if [ -z "$f" ]; then continue; fi
  if ! grep -qE "assert\.|expect\(|should\.|t\.pass|t\.fail|ok\(" "$f" 2>/dev/null; then
    rel="${f#$ROOT/}"
    printf '%s:0\ttest file has no assertion calls\n' "$rel"
    ISSUES=$((ISSUES+1))
  fi
done < <(find "$ROOT" -maxdepth 5 \( -name "*.test.js" -o -name "*.spec.js" \) -not -path "*/node_modules/*" 2>/dev/null || true)

# Live credential check in JS tests
while IFS= read -r f; do
  if [ -z "$f" ]; then continue; fi
  while IFS=: read -r lineno rest; do
    if [ -z "$lineno" ]; then continue; fi
    if echo "$rest" | grep -qE 'karen-ignore|skip'; then continue; fi
    rel="${f#$ROOT/}"
    printf '%s:%s\tlive credential env var read in test\n' "$rel" "$lineno"
    ISSUES=$((ISSUES+1))
  done < <(grep -nE "process\.env\.(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API|ADMIN)[^_A-Z]" "$f" 2>/dev/null || true)
done < <(find "$ROOT" -maxdepth 5 \( -name "*.test.js" -o -name "*.spec.js" \) -not -path "*/node_modules/*" 2>/dev/null || true)

SUMMARY_EMITTED=1
if [ "$ISSUES" -eq 0 ]; then
  echo "PASS (0 issues)"
else
  echo "FAIL ($ISSUES issues)"
fi
exit 0
