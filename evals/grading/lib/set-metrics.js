'use strict';

// Precision/recall/F1 for a set-detection task, per scikit-learn's
// precision_recall_fscore_support conventions: P = TP/(TP+FP), R = TP/(TP+FN).
// `actual` and `expected` are arrays of stringifiable identities (already
// normalized by the caller — e.g. lowercased, or issue-id strings).
function setMetrics(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  const truePositives = [...actualSet].filter((x) => expectedSet.has(x));
  const falsePositives = [...actualSet].filter((x) => !expectedSet.has(x));
  const falseNegatives = [...expectedSet].filter((x) => !actualSet.has(x));

  const tp = truePositives.length;
  const fp = falsePositives.length;
  const fn = falseNegatives.length;

  const precision = tp + fp === 0 ? (fn === 0 ? 1 : 0) : tp / (tp + fp);
  const recall = tp + fn === 0 ? (fp === 0 ? 1 : 0) : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    precision,
    recall,
    f1,
    truePositives,
    falsePositives,
    falseNegatives,
  };
}

// Micro-average precision/recall/f1 across multiple fixtures' TP/FP/FN counts
// (dominant convention for NER-style set detection per CoNLL-2003 / SeqScore).
function microAverage(perFixtureCounts) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const c of perFixtureCounts) {
    tp += c.truePositives.length;
    fp += c.falsePositives.length;
    fn += c.falseNegatives.length;
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, tp, fp, fn };
}

module.exports = { setMetrics, microAverage };
