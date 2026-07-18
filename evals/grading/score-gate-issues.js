#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.4 "Generated-gate correctness — planted-issue
// precision/recall" (the OWASP-Benchmark-style methodology), scored against
// BLUEPRINT.md §"The Gate Contract" (raw stdout shape) and §"structural over
// textual" (Principle 5) — decoys exist to catch textual-only implementations.
//
// metrics shape:
//   overall:     { precision, recall, f1, truePositives, falsePositives, falseNegatives }
//                (from lib/set-metrics.js setMetrics; equivalent to a micro-average
//                 across categories since categories partition the issue-id space)
//   perCategory: { <category>: { precision, recall, f1, truePositives, falsePositives, falseNegatives } }
//                one entry per category seen in planted-issues.json (real or decoy-only)
//   decoyFalsePositives: [{ file, line, category, gate }]   — emitted lines matching a decoy
//   unmatchedFindings:   [{ file, line, gate, message }]    — emitted lines matching no planted issue
//
// pass = zero decoyFalsePositives AND overall.recall (on non-decoy issues) >= 0.9.
// Both thresholds are this dimension's central correctness bar per EVALS-PLAN.md §4.4:
// any decoy hit is a hard fail (proves the gate is textual, not structural), while
// missing up to 10% of real planted issues is tolerated as "recall, not perfection."

const fs = require('fs');
const path = require('path');
const { parseGateOutput, issueId } = require('./lib/parse-gate-output');
const { setMetrics } = require('./lib/set-metrics');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const [fixtureDir, runCaptureFile] = process.argv.slice(2);
  if (!fixtureDir || !runCaptureFile) {
    throw new Error('usage: node score-gate-issues.js <fixtureDir> <runCaptureFile>');
  }

  const fixture = path.basename(path.resolve(fixtureDir));
  const plantedIssues = readJson(path.join(fixtureDir, 'planted-issues.json'));
  const expectedGates = readJson(path.join(fixtureDir, 'expected-gates.json')) || [];
  const coversCategoriesByGate = new Map(expectedGates.map((g) => [g.id, new Set(g.coversCategories || [])]));

  // No compliance/planted-issues ground truth for this fixture: vacuously pass.
  if (plantedIssues === null) {
    console.log(
      JSON.stringify({
        dimension: 'gate-issues',
        fixture,
        metrics: {
          overall: { precision: 1, recall: 1, f1: 1, truePositives: [], falsePositives: [], falseNegatives: [] },
          perCategory: {},
          decoyFalsePositives: [],
          unmatchedFindings: [],
        },
        pass: true,
        details: [{ note: 'no planted-issues.json for this fixture; dimension vacuously passes' }],
      }),
    );
    return;
  }

  const runCapture = readJson(runCaptureFile) || {};
  const auditRuns = Array.isArray(runCapture.auditRuns) ? runCapture.auditRuns : [];
  const initialRun = auditRuns.find((r) => r && r.trigger === 'initial') || auditRuns[0] || {};
  const gateResults = initialRun.gateResults || {};

  // Index planted issues by "file:line" to recover category for an emitted line.
  // (Same file:line normally maps to exactly one planted issue; if several are
  // declared at the same location, prefer a non-decoy match — a gate correctly
  // flagging the real issue at that line should not be penalized by a decoy
  // sharing the same location.)
  const plantedByFileLine = new Map();
  for (const issue of plantedIssues) {
    const key = `${issue.file}:${issue.line}`;
    if (!plantedByFileLine.has(key)) plantedByFileLine.set(key, []);
    plantedByFileLine.get(key).push(issue);
  }

  const expectedIds = plantedIssues.filter((i) => !i.isDecoy).map((i) => issueId(i.file, i.line, i.category));

  const categories = new Set(plantedIssues.map((i) => i.category));
  const actualIds = new Set();
  const decoyFalsePositives = [];
  const unmatchedFindings = [];
  let unmatchedCounter = 0;

  for (const [gateId, result] of Object.entries(gateResults)) {
    const stdout = result && typeof result.stdout === 'string' ? result.stdout : '';
    const { issues } = parseGateOutput(stdout);

    const coversCategories = coversCategoriesByGate.get(gateId);

    for (const emitted of issues) {
      const key = `${emitted.file}:${emitted.line}`;
      const allMatchesAtLine = plantedByFileLine.get(key) || [];
      // Scope matches to categories this gate actually covers (per expected-gates.json)
      // so a different gate's unrelated finding at the same file:line (e.g. a lint
      // warning landing on a shell-injection decoy's line) isn't misattributed to
      // that category's precision/recall.
      const matches = coversCategories
        ? allMatchesAtLine.filter((m) => coversCategories.has(m.category))
        : allMatchesAtLine;

      if (matches.length === 0) {
        unmatchedFindings.push({ file: emitted.file, line: emitted.line, gate: gateId, message: emitted.message });
        // Count as an unattributed FP overall without polluting any real category.
        unmatchedCounter += 1;
        actualIds.add(`__unmatched__:${gateId}:${key}:${unmatchedCounter}`);
        continue;
      }

      const match = matches.find((m) => !m.isDecoy) || matches[0];
      const id = issueId(emitted.file, emitted.line, match.category);
      actualIds.add(id);

      if (match.isDecoy) {
        decoyFalsePositives.push({ file: emitted.file, line: emitted.line, category: match.category, gate: gateId });
      }
    }
  }

  const overall = setMetrics(expectedIds, [...actualIds]);

  const perCategory = {};
  for (const category of categories) {
    const expectedForCategory = plantedIssues
      .filter((i) => !i.isDecoy && i.category === category)
      .map((i) => issueId(i.file, i.line, i.category));
    const actualForCategory = [...actualIds].filter((id) => id.endsWith(`:${category}`) && !id.startsWith('__unmatched__:'));
    perCategory[category] = setMetrics(expectedForCategory, actualForCategory);
  }

  const pass = decoyFalsePositives.length === 0 && overall.recall >= 0.9;

  const details = [];
  for (const [category, metrics] of Object.entries(perCategory)) {
    if (metrics.falseNegatives.length > 0 || metrics.falsePositives.length > 0) {
      details.push({ category, falseNegatives: metrics.falseNegatives, falsePositives: metrics.falsePositives });
    }
  }
  if (decoyFalsePositives.length > 0) {
    details.push({ field: 'decoyFalsePositives', items: decoyFalsePositives });
  }
  if (unmatchedFindings.length > 0) {
    details.push({ field: 'unmatchedFindings', items: unmatchedFindings });
  }

  console.log(
    JSON.stringify({
      dimension: 'gate-issues',
      fixture,
      metrics: { overall, perCategory, decoyFalsePositives, unmatchedFindings },
      pass,
      details,
    }),
  );
}

main();
