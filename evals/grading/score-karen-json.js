#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.3 (".karen.json" field accuracy) against the
// shape defined in BLUEPRINT.md's "Configuration: .karen.json" section.
// Compares run-capture.json's `init.karenJson` (CONTRACT.md §2) against the
// fixture's `expected-karen.json` (CONTRACT.md §1).
//
// metrics = {
//   scalarMatchRate: number,            // fraction of scalar/set-scalar fields that exact-match
//   arrayFieldMetrics: {                // setMetrics() output (precision/recall/f1/TP/FP/FN) per field
//     subprojects:     { precision, recall, f1, truePositives, falsePositives, falseNegatives },
//     knownGaps:       { ... same shape ... },
//     exceedsBaseline: { ... same shape ... },
//     exceptions:      { ... same shape ... },
//   }
// }
//
// Scalar / set-scalar fields compared for exact match (order-insensitive
// for the set-valued ones): project.type, project.language, project.deployment,
// project.audience, project.aiPowered, compliance, coverage.threshold,
// personalDataRegistry.path, personalDataRegistry.stores.
//
// `compliance[]` entries (BLUEPRINT.md "Tiered, Feature-Gated Compliance")
// are either a plain string ("soc2") or a gated object
// ({ standard, activatesWhen, note }) — normalizeCompliance() reduces both
// shapes to a stable "standard::activatesWhen" string before the existing
// set-equality check runs, so gated and unconditional entries compare the
// same way without a separate code path.
//
// Per-item stable keys used to diff array/set fields via setMetrics():
//   project.subprojects[]      -> item.path
//   knownGaps[]                -> `${pattern}::${scope}`
//   exceedsBaseline[]          -> item.gate
//   crossSubprojectConsistency[] -> item.pattern
//   exceptions                 -> object keyed by gate id -> array of entries;
//                                  flattened first, then keyed by
//                                  `${gate}::${pattern}::${file}`
//
// pass = scalarMatchRate === 1 && every arrayFieldMetrics[*].f1 >= 0.9

const fs = require('fs');
const path = require('path');
const { setMetrics } = require('./lib/set-metrics');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Stringifies a scalar-or-array field's items, one string per item.
function toStringArray(value) {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(String);
}

// Reduces a compliance[] entry (plain string "soc2", or a gated object
// { standard, activatesWhen, note } per BLUEPRINT.md "Tiered, Feature-Gated
// Compliance") to a stable comparison string. A plain string has no
// activatesWhen, so it normalizes to "soc2::" — distinct from a gated
// "soc2::feature:analytics-tier" entry for the same standard.
function toComplianceStringArray(value) {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((entry) => {
    if (typeof entry === 'string') return `${entry}::`;
    if (entry && typeof entry === 'object') return `${entry.standard ?? ''}::${entry.activatesWhen ?? ''}`;
    return String(entry ?? '');
  });
}

// Order-insensitive, dedup'd set equality over `stringify(value)`.
function setsEqual(a, b, stringify = toStringArray) {
  const sa = [...new Set(stringify(a))].sort();
  const sb = [...new Set(stringify(b))].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

function scalarEqual(a, b) {
  const na = a === undefined ? null : a;
  const nb = b === undefined ? null : b;
  return na === nb;
}

const SCALAR_FIELDS = [
  { field: 'project.type', get: (k) => k?.project?.type, kind: 'scalar' },
  { field: 'project.language', get: (k) => k?.project?.language, kind: 'set' },
  { field: 'project.deployment', get: (k) => k?.project?.deployment, kind: 'set' },
  { field: 'project.audience', get: (k) => k?.project?.audience, kind: 'scalar' },
  { field: 'project.aiPowered', get: (k) => k?.project?.aiPowered, kind: 'scalar' },
  { field: 'compliance', get: (k) => k?.compliance, kind: 'set', stringify: toComplianceStringArray },
  { field: 'coverage.threshold', get: (k) => k?.coverage?.threshold, kind: 'scalar' },
  { field: 'personalDataRegistry.path', get: (k) => k?.personalDataRegistry?.path ?? null, kind: 'scalar' },
  { field: 'personalDataRegistry.stores', get: (k) => k?.personalDataRegistry?.stores, kind: 'set' },
];

function keySubproject(item) {
  return String(item?.path ?? '');
}

function keyKnownGap(item) {
  return `${item?.pattern ?? ''}::${item?.scope ?? ''}`;
}

function keyExceedsBaseline(item) {
  return String(item?.gate ?? '');
}

function keyCrossSubprojectConsistency(item) {
  return String(item?.pattern ?? '');
}

// exceptions is `{ [gateId]: [{ pattern, file, reason, expires }, ...] }` —
// flatten into a list of stable `gate::pattern::file` keys.
function keyedExceptions(exceptionsObj) {
  if (!exceptionsObj || typeof exceptionsObj !== 'object') return [];
  const keys = [];
  for (const [gate, entries] of Object.entries(exceptionsObj)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      keys.push(`${gate}::${entry?.pattern ?? ''}::${entry?.file ?? ''}`);
    }
  }
  return keys;
}

function vacuousArrayMetrics() {
  return { precision: 1, recall: 1, f1: 1, truePositives: [], falsePositives: [], falseNegatives: [] };
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: node score-karen-json.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = readJson(runCaptureFile) ?? {};
  const fixtureName = runCapture.fixture ?? path.basename(fixtureDir);
  const expectedKaren = readJson(path.join(fixtureDir, 'expected-karen.json'));

  // No ground truth for this dimension in this fixture: vacuous pass.
  if (expectedKaren === null) {
    const arrayFieldMetrics = {
      subprojects: vacuousArrayMetrics(),
      knownGaps: vacuousArrayMetrics(),
      exceedsBaseline: vacuousArrayMetrics(),
      crossSubprojectConsistency: vacuousArrayMetrics(),
      exceptions: vacuousArrayMetrics(),
    };
    console.log(JSON.stringify({
      dimension: 'karen-json',
      fixture: fixtureName,
      metrics: { scalarMatchRate: 1, arrayFieldMetrics },
      pass: true,
      details: [{ note: 'no expected-karen.json for this fixture — vacuous pass' }],
    }));
    return;
  }

  const actualKaren = runCapture?.init?.karenJson ?? {};

  const details = [];
  let matchCount = 0;
  for (const { field, get, kind, stringify } of SCALAR_FIELDS) {
    const expected = get(expectedKaren);
    const actual = get(actualKaren);
    const match = kind === 'set' ? setsEqual(expected, actual, stringify) : scalarEqual(expected, actual);
    if (match) matchCount += 1;
    details.push({ field, expected, actual, match });
  }
  const scalarMatchRate = matchCount / SCALAR_FIELDS.length;

  function arrayFieldDetail(field, expectedItems, actualItems, keyFn) {
    const expectedKeys = (expectedItems ?? []).map(keyFn);
    const actualKeys = (actualItems ?? []).map(keyFn);
    const metrics = setMetrics(expectedKeys, actualKeys);
    details.push({ field, falsePositives: metrics.falsePositives, falseNegatives: metrics.falseNegatives });
    return metrics;
  }

  const arrayFieldMetrics = {
    subprojects: arrayFieldDetail(
      'project.subprojects',
      expectedKaren?.project?.subprojects,
      actualKaren?.project?.subprojects,
      keySubproject,
    ),
    knownGaps: arrayFieldDetail('knownGaps', expectedKaren?.knownGaps, actualKaren?.knownGaps, keyKnownGap),
    exceedsBaseline: arrayFieldDetail(
      'exceedsBaseline',
      expectedKaren?.exceedsBaseline,
      actualKaren?.exceedsBaseline,
      keyExceedsBaseline,
    ),
    crossSubprojectConsistency: arrayFieldDetail(
      'crossSubprojectConsistency',
      expectedKaren?.crossSubprojectConsistency,
      actualKaren?.crossSubprojectConsistency,
      keyCrossSubprojectConsistency,
    ),
    exceptions: (() => {
      const expectedKeys = keyedExceptions(expectedKaren?.exceptions);
      const actualKeys = keyedExceptions(actualKaren?.exceptions);
      const metrics = setMetrics(expectedKeys, actualKeys);
      details.push({ field: 'exceptions', falsePositives: metrics.falsePositives, falseNegatives: metrics.falseNegatives });
      return metrics;
    })(),
  };

  const pass = scalarMatchRate === 1 && Object.values(arrayFieldMetrics).every((m) => m.f1 >= 0.9);

  console.log(JSON.stringify({
    dimension: 'karen-json',
    fixture: fixtureName,
    metrics: { scalarMatchRate, arrayFieldMetrics },
    pass,
    details,
  }));
}

main();
