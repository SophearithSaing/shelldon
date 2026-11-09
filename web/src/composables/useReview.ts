import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { errorMessage } from '../api/client'
import { loadSource, readReview } from '../api/reviews'
import type { PullRequest, SourceDiff, SourceRequest, SourceResponse } from '../api/contracts/source'

interface ReviewState {
  pr: ShallowRef<PullRequest | null>
  source: ShallowRef<SourceDiff | null>
  decision: ShallowRef<Exclude<SourceResponse, { state: 'ready' }> | null>
  pending: Ref<boolean>
  replacementBlocked: Ref<boolean>
  metadataPending: Ref<boolean>
  error: Ref<string>
  understood: Ref<Set<string>>
  activeFile: Ref<string>
  progress: ComputedRef<number>
  read: () => Promise<void>
  load: (input?: SourceRequest) => Promise<void>
  refresh: () => Promise<void>
  toggleUnderstood: (fileID: string) => void
}

/**
 * Coordinates one page's registered PR and explicitly loaded comparison.
 * @param reviewID Reactive routed PR identity.
 * @returns Page-local source and reading state with explicit actions.
 */
export function useReview(reviewID: Readonly<Ref<string>>): ReviewState {
  const pr = shallowRef<PullRequest | null>(null)
  const source = shallowRef<SourceDiff | null>(null)
  const decision = shallowRef<Exclude<SourceResponse, { state: 'ready' }> | null>(null)
  const pending = ref(false)
  const replacementBlocked = ref(false)
  const metadataPending = ref(false)
  const error = ref('')
  const understood = ref(new Set<string>())
  const activeFile = ref('')
  let epoch = 0
  let controller: AbortController | null = null

  /** Reads the routed PR without loading source. */
  async function read(): Promise<void> {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const requestEpoch = ++epoch
    pr.value = null
    source.value = null
    decision.value = null
    error.value = ''
    pending.value = false
    metadataPending.value = true
    understood.value = new Set()
    activeFile.value = ''
    try {
      const result = await readReview(reviewID.value, signal)
      if (requestEpoch !== epoch || signal.aborted) return
      if (result.id !== reviewID.value) throw new Error('Mismatched review.')
      pr.value = result
    } catch (cause) {
      if (requestEpoch === epoch && !signal.aborted) error.value = errorMessage(cause)
    } finally {
      if (requestEpoch === epoch) metadataPending.value = false
    }
  }

  /**
   * Loads or refreshes source after an explicit user action.
   * @param input Source action or base decision.
   */
  async function load(input: SourceRequest = { action: 'load' }): Promise<void> {
    if (pending.value || !pr.value) return
    if (replacementBlocked.value) { error.value = 'Finish or discard the retained initial question before replacing its source.'; return }
    const requestEpoch = epoch
    const signal = controller!.signal
    pending.value = true
    error.value = ''
    try {
      const result = await loadSource(reviewID.value, input, signal)
      if (requestEpoch !== epoch || signal.aborted) return
      if (result.pr.id !== reviewID.value) throw new Error('Mismatched source.')
      if (result.state === 'ready') {
        if (!result.diff.complete || result.diff.revision.prID !== reviewID.value || !Array.isArray(result.diff.files)) throw new Error('Incomplete comparison.')
        if (input.action === 'refresh' && result.requestedRevisionID !== source.value?.revisionID) throw new Error('Mismatched refresh.')
        if (source.value?.revisionID !== result.diff.revisionID) understood.value = new Set()
        source.value = result.diff
        if (!result.diff.files.some((file): boolean => file.id === activeFile.value)) activeFile.value = result.diff.files[0]?.id ?? ''
        decision.value = null
      } else {
        decision.value = result
      }
      pr.value = result.pr
    } catch (cause) {
      if (requestEpoch === epoch && !signal.aborted) error.value = errorMessage(cause)
    } finally {
      if (requestEpoch === epoch) pending.value = false
    }
  }

  /** Refreshes the displayed comparison without clearing readable source. */
  async function refresh(): Promise<void> {
    if (source.value) await load({ action: 'refresh', revision: source.value.revision })
  }

  /**
   * Toggles reversible, self-reported understanding for one changed file.
   * @param fileID Changed file identity.
   */
  function toggleUnderstood(fileID: string): void {
    if (!source.value?.files.some((file): boolean => file.id === fileID)) return
    const next = new Set(understood.value)
    if (next.has(fileID)) next.delete(fileID)
    else next.add(fileID)
    understood.value = next
  }

  const progress = computed((): number => source.value?.files.length ? Math.round(understood.value.size / source.value.files.length * 100) : 0)
  watch(reviewID, read, { immediate: true })
  onBeforeUnmount((): void => { epoch++; controller?.abort() })
  return { pr, source, decision, pending, replacementBlocked, metadataPending, error, understood, activeFile, progress, read, load, refresh, toggleUnderstood }
}
