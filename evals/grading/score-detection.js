#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.1 (Detection accuracy), scored against
// BLUEPRINT.md's `detect_project(path)` output shape (see "The `detect_project`
// tool returns" and "Poly-repo & Monorepo Structure" / "Unclaimed Paths").
// Compares run-capture.json's init.detectProjectOutput against the fixture's
// fixture-manifest.json (CONTRACT.md §1) as five independent set-detection
// tasks: languages, manifests (compared by .path only), frameworks,
// subprojects (compared by .path only), unclaimedPaths.
//
// metrics = {
//   precision, recall, f1        // overall micro-average across all 5 fields (CONTRACT.md §3 top-level shape)
//   perField: {
//     <field>: { precision, recall, f1, truePositives, falsePositives, falseNegatives }
//   }
// }
// pass = overall micro-averaged f1 >= 0.9 — a single field mismatch (e.g. one
// missed framework in a fixture with ~10 total detected identities) should
// not fail the whole dimension, but two or more misses, or any miss on a
// small-field fixture, should. 0.9 is the threshold Karen's blueprint implies
// by treating "treating a multi-package repo as single-package" as a real
// coverage gap (BLUEPRINT.md §"Poly-repo & Monorepo Structure") rather than a
// rounding error — i.e. detection has to be very close to exact, not merely
// "mostly right".

const fs = require('fs');
const path = require('path');
const { setMetrics, microAverage } = require('./lib/set-metrics');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Normalizes a field value into an array of stringifiable identities.
// - Plain arrays of strings (languages, frameworks, unclaimedPaths) pass through.
// - Arrays of objects (manifests, subprojects) are reduced to their `.path`.
// - Missing/undefined fields are treated as an empty set.
function toIdentitySet(value, pathKey) {
  if (!Array.isArray(value)) return [];
  if (!pathKey) return value;
  return value.map((entry) => (entry && typeof entry === 'object' ? entry.path : entry)).filter((p) => p !== undefined && p !== null);
}

const FIELDS = [
  { name: 'languages', pathKey: null },
  { name: 'manifests', pathKey: 'path' },
  { name: 'frameworks', pathKey: null },
  { name: 'subprojects', pathKey: 'path' },
  { name: 'unclaimedPaths', pathKey: null },
];

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: score-detection.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
  const fixture = runCapture.fixture || path.basename(fixtureDir);

  const manifest = readJsonIfExists(path.join(fixtureDir, 'fixture-manifest.json'));

  // No ground-truth manifest shipped for this fixture — vacuously pass
  // rather than crash (per grading contract's "no compliance regime" style
  // exemption, generalized to "no ground truth file at all").
  if (manifest === null) {
    const vacuous = { precision: 1, recall: 1, f1: 1, truePositives: [], falsePositives: [], falseNegatives: [] };
    process.stdout.write(
      `${JSON.stringify({
        dimension: 'detection',
        fixture,
        metrics: { precision: 1, recall: 1, f1: 1, perField: {} },
        pass: true,
        details: [{ field: '*', issue: 'no fixture-manifest.json found — vacuous pass' }],
      })}\n`
    );
    return;
  }

  const detected = (runCapture.init && runCapture.init.detectProjectOutput) || {};

  const perField = {};
  const perFieldCounts = [];
  const details = [];

  for (const { name, pathKey } of FIELDS) {
    const expected = toIdentitySet(manifest[name], pathKey);
    const actual = toIdentitySet(detected[name], pathKey);
    const result = setMetrics(expected, actual);
    perField[name] = result;
    perFieldCounts.push(result);
    if (result.falseNegatives.length > 0 || result.falsePositives.length > 0) {
      details.push({
        field: name,
        falseNegatives: result.falseNegatives,
        falsePositives: result.falsePositives,
      });
    }
  }

  const overall = microAverage(perFieldCounts);

  const result = {
    dimension: 'detection',
    fixture,
    metrics: {
      precision: overall.precision,
      recall: overall.recall,
      f1: overall.f1,
      perField,
    },
    pass: overall.f1 >= 0.9,
    details,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
