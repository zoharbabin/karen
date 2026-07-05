#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.6 (Delta feedback correctness), scored against
// BLUEPRINT.md's "Run State" / "Delta Feedback" sections (per-gate `count` in
// `.karen/run-state.json`, compared run-over-run).
// metrics = { partialFix: { expectedDeltas, actualDeltas, matches }, regression: { ... } }
// where expectedDeltas/actualDeltas are { gateId: number } maps covering the
// union of every gate the fixture exercises (named gates from the patch
// sidecar's expectedDelta, plus every other gate present in run-state, which
// must show delta 0 — the PASS_TO_PASS-equivalent regression guard).

const fs = require('fs');
const path = require('path');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findRunEntry(auditRuns, trigger) {
  return auditRuns.find((run) => run.trigger === trigger) || null;
}

// Per CONTRACT.md §5, the fixed trigger order — used to find "the
// immediately preceding entry" for a given trigger by array position rather
// than by a hardcoded predecessor map.
const TRIGGER_ORDER = [
  'initial',
  '01-partial-fix',
  '02-regression',
  '03-noop-line-shift',
  '04-repeat-noop-1',
  '04-repeat-noop-2',
  '04-repeat-noop-3',
];

function previousTrigger(trigger) {
  const idx = TRIGGER_ORDER.indexOf(trigger);
  if (idx <= 0) return null;
  return TRIGGER_ORDER[idx - 1];
}

function gateCount(runEntry, gateId) {
  if (!runEntry || !runEntry.runState || !runEntry.runState.gates) return null;
  const gate = runEntry.runState.gates[gateId];
  return gate ? gate.count : null;
}

// Computes actual per-gate deltas (currentCount - previousCount) for every
// gate present in either the current or previous run's runState.gates, so
// gates outside expectedDelta are still checked for a zero delta.
function computeActualDeltas(auditRuns, trigger) {
  const currentEntry = findRunEntry(auditRuns, trigger);
  const prevTrigger = previousTrigger(trigger);
  const previousEntry = prevTrigger ? findRunEntry(auditRuns, prevTrigger) : null;

  if (!currentEntry) return null;

  const currentGates = (currentEntry.runState && currentEntry.runState.gates) || {};
  const previousGates = (previousEntry && previousEntry.runState && previousEntry.runState.gates) || {};

  const gateIds = new Set([...Object.keys(currentGates), ...Object.keys(previousGates)]);
  const deltas = {};
  for (const gateId of gateIds) {
    const currentCount = gateCount(currentEntry, gateId);
    const previousCount = gateCount(previousEntry, gateId);
    if (currentCount === null || previousCount === null) continue;
    deltas[gateId] = currentCount - previousCount;
  }
  return deltas;
}

// Confirms every gate named in expectedDelta matches exactly, and every gate
// not named in expectedDelta (but present in actualDeltas) shows a zero
// delta — the regression guard.
function checkDeltas(expectedDelta, actualDeltas) {
  if (actualDeltas === null) return false;
  for (const [gateId, expected] of Object.entries(expectedDelta)) {
    if (actualDeltas[gateId] !== expected) return false;
  }
  for (const [gateId, actual] of Object.entries(actualDeltas)) {
    if (Object.prototype.hasOwnProperty.call(expectedDelta, gateId)) continue;
    if (actual !== 0) return false;
  }
  return true;
}

function scoreSidecar(sidecar, trigger, auditRuns, details, label) {
  // No sidecar for this fixture (e.g. patch not shipped) — vacuously pass.
  if (sidecar === null) {
    return { expectedDeltas: {}, actualDeltas: {}, matches: true };
  }

  const expectedDelta = sidecar.expectedDelta || {};
  const actualDeltas = computeActualDeltas(auditRuns, trigger);

  if (actualDeltas === null) {
    details.push({
      field: label,
      issue: `no auditRuns entry found for trigger "${trigger}"`,
    });
    return { expectedDeltas: expectedDelta, actualDeltas: {}, matches: false };
  }

  const matches = checkDeltas(expectedDelta, actualDeltas);

  if (!matches) {
    for (const [gateId, expected] of Object.entries(expectedDelta)) {
      const actual = actualDeltas[gateId];
      if (actual !== expected) {
        details.push({
          field: `${label}.${gateId}`,
          expectedDelta: expected,
          actualDelta: actual === undefined ? null : actual,
        });
      }
    }
    for (const [gateId, actual] of Object.entries(actualDeltas)) {
      if (Object.prototype.hasOwnProperty.call(expectedDelta, gateId)) continue;
      if (actual !== 0) {
        details.push({
          field: `${label}.${gateId}`,
          expectedDelta: 0,
          actualDelta: actual,
          issue: 'unexpected non-zero delta on gate not named in expectedDelta (regression guard)',
        });
      }
    }
  }

  return { expectedDeltas: expectedDelta, actualDeltas, matches };
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: score-delta.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
  const auditRuns = runCapture.auditRuns || [];
  const fixture = runCapture.fixture || path.basename(fixtureDir);

  const partialFixSidecar = readJsonIfExists(path.join(fixtureDir, 'patches', '01-partial-fix.json'));
  const regressionSidecar = readJsonIfExists(path.join(fixtureDir, 'patches', '02-regression.json'));

  const details = [];
  const partialFix = scoreSidecar(partialFixSidecar, '01-partial-fix', auditRuns, details, 'partialFix');
  const regression = scoreSidecar(regressionSidecar, '02-regression', auditRuns, details, 'regression');

  const result = {
    dimension: 'delta',
    fixture,
    metrics: { partialFix, regression },
    pass: partialFix.matches && regression.matches,
    details,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
