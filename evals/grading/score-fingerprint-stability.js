#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.7 (Fingerprint stability under line drift),
// scored against BLUEPRINT.md's "Run State" section: fingerprint identity is
// "content-based, not file:line" — a hash of (file, normalized description),
// so an unrelated line inserted above an unfixed issue must not change its
// fingerprint, its gate's count, or reset that gate's staleCount.
// metrics = { perGate: { gateId: { fingerprintUnchanged: bool,
//                                   countUnchanged: bool,
//                                   staleCountNotReset: bool|null } } }
// staleCountNotReset is null when neither run-state entry exposes a
// per-gate `staleCount` field (BLUEPRINT.md's run-state.json example does
// not show one) — treated as vacuous pass, not a failure.
// pass = every gate's fingerprintUnchanged && countUnchanged &&
//        (staleCountNotReset !== false).

const fs = require('fs');
const path = require('path');
const { parseGateOutput } = require('./lib/parse-gate-output');

// Per CONTRACT.md §5, the fixed trigger order — used to find "the entry
// immediately before 03-noop-line-shift" by array position.
const TRIGGER_ORDER = [
  'initial',
  '01-partial-fix',
  '02-regression',
  '03-noop-line-shift',
  '04-repeat-noop-1',
  '04-repeat-noop-2',
  '04-repeat-noop-3',
];

const TARGET_TRIGGER = '03-noop-line-shift';

function findRunEntry(auditRuns, trigger) {
  return auditRuns.find((run) => run.trigger === trigger) || null;
}

function previousTrigger(trigger) {
  const idx = TRIGGER_ORDER.indexOf(trigger);
  if (idx <= 0) return null;
  return TRIGGER_ORDER[idx - 1];
}

// Signature of an issue ignoring line number (line is exactly what the
// noop patch is allowed to shift) — used to detect "issue set otherwise
// unchanged" for a gate between the two runs.
function issueSignature(issue) {
  return `${issue.file}::${issue.message}`;
}

function sortedSignatures(stdout) {
  if (typeof stdout !== 'string') return [];
  const { issues } = parseGateOutput(stdout);
  return issues.map(issueSignature).sort();
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

// A gate is in scope for this dimension when it currently has an unfixed
// issue (count > 0) and its issue set (by content, ignoring line) is
// identical between the previous run and the noop-line-shift run — the
// operational stand-in for "an unfixed issue affected by the line shift".
function gatesInScope(previousEntry, currentEntry) {
  const previousResults = (previousEntry && previousEntry.gateResults) || {};
  const currentResults = (currentEntry && currentEntry.gateResults) || {};
  const gateIds = new Set([...Object.keys(previousResults), ...Object.keys(currentResults)]);

  const inScope = [];
  for (const gateId of gateIds) {
    const previousStdout = previousResults[gateId] && previousResults[gateId].stdout;
    const currentStdout = currentResults[gateId] && currentResults[gateId].stdout;
    if (previousStdout === undefined || currentStdout === undefined) continue;

    const previousSignatures = sortedSignatures(previousStdout);
    const currentSignatures = sortedSignatures(currentStdout);
    if (currentSignatures.length === 0) continue; // fully fixed, nothing left to drift
    if (!arraysEqual(previousSignatures, currentSignatures)) continue;

    inScope.push(gateId);
  }
  return inScope;
}

function gateRunState(runEntry, gateId) {
  if (!runEntry || !runEntry.runState || !runEntry.runState.gates) return null;
  return runEntry.runState.gates[gateId] || null;
}

function checkGate(previousEntry, currentEntry, gateId, details) {
  const previousGate = gateRunState(previousEntry, gateId);
  const currentGate = gateRunState(currentEntry, gateId);

  if (!previousGate || !currentGate) {
    details.push({ field: gateId, issue: 'missing runState.gates entry in previous or current run' });
    return { fingerprintUnchanged: false, countUnchanged: false, staleCountNotReset: null };
  }

  const previousFingerprint = Array.isArray(previousGate.fingerprint) ? previousGate.fingerprint : [];
  const currentFingerprint = Array.isArray(currentGate.fingerprint) ? currentGate.fingerprint : [];
  const fingerprintUnchanged = arraysEqual(previousFingerprint, currentFingerprint);
  if (!fingerprintUnchanged) {
    details.push({
      field: `${gateId}.fingerprint`,
      expected: previousFingerprint,
      actual: currentFingerprint,
      issue: 'fingerprint changed across a pure line-shift noop patch',
    });
  }

  const countUnchanged = previousGate.count === currentGate.count;
  if (!countUnchanged) {
    details.push({
      field: `${gateId}.count`,
      expected: previousGate.count,
      actual: currentGate.count,
      issue: 'gate count changed across a pure line-shift noop patch',
    });
  }

  let staleCountNotReset = null;
  const previousHasStaleCount = Object.prototype.hasOwnProperty.call(previousGate, 'staleCount');
  const currentHasStaleCount = Object.prototype.hasOwnProperty.call(currentGate, 'staleCount');
  if (previousHasStaleCount || currentHasStaleCount) {
    if (!previousHasStaleCount || !currentHasStaleCount) {
      staleCountNotReset = false;
      details.push({
        field: `${gateId}.staleCount`,
        issue: 'staleCount field present in one run but missing in the other',
      });
    } else {
      // Fingerprint is identical, so per BLUEPRINT.md's circuit-breaker
      // logic staleCount must have incremented, not reset to zero.
      staleCountNotReset = currentGate.staleCount === previousGate.staleCount + 1;
      if (!staleCountNotReset) {
        details.push({
          field: `${gateId}.staleCount`,
          expected: previousGate.staleCount + 1,
          actual: currentGate.staleCount,
          issue: 'staleCount did not increment across an unchanged fingerprint (line-shift reset it)',
        });
      }
    }
  }

  return { fingerprintUnchanged, countUnchanged, staleCountNotReset };
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: score-fingerprint-stability.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
  const auditRuns = runCapture.auditRuns || [];
  const fixture = runCapture.fixture || path.basename(fixtureDir);

  const details = [];
  const currentEntry = findRunEntry(auditRuns, TARGET_TRIGGER);

  // Fixture doesn't ship this patch (per CONTRACT.md §2's zero-non-decoy-
  // issues exception) — vacuously pass, nothing to check.
  if (!currentEntry) {
    process.stdout.write(
      `${JSON.stringify({
        dimension: 'fingerprint-stability',
        fixture,
        metrics: { perGate: {} },
        pass: true,
        details: [{ field: TARGET_TRIGGER, issue: 'no auditRuns entry for this trigger; dimension vacuously passes' }],
      })}\n`
    );
    return;
  }

  const previousEntry = findRunEntry(auditRuns, previousTrigger(TARGET_TRIGGER));
  if (!previousEntry) {
    process.stdout.write(
      `${JSON.stringify({
        dimension: 'fingerprint-stability',
        fixture,
        metrics: { perGate: {} },
        pass: false,
        details: [{ field: previousTrigger(TARGET_TRIGGER), issue: 'no auditRuns entry found for the run preceding 03-noop-line-shift' }],
      })}\n`
    );
    return;
  }

  const inScopeGates = gatesInScope(previousEntry, currentEntry);
  const perGate = {};
  for (const gateId of inScopeGates) {
    perGate[gateId] = checkGate(previousEntry, currentEntry, gateId, details);
  }

  const pass = inScopeGates.every((gateId) => {
    const result = perGate[gateId];
    return result.fingerprintUnchanged && result.countUnchanged && result.staleCountNotReset !== false;
  });

  const result = {
    dimension: 'fingerprint-stability',
    fixture,
    metrics: { perGate },
    pass,
    details,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
