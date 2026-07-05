<!--
Judge prompt template for EVALS-PLAN.md §4.2 "Interview quality" — the
follow-up-quality sub-part (the one genuinely qualitative check; the other
two sub-parts are deterministic and live in score-interview.js).

Runner usage: fill every {{PLACEHOLDER}} below and send the result as a
single user turn to the judge model. Run 3x per fixture per EVALS-PLAN.md
§4.2/§7 and average the returned "score"; do not silently smooth
disagreement across the 3 runs — report it.

Reference-guided grading (Zheng et al., arXiv:2306.05685): the judge is
given the fixture's ground truth as a reference, not just the transcript,
which is what suppresses reward for verbose-but-empty follow-ups.
-->

You are grading one AI assistant's interview transcript for follow-up quality. You are NOT grading whether every required topic was asked — that's already checked separately by an exact keyword matcher. You are grading only one thing: **when an answer changed what mattered, did the assistant's next question adapt to that change in a way that shows real reasoning, not just move on to the next item on a checklist?**

The canonical example of what "good" looks like: a user says the project runs in the browser; a good follow-up asks whether it handles microphone or camera access, because browser + media capability changes what the harness needs to enforce. A bad "follow-up" ignores that signal and asks something generic and pre-scripted instead, or asks about something the transcript already answered.

## Fixture

{{FIXTURE_NAME}}

## Reference — ground truth for this fixture (answer-key.md)

Score strictly against this reference. It lists the topics that source signal in this project makes relevant, and what should NOT be re-asked because detection already knew it. A follow-up only counts as a hit if it visibly responds to something the user just said and matches the intent of a "must ask unprompted" item below — do not credit a follow-up that happens to mention the same words without adapting to the prior answer.

{{ANSWER_KEY}}

## Transcript to grade

{{TRANSCRIPT}}

## Scoring rules

- Score strictly against the reference above, not against how thorough, detailed, or polished the transcript sounds. A short, precise follow-up that catches the signal scores higher than a long, generic one that doesn't.
- Do NOT reward verbosity or length in any question or explanation. Padding, restating the user's answer back at length, or asking multiple unrelated questions in one turn is not a sign of quality — judge only whether the follow-up shows correct reasoning about what changed.
- Do NOT penalize brevity. A one-line follow-up that correctly targets the exact "must ask unprompted" item is a perfect score for that item.
- Only evaluate turns where the reference indicates an answer should have changed the direction of the interview. If the reference has no such "must ask unprompted" items for this fixture, or the transcript never reaches a point where one applies, say so and score 1 (vacuous pass — nothing to fail on).
- For each "must ask unprompted" item in the reference, first check what its parenthetical justification says. Two different kinds of item are mixed under that one header, and they are scored differently:
  - **Signal-triggered items**: the parenthetical names a specific concrete source artifact (a particular file, function call, code construct, or document) that Karen could react to. Score these on whether the follow-up visibly connects to that artifact or to the answer that surfaced it (not just asked as an isolated scripted question).
  - **Baseline items**: the parenthetical says no signal exists either way (e.g. "no compliance artifacts of any kind exist", "detect_project has no way to tell", a classification that is inherently ambiguous with no code-level artifact to point to). There is nothing here for a follow-up to adapt to, so asking it plainly, in the same wording used across other fixtures, is correct — do NOT penalize it for sounding generic or pre-scripted. Count it as a hit as long as it was asked; topic coverage itself is already checked deterministically elsewhere.
  List your verdict per item, noting which kind it is.
- Ignore the deterministic ask/don't-ask coverage question entirely — that's graded elsewhere. Focus only on the *quality of the connection* between an answer and the next question.

## Output format

Output exactly one JSON object and nothing else — no prose before or after it, no markdown code fence:

{"score": <number between 0 and 1>, "reasoning": "<1-3 sentences justifying the score against the reference, naming which items adapted well and which didn't>", "specificFollowUpsEvaluated": [{"referenceItem": "<must-ask-unprompted topic text from the reference>", "adapted": <true|false>, "note": "<one short sentence>"}]}
