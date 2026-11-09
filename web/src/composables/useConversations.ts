import { computed, inject, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import { APIError, errorMessage } from '../api/client'
import { answerAction, askFollowup, askQuestion, observeAnswer, readThread, readThreads } from '../api/questions'
import { sameAnchor, selectionContext } from '../api/selection'
import type { Answer, Anchor, QuestionContext, SourceReference, ThreadDetail, ThreadList } from '../api/contracts/questions'
import type { SourceDiff } from '../api/contracts/source'
import { setPageGuard } from './navigation'

export interface InitialDraft {
  context: QuestionContext
  text: string
  paused: boolean
  sending: boolean
  uncertain: boolean
  error: string
}

export interface ConversationThread {
  id: string
  context: QuestionContext
  answers: Answer[]
  draft: string
  inline: boolean
  sending: boolean
  uncertain: boolean
  error: string
  observationLost: boolean
  session: ThreadDetail['session']
}

export interface SourceNavigation extends Omit<SourceReference, 'anchor'> {
  fileID: string
  anchor?: Anchor
  focusDraft?: boolean
  focusThread?: string
}

export interface Conversations {
  selection: ShallowRef<QuestionContext | null>
  draft: Ref<InitialDraft | null>
  threads: Ref<ConversationThread[]>
  selected: Ref<string>
  panelCollapsed: Ref<boolean>
  list: ShallowRef<ThreadList | null>
  historyPending: Ref<boolean>
  historyError: Ref<string>
  error: Ref<string>
  sourceRequest: ShallowRef<SourceNavigation | null>
  hasPageState: ComputedRef<boolean>
  select: (anchor: Anchor) => boolean
  compose: () => void
  resume: () => void
  discard: () => void
  submit: () => Promise<void>
  followup: (thread: ConversationThread) => Promise<void>
  action: (thread: ConversationThread, action: 'stop' | 'save') => Promise<void>
  observe: (thread: ConversationThread) => void
  refreshList: () => Promise<void>
  openSaved: (threadID: string) => Promise<void>
  openPanel: (thread: ConversationThread) => void
  showInline: (thread: ConversationThread) => void
  navigate: (reference: SourceReference, ask?: boolean) => boolean
  openFile: (fileID: string, revisionID: string) => boolean
  matching: (reference: SourceReference) => boolean
  unavailable: (thread: ConversationThread) => boolean
  busy: (revisionID: string) => boolean
}

export const ConversationsKey: InjectionKey<Conversations> = Symbol('conversations')

/**
 * Gets the canonical PR conversation coordinator for reusable source/transcript components.
 * @returns Owning PR coordinator.
 */
export function useConversationContext(): Conversations {
  const state = inject(ConversationsKey)
  if (!state) throw new Error('Conversation components require a review workspace.')
  return state
}

/**
 * Distinguishes a known terminal answer from an active one.
 * @param answer Answer snapshot.
 * @returns Whether execution has a terminal presentation state.
 */
export function terminal(answer: Answer): boolean {
  return answer.state !== 'pending' && answer.state !== 'streaming'
}

/**
 * Owns canonical threads, original drafts and exact-answer observation for one PR page.
 * @param prID Registered PR.
 * @param source Displayed comparison.
 * @param sourcePending Source replacement lock.
 * @returns Shared conversation state and explicit operations.
 */
export function useConversations(prID: string, source: ShallowRef<SourceDiff | null>, sourcePending: Ref<boolean>): Conversations {
  const selection = shallowRef<QuestionContext | null>(null)
  const draft = ref<InitialDraft | null>(null)
  const threads = ref<ConversationThread[]>([])
  const selected = ref('')
  const panelCollapsed = ref(true)
  const list = shallowRef<ThreadList | null>(null)
  const historyPending = ref(false)
  const historyError = ref('')
  const error = ref('')
  const sourceRequest = shallowRef<SourceNavigation | null>(null)
  const blocked = new Set<string>()
  const observers = new Map<string, AbortController>()
  const lifetime = new AbortController()
  let listRequest = 0
  let detailRequest = 0

  /**
   * Checks page-local ownership; cross-tab exclusion remains backend-authoritative.
   * @param revisionID Original comparison identity.
   * @returns Whether this page cannot send on that shared revision.
   */
  function busy(revisionID: string): boolean {
    return blocked.has(revisionID) || !!draft.value?.sending && draft.value.context.revisionID === revisionID || threads.value.some((thread): boolean => {
      const latest = thread.answers.at(-1)
      return thread.context.revisionID === revisionID && (thread.sending || thread.uncertain || !!latest && (!terminal(latest) || latest.persistence === 'failed' || latest.executionUnknown && thread.session.state === 'unknown'))
    })
  }

  /**
   * Verifies that original-source navigation still targets the displayed comparison.
   * @param reference Original source anchor.
   * @returns Whether the exact range still belongs to loaded source.
   */
  function matching(reference: SourceReference): boolean {
    return !!source.value && source.value.revisionID === reference.revisionID && selectionContext(source.value, reference.anchor) !== null
  }

  /**
   * Checks terminal/session boundaries before an explicit follow-up.
   * @param thread Original thread.
   * @returns Whether continuation is currently unavailable.
   */
  function unavailable(thread: ConversationThread): boolean {
    return !thread.answers.length || thread.uncertain || thread.sending || busy(thread.context.revisionID) || ['busy', 'unknown', 'unavailable'].includes(thread.session.state)
  }

  /**
   * Selects source without replacing a retained initial draft.
   * @param anchor Exact displayed selection.
   * @returns Whether this selection was accepted without replacing another draft.
   */
  function select(anchor: Anchor): boolean {
    error.value = ''
    if (draft.value) { error.value = 'Resume or discard the retained question before selecting another range.'; return false }
    if (sourcePending.value || !source.value) return false
    const context = selectionContext(source.value, anchor)
    if (!context) { error.value = 'Select changed text on one side within one hunk, or select the whole hunk.'; return false }
    selection.value = context
    return true
  }

  /** Opens the single initial composer without starting backend work. */
  function compose(): void {
    if (draft.value) { draft.value.paused = false; return }
    if (!selection.value || !matching(selection.value) || sourcePending.value) return
    draft.value = { context: selection.value, text: '', paused: false, sending: false, uncertain: false, error: '' }
  }

  /** Reopens the retained initial composer on its own original source. */
  function resume(): void {
    if (!draft.value || !matching(draft.value.context) || sourcePending.value) return
    draft.value.paused = false
    sourceRequest.value = { ...draft.value.context, fileID: draft.value.context.anchor.fileID, focusDraft: true }
  }

  /** Explicitly discards only page-memory input, never accepted execution. */
  function discard(): void {
    if (draft.value?.sending) return
    if (draft.value?.text && !window.confirm('Discard this unsent page draft? This does not cancel any accepted answer.')) return
    draft.value = null
    selection.value = null
    error.value = ''
  }

  /**
   * Updates the local navigation projection after a canonical answer changes.
   * @param thread Owning thread.
   * @param answer Latest runtime snapshot.
   */
  function project(thread: ConversationThread, answer: Answer): void {
    const version = answer.savedVersion ?? list.value?.version ?? '0'
    const current = list.value ?? { prID, version, threads: [] }
    const summary = { threadID: thread.id, revisionID: thread.context.revisionID, question: thread.answers[0]!.question.slice(0, 256), oldPath: thread.context.oldPath, newPath: thread.context.newPath, anchor: thread.context.anchor, answerCount: thread.answers.length, state: answer.state, executionUnknown: answer.executionUnknown, persistence: answer.persistence ?? 'saved' }
    const summaries = current.threads.filter((item): boolean => item.threadID !== thread.id)
    const index = current.threads.findIndex((item): boolean => item.threadID === thread.id)
    summaries.splice(index < 0 ? summaries.length : index, 0, summary)
    list.value = { prID, version: BigInt(version) > BigInt(current.version) ? version : current.version, threads: summaries }
  }

  /**
   * Merges cumulative snapshots without rolling live text back to an older saved read.
   * @param thread Owning canonical thread.
   * @param answer Scoped answer snapshot.
   */
  function merge(thread: ConversationThread, answer: Answer): void {
    if (answer.prID !== prID || answer.threadID !== thread.id || answer.revisionID !== thread.context.revisionID) throw new Error('Mismatched answer scope.')
    const index = thread.answers.findIndex((item): boolean => item.answerID === answer.answerID)
    const previous = thread.answers[index]
    if (previous && (terminal(previous) && !terminal(answer) || previous.text.length > answer.text.length || previous.savedVersion && answer.savedVersion && BigInt(previous.savedVersion) > BigInt(answer.savedVersion))) return
    if (previous?.stopRequested) answer = { ...answer, stopRequested: true }
    if (index < 0) thread.answers.push(answer)
    else thread.answers[index] = answer
    if (terminal(answer)) thread.session = answer.executionUnknown ? { state: 'unknown', reason: 'execution-uncertain' } : answer.persistence === 'failed' ? { state: 'unavailable', reason: 'answer-not-saved' } : { state: 'unverified', reason: 'continuation-requires-verification' }
    project(thread, answer)
  }

  /**
   * Observes only the latest existing answer with at most one observer per page.
   * @param thread Canonical thread.
   */
  function observe(thread: ConversationThread): void {
    const answer = thread.answers.at(-1)
    if (!answer || observers.has(answer.answerID) || lifetime.signal.aborted) return
    const controller = new AbortController()
    observers.set(answer.answerID, controller)
    thread.observationLost = false
    void observeAnswer(answer, controller.signal, (snapshot): void => {
      if (!lifetime.signal.aborted && !controller.signal.aborted) merge(thread, snapshot)
    }).then((): void => {
      if (!lifetime.signal.aborted && !controller.signal.aborted && !terminal(thread.answers.at(-1)!)) thread.observationLost = true
    }).catch((): void => {
      if (!lifetime.signal.aborted && !controller.signal.aborted) thread.observationLost = true
    }).finally((): void => { observers.delete(answer.answerID) })
  }

  /**
   * Verifies an admission before adding any visible transcript or clearing input.
   * @param answer Backend admission.
   * @param context Original selection.
   * @param text Submitted question.
   */
  function validateAdmission(answer: Answer, context: QuestionContext, text: string): void {
    if (!/^[a-f0-9]{64}$/.test(answer.answerID) || !/^[a-f0-9]{64}$/.test(answer.threadID) || answer.prID !== prID || answer.revisionID !== context.revisionID || answer.question !== text || answer.reference?.revisionID !== context.revisionID || !sameAnchor(answer.reference.anchor, context.anchor)) throw new Error('Uncertain question admission.')
  }

  /** Sends the initial draft once after an explicit user action. */
  async function submit(): Promise<void> {
    const initial = draft.value
    if (!initial || !initial.text.trim() || initial.sending || initial.uncertain || busy(initial.context.revisionID)) return
    const text = initial.text
    initial.sending = true
    initial.error = ''
    try {
      const answer = await askQuestion(prID, initial.context.revision, initial.context.anchor, text)
      if (lifetime.signal.aborted) return
      validateAdmission(answer, initial.context, text)
      const thread: ConversationThread = { id: answer.threadID, context: initial.context, answers: [answer], draft: '', inline: true, sending: false, uncertain: false, error: '', observationLost: false, session: { state: 'busy', reason: 'question-active' } }
      threads.value.push(thread)
      selected.value = thread.id
      project(thread, answer)
      draft.value = null
      selection.value = null
      observe(threads.value.at(-1)!)
    } catch (cause) {
      if (lifetime.signal.aborted) return
      initial.error = errorMessage(cause)
      if (!(cause instanceof APIError) || cause.status >= 500) { initial.uncertain = true; blocked.add(initial.context.revisionID); initial.error = 'Question admission is uncertain. Do not resend. Open Questions and refresh saved history to inspect what was accepted.' }
    } finally { initial.sending = false }
  }

  /**
   * Sends a new follow-up on its original thread without replacing its binding.
   * @param thread Canonical thread.
   */
  async function followup(thread: ConversationThread): Promise<void> {
    if (!thread.draft.trim() || unavailable(thread)) return
    const text = thread.draft
    thread.sending = true
    thread.error = ''
    try {
      const answer = await askFollowup(thread.answers.at(-1)!, text)
      if (lifetime.signal.aborted) return
      validateAdmission(answer, thread.context, text)
      if (answer.threadID !== thread.id) throw new Error('Mismatched follow-up thread.')
      merge(thread, answer)
      if (thread.draft === text) thread.draft = ''
      observe(thread)
    } catch (cause) {
      if (lifetime.signal.aborted) return
      thread.error = errorMessage(cause)
      if (!(cause instanceof APIError) || cause.status >= 500) { thread.uncertain = true; thread.error = 'Follow-up admission is uncertain. Do not resend; refresh the saved thread to inspect accepted history.' }
    } finally { thread.sending = false }
  }

  /**
   * Requests targeted Stop or persistence-only retry without replaying a prompt.
   * @param thread Canonical thread.
   * @param operation Exact-answer action.
   */
  async function action(thread: ConversationThread, operation: 'stop' | 'save'): Promise<void> {
    const answer = thread.answers.at(-1)
    if (!answer) return
    thread.error = ''
    try {
      const result = await answerAction(answer, operation)
      if (result.answerID !== answer.answerID || result.question !== answer.question || !sameAnchor(result.reference?.anchor, answer.reference.anchor)) throw new Error('Mismatched answer acknowledgement.')
      if (!lifetime.signal.aborted) merge(thread, result)
    } catch (cause) { if (!lifetime.signal.aborted) thread.error = errorMessage(cause) }
  }

  /** Explicitly refreshes bounded saved navigation, retaining live transcripts and drafts. */
  async function refreshList(): Promise<void> {
    const request = ++listRequest
    historyPending.value = true
    historyError.value = ''
    try {
      const result = await readThreads(prID, lifetime.signal)
      if (lifetime.signal.aborted || request !== listRequest) return
      if (result.prID !== prID || !/^(0|[1-9][0-9]*)$/.test(result.version) || !Array.isArray(result.threads)) throw new Error('Invalid saved history.')
      if (!list.value || BigInt(result.version) >= BigInt(list.value.version)) list.value = result
    } catch (cause) { if (!lifetime.signal.aborted && request === listRequest) historyError.value = errorMessage(cause) }
    finally { if (request === listRequest) historyPending.value = false }
  }

  /**
   * Opens or explicitly refreshes saved history without erasing live state.
   * @param threadID Exact saved thread identity.
   */
  async function openSaved(threadID: string): Promise<void> {
    const request = ++detailRequest
    selected.value = threadID
    historyPending.value = true
    historyError.value = ''
    try {
      const detail = await readThread(prID, threadID, lifetime.signal)
      if (lifetime.signal.aborted || request !== detailRequest || selected.value !== threadID) return
      if (detail.prID !== prID || detail.threadID !== threadID || !/^(0|[1-9][0-9]*)$/.test(detail.version) || detail.context.revisionID !== detail.revisionID || !Array.isArray(detail.answers) || !detail.answers.length || detail.answers.some((answer): boolean => answer.prID !== prID || answer.threadID !== threadID || answer.revisionID !== detail.revisionID || !sameAnchor(answer.reference?.anchor, detail.context.anchor))) throw new Error('Invalid saved thread.')
      let thread = threads.value.find((item): boolean => item.id === threadID)
      if (!thread) {
        threads.value.push({ id: threadID, context: detail.context, answers: [], draft: '', inline: false, sending: false, uncertain: false, error: '', observationLost: false, session: detail.session })
        thread = threads.value.at(-1)!
      }
      for (const answer of detail.answers) merge(thread, answer)
      if (!thread.answers.at(-1)?.savedVersion || BigInt(detail.version) >= BigInt(thread.answers.at(-1)!.savedVersion!)) thread.session = detail.session
      selected.value = thread.id
      const latest = thread.answers.at(-1)!
      if (!terminal(latest) || detail.persistence !== 'saved') observe(thread)
    } catch (cause) { if (!lifetime.signal.aborted && request === detailRequest) historyError.value = errorMessage(cause) }
    finally { if (request === detailRequest) historyPending.value = false }
  }

  /**
   * Opens the existing canonical thread in the supporting panel.
   * @param thread Existing thread.
   */
  function openPanel(thread: ConversationThread): void { selected.value = thread.id; panelCollapsed.value = false }

  /**
   * Accepts an original-source navigation request only when drafts/source allow it.
   * @param reference Original anchor.
   * @param ask Whether to open the existing initial composer after navigation.
   * @returns Whether navigation was accepted.
   */
  function navigate(reference: SourceReference, ask = false): boolean {
    if (!matching(reference) || draft.value || sourcePending.value) { error.value = draft.value ? 'Resume or discard the retained question before changing its source selection.' : sourcePending.value ? 'Wait for the current source request before navigating to another range.' : 'Load the matching original source before navigating to this range.'; return false }
    select(reference.anchor)
    if (ask) compose()
    sourceRequest.value = { ...reference, fileID: reference.anchor.fileID, focusDraft: ask }
    return true
  }

  /**
   * Reopens the same thread inline at its exact original source range.
   * @param thread Existing canonical thread.
   */
  function showInline(thread: ConversationThread): void { if (navigate(thread.context)) { thread.inline = true; selected.value = thread.id; sourceRequest.value = { ...thread.context, fileID: thread.context.anchor.fileID, focusThread: thread.id } } }

  /**
   * Reveals a matching original file, including changes without text anchors.
   * @param fileID Original file identity.
   * @param revisionID Original comparison.
   * @returns Whether file navigation was accepted.
   */
  function openFile(fileID: string, revisionID: string): boolean {
    if (draft.value || sourcePending.value || source.value?.revisionID !== revisionID || !source.value.files.some((file): boolean => file.id === fileID)) return false
    sourceRequest.value = { revisionID, fileID }
    return true
  }

  const hasPageState = computed((): boolean => !!draft.value || threads.value.length > 0)
  const removeGuard = setPageGuard((): boolean => !hasPageState.value || window.confirm('Discard this page’s drafts, transcripts and reading state? Accepted backend work will continue; this does not cancel it.'))

  /**
   * Guards unsent text when the browser leaves outside application navigation.
   * @param event Native page departure.
   */
  function beforeUnload(event: BeforeUnloadEvent): void {
    if (draft.value?.text || threads.value.some((thread): boolean => !!thread.draft)) event.preventDefault()
  }

  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount((): void => { removeGuard(); window.removeEventListener('beforeunload', beforeUnload); lifetime.abort(); for (const observer of observers.values()) observer.abort() })
  return { selection, draft, threads, selected, panelCollapsed, list, historyPending, historyError, error, sourceRequest, hasPageState, select, compose, resume, discard, submit, followup, action, observe, refreshList, openSaved, openPanel, showInline, navigate, openFile, matching, unavailable, busy }
}
