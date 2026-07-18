#!/usr/bin/env node
'use strict';

// Implements EVALS-PLAN.md §4.2 "Interview quality" — the two DETERMINISTIC
// sub-parts only (precision on "shouldn't have asked" / recall on "should
// have asked unprompted"). The third sub-part (follow-up quality) is an
// LLM-judge task covered by judge-interview-followup.md, not this script.
// Ground truth: answer-key.md's `## Must ask unprompted` / `## Must NOT ask`
// sections (CONTRACT.md §1). metrics keys: mustNotAskPrecision, mustAskRecall,
// violations (topics wrongly asked), misses (topics never asked).

const fs = require('fs');
const path = require('path');

function usageError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write('Usage: node score-interview.js <fixtureDir> <runCaptureFile>\n');
  process.exit(1);
}

const [, , fixtureDir, runCaptureFile] = process.argv;
if (!fixtureDir || !runCaptureFile) {
  usageError('Missing required arguments.');
}

const fixtureName = path.basename(path.resolve(fixtureDir));

// Splits answer-key.md into sections keyed by their `## ` header line, per
// CONTRACT.md §1's exact-header parsing rule. Header matching is
// case-insensitive and tolerant of the trailing parenthetical description
// that follows the canonical header text in every fixture example.
function parseSections(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.*)$/);
    if (headerMatch) {
      current = { header: headerMatch[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

// Extracts each `- ` bullet's topic string from a section, stripping the
// trailing parenthetical justification (e.g. "(source has `getUserMedia`
// calls)") since that explanatory text is authoring rationale, not part of
// the topic a real question would echo.
function extractTopics(section) {
  const topics = [];
  for (const line of section.lines) {
    const bulletMatch = line.match(/^\s*-\s+(.+)$/);
    if (!bulletMatch) continue;
    const raw = bulletMatch[1].trim();
    const topic = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    topics.push(topic.length > 0 ? topic : raw);
  }
  return topics;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'is', 'are', 'and', 'or', 'in', 'on', 'for', 'to',
  'with', 'from', 'already', 'source', 'has', 'output', 'calls', 'present',
  'signal', 'can', 'cant', 'classify', 'intent', 'answerable', 'detect',
  'project', 'this', 'that', 'be', 'was', 'were', 'it', 'its', 'as', 'via',
]);

function keywordsOf(topic) {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

// Overloaded words that show up across multiple, semantically unrelated
// ground-truth topics in this benchmark's answer keys (e.g. "coverage"
// meaning "test coverage threshold" in one fixture and "vendored-file
// provenance coverage" in another; "reachable"/"mcp" appearing once in an
// unrelated scene-setting sentence). A single hit on one of these is not
// enough evidence a topic was actually covered — require it alongside at
// least one other, more specific keyword from the same topic.
const OVERLOADED_KEYWORDS = new Set(['reachable', 'mcp', 'runtime']);

// Deterministic keyword/topic match: a karen-role message "matches" a topic
// if it contains the full topic phrase as a case-insensitive substring, or
// (fallback, since real questions rarely echo a ground-truth phrase
// verbatim) contains one of the topic's significant keywords as a whole
// word. Used for mustAskRecall, where a generous match is the safer failure
// direction — a missed match wrongly penalizes a question Karen actually
// asked.
//
// Matched within a single sentence, not the whole message, mirroring
// findViolatingMessage below — a message that states one already-known fact
// and then asks an unrelated question in the next sentence must not let a
// keyword from one sentence combine with a keyword from the other sentence
// into a false match. A keyword on the overloaded list above only counts if
// a second, non-overloaded keyword from the same topic also appears in the
// same sentence — closing the specific false-miss/false-match failure modes
// those words caused without weakening every other, more specific keyword's
// single-hit match.
function findMatchingMessage(topic, karenMessages) {
  const topicLower = topic.toLowerCase();
  const keywords = keywordsOf(topic);
  for (const message of karenMessages) {
    for (const sentence of splitSentences(message)) {
      const sentenceLower = sentence.toLowerCase();
      if (topicLower.length > 0 && sentenceLower.includes(topicLower)) {
        return message;
      }
      const hits = keywords.filter((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(sentence));
      const hasSpecificHit = hits.some((keyword) => !OVERLOADED_KEYWORDS.has(keyword));
      if (hasSpecificHit || hits.length >= 2) {
        return message;
      }
    }
  }
  return null;
}

// Stricter match for mustNotAsk violations, where a false accusation is the
// costly failure direction. A single shared overloaded word (e.g. "runtime"
// meaning "at runtime" in an LLM question vs. "runtime dependencies" in a
// package.json question; "coverage" meaning the coverage bar vs. the
// coverage tool) produces a false-positive violation under any-keyword
// matching. Requiring every significant keyword to appear means a genuine
// re-ask of an already-known fact — which naturally echoes most of that
// fact's own words — still matches, while an incidental one-word collision
// does not.
//
// Matched within a single sentence, not the whole message. A karen turn
// routinely states an already-known fact ("...with zero runtime
// dependencies.") and then asks a separate, legitimate question in the next
// sentence of the same turn ("...and whether there's any compliance
// requirement?"). Whole-message matching lets "whether" from the unrelated
// question combine with "runtime"/"dependencies" from the fact statement
// into a false violation; splitting on sentence boundaries keeps each
// keyword set scoped to the sentence that actually asked or stated it.
function splitSentences(message) {
  return message.split(/(?<=[.?!])\s+/);
}

function findViolatingMessage(topic, karenMessages) {
  const topicLower = topic.toLowerCase();
  const keywords = keywordsOf(topic);
  for (const message of karenMessages) {
    for (const sentence of splitSentences(message)) {
      const sentenceLower = sentence.toLowerCase();
      if (topicLower.length > 0 && sentenceLower.includes(topicLower)) {
        return message;
      }
      if (keywords.length > 0 && keywords.every((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(sentence))) {
        return message;
      }
    }
  }
  return null;
}

function loadAnswerKeySections(fixtureDir) {
  const answerKeyPath = path.join(fixtureDir, 'answer-key.md');
  if (!fs.existsSync(answerKeyPath)) {
    return null;
  }
  const markdown = fs.readFileSync(answerKeyPath, 'utf8');
  return parseSections(markdown);
}

function findSection(sections, headerSubstring) {
  return sections.find((s) => s.header.toLowerCase().startsWith(headerSubstring));
}

let runCapture;
try {
  runCapture = JSON.parse(fs.readFileSync(runCaptureFile, 'utf8'));
} catch (err) {
  process.stderr.write(`Failed to read/parse run-capture file: ${err.message}\n`);
  process.exit(1);
}

const transcript = (runCapture && runCapture.init && Array.isArray(runCapture.init.transcript))
  ? runCapture.init.transcript
  : [];
const karenMessages = transcript
  .filter((turn) => turn && turn.role === 'karen' && typeof turn.text === 'string')
  .map((turn) => turn.text);

const sections = loadAnswerKeySections(fixtureDir);

// No answer-key.md for this fixture (e.g. dimension not applicable) —
// vacuously pass rather than crash, per CONTRACT.md's per-dimension
// applicability rule.
if (sections === null) {
  const result = {
    dimension: 'interview',
    fixture: fixtureName,
    metrics: { mustNotAskPrecision: 1, mustAskRecall: 1, violations: [], misses: [] },
    pass: true,
    details: [{ note: 'answer-key.md not found for this fixture; vacuously passing.' }],
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

const mustAskSection = findSection(sections, 'must ask unprompted');
const mustNotAskSection = findSection(sections, 'must not ask');

const mustAskTopics = mustAskSection ? extractTopics(mustAskSection) : [];
const mustNotAskTopics = mustNotAskSection ? extractTopics(mustNotAskSection) : [];

const violations = [];
for (const topic of mustNotAskTopics) {
  const matchedMessage = findViolatingMessage(topic, karenMessages);
  if (matchedMessage) {
    violations.push({ topic, matchedMessage });
  }
}

const misses = [];
for (const topic of mustAskTopics) {
  const matchedMessage = findMatchingMessage(topic, karenMessages);
  if (!matchedMessage) {
    misses.push({ topic });
  }
}

const mustNotAskPrecision = mustNotAskTopics.length === 0
  ? 1
  : 1 - violations.length / mustNotAskTopics.length;
const mustAskRecall = mustAskTopics.length === 0
  ? 1
  : (mustAskTopics.length - misses.length) / mustAskTopics.length;

const pass = violations.length === 0 && misses.length === 0;

const details = [
  ...violations.map((v) => ({
    field: 'mustNotAsk',
    topic: v.topic,
    finding: 'violation',
    matchedMessage: v.matchedMessage,
  })),
  ...misses.map((m) => ({
    field: 'mustAskUnprompted',
    topic: m.topic,
    finding: 'miss',
  })),
];

const result = {
  dimension: 'interview',
  fixture: fixtureName,
  metrics: { mustNotAskPrecision, mustAskRecall, violations, misses },
  pass,
  details,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(0);
