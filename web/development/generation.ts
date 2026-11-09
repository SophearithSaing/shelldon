import { randomBytes } from 'node:crypto'
import type { GenerationFeature, GenerationRead, GenerationStatus, QuizChecked, QuizRead } from '../src/api/contracts/generation.ts'
import type { SourceDiff } from '../src/api/contracts/source.ts'
import type { PrivateQuestion } from './fixtures/features.ts'
import { quizFixture, semanticFixture } from './fixtures/features.ts'
import { body, RequestError, sameRevision, scenario, send } from './http.ts'
import type { DevelopmentRequest } from './http.ts'

interface Store {
  read: GenerationRead
  privateQuestions: PrivateQuestion[]
  blocked: boolean
}

interface GenerationAPI {
  handle: (context: DevelopmentRequest) => Promise<boolean>
  close: () => void
}

/**
 * Creates separately scoped quiz/semantic generation with backend-compatible public projections.
 * @returns Independent handlers and owned-worker cleanup.
 */
export function createGenerationAPI(): GenerationAPI {
  const stores = new Map<string, Store>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  /**
   * Gets one feature's saved state without requiring source.
   * @param prID Registered PR.
   * @param feature Independent feature.
   * @returns Feature-local state.
   */
  function storeFor(prID: string, feature: GenerationFeature): Store {
    const key = `${prID}:${feature}`
    if (!stores.has(key)) stores.set(key, { read: feature === 'quiz' ? { prID, version: '0', quiz: null, generation: null } : { prID, version: '0', review: null, generation: null }, privateQuestions: [], blocked: false })
    return stores.get(key)!
  }

  /**
   * Advances accepted work without requiring an observer.
   * @param store Original feature state.
   * @param source Pinned comparison.
   * @param feature Independent feature.
   * @param status Exact accepted generation.
   * @param mode Opt-in test scenario.
   * @param step Next execution step.
   */
  function advance(store: Store, source: SourceDiff, feature: GenerationFeature, status: GenerationStatus, mode: string, step = 0): void {
    const timer = setTimeout((): void => {
      timers.delete(timer)
      status.sequence = String(BigInt(status.sequence) + 1n)
      if (status.cancelRequested) { status.state = 'cancelled'; return }
      if (step === 3) {
        if (mode === 'generation-failed' || mode === 'generation-save-uncertain' || mode === 'generation-unknown') {
          status.state = mode === 'generation-unknown' ? 'unknown' : 'failed'
          status.executionUnknown = mode === 'generation-unknown'
          status.failureCode = mode === 'generation-failed' ? 'execution-failed' : mode === 'generation-unknown' ? 'execution-uncertain' : 'save-uncertain'
          store.blocked = mode !== 'generation-failed'
          return
        }
        const version = String(BigInt(store.read.version) + 1n)
        if (feature === 'quiz') {
          const result = quizFixture(source, status.quizID!)
          store.privateQuestions = result.privateQuestions
          store.read = { prID: status.prID, version, quiz: result.quiz, generation: status }
        } else store.read = { prID: status.prID, version, review: semanticFixture(source, status.reviewID!), generation: status }
        status.state = 'completed'
        status.savedVersion = version
        return
      }
      status.state = (['generating', 'validating', 'saving'] as const)[step]!
      advance(store, source, feature, status, mode, step + 1)
    }, 350)
    timers.add(timer)
  }

  /**
   * Handles finite saved reads, explicit generation/cancel and private quiz checking.
   * @param context Registered HTTP request.
   * @returns Whether the route belongs to these features.
   */
  async function handle(context: DevelopmentRequest): Promise<boolean> {
    const { request, response, pr, path } = context
    const route = /^\/(quiz|semantic-review)(.*)$/.exec(path)
    if (!route) return false
    const feature = route[1] as GenerationFeature
    const suffix = route[2]!
    const store = storeFor(pr.id, feature)
    if (!suffix && request.method === 'GET') {
      if (store.read.generation?.failureCode === 'save-uncertain') store.blocked = false
      send(response, 200, store.read)
      return true
    }
    if (suffix === '/generations' && request.method === 'POST') {
      const input = await body(request, ['revision', 'expectedVersion'])
      const source = context.sources.find((diff): boolean => sameRevision(input.revision, diff))
      if (typeof input.expectedVersion !== 'string' || !/^(0|[1-9][0-9]*)$/.test(input.expectedVersion) || BigInt(input.expectedVersion) > 18446744073709551615n) throw new RequestError(400, 'Invalid saved version.')
      if (input.expectedVersion !== store.read.version) throw new RequestError(409, 'Saved result changed. Refresh saved state explicitly.')
      if (!source || !sameRevision(input.revision, source)) throw new RequestError(410, 'Original pinned source is unavailable; load source explicitly.')
      if (source.files.length < 3 || source.files.slice(0, 3).some((file): boolean => file.kind !== 'text')) throw new RequestError(422, 'This comparison has no supported generation fixture.')
      if (store.blocked) throw new RequestError(409, 'Generation outcome is uncertain. Refresh saved state; do not resend.')
      if (store.read.generation && ['pending', 'generating', 'validating', 'saving'].includes(store.read.generation.state)) throw new RequestError(409, 'Another generation is active; nothing was queued.')
      const status: GenerationStatus = { prID: pr.id, generationID: randomBytes(32).toString('hex'), ...(feature === 'quiz' ? { quizID: randomBytes(32).toString('hex') } : { reviewID: randomBytes(32).toString('hex') }), revisionID: source.revisionID, sequence: '1', state: 'pending', cancelRequested: false, executionUnknown: false }
      store.read.generation = status
      const mode = scenario(request)
      send(response, mode === 'generation-admission-uncertain' ? 500 : 202, mode === 'generation-admission-uncertain' ? { error: 'Generation admission is uncertain. Refresh saved state explicitly.' } : status)
      advance(store, structuredClone(source), feature, status, mode)
      return true
    }
    const generation = /^\/generations\/([a-f0-9]{64})(\/cancel)?$/.exec(suffix)
    if (generation) {
      const status = store.read.generation
      if (!status || status.generationID !== generation[1]) throw new RequestError(404, 'Generation not found in this PR.')
      if (!generation[2] && request.method === 'GET') send(response, 200, status)
      else if (generation[2] && request.method === 'POST') {
        const input = await body(request, ['revisionID'], 1024)
        if (input.revisionID !== status.revisionID) throw new RequestError(404, 'Generation not found in this revision.')
        if (['pending', 'generating', 'validating', 'saving'].includes(status.state)) status.cancelRequested = true
        send(response, 202, status)
      } else throw new RequestError(405, 'Method not allowed.')
      return true
    }
    const check = /^\/([a-f0-9]{64})\/questions\/(q[1-5])\/check$/.exec(suffix)
    if (feature === 'quiz' && check && request.method === 'POST') {
      const input = await body(request, ['revisionID', 'choiceID'], 1024)
      const quiz = (store.read as QuizRead).quiz
      if (!quiz || quiz.quizID !== check[1] || quiz.revisionID !== input.revisionID) throw new RequestError(409, 'This saved quiz changed. Refresh saved quiz explicitly.')
      const question = store.privateQuestions.find((item): boolean => item.questionID === check[2])!
      if (typeof input.choiceID !== 'string' || !question.choices.some((choice): boolean => choice.choiceID === input.choiceID)) throw new RequestError(400, 'Choose one of the saved alternatives.')
      const result: QuizChecked = { prID: pr.id, version: store.read.version, quizID: quiz.quizID, revisionID: quiz.revisionID, questionID: question.questionID, choiceID: input.choiceID, correct: input.choiceID === question.correctChoiceID, correctChoiceID: question.correctChoiceID, explanation: question.explanation, evidence: question.evidence }
      send(response, 200, result)
      return true
    }
    throw new RequestError(405, 'Method not allowed.')
  }

  /** Stops only owned development generation workers on server shutdown. */
  function close(): void { for (const timer of timers) clearTimeout(timer) }

  return { handle, close }
}
