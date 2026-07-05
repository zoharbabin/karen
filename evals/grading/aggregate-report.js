#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §7 (Statistical Methodology) and CONTRACT.md §3's
// closing paragraph: rolls up N score-JSON files (one per score-*.js run,
// each shaped { dimension, fixture, metrics, pass, details } per CONTRACT.md
// §3) into a combined report, grouped by fixture then dimension. When a
// (fixture, dimension) pair has k>1 runs (repeated runs per EVALS-PLAN.md
// §7's k=3/5/10 schedule), reports mean ± population standard deviation of
// every numeric leaf found anywhere under "metrics" (recursing into plain
// objects, skipping arrays and non-numeric leaves — every per-dimension
// script defines its own metrics shape, so this stays shape-agnostic), plus
// pass@1 (fraction of runs that passed — probability of >=1 success in a
// single trial, degenerate at k=1) and pass^k (true only if every run in the
// group passed — EVALS-PLAN.md §7's safety-critical bar). This script never
// redefines a dimension's own pass/fail threshold; it only aggregates the
// booleans each score-*.js already computed.
//
// Aggregated (JSON mode, --json) shape:
// {
//   fixtures: {
//     "<fixture>": {
//       dimensions: {
//         "<dimension>": {
//           runs, passAtOne, passPowK,
//           metrics: { "<dot.path>": { mean, sd, n } }
//         }
//       }
//     }
//   },
//   overall: { totalRuns, totalGroups, passAtOneRate, passPowKRate }
// }
// (Text mode is the default; --json switches to printing this object.)

const fs = require('fs');
const path = require('path');

function usageError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write('Usage: node aggregate-report.js [--json] <scoreJsonFile1> [scoreJsonFile2 ...]\n');
  process.exit(1);
}

function parseArgs(argv) {
  let json = false;
  const files = [];
  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
    } else {
      files.push(arg);
    }
  }
  return { json, files };
}

// Reads and parses one score-*.js output file. Returns null (with a stderr
// warning) rather than throwing on a missing/unparseable file or one missing
// the CONTRACT.md §3 minimum fields — a malformed input file is a data
// problem to flag, not a reason to abort the whole aggregation.
function loadScoreFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    process.stderr.write(`aggregate-report: skipping "${filePath}": ${err.message}\n`);
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`aggregate-report: skipping "${filePath}": invalid JSON (${err.message})\n`);
    return null;
  }
  if (!data || typeof data !== 'object' || !data.dimension || !data.fixture) {
    process.stderr.write(`aggregate-report: skipping "${filePath}": missing required "dimension"/"fixture" fields\n`);
    return null;
  }
  return data;
}

// Recursively flattens every numeric leaf under `obj` into dot-path keys.
// Arrays are skipped entirely (score-*.js metrics only ever put id lists —
// falsePositives/falseNegatives/etc. — in arrays, never aggregatable
// numbers), as are non-numeric scalars (booleans, strings, null).
function flattenNumeric(obj, prefix) {
  const result = {};
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return result;
  for (const [key, value] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[keyPath] = value;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenNumeric(value, keyPath));
    }
  }
  return result;
}

// Population mean/SD (divide by n, not n-1) — chosen so a k=1 group still
// yields a well-defined SD of 0 instead of a division-by-zero/NaN, which
// matters because EVALS-PLAN.md §7 explicitly allows k=1 for deterministic
// dimensions before Karen exists.
function computeStats(values) {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return { mean, sd: Math.sqrt(variance), n };
}

// Groups score entries by fixture, then by dimension, preserving first-seen
// order (deterministic, input-order report rather than an alphabetical
// resort that would obscure the order files were passed in).
function groupByFixtureThenDimension(entries) {
  const fixtures = new Map();
  for (const entry of entries) {
    if (!fixtures.has(entry.fixture)) fixtures.set(entry.fixture, new Map());
    const dimensions = fixtures.get(entry.fixture);
    if (!dimensions.has(entry.dimension)) dimensions.set(entry.dimension, []);
    dimensions.get(entry.dimension).push(entry);
  }
  return fixtures;
}

// Aggregates one (fixture, dimension) group of runs into
// { runs, passAtOne, passPowK, metrics: { path: { mean, sd, n } } }.
function aggregateGroup(runs) {
  const passCount = runs.filter((r) => r.pass === true).length;
  const passAtOne = passCount / runs.length;
  const passPowK = runs.every((r) => r.pass === true);

  const flattenedPerRun = runs.map((r) => flattenNumeric(r.metrics, ''));
  const allPaths = new Set();
  for (const flat of flattenedPerRun) {
    for (const key of Object.keys(flat)) allPaths.add(key);
  }

  const metrics = {};
  for (const metricPath of allPaths) {
    const values = flattenedPerRun
      .map((flat) => flat[metricPath])
      .filter((v) => typeof v === 'number');
    if (values.length === 0) continue;
    metrics[metricPath] = computeStats(values);
  }

  return { runs: runs.length, passAtOne, passPowK, metrics };
}

function buildAggregate(entries) {
  const fixtureGroups = groupByFixtureThenDimension(entries);
  const fixtures = {};
  let totalRuns = 0;
  let totalGroups = 0;
  let totalPassed = 0;
  let groupsAllPassed = 0;

  for (const [fixtureName, dimensions] of fixtureGroups) {
    fixtures[fixtureName] = { dimensions: {} };
    for (const [dimensionName, runs] of dimensions) {
      const aggregated = aggregateGroup(runs);
      fixtures[fixtureName].dimensions[dimensionName] = aggregated;
      totalRuns += aggregated.runs;
      totalGroups += 1;
      totalPassed += runs.filter((r) => r.pass === true).length;
      if (aggregated.passPowK) groupsAllPassed += 1;
    }
  }

  const overall = {
    totalRuns,
    totalGroups,
    // Pooled pass@1 rate across every individual run (weighted by run
    // count) — the plain fraction of all runs, across every
    // fixture/dimension, that passed.
    passAtOneRate: totalRuns === 0 ? 1 : totalPassed / totalRuns,
    // pass^k is inherently per-group (it means "all k runs in this one
    // group succeeded"), so its overall rollup is the fraction of groups
    // that were entirely clean, not a pooled per-run fraction.
    passPowKRate: totalGroups === 0 ? 1 : groupsAllPassed / totalGroups,
  };

  return { fixtures, overall };
}

function pct(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function formatMetricValue({ mean, sd, n }) {
  return n > 1 ? `${mean.toFixed(3)}±${sd.toFixed(3)}` : `${mean.toFixed(3)}`;
}

function formatText(aggregate) {
  const lines = [];
  const fixtureNames = Object.keys(aggregate.fixtures);
  for (const fixtureName of fixtureNames) {
    lines.push(`Fixture: ${fixtureName}`);
    const dimensions = aggregate.fixtures[fixtureName].dimensions;
    for (const [dimensionName, agg] of Object.entries(dimensions)) {
      const metricParts = Object.entries(agg.metrics)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([metricPath, stats]) => `${metricPath}=${formatMetricValue(stats)}`);
      const header = `  ${dimensionName}  runs=${agg.runs}  pass@1=${pct(agg.passAtOne)}  pass^${agg.runs}=${agg.passPowK}`;
      lines.push(metricParts.length > 0 ? `${header}  ${metricParts.join(' ')}` : header);
    }
    lines.push('');
  }
  lines.push(
    `Overall: ${aggregate.overall.totalRuns} run(s) across ${fixtureNames.length} fixture(s), ` +
      `${aggregate.overall.totalGroups} fixture/dimension group(s) — ` +
      `pass@1=${pct(aggregate.overall.passAtOneRate)}, pass^k=${pct(aggregate.overall.passPowKRate)}`,
  );
  return lines.join('\n');
}

function main() {
  const { json, files } = parseArgs(process.argv.slice(2));
  if (files.length === 0) {
    usageError('No score-JSON files provided.');
  }

  const entries = files
    .map((filePath) => loadScoreFile(path.resolve(filePath)))
    .filter((entry) => entry !== null);

  if (entries.length === 0) {
    usageError('No valid score-JSON files could be read.');
  }

  const aggregate = buildAggregate(entries);

  if (json) {
    process.stdout.write(`${JSON.stringify(aggregate)}\n`);
  } else {
    process.stdout.write(`${formatText(aggregate)}\n`);
  }
}

main();
