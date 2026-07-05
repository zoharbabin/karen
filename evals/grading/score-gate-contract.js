#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.5 (Gate contract conformance) against
// BLUEPRINT.md's "The Gate Contract" section. Pure format validation of the
// raw stdout each gate in run-capture.json's `auditRuns[0].gateResults`
// (CONTRACT.md §2) printed, plus its exit code, against the fixture's
// `expected-gates.json` (CONTRACT.md §1) for zero-tolerance expectations.
// No fuzzy scoring, no judgment — a schema/format validator.
//
// metrics = {
//   perGate: {
//     <gateId>: {
//       summaryLineValid:      boolean, // a raw line exactly matches
//                                        // ^(PASS \(0 issues\)|FAIL \(\d+ issues\))$
//       countMatches:          boolean, // parsed summary count === number of
//                                        // parsed issue lines
//       exitCodeValid:         boolean, // exitCode is 0 iff summary is PASS,
//                                        // 1 iff summary is FAIL, never 2
//       zeroToleranceCorrect: boolean, // ZERO-TOLERANCE line present iff the
//                                        // gate is zeroTolerance:true AND has
//                                        // issues; absent otherwise. Vacuously
//                                        // true when expected-gates.json (or
//                                        // an entry for this gate) is absent.
//     }
//   }
// }
//
// pass = every boolean above is true for every gate in auditRuns[0].gateResults.

const fs = require('fs');
const path = require('path');
const { parseGateOutput } = require('./lib/parse-gate-output');

// Strict per BLUEPRINT.md §"The Gate Contract": exactly "PASS (0 issues)" or
// "FAIL (N issues)" — plural "issues" always, singular "issue" is not valid
// contract output even though the shared parser tolerates it for leniency.
const STRICT_SUMMARY_RE = /^(PASS \(0 issues\)|FAIL \(\d+ issues\))$/;

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasStrictSummaryLine(stdout) {
  return stdout.split('\n').some((line) => STRICT_SUMMARY_RE.test(line));
}

// expectedGates is null when expected-gates.json doesn't exist for this
// fixture (vacuous pass per the shared "missing ground truth" rule) or when
// this particular gateId has no entry in it.
function findExpectedGate(expectedGates, gateId) {
  if (!expectedGates) return null;
  return expectedGates.find((g) => g.id === gateId) || null;
}

function scoreGate(gateId, gateResult, expectedGates, details) {
  const stdout = gateResult.stdout || '';
  const exitCode = gateResult.exitCode;
  const parsed = parseGateOutput(stdout);

  const summaryLineValid = hasStrictSummaryLine(stdout);
  if (!summaryLineValid) {
    details.push({ field: `perGate.${gateId}.summaryLineValid`, stdout });
  }

  const countMatches = parsed.summary !== null && parsed.summary.count === parsed.issues.length;
  if (!countMatches) {
    details.push({
      field: `perGate.${gateId}.countMatches`,
      summaryCount: parsed.summary ? parsed.summary.count : null,
      parsedIssueCount: parsed.issues.length,
    });
  }

  const exitCodeValid =
    parsed.summary !== null &&
    ((parsed.summary.status === 'PASS' && exitCode === 0) ||
      (parsed.summary.status === 'FAIL' && exitCode === 1));
  if (!exitCodeValid) {
    details.push({
      field: `perGate.${gateId}.exitCodeValid`,
      status: parsed.summary ? parsed.summary.status : null,
      exitCode,
    });
  }

  const expectedGate = findExpectedGate(expectedGates, gateId);
  // No ground truth for this gate's zero-tolerance status — vacuous pass.
  const zeroToleranceExpected = expectedGate ? Boolean(expectedGate.zeroTolerance) : false;
  const zeroToleranceLineExpected = zeroToleranceExpected && parsed.issues.length > 0;
  const zeroToleranceCorrect =
    expectedGate === null || parsed.zeroTolerance === zeroToleranceLineExpected;
  if (!zeroToleranceCorrect) {
    details.push({
      field: `perGate.${gateId}.zeroToleranceCorrect`,
      expectedZeroToleranceLine: zeroToleranceLineExpected,
      actualZeroToleranceLine: parsed.zeroTolerance,
    });
  }

  return { summaryLineValid, countMatches, exitCodeValid, zeroToleranceCorrect };
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: score-gate-contract.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
  const fixture = runCapture.fixture || path.basename(fixtureDir);
  const expectedGates = readJsonIfExists(path.join(fixtureDir, 'expected-gates.json'));

  const auditRuns = runCapture.auditRuns || [];
  const initialRun = auditRuns[0] || null;
  const gateResults = (initialRun && initialRun.gateResults) || {};

  const details = [];
  const perGate = {};
  for (const [gateId, gateResult] of Object.entries(gateResults)) {
    perGate[gateId] = scoreGate(gateId, gateResult, expectedGates, details);
  }

  const pass = Object.values(perGate).every(
    (g) => g.summaryLineValid && g.countMatches && g.exitCodeValid && g.zeroToleranceCorrect
  );

  const result = {
    dimension: 'gate-contract',
    fixture,
    metrics: { perGate },
    pass,
    details,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
