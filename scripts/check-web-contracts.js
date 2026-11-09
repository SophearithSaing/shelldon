import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { digest, parsePR, sourceFixture } from '../web/development/fixtures/source.ts'
import { quizFixture, semanticFixture } from '../web/development/fixtures/features.ts'
import { selectionContext } from '../web/src/api/selection.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const pr = parsePR('https://github.com/acme/platform/pull/248')
const diff = sourceFixture(pr)
const anchor = { kind: 'lines', fileID: diff.files[0].id, hunkID: diff.files[0].hunks[0].id, side: 'new', start: 15, end: 15 }
const context = selectionContext(diff, anchor)
const question = 'Why share this promise?'
const answer = { answerID: digest('contract-answer'), threadID: digest('contract-thread'), prID: pr.id, revisionID: diff.revisionID, question, text: 'Concurrent callers share the in-flight operation.', state: 'completed', stopRequested: false, executionUnknown: false, reference: { revisionID: diff.revisionID, anchor, oldPath: context.oldPath, newPath: context.newPath }, persistence: 'saved', savedVersion: '1' }
const quiz = quizFixture(diff, digest('contract-quiz'))
const semantic = semanticFixture(diff, digest('contract-semantic'))
const generation = { prID: pr.id, generationID: digest('contract-generation'), revisionID: diff.revisionID, sequence: '1', state: 'pending', cancelRequested: false, executionUnknown: false }
const payload = {
  pr,
  source: { state: 'ready', pr, diff },
  initial: { revision: diff.revision, anchor, question },
  answer,
  list: { prID: pr.id, version: '1', threads: [{ threadID: answer.threadID, revisionID: diff.revisionID, question, oldPath: context.oldPath, newPath: context.newPath, anchor, answerCount: 1, state: 'completed', executionUnknown: false, persistence: 'saved' }] },
  detail: { prID: pr.id, version: '1', threadID: answer.threadID, revisionID: diff.revisionID, context, answers: [answer], persistence: 'saved', session: { state: 'unverified', reason: 'continuation-requires-verification' } },
  quiz: { prID: pr.id, version: '1', quiz: quiz.quiz, generation: { ...generation, quizID: digest('contract-next-quiz') } },
  checked: quiz.privateQuestions.map((item) => ({ prID: pr.id, version: '1', quizID: quiz.quiz.quizID, revisionID: diff.revisionID, questionID: item.questionID, choiceID: 'b', correct: false, correctChoiceID: item.correctChoiceID, explanation: item.explanation, evidence: item.evidence })),
  semantic: { prID: pr.id, version: '1', review: semantic, generation: { ...generation, generationID: digest('contract-semantic-generation'), reviewID: digest('contract-next-semantic') } },
}

/**
 * Checks a public payload with the actual backend structs and validators.
 * @param {unknown} value Public transport payload.
 * @param {boolean} valid Whether Go must accept the payload.
 */
function check(value, valid) {
  const result = spawnSync('go', ['run', './web/tests/contracts'], { cwd: root, input: JSON.stringify(value), encoding: 'utf8', timeout: 60000 })
  if (result.error || (result.status === 0) !== valid) throw new Error('Go public contract check did not match the expected result.')
}

check(payload, true)
const leaked = structuredClone(payload)
leaked.quiz.quiz.questions[0].correctChoiceID = 'a'
check(leaked, false)
const invalidRange = structuredClone(payload)
invalidRange.semantic.review.groups[0].ranges[0].fileID = digest('foreign-file')
check(invalidRange, false)
const staleRevision = structuredClone(payload)
staleRevision.quiz.quiz.revision.headSHA = 'e'.repeat(40)
check(staleRevision, false)
console.log('Go public contracts passed: valid fixtures, withheld keys, original evidence and revision identity.')
