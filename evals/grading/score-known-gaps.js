#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.10 (known-gaps vs. exceptions classification,
// fixture 9 — python-sdk-single — only, but runs generically so any fixture
// without this scenario passes vacuously). Ground truth per BLUEPRINT.md
// §"Known Gaps vs. Exceptions": a tracker-backed, no-expiry item belongs in
// `knownGaps`; a dated, temporary item belongs in `exceptions` — never both,
// never swapped. Compares expected-karen.json (CONTRACT.md §1) against
// run-capture.json's `init.karenJson` (CONTRACT.md §2).
//
// metrics = {
//   knownGapsCorrect: boolean,   // every expected knownGaps[] item landed in
//                                // actual knownGaps (not in exceptions) AND
//                                // setMetrics f1 over the knownGaps set >= 0.9
//   exceptionsCorrect: boolean,  // every expected exceptions[] item landed in
//                                // actual exceptions (not in knownGaps) AND
//                                // setMetrics f1 over the exceptions set >= 0.9
//   swapsDetected: [
//     { kind: 'knownGap-in-exceptions' | 'exception-in-knownGaps', pattern, expectedKey },
//     ...
//   ],
// }
//
// Item identity: knownGaps[] keyed by `${pattern}::${scope}` (matches
// score-karen-json.js's keyKnownGap). exceptions keyed by `${gate}::${file}`
// (matches score-karen-json.js's keyedExceptions), flattened from the
// `{ [gateId]: [entry, ...] }` shape — `pattern` is excluded from the
// identity key since karen-json-schema.md documents it as "a short, minimal
// matchable token" (an example wording choice, not a fixed literal); two
// correct runs can pick different valid substrings of the same construct.
// Swap detection cross-checks by `pattern` alone, since that's the only
// field shared between a knownGaps entry (pattern/scope) and an exceptions
// entry (pattern/file) — the two structures don't share a `scope`/`file` key.
//
// pass = swapsDetected.length === 0 && knownGapsCorrect && exceptionsCorrect

const fs = require('fs');
const path = require('path');
const { setMetrics } = require('./lib/set-metrics');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function keyKnownGap(item) {
  return `${item?.pattern ?? ''}::${item?.scope ?? ''}`;
}

// exceptions is `{ [gateId]: [{ pattern, file, reason, expires }, ...] }` —
// flatten into a list of { key, pattern } pairs. `key` (identity) excludes
// `pattern` — see note above; `pattern` is kept alongside for swap detection
// only, which cross-checks against knownGaps by pattern, not by this key.
function flattenExceptions(exceptionsObj) {
  if (!exceptionsObj || typeof exceptionsObj !== 'object') return [];
  const out = [];
  for (const [gate, entries] of Object.entries(exceptionsObj)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      out.push({ key: `${gate}::${entry?.file ?? ''}`, pattern: entry?.pattern ?? '' });
    }
  }
  return out;
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: node score-known-gaps.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = readJson(runCaptureFile) ?? {};
  const fixtureName = runCapture.fixture ?? path.basename(fixtureDir);
  const expectedKaren = readJson(path.join(fixtureDir, 'expected-karen.json'));

  const expectedGaps = expectedKaren?.knownGaps ?? [];
  const expectedExceptionsFlat = flattenExceptions(expectedKaren?.exceptions);

  // No ground truth for this scenario in this fixture: vacuous pass.
  if (expectedKaren === null || (expectedGaps.length === 0 && expectedExceptionsFlat.length === 0)) {
    console.log(JSON.stringify({
      dimension: 'known-gaps',
      fixture: fixtureName,
      metrics: { knownGapsCorrect: true, exceptionsCorrect: true, swapsDetected: [] },
      pass: true,
      details: [{ note: 'no knownGaps/exceptions ground truth for this fixture — vacuous pass' }],
    }));
    return;
  }

  const actualKaren = runCapture?.init?.karenJson ?? {};
  const actualGaps = actualKaren?.knownGaps ?? [];
  const actualExceptionsFlat = flattenExceptions(actualKaren?.exceptions);

  const actualGapKeys = new Set(actualGaps.map(keyKnownGap));
  const actualGapPatterns = new Set(actualGaps.map((g) => g?.pattern ?? ''));
  const actualExceptionKeys = new Set(actualExceptionsFlat.map((e) => e.key));
  const actualExceptionPatterns = new Set(actualExceptionsFlat.map((e) => e.pattern));

  const swapsDetected = [];

  // Every expected knownGaps item: should be in actual knownGaps, must not
  // have landed in actual exceptions instead (tracker-backed item wrongly
  // treated as a dated exception).
  for (const gap of expectedGaps) {
    const key = keyKnownGap(gap);
    const pattern = gap?.pattern ?? '';
    const inKnownGaps = actualGapKeys.has(key);
    const inExceptions = actualExceptionPatterns.has(pattern);
    if (!inKnownGaps && inExceptions) {
      swapsDetected.push({ kind: 'knownGap-in-exceptions', pattern, expectedKey: key });
    }
  }

  // Every expected exceptions item: should be in actual exceptions, must not
  // have landed in actual knownGaps instead (dated temporary item wrongly
  // treated as a permanent boundary).
  for (const exc of expectedExceptionsFlat) {
    const inExceptions = actualExceptionKeys.has(exc.key);
    const inKnownGaps = actualGapPatterns.has(exc.pattern);
    if (!inExceptions && inKnownGaps) {
      swapsDetected.push({ kind: 'exception-in-knownGaps', pattern: exc.pattern, expectedKey: exc.key });
    }
  }

  const knownGapsMetrics = setMetrics(expectedGaps.map(keyKnownGap), actualGaps.map(keyKnownGap));
  const exceptionsMetrics = setMetrics(
    expectedExceptionsFlat.map((e) => e.key),
    actualExceptionsFlat.map((e) => e.key),
  );

  const knownGapsSwaps = swapsDetected.filter((s) => s.kind === 'knownGap-in-exceptions').length;
  const exceptionsSwaps = swapsDetected.filter((s) => s.kind === 'exception-in-knownGaps').length;

  const knownGapsCorrect = knownGapsSwaps === 0 && knownGapsMetrics.f1 >= 0.9;
  const exceptionsCorrect = exceptionsSwaps === 0 && exceptionsMetrics.f1 >= 0.9;

  const pass = swapsDetected.length === 0 && knownGapsCorrect && exceptionsCorrect;

  const details = [
    {
      field: 'knownGaps',
      falsePositives: knownGapsMetrics.falsePositives,
      falseNegatives: knownGapsMetrics.falseNegatives,
      f1: knownGapsMetrics.f1,
    },
    {
      field: 'exceptions',
      falsePositives: exceptionsMetrics.falsePositives,
      falseNegatives: exceptionsMetrics.falseNegatives,
      f1: exceptionsMetrics.f1,
    },
  ];
  if (swapsDetected.length > 0) {
    details.push({ note: 'swap(s) detected between knownGaps and exceptions', swapsDetected });
  }

  console.log(JSON.stringify({
    dimension: 'known-gaps',
    fixture: fixtureName,
    metrics: { knownGapsCorrect, exceptionsCorrect, swapsDetected },
    pass,
    details,
  }));
}

main();
