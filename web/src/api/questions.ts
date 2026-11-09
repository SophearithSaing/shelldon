import { json, request } from './client'
import type { Answer, Anchor, ThreadList, ThreadDetail } from './contracts/questions'
import type { Revision } from './contracts/source'
import { sameAnchor } from './selection'

/**
 * Admits one explicitly submitted source question.
 * @param prID Registered PR identity.
 * @param revision Original comparison.
 * @param anchor Selected range.
 * @param question Submitted text.
 * @returns Admitted answer, not completion proof.
 */
export function askQuestion(prID: string, revision: Revision, anchor: Anchor, question: string): Promise<Answer> {
  return json(`/api/reviews/${prID}/questions`, { method: 'POST', body: JSON.stringify({ revision, anchor, question }) })
}

/**
 * Admits a new question in an existing original thread.
 * @param answer Existing thread scope.
 * @param question New follow-up text.
 * @returns Admitted answer.
 */
export function askFollowup(answer: Answer, question: string): Promise<Answer> {
  return json(`/api/reviews/${answer.prID}/threads/${answer.threadID}/answers`, { method: 'POST', body: JSON.stringify({ revisionID: answer.revisionID, question }) })
}

/**
 * Reads saved thread navigation without source or inference.
 * @param prID Registered PR.
 * @param signal Read cancellation.
 * @returns Saved thread list.
 */
export function readThreads(prID: string, signal?: AbortSignal): Promise<ThreadList> {
  return json(`/api/reviews/${prID}/threads`, { signal })
}

/**
 * Reads one saved transcript without resubmitting input.
 * @param prID Registered PR.
 * @param threadID Saved thread.
 * @param signal Read cancellation.
 * @returns Saved context and transcript.
 */
export function readThread(prID: string, threadID: string, signal?: AbortSignal): Promise<ThreadDetail> {
  return json(`/api/reviews/${prID}/threads/${threadID}`, { signal })
}

/**
 * Requests a targeted answer operation without prompt replay.
 * @param answer Exact answer scope.
 * @param action Stop acknowledgement or persistence-only retry.
 * @returns Current answer snapshot.
 */
export function answerAction(answer: Answer, action: 'stop' | 'save'): Promise<Answer> {
  return json(`/api/reviews/${answer.prID}/threads/${answer.threadID}/answers/${answer.answerID}/${action}`, { method: 'POST', body: JSON.stringify({ revisionID: answer.revisionID }) })
}

/**
 * Observes cumulative SSE snapshots of one existing answer; never admits work.
 * @param answer Exact answer scope.
 * @param signal Observation cancellation.
 * @param receive Snapshot receiver.
 */
export async function observeAnswer(answer: Answer, signal: AbortSignal, receive: (snapshot: Answer) => void): Promise<void> {
  const response = await request(`/api/reviews/${answer.prID}/threads/${answer.threadID}/answers/${answer.answerID}/events`, { method: 'POST', body: JSON.stringify({ revisionID: answer.revisionID }), signal })
  if (!response.headers.get('content-type')?.startsWith('text/event-stream') || !response.body) throw new Error('Invalid answer stream.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replaceAll('\r\n', '\n')
      if (buffer.length > 2 << 20) throw new Error('Answer event exceeds limits.')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (event.split('\n').includes('event: answer')) {
          const data = event.split('\n').filter((line): boolean => line.startsWith('data:')).map((line): string => line.slice(5).trimStart()).join('\n')
          const snapshot = JSON.parse(data) as Answer
          if (snapshot.answerID !== answer.answerID || snapshot.threadID !== answer.threadID || snapshot.prID !== answer.prID || snapshot.revisionID !== answer.revisionID || snapshot.question !== answer.question || snapshot.reference?.revisionID !== answer.revisionID || !sameAnchor(snapshot.reference.anchor, answer.reference.anchor) || typeof snapshot.text !== 'string' || !['pending', 'streaming', 'completed', 'failed', 'interrupted'].includes(snapshot.state)) throw new Error('Mismatched answer stream.')
          receive(snapshot)
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    await reader.cancel().catch((): void => {})
    reader.releaseLock()
  }
}
