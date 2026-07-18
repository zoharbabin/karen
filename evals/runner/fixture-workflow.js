export const meta = {
  name: 'karen-fixture-eval',
  description: 'Per-fixture Karen eval pipeline: init/audit/patch capture + deterministic + judged grading',
  whenToUse: 'Run the Karen eval benchmark against self-test golden/broken samples (grade-only) or a real Karen skill (full, once Karen exists)',
  phases: [
    { title: 'Capture' },
    { title: 'Grade' },
    { title: 'Judge' },
    { title: 'Report' },
  ],
}

// args shape:
//   { mode: 'grade-only' | 'full', source: 'golden' | 'broken' | '<abs path to a run-capture.json dir>',
//     fixtures?: string[], repeatJudge?: number, fixtureRetries?: number }
// Defaults: mode 'grade-only', source 'golden', every fixture under evals/fixtures/ (discovered
// live each run, not hardcoded — new fixtures need no edit here), repeatJudge 1 (grade-only) / 3 (full).

const ROOT = '/opt/homebrew/var/www/coding-harness'
const EVALS = `${ROOT}/evals`

const DIMENSION_SCRIPT = {
  detection: 'score-detection.js',
  interview: 'score-interview.js',
  karenJson: 'score-karen-json.js',
  gateIssues: 'score-gate-issues.js',
  gateContract: 'score-gate-contract.js',
  delta: 'score-delta.js',
  fingerprintStability: 'score-fingerprint-stability.js',
  circuitBreaker: 'score-circuit-breaker.js',
  reconciliation: 'score-reconciliation.js',
  knownGaps: 'score-known-gaps.js',
}

// Every fixture runs the universal 8; reconciliation/knownGaps scripts vacuously
// pass on fixtures without that scenario (see grader header comments), so we
// still run them everywhere rather than special-casing fixture 4 / fixture 9 here.
const DIMENSIONS = Object.keys(DIMENSION_SCRIPT)

// Every score-*.js grader emits this exact top-level shape (CONTRACT.md §3);
// "metrics" and "details" vary in internal shape per dimension, so they stay
// untyped objects/arrays here rather than being pinned further. Declared here
// (ahead of the top-level pipeline() calls below) rather than next to
// gradeDeterministic further down the file — this script runs top-to-bottom
// as one sequential body, so a const declared after the code that calls the
// function referencing it is still in its temporal dead zone when that call
// actually executes.
const GRADE_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    fixture: { type: 'string' },
    metrics: { type: 'object' },
    pass: { type: 'boolean' },
    details: { type: 'array' },
  },
  required: ['dimension', 'fixture', 'pass'],
}

// Deterministic grader-runner, embedded verbatim and run once per fixture so
// gradeDeterministic needs a single combined relay call instead of one per
// dimension. Runs all 10 score-*.js scripts itself (each is already a fast,
// independent, side-effect-free read of the same run-capture file) and writes
// one {dimension: result, ...} object to outPath — same "mechanical piece
// stays byte-for-byte reproducible, not left to model judgment" rationale as
// RUN_STATE_UPDATER_SRC below. Declared here (ahead of gradeDeterministic
// further down) for the same temporal-dead-zone reason as GRADE_RESULT_SCHEMA
// above.
const GRADE_MERGE_SRC = [
  "const { execFileSync } = require('child_process');",
  "const fs = require('fs');",
  '',
  'const evalsDir = process.argv[2];',
  'const fixtureDir = process.argv[3];',
  'const runCaptureFile = process.argv[4];',
  'const outPath = process.argv[5];',
  '',
  `const DIMENSION_SCRIPT = ${JSON.stringify(DIMENSION_SCRIPT)};`,
  '',
  'const results = {};',
  'for (const [dim, script] of Object.entries(DIMENSION_SCRIPT)) {',
  '  try {',
  "    const out = execFileSync('node', [evalsDir + '/grading/' + script, fixtureDir, runCaptureFile], { encoding: 'utf8' });",
  "    const lines = out.trim().split('\\n').filter(function (l) { return l.length > 0; });",
  '    results[dim] = JSON.parse(lines[lines.length - 1]);',
  '  } catch (err) {',
  '    results[dim] = { dimension: dim, fixture: null, pass: false, error: String((err && err.message) || err) };',
  '  }',
  '}',
  '',
  'fs.writeFileSync(outPath, JSON.stringify(results));',
].join('\n')

// Deterministic run-state.json writer, embedded verbatim into each audit
// trigger's scratch dir and run there via `node`. Implements
// reference/run-state.md's write_run_state procedure (content-based
// fingerprint per issue — a short hash of (file, message-with-digits-
// stripped) — plus per-gate count/staleCount, carried forward from the
// previous run's run-state.json when the fingerprint set is unchanged, reset
// to 0 otherwise) so delta/circuit-breaker/fingerprint-stability grading has
// real run-state data to compare across triggers, using the exact same
// parsing rules as grading/lib/parse-gate-output.js. Written as one plain
// string (no backticks or template interpolation) so it can sit inside this
// file's own template-literal prompts without escaping. Declared here
// (ahead of the top-level pipeline() calls below), not next to
// runAuditSequence further down — same temporal-dead-zone reason as
// GRADE_RESULT_SCHEMA above; a const (unlike a function declaration) is not
// hoisted, so it must sit above every call site that runs before it.
const RUN_STATE_UPDATER_SRC = [
  "const fs = require('fs');",
  "const path = require('path');",
  "const crypto = require('crypto');",
  '',
  'const scratchDir = process.argv[2];',
  'const captureDir = process.argv[3];',
  'const outPath = process.argv[4];',
  '',
  'function parseGateOutput(stdout) {',
  "  const lines = stdout.split('\\n').filter(function (l) { return l.length > 0; });",
  '  const issues = [];',
  '  let summary = null;',
  '  for (const line of lines) {',
  "    const summaryMatch = line.match(/^(PASS|FAIL) \\((\\d+) issues?\\)$/);",
  '    if (summaryMatch) { summary = { status: summaryMatch[1], count: Number(summaryMatch[2]) }; continue; }',
  "    if (line.trim() === 'ZERO-TOLERANCE') continue;",
  "    const issueMatch = line.match(/^([^\\t]+?):(\\d+)\\t(.+)$/);",
  '    if (issueMatch) { issues.push({ file: issueMatch[1], line: Number(issueMatch[2]), message: issueMatch[3] }); continue; }',
  "    const noLineMatch = line.match(/^([^\\t]+?)\\t(.+)$/);",
  '    if (noLineMatch) { issues.push({ file: noLineMatch[1], line: null, message: noLineMatch[2] }); }',
  '  }',
  '  return { issues: issues, summary: summary };',
  '}',
  '',
  'function fingerprintFor(issue) {',
  "  const normalized = issue.message.replace(/\\d+/g, '').replace(/\\s+/g, ' ').trim();",
  "  const hash = crypto.createHash('md5').update(issue.file + '::' + normalized).digest('hex').slice(0, 6);",
  "  return hash + ':' + issue.file;",
  '}',
  '',
  "const runStatePath = path.join(scratchDir, '.karen', 'run-state.json');",
  'let previous = null;',
  'if (fs.existsSync(runStatePath)) {',
  "  previous = JSON.parse(fs.readFileSync(runStatePath, 'utf8'));",
  '}',
  'const previousGates = (previous && previous.gates) || {};',
  '',
  "const gateFiles = fs.readdirSync(captureDir).filter(function (f) { return f.endsWith('.out'); });",
  'const gateResults = {};',
  'const gates = {};',
  'let total = 0;',
  '',
  'for (const outFile of gateFiles) {',
  '  const gateId = outFile.slice(0, -4);',
  "  const stdout = fs.readFileSync(path.join(captureDir, outFile), 'utf8');",
  "  const exitPath = path.join(captureDir, gateId + '.exit');",
  "  const exitCode = fs.existsSync(exitPath) ? parseInt(fs.readFileSync(exitPath, 'utf8').trim(), 10) : null;",
  '  gateResults[gateId] = { stdout: stdout, exitCode: exitCode };',
  '',
  '  const parsed = parseGateOutput(stdout);',
  '  const count = parsed.summary ? parsed.summary.count : parsed.issues.length;',
  '  const fingerprint = parsed.issues.map(fingerprintFor).sort();',
  '',
  '  const prevGate = previousGates[gateId];',
  '  const prevFingerprint = (prevGate && Array.isArray(prevGate.fingerprint)) ? prevGate.fingerprint.slice().sort() : null;',
  '  const unchanged = prevFingerprint !== null && prevFingerprint.length === fingerprint.length &&',
  '    prevFingerprint.every(function (v, i) { return v === fingerprint[i]; });',
  '  const staleCount = unchanged ? ((prevGate.staleCount || 0) + 1) : 0;',
  '',
  '  gates[gateId] = { count: count, fingerprint: fingerprint, staleCount: staleCount };',
  '  total += count;',
  '}',
  '',
  'const runState = {',
  '  run: ((previous && previous.run) || 0) + 1,',
  '  timestamp: new Date().toISOString(),',
  '  gates: gates,',
  '  total: total,',
  '};',
  '',
  "fs.mkdirSync(path.dirname(runStatePath), { recursive: true });",
  'fs.writeFileSync(runStatePath, JSON.stringify(runState, null, 2));',
  '',
  'fs.writeFileSync(outPath, JSON.stringify({ gateResults: gateResults, runState: runState }));',
].join('\n')

// Deterministic audit-result merger, embedded verbatim and run once per
// fixture after all 7 audit triggers have written their own outPath file, so
// assembling the combined auditRuns array is a plain file read+concat rather
// than an LLM asked to reconstruct 7 nested {gateResults, runState} objects
// through a schema tool-call — that reconstruction step was observed to
// silently mistranscribe a single numeric field (a gate's staleCount) deep
// inside one trigger's runState even at model:'sonnet'. Same "mechanical
// piece stays byte-for-byte reproducible" rationale as GRADE_MERGE_SRC and
// RUN_STATE_UPDATER_SRC above. Declared here for the same temporal-dead-zone
// reason as those two consts.
const AUDIT_MERGE_SRC = [
  "const fs = require('fs');",
  '',
  'const triggerToOutPath = JSON.parse(process.argv[2]);',
  'const outPath = process.argv[3];',
  '',
  'const combined = {};',
  'for (const [trigger, filePath] of Object.entries(triggerToOutPath)) {',
  "  combined[trigger] = JSON.parse(fs.readFileSync(filePath, 'utf8'));",
  '}',
  '',
  'fs.writeFileSync(outPath, JSON.stringify(combined));',
].join('\n')

// Observed empirically: args sometimes arrives JSON-encoded as a string
// rather than as the object it was invoked with — parse defensively so
// mode/source/fixtures/repeatJudge resolve correctly either way.
const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args

const mode = (parsedArgs && parsedArgs.mode) || 'grade-only'
const source = (parsedArgs && parsedArgs.source) || 'golden'
// EVALS-PLAN.md §7: 3 runs is an explicitly under-powered v1 starting point
// ("scale to 5-10 once the harness is stable enough to justify the spend") —
// confirmed under-powered empirically: golden fixtures with clean, rubric-
// exemplary transcripts (adaptive follow-ups citing exact source evidence)
// scored a mean <0.7 at k=3 purely from judge variance (e.g. python-monorepo
// individual runs: 0.45, 0.92, 0.45). Deterministic dimensions are now
// stable, so this is that point — move to 5.
const repeatJudge = (parsedArgs && parsedArgs.repeatJudge) || 5
// captureFromLiveKaren is dozens of sequential agent() calls per fixture (karen
// turns, persist-harness, 7 audit runs, merge, relay) with no internal resume —
// one transient Bedrock 503 / mid-response error anywhere in that chain sacrifices
// the whole fixture even though agent()'s own 5x stall-retry already absorbed
// everything it could. Confirmed empirically: a live mode:'full' run across all 14
// fixtures returned fixturesSucceeded:3 with the other 11 losses traced to exactly
// this kind of one-off transient error, not a real skill or fixture defect. Retrying
// the entire per-fixture capture (cheap relative to losing the fixture outright) is
// the fix; default 3 attempts, overridable since a full run is expensive to redo.
const fixtureRetries = (parsedArgs && parsedArgs.fixtureRetries) || 3

if (mode !== 'grade-only' && mode !== 'full') {
  throw new Error(`Unknown mode "${mode}" — expected "grade-only" or "full"`)
}

// Scripts get no direct filesystem access, so fixture discovery goes through a
// tiny agent() call that lists evals/fixtures/ — this keeps the fixture set
// live off disk instead of a hardcoded array that silently drifts stale as
// fixtures are added.
const fixtures = (parsedArgs && parsedArgs.fixtures) || await discoverFixtures()

log(`Running ${fixtures.length} fixture(s) in ${mode} mode (source: ${source})`)

phase('Capture')
const captures = await pipeline(
  fixtures,
  async (fixtureName) => {
    if (mode === 'grade-only') return captureFromSelfTest(fixtureName, source)
    for (let attempt = 1; attempt <= fixtureRetries; attempt++) {
      const result = await captureFromLiveKaren(fixtureName)
      if (result) return result
      log(`${fixtureName}: capture attempt ${attempt}/${fixtureRetries} failed`)
    }
    log(`${fixtureName}: capture failed after ${fixtureRetries} attempt(s) — dropping this fixture from the run`)
    return null
  }
)

// pipeline()'s 2nd callback arg (originalItem) is drawn from *this call's own*
// items array (captures / graded below), never the top-level fixtures array —
// so fixture names come from the index param against `fixtures` directly.
phase('Grade')
const graded = await pipeline(
  captures,
  (capture, _item, i) => capture ? gradeDeterministic(capture, fixtures[i]) : null
)

phase('Judge')
const judged = await pipeline(
  graded,
  (result, _item, i) => {
    const capture = captures[i]
    return result && capture ? judgeInterviewFollowup(capture, fixtures[i], repeatJudge) : null
  }
)

const combined = judged.map((judgeResult, i) => {
  if (!graded[i]) return null
  return { fixture: fixtures[i], deterministic: graded[i], judge: judgeResult }
}).filter(Boolean)

// Failed fixtures were previously visible only in the ephemeral `logs` array
// (whatever log() calls happened to fire during that run) — surfacing the
// list directly on the returned result means a caller doesn't have to go
// digging through task-output files to know which fixtures dropped out.
const failedFixtures = fixtures.filter((_, i) => !graded[i])

phase('Report')
const report = await buildAggregateReport(combined)

return { mode, source, fixturesRun: fixtures.length, fixturesSucceeded: combined.length, failedFixtures, report }

// ---------------------------------------------------------------------------

async function discoverFixtures() {
  const listing = await agent(
    `List the immediate subdirectory names (not files, not nested paths) directly under ${EVALS}/fixtures/. Print them one per line, sorted alphabetically, nothing else — no commentary, no numbering, no code fences.`,
    { label: 'discover-fixtures', phase: 'Capture', model: 'haiku', effort: 'low' }
  )
  const names = (listing || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (!names.length) {
    throw new Error(`No fixtures discovered under ${EVALS}/fixtures/ — check the directory exists and is non-empty`)
  }
  return names
}

// haiku sometimes wraps output in a ```json fence despite being told not to
// — strip that wrapper before parsing rather than failing on it.
function stripCodeFence(text) {
  return text.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()
}

function captureFromSelfTest(fixtureName, sourceKind) {
  const runCapturePath = `${EVALS}/self-test/${sourceKind}/${fixtureName}/run-capture.json`
  const fixtureDir = `${EVALS}/fixtures/${fixtureName}`
  return agent(
    `Read the file at ${runCapturePath} and print its exact raw contents to stdout, verbatim, with nothing else added before or after — no commentary, no code fences. If the file does not exist, print exactly the string MISSING_RUN_CAPTURE instead. Return that raw output as your final answer.`,
    { label: `capture:${fixtureName}`, phase: 'Capture', model: 'haiku', effort: 'low' }
  ).then((text) => {
    if (!text || text.trim() === 'MISSING_RUN_CAPTURE') {
      log(`WARN: no run-capture.json for ${fixtureName} at ${sourceKind} — skipping`)
      return null
    }
    let parsed
    try {
      parsed = JSON.parse(stripCodeFence(text))
    } catch (e) {
      log(`WARN: run-capture.json for ${fixtureName} failed to parse — skipping (${e.message})`)
      return null
    }
    return { fixtureDir, runCapturePath, runCapture: parsed }
  })
}

function captureFromLiveKaren(fixtureName) {
  // Full mode requires a real Karen skill/plugin installed in this workflow's
  // execution environment (BLUEPRINT.md "The Skill Architecture") — Karen does
  // not exist yet (EVALS-PLAN.md §6), so this path is structurally complete but
  // untested until then. It drives the real two-agent interview per §5: Agent A
  // ("Karen") and Agent B ("fake user", briefed with fake-user-agent-brief.md +
  // the fixture's answer-key.md) alternate turns; each turn is a fresh agent()
  // call carrying the transcript-so-far in its prompt, since agents are stateless
  // across calls and the workflow script itself holds no memory but plain JS vars.
  const fixtureDir = `${EVALS}/fixtures/${fixtureName}`
  const scratchDir = `/tmp/karen-eval-${fixtureName}`

  return agent(
    `Set up a scratch copy of the fixture repo for a live Karen evaluation run.
1. Remove ${scratchDir} if it exists, then copy ${fixtureDir}/repo/ to ${scratchDir}/ fresh.
2. Install the project's real dependencies so gate scripts that shell out to the project's own toolchain (npm test, tsc, eslint, pytest, go vet, etc.) actually have something to run instead of silently failing: if ${scratchDir}/package.json exists, run \`npm install\` there; if ${scratchDir}/requirements.txt or ${scratchDir}/pyproject.toml exists, create a venv and install it (or \`pip install -e .\`/\`pip install -r requirements.txt\` into the environment already active); if ${scratchDir}/go.mod exists, run \`go mod download\`. Do this for every subproject with its own manifest, not just the root. If an install step fails, print exactly DEPS_INSTALL_FAILED:<manifest path> and stop.
3. Confirm a "karen" skill/plugin is available in this environment (check for a registered skill named karen, or an installed Karen plugin per BLUEPRINT.md's "The Skill Architecture"). If none is found, print exactly KAREN_NOT_INSTALLED and stop.
4. Otherwise print exactly SCRATCH_READY:${scratchDir}
Return only that one line.`,
    { label: `setup:${fixtureName}`, phase: 'Capture', model: 'sonnet' }
  ).then(async (setupResult) => {
    if (!setupResult || setupResult.includes('KAREN_NOT_INSTALLED')) {
      log(`${fixtureName}: Karen is not installed in this environment — full mode cannot run yet. Use mode:"grade-only" against self-test samples instead.`)
      return null
    }
    if (setupResult.includes('DEPS_INSTALL_FAILED')) {
      log(`${fixtureName}: dependency install failed during scratch setup — ${setupResult}`)
      return null
    }

    const transcript = []
    const MAX_TURNS = 20
    let karenDone = false
    let finalKarenJson = null
    let finalGateScripts = null
    let finalHarnessJson = null
    let detectProjectOutput = null

    for (let turn = 0; turn < MAX_TURNS && !karenDone; turn++) {
      const karenTurn = await agent(
        `You are Karen, running "karen init" against the project at ${scratchDir} (BLUEPRINT.md "The Init Conversation"). Call detect_project-equivalent analysis on the real files there first if this is turn 0. Conversation so far:\n${JSON.stringify(transcript)}\n\nDo not read, grep, or otherwise consult anything under ${EVALS}/self-test/, or any of ${fixtureDir}/answer-key.md, ${fixtureDir}/expected-karen.json, ${fixtureDir}/planted-issues.json, ${fixtureDir}/expected-gates.json, or ${fixtureDir}/fixture-manifest.json — those are this fixture's grading ground truth, and consulting them to shortcut detection or the interview instead of reasoning from ${scratchDir}'s own files invalidates this run. Everything you need is either derivable from ${scratchDir} itself or must be asked in the conversation.\n\nAsk your next interview question, OR if you have everything you need, respond with a JSON object {"done": true, "detectProjectOutput": {...}, "karenJson": {...}, "gateScripts": {"gate-id": "script source", ...}, "harnessJson": {...}} representing the final .karen.json, generated gate scripts, and .karen/harness.json (per write-harness.md's "Registering everything in .karen/harness.json" — id/name/script path/run order/zeroTolerance for every gate in gateScripts, script paths relative to ${scratchDir} matching exactly where you'll write each one under .karen/gates/) all written to ${scratchDir}/.karen/. detectProjectOutput MUST use exactly this field shape (evals/schema/CONTRACT.md §1's fixture-manifest.json contract — this is graded by exact field name against ground truth, not free-form): {"languages": [...string], "manifests": [{"path": "...", "language": "..."}, ...], "frameworks": [...string], "ciConfig": [...string paths], "existingTestSetup": {"runner": "...", "coverageTool": "...", "coverageReport": "..."}, "agentContextFiles": [...string paths], "existingGates": [{"id": "...", "command": "...", "outputFormat": "...", "coverage": [...]}], "subprojects": [{"path": "...", "manifestPath": "...", "language": "..."}, ...] (empty array for single-package projects), "unclaimedPaths": [...string paths] (empty array if nothing is unowned)}. Otherwise respond with {"done": false, "question": "..."}. Respond with ONLY that JSON object.`,
        { label: `karen-turn-${turn}:${fixtureName}`, phase: 'Capture', model: 'sonnet',
          // detectProjectOutput's nested shape is pinned here (not just described
          // in the prompt prose above) because a plain {type:'object'} lets the
          // tool-call validator accept any shape without retrying — confirmed
          // empirically on node-monorepo, whose live output used "language"
          // (singular) and bare-string manifests instead of CONTRACT.md §1's
          // "languages"/{path,language} shape, silently zeroing detection's f1
          // for those fields despite the prompt already stating the contract.
          schema: { type: 'object', properties: { done: { type: 'boolean' }, question: { type: 'string' }, detectProjectOutput: {
            type: 'object',
            properties: {
              languages: { type: 'array', items: { type: 'string' } },
              manifests: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, language: { type: 'string' } }, required: ['path', 'language'] } },
              frameworks: { type: 'array', items: { type: 'string' } },
              ciConfig: { type: 'array', items: { type: 'string' } },
              existingTestSetup: { type: 'object', properties: { runner: { type: 'string' }, coverageTool: { type: 'string' }, coverageReport: { type: 'string' } } },
              agentContextFiles: { type: 'array', items: { type: 'string' } },
              existingGates: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, command: { type: 'string' }, outputFormat: { type: 'string' }, coverage: { type: 'array', items: { type: 'string' } } } } },
              subprojects: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, manifestPath: { type: 'string' }, language: { type: 'string' } }, required: ['path', 'manifestPath', 'language'] } },
              unclaimedPaths: { type: 'array', items: { type: 'string' } },
            },
            required: ['languages', 'manifests', 'frameworks', 'ciConfig', 'existingTestSetup', 'agentContextFiles', 'existingGates', 'subprojects', 'unclaimedPaths'],
          // minProperties:1 (not just type:'object') because a done:true
          // response validated fine with karenJson/gateScripts/harnessJson
          // all present but literally {} — confirmed on node-mcp-server-single,
          // where the final turn's own transcript showed it had already read
          // real, correctly-generated content for all three back off disk
          // (from an earlier turn in the same capture attempt) immediately
          // before its final tool call, but that call's argument generation
          // collapsed to empty objects anyway (its accompanying output_tokens
          // was far too small to hold the ~28KB of gate-script content it had
          // just verified) — the schema only checked presence, not shape, so
          // this passed validation and clobbered real prior content when
          // persisted. This forces a retry instead of silently accepting a
          // degenerate empty result.
          }, karenJson: { type: 'object', minProperties: 1 }, gateScripts: { type: 'object', minProperties: 1 }, harnessJson: { type: 'object', minProperties: 1 } }, required: ['done'],
            // Plain required:['done'] let a done:true response validate even when
            // detectProjectOutput/karenJson/gateScripts/harnessJson were omitted or
            // nested somewhere else — confirmed on node-sdk-single, where the final
            // turn's karenJson held a correctly-shaped nested detectProjectOutput but
            // the top-level field the persist/capture steps below actually read was
            // absent, silently zeroing detection scoring downstream. This conditional
            // makes the four result fields mandatory specifically when done is true,
            // so a same-shape omission fails validation and retries instead of
            // capturing an incomplete result.
            if: { properties: { done: { const: true } } },
            then: { required: ['done', 'detectProjectOutput', 'karenJson', 'gateScripts', 'harnessJson'] } } }
      )
      if (!karenTurn) break
      if (karenTurn.done) {
        karenDone = true
        finalKarenJson = karenTurn.karenJson
        finalGateScripts = karenTurn.gateScripts
        finalHarnessJson = karenTurn.harnessJson
        detectProjectOutput = karenTurn.detectProjectOutput
        break
      }
      transcript.push({ role: 'karen', text: karenTurn.question })

      const userAnswer = await agent(
        `Read ${EVALS}/runner/fake-user-agent-brief.md and ${fixtureDir}/answer-key.md, then answer this question from Karen as the project's user, following the brief's rules exactly: "${karenTurn.question}"\nTranscript so far:\n${JSON.stringify(transcript)}`,
        { label: `fakeuser-turn-${turn}:${fixtureName}`, phase: 'Capture', model: 'sonnet' }
      )
      transcript.push({ role: 'user', text: userAnswer || '' })
    }

    if (!karenDone) {
      log(`${fixtureName}: Karen did not signal completion within ${MAX_TURNS} turns — capture incomplete`)
      return null
    }

    // The interview turn only reports what Karen *would* write as JSON fields —
    // nothing before this point has actually created scratchDir/.karen/ on disk.
    // Without this step the "initial" audit trigger below finds no .karen/ at
    // all (confirmed empirically: gateResults comes back {} with a "no .karen/
    // directory found" runState error) and every downstream grader scores a
    // false 0, since it's grading a harness that was never persisted rather
    // than one that's actually broken.
    const persisted = await agent(
      `Write the following files under ${scratchDir}:
1. ${scratchDir}/.karen.json — this exact JSON:\n${JSON.stringify(finalKarenJson)}
2. This harness.json object's "gates" array is the ONLY source of truth for each gate script's destination filename — it is what \`run_gate\`/\`karen audit\` reads later to find each gate by its "script" path, so the file you write MUST land at exactly that path, byte-for-byte including the extension (do not add, remove, or infer a ".sh"/".js"/etc. extension yourself; copy the "script" string verbatim). For each entry in harnessJson.gates below, look up its script source by matching entry.id against a key in this gateScripts object, then write that source verbatim to ${scratchDir}/<entry.script> (create parent directories as needed) and make it executable (chmod +x). harnessJson:\n${JSON.stringify(finalHarnessJson)}\ngateScripts:\n${JSON.stringify(finalGateScripts)}
3. ${scratchDir}/.karen/harness.json — this exact harnessJson object again, unchanged.
Then print WRITTEN.`,
      { label: `persist-harness:${fixtureName}`, phase: 'Capture', model: 'sonnet' }
    )
    if (!persisted || !persisted.includes('WRITTEN')) {
      log(`${fixtureName}: failed to persist .karen/ to scratch dir — aborting capture`)
      return null
    }

    const auditRuns = await runAuditSequence(fixtureDir, scratchDir, fixtureName)
    if (!auditRuns) return null

    const runCapture = {
      fixture: fixtureName,
      init: { detectProjectOutput, transcript, karenJson: finalKarenJson, gateScripts: finalGateScripts, harnessJson: finalHarnessJson },
      auditRuns,
    }

    const runCapturePath = `/tmp/karen-eval-${fixtureName}-run-capture.json`
    // model:'sonnet' (not haiku/low-effort) deliberately — this blob is the
    // largest and most deeply nested one persisted anywhere in this file
    // (fixture/init/{4 fields}/auditRuns), and a haiku+low-effort attempt at
    // this exact step was observed silently "helpfully" restructuring it
    // (nesting auditRuns inside init) rather than writing it byte-for-byte,
    // which corrupted every downstream grader reading auditRuns from the
    // top level. persist-harness above (same file, model:'sonnet') writes
    // comparably large content correctly — match that, not this file's
    // faster/cheaper tier used for small fixed-shape writes elsewhere.
    await agent(
      `Write this exact JSON to ${runCapturePath} (create parent dirs if needed), byte-for-byte — do not reformat, reorder, or restructure any part of it, especially not the top-level keys ("fixture", "init", "auditRuns" must all remain siblings at the top level, exactly as given):\n${JSON.stringify(runCapture)}\nThen print WRITTEN.`,
      { label: `persist:${fixtureName}`, phase: 'Capture', model: 'sonnet' }
    )

    return { fixtureDir, runCapturePath, runCapture }
  })
}

async function runAuditSequence(fixtureDir, scratchDir, fixtureName) {
  const triggers = ['initial', '01-partial-fix', '02-regression', '03-noop-line-shift', '04-repeat-noop-1', '04-repeat-noop-2', '04-repeat-noop-3']
  const patchForTrigger = {
    '01-partial-fix': '01-partial-fix.patch',
    '02-regression': '02-regression.patch',
    '03-noop-line-shift': '03-noop-line-shift.patch',
    '04-repeat-noop-1': '04-repeat-noop.patch',
    '04-repeat-noop-2': '04-repeat-noop.patch',
    '04-repeat-noop-3': '04-repeat-noop.patch',
  }

  // The :run step per trigger is genuinely sequential and can't be batched:
  // each trigger's patch applies cumulatively against the same working tree,
  // and RUN_STATE_UPDATER_SRC's staleCount carry-forward explicitly reads
  // the PREVIOUS trigger's on-disk run-state.json, not anything the :relay
  // step below returns. But nothing downstream of a given loop iteration
  // consumes the :relay step's *return value* either — the next iteration's
  // :run step only ever reads files on disk. So the 7 relay calls have no
  // cross-iteration dependency among themselves and can be deferred to one
  // combined call after the loop, while the 7 :run calls stay one-per-
  // iteration.
  const outPaths = {}
  for (const trigger of triggers) {
    const patchFile = patchForTrigger[trigger]
    const captureDir = `/tmp/karen-eval-${fixtureName}-${trigger}-gateout`
    const outPath = `/tmp/karen-eval-${fixtureName}-${trigger}-audit.json`
    outPaths[trigger] = outPath
    // .cjs (not .js) so Node always treats this as CommonJS regardless of the
    // target fixture's own package.json "type" field — RUN_STATE_UPDATER_SRC
    // uses require(), and a fixture whose package.json declares "type":
    // "module" makes Node treat every .js file under it as ESM by default,
    // crashing with "require is not defined in ES module scope" (confirmed
    // on node-mcp-server-single, the only Node fixture with "type": "module").
    const updaterPath = `${scratchDir}/.karen/_update-run-state.cjs`
    // Redirect each gate script's real stdout/exit code to files first, then
    // assemble the JSON via a fixed Node script reading those files — asking
    // the agent to run a gate script AND retype its raw (often multi-line,
    // tab-containing) stdout into a schema response in the same turn was
    // observed to silently drop the stdout content (captured "" with the
    // correct exitCode), which zeroed out gate-issues/gate-contract/
    // fingerprint-stability even though the gate script itself was correct.
    // Same fix as gradeDeterministic's redirect-then-relay pattern above.
    //
    // run-state.json itself also needs writing every trigger — per
    // reference/run-state.md this is Karen's own write_run_state procedure
    // (content-based fingerprint hash per issue, staleCount carried forward
    // from the previous run when the fingerprint set is unchanged, reset to
    // 0 otherwise). Leaving that hashing/carry-forward logic to fresh model
    // judgment on every one of the 7 independent trigger turns risks
    // inconsistent hashing between turns even when the underlying issue is
    // identical, which would corrupt delta/circuit-breaker/fingerprint-
    // stability scoring for reasons that have nothing to do with whether
    // Karen's *gate scripts* are correct. Writing the exact same small
    // updater script verbatim every trigger keeps that one mechanical piece
    // byte-for-byte reproducible, the same way collect-feedback-bundle.sh is
    // the one deliberate bundled script in the plugin itself.
    const ran = await agent(
      `Working in ${scratchDir} (a scratch copy of a fixture repo mid-Karen-eval):
0. \`rm -f ${outPath}\` first, unconditionally, before doing anything else below. ${outPath} is reused across separate eval runs; if this turn fails partway through (e.g. step 2's script crashing) and leaves ${outPath} absent, that must show up downstream as a missing file, never as a stale result from an earlier, unrelated run silently standing in for this one.
${patchFile ? `1. Apply the patch at ${fixtureDir}/patches/${patchFile} with \`git apply --allow-empty\` (init a throwaway git repo first with \`git init -q\` and \`git add -A && git commit -q -m init\` if one doesn't exist yet, so git apply has a tree to work against; \`--allow-empty\` is required because some of these fixture patches are deliberately empty zero-hunk diffs used to test no-op-repeat handling, not a sign of a broken patch). If it fails to apply even with --allow-empty, print exactly PATCH_FAILED:${patchFile} and stop.\n2. ` : '1. '}\`rm -rf ${captureDir} && mkdir -p ${captureDir}\` (this path is reused across separate eval runs, so it must start empty — a stale .out/.exit file left over from a prior run would get double-counted alongside this run's fresh output). Then read ${scratchDir}/.karen/harness.json, and for every entry in its "gates" array run \`chmod +x ${scratchDir}/<script-path-from-harness.json>\` before executing anything (idempotent — a script the persist step already made executable is unaffected; this guards against the executable bit not yet being visible to this fresh agent turn right after a prior turn wrote it). Then run exactly the gates listed in that "gates" array (using each entry's own "id" and "script" path, resolved relative to ${scratchDir}) against ${scratchDir} — never every file physically present under ${scratchDir}/.karen/gates/, since a stale or duplicate file left in that directory that isn't registered in harness.json must NOT be executed. A gate script can be written in any language (bash, Node, Python, ...) and always starts with its own shebang — invoke it by DIRECT EXECUTION of its own path, never by guessing an interpreter from the extension and prefixing it (do NOT prefix with \`bash\`, \`node\`, \`python3\`, etc. — that breaks the moment the guess is wrong; the shebang picks the interpreter). Redirect each gate's raw stdout+stderr to its own file under ${captureDir}/<gate-id>.out (using the gate's "id" from harness.json, not its filename) and its exit code to ${captureDir}/<gate-id>.exit — e.g. for each gate entry: \`${scratchDir}/<script-path-from-harness.json> ${scratchDir} > ${captureDir}/<gate-id>.out 2>&1; echo $? > ${captureDir}/<gate-id>.exit\`. Never retype, summarize, or paraphrase a gate's output yourself.
2. Write the exact JavaScript below to ${updaterPath} verbatim, character-for-character, between the START/END markers (excluding the marker lines themselves — do not add, remove, or reformat anything):
---SCRIPT START---
${RUN_STATE_UPDATER_SRC}
---SCRIPT END---
3. Run: node ${updaterPath} ${scratchDir} ${captureDir} ${outPath}
This reads ${scratchDir}/.karen/run-state.json if it exists (from a previous trigger), computes updated per-gate fingerprints/counts/staleCounts, writes the new run-state.json, and writes {"gateResults": ..., "runState": ...} to ${outPath}. If this step fails for any reason (a crash, a missing tool, anything) do NOT invent a workaround — report the exact failure as your final text instead of printing DONE.
Only if every step above genuinely succeeded and ${outPath} now exists with fresh content, print DONE as the last line of your response.`,
      { label: `audit:${trigger}:${fixtureName}:run`, phase: 'Capture', model: 'sonnet' }
    )
    if (!ran || !ran.includes('DONE') || (patchFile && ran.includes(`PATCH_FAILED:${patchFile}`))) {
      log(`${fixtureName}: audit run "${trigger}" failed to execute — aborting capture for this fixture. Agent's report: ${ran ? ran.slice(0, 500) : '(no response)'}`)
      return null
    }
  }

  // Merge all 7 triggers' outPath files into one combined JSON file via a
  // fixed Node script (AUDIT_MERGE_SRC — plain file read+concat, no model
  // judgment involved), then relay that single combined file's raw bytes
  // through agent() the same way captureFromSelfTest does — a raw-text
  // final answer, parsed by this script's own JSON.parse, never retyped
  // through a schema tool-call. This replaces the prior approach (an agent
  // reading 7 separate files and reconstructing their content through a
  // schema), which was observed to silently mistranscribe a single numeric
  // field (a gate's staleCount) deep inside one trigger's runState while
  // leaving everything else correct.
  const mergePath = `/tmp/karen-eval-${fixtureName}-audit-merge.js`
  const combinedPath = `/tmp/karen-eval-${fixtureName}-audit-combined.json`
  const merged = await agent(
    `Write the exact JavaScript below to ${mergePath} verbatim, character-for-character, between the START/END markers (excluding the marker lines themselves):
---SCRIPT START---
${AUDIT_MERGE_SRC}
---SCRIPT END---
Then run: node ${mergePath} '${JSON.stringify(outPaths)}' ${combinedPath}
Then print DONE.`,
    { label: `audit:${fixtureName}:merge`, phase: 'Capture', model: 'sonnet' }
  )
  if (!merged || !merged.includes('DONE')) {
    log(`${fixtureName}: audit merge failed — aborting capture for this fixture`)
    return null
  }

  const relayedText = await agent(
    `Read the file at ${combinedPath} and print its exact raw contents to stdout, verbatim, with nothing else added before or after — no commentary, no code fences. Return that raw output as your final answer.`,
    { label: `audit:${fixtureName}:relay`, phase: 'Capture', model: 'haiku', effort: 'low' }
  )
  if (!relayedText) {
    log(`${fixtureName}: audit relay failed — aborting capture for this fixture`)
    return null
  }
  let relayed
  try {
    relayed = JSON.parse(stripCodeFence(relayedText))
  } catch (e) {
    log(`${fixtureName}: audit relay output failed to parse — aborting capture for this fixture (${e.message})`)
    return null
  }

  const auditRuns = []
  for (const trigger of triggers) {
    const result = relayed[trigger]
    if (!result || !result.gateResults || !result.runState) {
      log(`${fixtureName}: audit run "${trigger}" missing from relay — aborting capture for this fixture`)
      return null
    }
    auditRuns.push({ trigger, gateResults: result.gateResults, runState: result.runState })
  }
  return auditRuns
}

async function gradeDeterministic(capture, fixtureName) {
  // All 10 dimensions read the same already-written runCapturePath file and
  // have no cross-dimension dependency, so — unlike runAuditSequence's
  // per-trigger relay below — the run step itself can be merged into one
  // call too, not just the relay: one Sonnet turn runs GRADE_MERGE_SRC (which
  // shells out to all 10 grader scripts itself) and writes one combined file,
  // then one Haiku call relays that whole file through a schema accepting
  // all 10 results at once. This replaces 10 run + 10 relay calls/fixture
  // with 1 + 1.
  const mergePath = `/tmp/karen-eval-grade-merge-${fixtureName}.js`
  const outPath = `/tmp/karen-eval-grade-${fixtureName}.json`
  const ran = await agent(
    `Write the exact JavaScript below to ${mergePath} verbatim, character-for-character, between the START/END markers (excluding the marker lines themselves):
---SCRIPT START---
${GRADE_MERGE_SRC}
---SCRIPT END---
Then run: node ${mergePath} ${EVALS} ${capture.fixtureDir} ${capture.runCapturePath} ${outPath}
Then print DONE.`,
    { label: `grade:${fixtureName}:run`, phase: 'Grade', model: 'sonnet' }
  )
  if (!ran) return DIMENSIONS.map((dim) => ({ dimension: dim, fixture: fixtureName, pass: false, error: 'no output' }))
  const relayed = await agent(
    `Read the file at ${outPath} (a JSON object keyed by dimension name, one entry per key: ${DIMENSIONS.join(', ')}) and report its exact field values through the required output — do not summarize, reword, or drop any nested content under any dimension's "metrics" or "details".`,
    { label: `grade:${fixtureName}:relay`, phase: 'Grade', model: 'haiku', effort: 'low',
      schema: { type: 'object', properties: Object.fromEntries(DIMENSIONS.map((dim) => [dim, GRADE_RESULT_SCHEMA])), required: DIMENSIONS } }
  )
  return DIMENSIONS.map((dim) => {
    const parsed = relayed && relayed[dim]
    if (!parsed) return { dimension: dim, fixture: fixtureName, pass: false, error: 'no output' }
    return parsed
  })
}

function judgeInterviewFollowup(capture, fixtureName, repeatCount) {
  const answerKeyPath = `${capture.fixtureDir}/answer-key.md`
  const runs = Array.from({ length: repeatCount }, (_, i) => () =>
    agent(
      `Read ${EVALS}/grading/judge-interview-followup.md and ${answerKeyPath}, then act as the judge that template describes, scoring this fixture's transcript:\n${JSON.stringify(capture.runCapture.init.transcript)}\nagainst the reference (fixture name "${fixtureName}"). You are the judge — the score, reasoning, and specificFollowUpsEvaluated you report via the required output fields must be your own real verdict on this transcript, not a description of the templating/grading process itself.`,
      { label: `judge:${fixtureName}:run${i + 1}`, phase: 'Judge', model: 'sonnet',
        schema: { type: 'object', properties: { score: { type: 'number' }, reasoning: { type: 'string' }, specificFollowUpsEvaluated: { type: 'array' } }, required: ['score', 'reasoning'] } }
    )
  )
  return parallel(runs).then((verdicts) => {
    const valid = verdicts.filter(Boolean)
    if (!valid.length) return { dimension: 'interviewFollowupJudge', fixture: fixtureName, pass: false, error: 'no judge verdicts returned' }
    const mean = valid.reduce((s, v) => s + v.score, 0) / valid.length
    return { dimension: 'interviewFollowupJudge', fixture: fixtureName, pass: mean >= 0.7, metrics: { meanScore: mean, runs: valid.length }, details: valid }
  })
}

// Ports grading/aggregate-report.js's pure aggregation math (grouping,
// mean/SD, text formatting) directly into the workflow script instead of
// relaying `combined` through an agent to run that script on disk — an
// agent asked to transcribe the whole combined array (150+ objects, 40KB+)
// verbatim was found to silently fabricate a structurally-plausible "all
// clean" rewrite instead of faithfully copying it, erasing every real
// failure on a broken-source run while looking identical to a correct run
// on golden data (where "clean" already happened to be true, masking the
// bug). This data never needs to leave the script's own JS memory, so
// there is no relay step left to corrupt.
function flattenNumeric(obj, prefix) {
  const result = {}
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return result
  for (const [key, value] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[keyPath] = value
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenNumeric(value, keyPath))
    }
  }
  return result
}

function computeStats(values) {
  const n = values.length
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n
  return { mean, sd: Math.sqrt(variance), n }
}

function groupByFixtureThenDimension(entries) {
  const fixtures = new Map()
  for (const entry of entries) {
    if (!fixtures.has(entry.fixture)) fixtures.set(entry.fixture, new Map())
    const dimensions = fixtures.get(entry.fixture)
    if (!dimensions.has(entry.dimension)) dimensions.set(entry.dimension, [])
    dimensions.get(entry.dimension).push(entry)
  }
  return fixtures
}

function aggregateGroup(runs) {
  const passCount = runs.filter((r) => r.pass === true).length
  const passAtOne = passCount / runs.length
  const passPowK = runs.every((r) => r.pass === true)

  const flattenedPerRun = runs.map((r) => flattenNumeric(r.metrics, ''))
  const allPaths = new Set()
  for (const flat of flattenedPerRun) {
    for (const key of Object.keys(flat)) allPaths.add(key)
  }

  const metrics = {}
  for (const metricPath of allPaths) {
    const values = flattenedPerRun.map((flat) => flat[metricPath]).filter((v) => typeof v === 'number')
    if (values.length === 0) continue
    metrics[metricPath] = computeStats(values)
  }

  return { runs: runs.length, passAtOne, passPowK, metrics }
}

function buildAggregate(entries) {
  const fixtureGroups = groupByFixtureThenDimension(entries)
  const fixtures = {}
  let totalRuns = 0
  let totalGroups = 0
  let totalPassed = 0
  let groupsAllPassed = 0

  for (const [fixtureName, dimensions] of fixtureGroups) {
    fixtures[fixtureName] = { dimensions: {} }
    for (const [dimensionName, runs] of dimensions) {
      const aggregated = aggregateGroup(runs)
      fixtures[fixtureName].dimensions[dimensionName] = aggregated
      totalRuns += aggregated.runs
      totalGroups += 1
      totalPassed += runs.filter((r) => r.pass === true).length
      if (aggregated.passPowK) groupsAllPassed += 1
    }
  }

  const overall = {
    totalRuns,
    totalGroups,
    passAtOneRate: totalRuns === 0 ? 1 : totalPassed / totalRuns,
    passPowKRate: totalGroups === 0 ? 1 : groupsAllPassed / totalGroups,
  }

  return { fixtures, overall }
}

function pct(fraction) {
  return `${(fraction * 100).toFixed(1)}%`
}

function formatMetricValue({ mean, sd, n }) {
  return n > 1 ? `${mean.toFixed(3)}±${sd.toFixed(3)}` : `${mean.toFixed(3)}`
}

function formatText(aggregate) {
  const lines = []
  const fixtureNames = Object.keys(aggregate.fixtures)
  for (const fixtureName of fixtureNames) {
    lines.push(`Fixture: ${fixtureName}`)
    const dimensions = aggregate.fixtures[fixtureName].dimensions
    for (const [dimensionName, agg] of Object.entries(dimensions)) {
      const metricParts = Object.entries(agg.metrics)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([metricPath, stats]) => `${metricPath}=${formatMetricValue(stats)}`)
      const header = `  ${dimensionName}  runs=${agg.runs}  pass@1=${pct(agg.passAtOne)}  pass^${agg.runs}=${agg.passPowK}`
      lines.push(metricParts.length > 0 ? `${header}  ${metricParts.join(' ')}` : header)
    }
    lines.push('')
  }
  lines.push(
    `Overall: ${aggregate.overall.totalRuns} run(s) across ${fixtureNames.length} fixture(s), ` +
      `${aggregate.overall.totalGroups} fixture/dimension group(s) — ` +
      `pass@1=${pct(aggregate.overall.passAtOneRate)}, pass^k=${pct(aggregate.overall.passPowKRate)}`,
  )
  return lines.join('\n')
}

async function buildAggregateReport(combined) {
  if (!combined.length) return 'No fixtures produced gradeable output.'
  const allScoreObjects = combined.flatMap((c) => [...c.deterministic, c.judge].filter(Boolean))
  return formatText(buildAggregate(allScoreObjects))
}
