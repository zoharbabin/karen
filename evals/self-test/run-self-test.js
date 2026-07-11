#!/usr/bin/env node
'use strict';

// Validates the benchmark against itself, per EVALS-PLAN.md §6: for every
// fixture under evals/fixtures/, every applicable score-*.js grader must
// score self-test/golden/<fixture>/run-capture.json at/above its own pass
// threshold, and must score self-test/broken/<fixture>/run-capture.json as
// failing on exactly the dimensions self-test/broken/<fixture>/flaws.json
// declares -- no more, no less. This is CONTRACT.md §4 made executable and
// runnable in CI (see .github/workflows/evals-selftest.yml), rather than a
// one-off manual check re-derived by hand each session.
//
// Usage: node self-test/run-self-test.js [--json]
// Exit 0 if every check passes, exit 1 otherwise. Prints a per-fixture
// summary; --json prints one JSON report object instead.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EVALS = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(EVALS, 'fixtures');
const GRADING_DIR = path.join(EVALS, 'grading');

// Maps each score-*.js script's own `dimension` field (CONTRACT.md §3) to
// the flaws.json `dimension` key (EVALS-PLAN.md §6 uses a slightly different
// casing/spelling convention than the grader output -- both are in the wild
// across the 14 fixtures' flaws.json files).
const SCRIPT_TO_DIMENSION_KEYS = {
  'score-detection.js': ['detection'],
  'score-interview.js': ['interview'],
  'score-karen-json.js': ['karen-json', 'karenJson'],
  'score-gate-issues.js': ['gate-issues', 'gateIssues'],
  'score-gate-contract.js': ['gate-contract', 'gateContract'],
  'score-delta.js': ['delta'],
  'score-fingerprint-stability.js': ['fingerprint-stability', 'fingerprintStability'],
  'score-circuit-breaker.js': ['circuit-breaker', 'circuitBreaker'],
  'score-reconciliation.js': ['reconciliation'],
  'score-known-gaps.js': ['known-gaps', 'knownGaps'],
};

const SCRIPTS = Object.keys(SCRIPT_TO_DIMENSION_KEYS);

function runGrader(script, fixtureDir, runCaptureFile) {
  const out = execFileSync('node', [path.join(GRADING_DIR, script), fixtureDir, runCaptureFile], {
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

function checkGolden(fixtureName) {
  const fixtureDir = path.join(FIXTURES_DIR, fixtureName);
  const runCaptureFile = path.join(EVALS, 'self-test', 'golden', fixtureName, 'run-capture.json');
  const failures = [];
  for (const script of SCRIPTS) {
    const result = runGrader(script, fixtureDir, runCaptureFile);
    if (!result.pass) {
      failures.push({ script, dimension: result.dimension, details: result.details });
    }
  }
  return failures;
}

function checkBroken(fixtureName) {
  const fixtureDir = path.join(FIXTURES_DIR, fixtureName);
  const runCaptureFile = path.join(EVALS, 'self-test', 'broken', fixtureName, 'run-capture.json');
  const flawsFile = path.join(EVALS, 'self-test', 'broken', fixtureName, 'flaws.json');
  const flaws = JSON.parse(fs.readFileSync(flawsFile, 'utf8')).flaws;
  const declaredDimensionKeys = new Set(flaws.map((f) => f.dimension));

  const problems = [];
  for (const script of SCRIPTS) {
    const dimensionKeys = SCRIPT_TO_DIMENSION_KEYS[script];
    const isDeclared = dimensionKeys.some((k) => declaredDimensionKeys.has(k));
    const result = runGrader(script, fixtureDir, runCaptureFile);

    if (isDeclared && result.pass) {
      problems.push({
        script,
        issue: 'expected-failure-but-passed',
        detail: `flaws.json declares ${script} should fail, but it passed`,
      });
    }
    if (!isDeclared && !result.pass) {
      problems.push({
        script,
        issue: 'unexpected-failure',
        detail: `${script} failed but flaws.json declares no flaw for it`,
        details: result.details,
      });
    }
  }
  return problems;
}

function main() {
  const asJson = process.argv.includes('--json');
  const fixtureNames = fs
    .readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const report = { fixtures: {}, ok: true };

  for (const fixtureName of fixtureNames) {
    const goldenFailures = checkGolden(fixtureName);
    const brokenProblems = checkBroken(fixtureName);
    const fixtureOk = goldenFailures.length === 0 && brokenProblems.length === 0;
    report.fixtures[fixtureName] = { goldenFailures, brokenProblems, ok: fixtureOk };
    if (!fixtureOk) report.ok = false;
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    for (const [fixtureName, result] of Object.entries(report.fixtures)) {
      if (result.ok) {
        process.stdout.write(`PASS  ${fixtureName}\n`);
        continue;
      }
      process.stdout.write(`FAIL  ${fixtureName}\n`);
      for (const f of result.goldenFailures) {
        process.stdout.write(`  golden: ${f.script} (${f.dimension}) did not pass\n`);
      }
      for (const p of result.brokenProblems) {
        process.stdout.write(`  broken: ${p.script} -- ${p.detail}\n`);
      }
    }
    process.stdout.write(report.ok ? '\nAll fixtures pass self-test.\n' : '\nSelf-test failures found.\n');
  }

  process.exit(report.ok ? 0 : 1);
}

main();
