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
//     fixtures?: string[], repeatJudge?: number }
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
  (fixtureName) => mode === 'grade-only'
    ? captureFromSelfTest(fixtureName, source)
    : captureFromLiveKaren(fixtureName)
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

phase('Report')
const report = await buildAggregateReport(combined)

return { mode, source, fixturesRun: fixtures.length, fixturesSucceeded: combined.length, report }

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
2. Confirm a "karen" skill/plugin is available in this environment (check for a registered skill named karen, or an installed Karen plugin per BLUEPRINT.md's "The Skill Architecture"). If none is found, print exactly KAREN_NOT_INSTALLED and stop.
3. Otherwise print exactly SCRATCH_READY:${scratchDir}
Return only that one line.`,
    { label: `setup:${fixtureName}`, phase: 'Capture', model: 'sonnet' }
  ).then(async (setupResult) => {
    if (!setupResult || setupResult.includes('KAREN_NOT_INSTALLED')) {
      log(`${fixtureName}: Karen is not installed in this environment — full mode cannot run yet. Use mode:"grade-only" against self-test samples instead.`)
      return null
    }

    const transcript = []
    const MAX_TURNS = 20
    let karenDone = false
    let finalKarenJson = null
    let finalGateScripts = null
    let detectProjectOutput = null

    for (let turn = 0; turn < MAX_TURNS && !karenDone; turn++) {
      const karenTurn = await agent(
        `You are Karen, running "karen init" against the project at ${scratchDir} (BLUEPRINT.md "The Init Conversation"). Call detect_project-equivalent analysis on the real files there first if this is turn 0. Conversation so far:\n${JSON.stringify(transcript)}\n\nAsk your next interview question, OR if you have everything you need, respond with a JSON object {"done": true, "detectProjectOutput": {...}, "karenJson": {...}, "gateScripts": {"gate-id": "script source", ...}} representing the final .karen.json and generated gate scripts written to ${scratchDir}/.karen/. Otherwise respond with {"done": false, "question": "..."}. Respond with ONLY that JSON object.`,
        { label: `karen-turn-${turn}:${fixtureName}`, phase: 'Capture', model: 'sonnet',
          schema: { type: 'object', properties: { done: { type: 'boolean' }, question: { type: 'string' }, detectProjectOutput: { type: 'object' }, karenJson: { type: 'object' }, gateScripts: { type: 'object' } }, required: ['done'] } }
      )
      if (!karenTurn) break
      if (karenTurn.done) {
        karenDone = true
        finalKarenJson = karenTurn.karenJson
        finalGateScripts = karenTurn.gateScripts
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

    const auditRuns = await runAuditSequence(fixtureDir, scratchDir, fixtureName)
    if (!auditRuns) return null

    const runCapture = {
      fixture: fixtureName,
      init: { detectProjectOutput, transcript, karenJson: finalKarenJson, gateScripts: finalGateScripts },
      auditRuns,
    }

    const runCapturePath = `/tmp/karen-eval-${fixtureName}-run-capture.json`
    await agent(
      `Write this exact JSON to ${runCapturePath} (create parent dirs if needed):\n${JSON.stringify(runCapture)}\nThen print WRITTEN.`,
      { label: `persist:${fixtureName}`, phase: 'Capture', model: 'haiku', effort: 'low' }
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

  const auditRuns = []
  for (const trigger of triggers) {
    const patchFile = patchForTrigger[trigger]
    const result = await agent(
      `Working in ${scratchDir} (a scratch copy of a fixture repo mid-Karen-eval):
${patchFile ? `1. Apply the patch at ${fixtureDir}/patches/${patchFile} with \`git apply\` (init a throwaway git repo first with \`git init -q\` and \`git add -A && git commit -q -m init\` if one doesn't exist yet, so git apply has a tree to work against). If it fails to apply, print exactly PATCH_FAILED:${patchFile} and stop.\n2. ` : '1. '}Run every gate script in ${scratchDir}/.karen/gates/ (one per file) against ${scratchDir}, and read ${scratchDir}/.karen/run-state.json after running them all.
Respond with ONLY a JSON object: {"gateResults": {"<gate-id>": {"stdout": "<raw stdout of that gate script>", "exitCode": <int>}}, "runState": <contents of run-state.json>}`,
      { label: `audit:${trigger}:${fixtureName}`, phase: 'Capture', model: 'sonnet',
        schema: { type: 'object', properties: { gateResults: { type: 'object' }, runState: { type: 'object' } }, required: ['gateResults', 'runState'] } }
    )
    if (!result) {
      log(`${fixtureName}: audit run "${trigger}" failed — aborting capture for this fixture`)
      return null
    }
    auditRuns.push({ trigger, gateResults: result.gateResults, runState: result.runState })
  }
  return auditRuns
}

function gradeDeterministic(capture, fixtureName) {
  return parallel(DIMENSIONS.map((dim) => () => {
    const outPath = `/tmp/karen-eval-grade-${fixtureName}-${dim}.json`
    // Redirect to a file first (no long verbatim relay needed for the run
    // step itself). The relay step then reports the file's content through
    // the `schema` option rather than free text: asking a model to
    // character-for-character retype a large JSON blob as chat text is
    // unreliable even split out on its own (observed dropping a single `}`
    // from an 800-byte payload) — `schema` forces the content into
    // structured tool-call fields, which the harness validates and retries
    // on mismatch, so there is no "valid-looking but truncated JSON string"
    // failure mode left to hit.
    return agent(
      `Run: node ${EVALS}/grading/${DIMENSION_SCRIPT[dim]} ${capture.fixtureDir} ${capture.runCapturePath} > ${outPath}\nThen print DONE.`,
      { label: `grade:${dim}:${fixtureName}:run`, phase: 'Grade', model: 'sonnet' }
    ).then(() => agent(
      `Read the file at ${outPath} (a JSON object matching the required output fields) and report its exact field values through the required output — do not summarize, reword, or drop any nested content under "metrics" or "details".`,
      { label: `grade:${dim}:${fixtureName}:relay`, phase: 'Grade', model: 'haiku', effort: 'low', schema: GRADE_RESULT_SCHEMA }
    )).then((parsed) => {
      if (!parsed) return { dimension: dim, fixture: fixtureName, pass: false, error: 'no output' }
      return parsed
    })
  })).then((results) => results.filter(Boolean))
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
