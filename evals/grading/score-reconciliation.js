#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.9 (Reconciliation correctness, fixture 4 —
// node-monorepo — only), scored against BLUEPRINT.md's "Reconciling
// Existing Quality Tooling" section: existingGates[].coverage[] is
// many-to-many (existing script -> gate id -> scope full/partial), and a
// generated gate's scope must never duplicate a gate ground truth marks
// "full" for an existing script.
// metrics = { coverageMatch: {precision, recall, f1, truePositives,
//   falsePositives, falseNegatives}, noCompetingGates: bool,
//   competingGatesFound: [gateId, ...] }
// coverageMatch identities are strings "<existingGateId>:<gate>:<scope>"
// built from existingGates[].coverage[] entries (both ground truth and
// run-capture), diffed via the shared set-metrics helper.
// pass = coverageMatch has zero false positives/negatives AND
//   noCompetingGates is true.
// Vacuous pass (no metrics key) when fixture-manifest.json has no
// existingGates entries at all.

const fs = require('fs');
const path = require('path');
const { setMetrics } = require('./lib/set-metrics');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Flattens existingGates[].coverage[] into identity strings
// "<existingGateId>:<gate>:<scope>" for set comparison.
function collectCoverageIdentities(existingGates) {
  const identities = [];
  for (const entry of existingGates) {
    const id = entry && entry.id;
    const coverage = (entry && entry.coverage) || [];
    for (const cov of coverage) {
      identities.push(`${id}:${cov.gate}:${cov.scope}`);
    }
  }
  return identities;
}

// Gate ids ground truth marks as fully covered by an existing script — a
// generated gate script for one of these ids would be a redundant,
// potentially-disagreeing competitor per BLUEPRINT.md.
function collectFullScopeGateIds(existingGates) {
  const gateIds = new Set();
  for (const entry of existingGates) {
    const coverage = (entry && entry.coverage) || [];
    for (const cov of coverage) {
      if (cov.scope === 'full') gateIds.add(cov.gate);
    }
  }
  return gateIds;
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    process.stderr.write('usage: score-reconciliation.js <fixtureDir> <runCaptureFile>\n');
    process.exit(1);
  }

  const runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
  const fixture = runCapture.fixture || path.basename(fixtureDir);

  const manifest = readJsonIfExists(path.join(fixtureDir, 'fixture-manifest.json')) || {};
  const groundTruthExistingGates = manifest.existingGates || [];

  if (groundTruthExistingGates.length === 0) {
    const result = {
      dimension: 'reconciliation',
      fixture,
      pass: true,
      details: ['not applicable -- fixture has no existing tooling to reconcile'],
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const init = runCapture.init || {};
  const actualExistingGates = (init.karenJson && init.karenJson.existingGates) || [];
  const gateScripts = init.gateScripts || {};

  const expectedIdentities = collectCoverageIdentities(groundTruthExistingGates);
  const actualIdentities = collectCoverageIdentities(actualExistingGates);
  const coverageMatch = setMetrics(expectedIdentities, actualIdentities);

  const fullScopeGateIds = collectFullScopeGateIds(groundTruthExistingGates);
  const competingGatesFound = [...fullScopeGateIds].filter((gateId) =>
    Object.prototype.hasOwnProperty.call(gateScripts, gateId)
  );
  const noCompetingGates = competingGatesFound.length === 0;

  const coverageMatches = coverageMatch.falsePositives.length === 0 && coverageMatch.falseNegatives.length === 0;

  const details = [];
  if (!coverageMatches) {
    details.push({
      field: 'coverage',
      falsePositives: coverageMatch.falsePositives,
      falseNegatives: coverageMatch.falseNegatives,
    });
  }
  for (const gateId of competingGatesFound) {
    details.push({
      field: 'competingGates',
      gate: gateId,
      issue: `ground truth marks "${gateId}" as fully covered by existing tooling, but init.gateScripts still generated a competing script for it`,
    });
  }

  const result = {
    dimension: 'reconciliation',
    fixture,
    metrics: { coverageMatch, noCompetingGates, competingGatesFound },
    pass: coverageMatches && noCompetingGates,
    details,
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
