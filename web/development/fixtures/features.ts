import type { Evidence, Quiz, QuizQuestion, SemanticReview } from '../../src/api/contracts/generation.ts'
import type { SourceDiff } from '../../src/api/contracts/source.ts'

export interface PrivateQuestion extends QuizQuestion {
  correctChoiceID: string
  explanation: string
  evidence: Evidence[]
}

/**
 * Derives a compact original-source quote from one pinned changed range.
 * @param diff Original complete diff.
 * @param fileIndex Supporting file index.
 * @param start First head line.
 * @param end Last head line.
 * @returns Supporting original range and literal lines.
 */
function evidence(diff: SourceDiff, fileIndex: number, start: number, end: number): Evidence {
  const file = diff.files[fileIndex]!
  const hunk = file.hunks![0]!
  return { anchor: { fileID: file.id, hunkID: hunk.id, side: 'new', start, end }, oldPath: file.oldPath, newPath: file.newPath, selected: hunk.lines.filter((line): boolean => line.newLine !== undefined && line.newLine >= start && line.newLine <= end) }
}

/**
 * Builds five private questions for the current backend's five-question contract.
 * @param diff Original pinned source.
 * @param quizID Generated quiz identity.
 * @returns Separate public set and private grading records.
 */
export function quizFixture(diff: SourceDiff, quizID: string): { quiz: Quiz; privateQuestions: PrivateQuestion[] } {
  const prompts = [
    ['What happens when two callers refresh at the same time?', 'Both await the same in-flight refresh operation.', 'Each always starts a separate network request.', 'The second caller receives the cached session immediately.', 'The first refresh is cancelled.', 'The early return shares the promise while the refresh is in flight.'],
    ['Why is inFlight cleared inside finally?', 'Cleanup must run after either success or failure.', 'It retries the request automatically.', 'It makes the request synchronous.', 'It prevents all future refreshes.', 'finally clears the shared reference regardless of the request outcome, allowing a later explicit retry.'],
    ['When does the refreshed session enter the store?', 'After requestToken resolves successfully.', 'Before the request starts.', 'Whenever a second caller arrives.', 'Only when the page reloads.', 'The then handler writes the returned session and preserves that same value as the promise result.'],
    ['What does the concurrency test check?', 'One request is shared and both callers receive the same result.', 'Two independent requests return different sessions.', 'A failed request is silently converted to success.', 'All later requests are permanently blocked.', 'The test asserts a single requestToken call and equal results for the two concurrent callers.'],
    ['What does the updated store allow?', 'Clearing the current session back to null.', 'Persisting sessions to Git.', 'Mutating the PR base branch.', 'Starting refreshes automatically on every read.', 'The setter now accepts null and clear explicitly resets the in-memory session.'],
  ]
  const ranges: [number, number, number][] = [[0, 18, 18], [0, 25, 27], [0, 21, 24], [2, 4, 10], [1, 9, 14]]
  const privateQuestions = prompts.map((values, index): PrivateQuestion => ({ questionID: `q${index + 1}`, prompt: values[0]!, choices: values.slice(1, 5).map((text, choice): { choiceID: string; text: string } => ({ choiceID: 'abcd'[choice]!, text })), correctChoiceID: 'a', explanation: values[5]!, evidence: [evidence(diff, ...ranges[index]!)] }))
  return { quiz: { quizID, revision: diff.revision, revisionID: diff.revisionID, questions: privateQuestions.map((question): QuizQuestion => ({ questionID: question.questionID, prompt: question.prompt, choices: question.choices })) }, privateQuestions }
}

/**
 * Organizes nonoverlapping changed ranges while retaining complete source inventory.
 * @param diff Original source.
 * @param reviewID Saved result identity.
 * @returns Three intent groups with exact original anchors.
 */
export function semanticFixture(diff: SourceDiff, reviewID: string): SemanticReview {
  return { reviewID, diff: structuredClone(diff), groups: [
    { groupID: 'g1', title: 'One refresh, many callers', explanation: 'The shared in-flight promise and concurrency test describe a single refresh operation for overlapping callers.', ranges: [evidence(diff, 0, 15, 24).anchor, evidence(diff, 2, 4, 10).anchor] },
    { groupID: 'g2', title: 'Recover after a failed refresh', explanation: 'Clearing the in-flight reference in finally allows an explicit later retry. The failure test checks that boundary.', ranges: [evidence(diff, 0, 25, 29).anchor, evidence(diff, 2, 12, 17).anchor] },
    { groupID: 'g3', title: 'Reset the session store', explanation: 'The session setter and clear operation now support returning the store to its empty state.', ranges: [evidence(diff, 1, 9, 14).anchor] },
  ] }
}
