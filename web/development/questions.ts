import { randomBytes } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import type { Answer, Anchor, QuestionContext, ThreadDetail, ThreadList } from '../src/api/contracts/questions.ts'
import { selectionContext } from '../src/api/selection.ts'
import { body, RequestError, sameRevision, scenario, send } from './http.ts'
import type { DevelopmentRequest } from './http.ts'

interface Thread {
  context: QuestionContext
  runtime: Answer[]
  saved: Answer[]
}

interface ReviewThreads {
  version: bigint
  threads: Map<string, Thread>
}

interface QuestionAPI {
  handle: (context: DevelopmentRequest) => Promise<boolean>
  close: () => void
}

/**
 * Creates private in-memory development conversations with independent execution/observation.
 * @returns Scoped handlers and owned-worker cleanup.
 */
export function createQuestionAPI(): QuestionAPI {
  const reviews = new Map<string, ReviewThreads>()
  const listeners = new Map<string, Set<ServerResponse>>()
  const timers = new Set<ReturnType<typeof setInterval>>()

  /**
   * Gets one PR's saved-history container without source work.
   * @param prID Registered PR.
   * @returns PR-local history.
   */
  function history(prID: string): ReviewThreads {
    if (!reviews.has(prID)) reviews.set(prID, { version: 0n, threads: new Map() })
    return reviews.get(prID)!
  }

  /**
   * Publishes a cumulative answer snapshot to current observers.
   * @param answer Existing answer.
   */
  function publish(answer: Answer): void {
    for (const response of listeners.get(answer.answerID) ?? []) {
      if (!response.destroyed) response.write(`event: answer\ndata: ${JSON.stringify(answer)}\n\n`)
      if (answer.state !== 'pending' && answer.state !== 'streaming') response.end()
    }
  }

  /**
   * Saves a terminal answer without sending another question.
   * @param store PR history.
   * @param thread Original thread.
   * @param answer Runtime answer.
   */
  function save(store: ReviewThreads, thread: Thread, answer: Answer): void {
    store.version++
    answer.persistence = 'saved'
    answer.savedVersion = String(store.version)
    const index = thread.saved.findIndex((item): boolean => item.answerID === answer.answerID)
    thread.saved[index] = structuredClone(answer)
  }

  /**
   * Runs bounded answer production independently of observer connections.
   * @param store PR history.
   * @param thread Original thread.
   * @param answer Admitted answer.
   * @param mode Explicit test scenario.
   */
  function execute(store: ReviewThreads, thread: Thread, answer: Answer, mode: string): void {
    const text = thread.runtime.length > 1
      ? 'The same original comparison still applies. The shared promise gives concurrent callers one result; clearing it in finally allows a later call to retry after either success or failure. The tests exercise both boundaries. Review the original selected lines alongside that behavior.'
      : 'The change introduces a single in-flight refresh shared by concurrent callers. The first caller starts requestToken; later callers receive the same promise. finally clears the shared reference after both success and failure, so a rejected request does not prevent a future retry. The related test verifies one request and a shared result. This explains the change, rather than proving it safe.'
    let offset = 0
    const timer = setInterval((): void => {
      answer.state = 'streaming'
      offset += 28
      answer.text = text.slice(0, offset)
      if (answer.stopRequested || offset >= text.length || mode === 'answer-failed' && offset > 100 || mode === 'answer-unknown' && offset > 100) {
        clearInterval(timer)
        timers.delete(timer)
        answer.state = answer.stopRequested || mode === 'answer-unknown' ? 'interrupted' : mode === 'answer-failed' ? 'failed' : 'completed'
        answer.executionUnknown = mode === 'answer-unknown'
        if (mode === 'answer-failed') answer.failureCode = 'execution-failed'
        if (answer.executionUnknown) answer.failureCode = 'execution-uncertain'
        if (mode === 'answer-save-failed') answer.persistence = 'failed'
        else save(store, thread, answer)
      }
      publish(answer)
    }, mode === 'answer-slow' ? 300 : 90)
    timers.add(timer)
  }

  /**
   * Handles supported question/history routes with exact original scope.
   * @param context Registered request context.
   * @returns Whether the route belongs to conversations.
   */
  async function handle(context: DevelopmentRequest): Promise<boolean> {
    const { request, response, pr, path } = context
    if (path !== '/questions' && !path.startsWith('/threads')) return false
    const store = history(pr.id)
    if (path === '/threads' && request.method === 'GET') {
      const result: ThreadList = { prID: pr.id, version: String(store.version), threads: [...store.threads.entries()].map(([threadID, thread]): ThreadList['threads'][number] => {
        const first = thread.saved[0]!
        const latest = thread.saved.at(-1)!
        return { threadID, revisionID: first.revisionID, question: first.question.slice(0, 256), oldPath: thread.context.oldPath, newPath: thread.context.newPath, anchor: thread.context.anchor, answerCount: thread.saved.length, state: latest.state, executionUnknown: latest.executionUnknown, persistence: 'saved' }
      }) }
      send(response, 200, result)
      return true
    }
    const match = /^\/threads\/([a-f0-9]{64})(?:\/answers(?:\/([a-f0-9]{64})\/(events|stop|save))?)?$/.exec(path)
    const thread = match ? store.threads.get(match[1]!) : undefined
    if (match && !thread) throw new RequestError(404, 'Question thread not found in this PR.')
    if (match && path === `/threads/${match[1]}` && request.method === 'GET') {
      const latest = thread!.runtime.at(-1)!
      const state = latest.executionUnknown ? 'unknown' : latest.persistence === 'failed' ? 'unavailable' : ['pending', 'streaming'].includes(latest.state) ? 'busy' : 'ready'
      const detail: ThreadDetail = { prID: pr.id, version: String(store.version), threadID: match[1]!, revisionID: thread!.context.revisionID, context: thread!.context, answers: thread!.saved, persistence: latest.persistence ?? 'saved', session: { state, reason: state === 'ready' ? 'original-session-verified' : state === 'busy' ? 'question-active' : state === 'unknown' ? 'execution-uncertain' : 'answer-not-saved' } }
      send(response, 200, detail)
      return true
    }
    if ((path === '/questions' || match && path.endsWith('/answers')) && request.method === 'POST') {
      const input = await body(request, path === '/questions' ? ['revision', 'anchor', 'question'] : ['revisionID', 'question'], 24 << 10)
      if (typeof input.question !== 'string' || !input.question.trim() || Buffer.byteLength(input.question) > 16384 || input.question.includes('\0')) throw new RequestError(400, 'Question must be nonblank UTF-8 text within 16384 bytes.')
      let pinned: QuestionContext | null
      if (thread) {
        if (input.revisionID !== thread.context.revisionID) throw new RequestError(409, 'Follow-up must retain its original revision.')
        pinned = thread.context
      } else {
        const source = context.sources.find((diff): boolean => sameRevision(input.revision, diff))
        if (!source) throw new RequestError(410, 'Original pinned source is unavailable.')
        if (!sameRevision(input.revision, source)) throw new RequestError(409, 'Question revision is stale.')
        if (!input.anchor || typeof input.anchor !== 'object' || Object.keys(input.anchor).some((key): boolean => !['kind', 'fileID', 'hunkID', 'side', 'start', 'end'].includes(key))) throw new RequestError(400, 'Invalid question anchor.')
        pinned = selectionContext(source, input.anchor as Anchor)
      }
      if (!pinned) throw new RequestError(400, 'Selection does not match the pinned text diff.')
      for (const existing of store.threads.values()) {
        if (existing.context.revisionID !== pinned.revisionID) continue
        const latest = existing.runtime.at(-1)!
        if (latest.executionUnknown) throw new RequestError(409, 'Question execution is uncertain; the shared session remains unavailable.')
        if (latest.persistence === 'failed') throw new RequestError(409, 'Retry saving before continuing; no question was sent.')
        if (['pending', 'streaming'].includes(latest.state)) throw new RequestError(409, 'Another question is active in this PR revision; nothing was queued.')
      }
      const threadID = match?.[1] ?? randomBytes(32).toString('hex')
      const current = thread ?? { context: structuredClone(pinned), runtime: [], saved: [] }
      const answer: Answer = { answerID: randomBytes(32).toString('hex'), threadID, prID: pr.id, revisionID: pinned.revisionID, question: input.question, text: '', state: 'pending', stopRequested: false, executionUnknown: false, reference: { revisionID: pinned.revisionID, anchor: pinned.anchor, oldPath: pinned.oldPath, newPath: pinned.newPath }, persistence: 'saved', savedVersion: String(++store.version) }
      current.runtime.push(answer)
      current.saved.push(structuredClone(answer))
      store.threads.set(threadID, current)
      const mode = scenario(request)
      send(response, mode === 'admission-uncertain' ? 500 : 202, mode === 'admission-uncertain' ? { error: 'Question admission is uncertain. Read saved Questions before taking further action.' } : answer)
      execute(store, current, answer, mode)
      return true
    }
    if (match?.[2] && request.method === 'POST') {
      const input = await body(request, ['revisionID'], 1024)
      const answer = thread!.runtime.find((item): boolean => item.answerID === match[2])
      if (!answer || input.revisionID !== answer.revisionID) throw new RequestError(404, 'Answer not found in this original revision.')
      if (match[3] === 'events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
        response.write(`event: answer\ndata: ${JSON.stringify(answer)}\n\n`)
        if (!['pending', 'streaming'].includes(answer.state)) response.end()
        else {
          if (!listeners.has(answer.answerID)) listeners.set(answer.answerID, new Set())
          listeners.get(answer.answerID)!.add(response)
          response.on('close', (): void => { listeners.get(answer.answerID)?.delete(response) })
        }
      } else if (match[3] === 'stop') {
        if (['pending', 'streaming'].includes(answer.state)) answer.stopRequested = true
        send(response, 202, answer)
      } else {
        if (['pending', 'streaming'].includes(answer.state)) throw new RequestError(409, 'Answer is still active; saving is unavailable.')
        save(store, thread!, answer)
        send(response, 200, answer)
      }
      return true
    }
    throw new RequestError(405, 'Method not allowed.')
  }

  /** Stops owned development workers and observers when Vite closes. */
  function close(): void {
    for (const timer of timers) clearInterval(timer)
    for (const responses of listeners.values()) for (const response of responses) response.end()
  }

  return { handle, close }
}
