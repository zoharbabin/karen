'use strict';

// Parses raw gate stdout per BLUEPRINT.md "The Gate Contract":
//   one issue line per: "file:line\tmessage" (line may be omitted)
//   final summary: "PASS (0 issues)" or "FAIL (N issues)"
//   optional trailing line: "ZERO-TOLERANCE"
function parseGateOutput(stdout) {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  const issues = [];
  let summary = null;
  let zeroTolerance = false;

  for (const line of lines) {
    const summaryMatch = line.match(/^(PASS|FAIL) \((\d+) issues?\)$/);
    if (summaryMatch) {
      summary = { status: summaryMatch[1], count: Number(summaryMatch[2]) };
      continue;
    }
    if (line.trim() === 'ZERO-TOLERANCE') {
      zeroTolerance = true;
      continue;
    }
    const issueMatch = line.match(/^([^\t]+?):(\d+)\t(.+)$/) || line.match(/^([^:]+):(\d+)\s{2,}(.+)$/);
    if (issueMatch) {
      issues.push({ file: issueMatch[1], line: Number(issueMatch[2]), message: issueMatch[3] });
      continue;
    }
    const noLineMatch = line.match(/^([^\t]+?)\t(.+)$/);
    if (noLineMatch && !summaryMatch) {
      issues.push({ file: noLineMatch[1], line: null, message: noLineMatch[2] });
    }
  }

  return { issues, summary, zeroTolerance };
}

// Issue identity string used across fixtures/graders: "<file>:<line>:<category>"
function issueId(file, line, category) {
  return `${file}:${line}:${category}`;
}

module.exports = { parseGateOutput, issueId };
