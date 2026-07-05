#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.8 (Circuit breaker correctness) against
// BLUEPRINT.md's "The Circuit Breaker" section: staleCount increments by
// exactly 1 per gate per run while its content-hash fingerprint stays
// identical, resets to 0 the moment the fingerprint changes, and the gate
// trips (staleCount >= threshold, default 3) exactly on the run that first
// crosses the threshold — not before, not after. Walks the fixed trigger
// window CONTRACT.md §5 guarantees: the entry immediately before the
// "04-repeat-noop-*" trio, then "04-repeat-noop-1/2/3" themselves.
//
// Only tests the *automatic* reset half of BLUEPRINT.md's reset behavior
// (fingerprint change -> staleCount 0). The *manual* `write_run_state` reset
// path has no representation in run-capture.json's fixed 7-entry auditRuns
// shape (CONTRACT.md §2) and is out of scope for this script.
//
// metrics = {
//   perGate: {
//     <gateId>: {
//       staleCountSequence: [beforeRepeatNoop, afterRepeatNoop1, afterRepeatNoop2, afterRepeatNoop3],
//       incrementCorrect: [bool|null, bool|null, bool|null], // per repeat-noop run:
//         // true if actual staleCount matches BLUEPRINT.md semantics for that
//         // run (prev+1 when fingerprint unchanged, 0 when fingerprint
//         // changed); null when not checkable (missing runState data).
//       trippedAtCorrectRun: bool|null, // true iff staleCount is below
//         // threshold after runs 1 and 2 and >= threshold after run 3;
//         // null when the gate isn't "stuck" across the whole window (its
//         // fingerprint changed at some point, so tripping doesn't apply)
//         // or staleCount data is missing entirely.
//       auditExitCodeCorrect: bool|null, // true iff an audit-level exit
//         // code field found on the run-capture entry equals the
//         // configured circuitBreaker.exitCode (default 2) once tripped,
//         // and does not equal it before tripping; null when no such field
//         // is present anywhere in the run-capture data (not part of the
//         // documented shape, CONTRACT.md §2 only defines per-gate exit
//         // codes) — vacuous pass, not a failure.
//     }
//   }
// }
// pass = every gate's incrementCorrect entries are truthy-or-null AND
//        trippedAtCorrectRun !== false AND auditExitCodeCorrect !== false.

const fs = require('fs');
const path = require('path');

// Per CONTRACT.md §5, the fixed trigger order.
const TRIGGER_ORDER = [
  'initial',
  '01-partial-fix',
  '02-regression',
  '03-noop-line-shift',
  '04-repeat-noop-1',
  '04-repeat-noop-2',
  '04-repeat-noop-3',
];

const REPEAT_NOOP_TRIGGERS = ['04-repeat-noop-1', '04-repeat-noop-2', '04-repeat-noop-3'];

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findRunEntry(auditRuns, trigger) {
  return auditRuns.find((run) => run.trigger === trigger) || null;
}

function previousTrigger(trigger) {
  const idx = TRIGGER_ORDER.indexOf(trigger);
  if (idx <= 0) return null;
  return TRIGGER_ORDER[idx - 1];
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function gateRunState(runEntry, gateId) {
  if (!runEntry || !runEntry.runState || !runEntry.runState.gates) return null;
  return runEntry.runState.gates[gateId] || null;
}

function gateFingerprint(runEntry, gateId) {
  const gate = gateRunState(runEntry, gateId);
  return gate && Array.isArray(gate.fingerprint) ? gate.fingerprint : null;
}

function gateStaleCount(runEntry, gateId) {
  const gate = gateRunState(runEntry, gateId);
  if (!gate || !Object.prototype.hasOwnProperty.call(gate, 'staleCount')) return undefined;
  return gate.staleCount;
}

function gateCount(runEntry, gateId) {
  const gate = gateRunState(runEntry, gateId);
  return gate ? gate.count : null;
}

// Best-effort lookup of an "audit-level" exit code on a run-capture entry.
// Not part of CONTRACT.md §2's documented shape (which only defines
// per-gate gateResults[gateId].exitCode) so several plausible locations are
// checked defensively; absence everywhere is a vacuous pass, not a bug.
function auditLevelExitCode(runEntry) {
  if (!runEntry) return undefined;
  if (typeof runEntry.auditExitCode === 'number') return runEntry.auditExitCode;
  if (typeof runEntry.exitCode === 'number') return runEntry.exitCode;
  if (runEntry.gateResults && typeof runEntry.gateResults.auditExitCode === 'number') {
    return runEntry.gateResults.auditExitCode;
  }
  if (runEntry.runState && typeof runEntry.runState.exitCode === 'number') {
    return runEntry.runState.exitCode;
  }
  return undefined;
}

// Gates in scope: gates with an unresolved issue (count > 0) at the baseline
// entry immediately before the repeat-noop trio — a gate already at zero
// issues can't be "stuck" and isn't what §4.8 is testing.
function gatesInScope(baselineEntry) {
  const gates = (baselineEntry && baselineEntry.runState && baselineEntry.runState.gates) || {};
  return Object.keys(gates).filter((gateId) => gateCount(baselineEntry, gateId) > 0);
}

function checkIncrement(prevEntry, currEntry, gateId, details, label) {
  const prevFingerprint = gateFingerprint(prevEntry, gateId);
  const currFingerprint = gateFingerprint(currEntry, gateId);
  const prevStaleCount = gateStaleCount(prevEntry, gateId);
  const currStaleCount = gateStaleCount(currEntry, gateId);

  if (prevFingerprint === null || currFingerprint === null) {
    details.push({ field: `${gateId}.${label}`, issue: 'missing runState.gates fingerprint in previous or current run' });
    return { fingerprintUnchanged: null, incrementCorrect: null, staleCount: currStaleCount };
  }
  if (prevStaleCount === undefined || currStaleCount === undefined) {
    details.push({ field: `${gateId}.${label}`, issue: 'staleCount field missing from runState.gates in previous or current run' });
    return { fingerprintUnchanged: null, incrementCorrect: null, staleCount: currStaleCount };
  }

  const fingerprintUnchanged = arraysEqual(prevFingerprint, currFingerprint);
  const expectedStaleCount = fingerprintUnchanged ? prevStaleCount + 1 : 0;
  const incrementCorrect = currStaleCount === expectedStaleCount;

  if (!incrementCorrect) {
    details.push({
      field: `${gateId}.${label}.staleCount`,
      fingerprintUnchanged,
      expected: expectedStaleCount,
      actual: currStaleCount,
      issue: fingerprintUnchanged
        ? 'fingerprint identical to previous run but staleCount did not increment by exactly 1'
        : 'fingerprint changed from previous run but staleCount did not reset to 0',
    });
  }

  return { fingerprintUnchanged, incrementCorrect, staleCount: currStaleCount };
}

function scoreGate(gateId, entries, threshold, trippedExitCode, details) {
  const [baselineEntry, run1Entry, run2Entry, run3Entry] = entries;

  const staleCountSequence = [
    gateStaleCount(baselineEntry, gateId),
    gateStaleCount(run1Entry, gateId),
    gateStaleCount(run2Entry, gateId),
    gateStaleCount(run3Entry, gateId),
  ].map((v) => (v === undefined ? null : v));

  const step1 = checkIncrement(baselineEntry, run1Entry, gateId, details, '04-repeat-noop-1');
  const step2 = checkIncrement(run1Entry, run2Entry, gateId, details, '04-repeat-noop-2');
  const step3 = checkIncrement(run2Entry, run3Entry, gateId, details, '04-repeat-noop-3');

  const incrementCorrect = [step1.incrementCorrect, step2.incrementCorrect, step3.incrementCorrect];

  // Tripping only applies to a gate that stayed "stuck" (fingerprint
  // unchanged) across the entire window; a gate whose fingerprint changed
  // partway through was reset and isn't expected to trip.
  const staysStuck = [step1.fingerprintUnchanged, step2.fingerprintUnchanged, step3.fingerprintUnchanged].every(
    (v) => v === true
  );

  let trippedAtCorrectRun = null;
  if (staysStuck && step1.staleCount !== undefined && step2.staleCount !== undefined && step3.staleCount !== undefined) {
    const notTrippedAfterRun1 = step1.staleCount < threshold;
    const notTrippedAfterRun2 = step2.staleCount < threshold;
    const trippedAfterRun3 = step3.staleCount >= threshold;
    trippedAtCorrectRun = notTrippedAfterRun1 && notTrippedAfterRun2 && trippedAfterRun3;
    if (!trippedAtCorrectRun) {
      details.push({
        field: `${gateId}.trippedAtCorrectRun`,
        threshold,
        staleCountSequence,
        issue: 'circuit did not trip exactly on 04-repeat-noop-3 (tripped early, late, or never)',
      });
    }
  }

  let auditExitCodeCorrect = null;
  const exitCode1 = auditLevelExitCode(run1Entry);
  const exitCode2 = auditLevelExitCode(run2Entry);
  const exitCode3 = auditLevelExitCode(run3Entry);
  if (trippedAtCorrectRun !== null && (exitCode1 !== undefined || exitCode2 !== undefined || exitCode3 !== undefined)) {
    const beforeTripOk = (exitCode1 === undefined || exitCode1 !== trippedExitCode) && (exitCode2 === undefined || exitCode2 !== trippedExitCode);
    const atTripOk = exitCode3 === undefined || exitCode3 === trippedExitCode;
    auditExitCodeCorrect = beforeTripOk && atTripOk;
    if (!auditExitCodeCorrect) {
      details.push({
        field: `${gateId}.auditExitCodeCorrect`,
        expectedExitCodeAtTrip: trippedExitCode,
        exitCode1,
        exitCode2,
        exitCode3,
        issue: 'audit-level exit code did not match circuitBreaker.exitCode exactly at the trip run',
      });
    }
  }

  return { staleCountSequence, incrementCorrect, trippedAtCorrectRun, auditExitCodeCorrect };
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: score-circuit-breaker.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
  const auditRuns = runCapture.auditRuns || [];
  const fixture = runCapture.fixture || path.basename(fixtureDir);

  const karenJson = readJsonIfExists(path.join(fixtureDir, 'expected-karen.json'));
  const circuitBreaker = (karenJson && karenJson.circuitBreaker) || {};
  const threshold = typeof circuitBreaker.threshold === 'number' ? circuitBreaker.threshold : 3;
  const trippedExitCode = typeof circuitBreaker.exitCode === 'number' ? circuitBreaker.exitCode : 2;

  const firstRepeatNoopTrigger = REPEAT_NOOP_TRIGGERS[0];
  const run1Entry = findRunEntry(auditRuns, firstRepeatNoopTrigger);

  // Fixture doesn't ship the repeat-noop patch (per CONTRACT.md §2's
  // zero-non-decoy-issues exception) — vacuously pass, nothing to check.
  if (!run1Entry) {
    process.stdout.write(
      `${JSON.stringify({
        dimension: 'circuit-breaker',
        fixture,
        metrics: { perGate: {} },
        pass: true,
        details: [{ field: firstRepeatNoopTrigger, issue: 'no auditRuns entry for this trigger; dimension vacuously passes' }],
      })}\n`
    );
    return;
  }

  const baselineTrigger = previousTrigger(firstRepeatNoopTrigger);
  const baselineEntry = baselineTrigger ? findRunEntry(auditRuns, baselineTrigger) : null;
  const run2Entry = findRunEntry(auditRuns, REPEAT_NOOP_TRIGGERS[1]);
  const run3Entry = findRunEntry(auditRuns, REPEAT_NOOP_TRIGGERS[2]);

  const details = [];

  if (!baselineEntry || !run2Entry || !run3Entry) {
    const missing = [
      !baselineEntry ? baselineTrigger : null,
      !run2Entry ? REPEAT_NOOP_TRIGGERS[1] : null,
      !run3Entry ? REPEAT_NOOP_TRIGGERS[2] : null,
    ].filter(Boolean);
    process.stdout.write(
      `${JSON.stringify({
        dimension: 'circuit-breaker',
        fixture,
        metrics: { perGate: {} },
        pass: false,
        details: [{ field: 'auditRuns', issue: `missing required auditRuns entries for: ${missing.join(', ')}` }],
      })}\n`
    );
    return;
  }

  const entries = [baselineEntry, run1Entry, run2Entry, run3Entry];
  const inScopeGates = gatesInScope(baselineEntry);

  const perGate = {};
  for (const gateId of inScopeGates) {
    perGate[gateId] = scoreGate(gateId, entries, threshold, trippedExitCode, details);
  }

  const pass = inScopeGates.every((gateId) => {
    const result = perGate[gateId];
    const incrementsOk = result.incrementCorrect.every((v) => v !== false);
    return incrementsOk && result.trippedAtCorrectRun !== false && result.auditExitCodeCorrect !== false;
  });

  const result = {
    dimension: 'circuit-breaker',
    fixture,
    metrics: { perGate },
    pass,
    details,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
