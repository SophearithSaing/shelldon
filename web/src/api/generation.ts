import { json } from './client'
import type { Revision } from './contracts/source'
import type { GenerationFeature, GenerationRead, GenerationStatus, Quiz, QuizChecked } from './contracts/generation'

/**
 * Reads a saved quiz or semantic result without inference.
 * @param prID Registered PR.
 * @param feature Independent generation feature.
 * @param signal Read cancellation.
 * @returns Saved content and transient status.
 */
export function readGeneration<T extends GenerationRead>(prID: string, feature: GenerationFeature, signal?: AbortSignal): Promise<T> {
  return json(`/api/reviews/${prID}/${feature}`, { signal })
}

/**
 * Starts explicit generation against an exact predecessor.
 * @param prID Registered PR.
 * @param feature Independent generation feature.
 * @param revision Pinned comparison.
 * @param expectedVersion Last explicitly read saved version.
 * @returns Admission status, not saved completion.
 */
export function generate(prID: string, feature: GenerationFeature, revision: Revision, expectedVersion: string): Promise<GenerationStatus> {
  return json(`/api/reviews/${prID}/${feature}/generations`, { method: 'POST', body: JSON.stringify({ revision, expectedVersion }) })
}

/**
 * Reads or requests cancellation of an exact generation.
 * @param prID Registered PR.
 * @param feature Independent generation feature.
 * @param status Exact admitted generation.
 * @param cancel Whether to request cancellation.
 * @param signal Observation cancellation.
 * @returns Current scoped status.
 */
export function generationStatus(prID: string, feature: GenerationFeature, status: GenerationStatus, cancel = false, signal?: AbortSignal): Promise<GenerationStatus> {
  return json(`/api/reviews/${prID}/${feature}/generations/${status.generationID}${cancel ? '/cancel' : ''}`, { ...(cancel ? { method: 'POST', body: JSON.stringify({ revisionID: status.revisionID }) } : {}), signal })
}

/**
 * Checks one saved question without inference or saved attempts.
 * @param prID Registered PR.
 * @param quiz Exact saved quiz.
 * @param questionID Explicitly checked question.
 * @param choiceID Selected choice.
 * @param signal Read cancellation.
 * @returns Only that question's key, explanation and evidence.
 */
export function checkQuiz(prID: string, quiz: Quiz, questionID: string, choiceID: string, signal?: AbortSignal): Promise<QuizChecked> {
  return json(`/api/reviews/${prID}/quiz/${quiz.quizID}/questions/${questionID}/check`, { method: 'POST', body: JSON.stringify({ revisionID: quiz.revisionID, choiceID }), signal })
}
