import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { APIError, errorMessage } from '../api/client'
import { generate, generationStatus, readGeneration } from '../api/generation'
import type { GenerationFeature, GenerationRead, GenerationStatus } from '../api/contracts/generation'
import type { SourceDiff } from '../api/contracts/source'

export interface GenerationState<T extends GenerationRead> {
  result: ShallowRef<T | null>
  status: ShallowRef<GenerationStatus | null>
  pending: Ref<boolean>
  error: Ref<string>
  blocked: Ref<boolean>
  busy: ComputedRef<boolean>
  canGenerate: ComputedRef<boolean>
  read: () => Promise<void>
  start: () => Promise<void>
  cancel: () => Promise<void>
}

/**
 * Recognizes statuses that still require observation, never mutation replay.
 * @param status Exact generation status.
 * @returns Whether generation has an active presentation state.
 */
export function generationActive(status: GenerationStatus | null): boolean {
  return !!status && ['pending', 'generating', 'validating', 'saving'].includes(status.state)
}

/**
 * Owns the shared finite-generation protocol used by quiz and semantic review.
 * @param prID Registered PR.
 * @param feature Independent generation endpoint.
 * @param source Explicitly loaded source.
 * @param active Whether this feature is being observed.
 * @returns Saved-result state and explicit mutation/recovery actions.
 */
export function useGeneration<T extends GenerationRead>(prID: string, feature: GenerationFeature, source: Readonly<Ref<SourceDiff | null>>, active: Readonly<Ref<boolean>>): GenerationState<T> {
  const result = shallowRef(null) as ShallowRef<T | null>
  const status = shallowRef<GenerationStatus | null>(null)
  const pending = ref(false)
  const starting = ref(false)
  const cancelling = ref(false)
  const error = ref('')
  const blocked = ref(false)
  const lifetime = new AbortController()
  let observation: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let readEpoch = 0

  /** Stops only observation; accepted generation belongs to the backend. */
  function stopObservation(): void {
    if (timer) clearTimeout(timer)
    timer = null
    observation?.abort()
    observation = null
  }

  /**
   * Validates and advances a scoped monotonic status.
   * @param next Backend snapshot.
   * @param explicitRead Whether an authoritative saved read resolved delivery uncertainty.
   */
  function accept(next: GenerationStatus | null, explicitRead = false): void {
    if (!next) { if (explicitRead) { status.value = null; blocked.value = false }; return }
    if (next.prID !== prID || !/^[a-f0-9]{64}$/.test(next.generationID) || !/^[a-f0-9]{64}$/.test(next.revisionID) || !/^[1-9][0-9]*$/.test(next.sequence) || !['pending', 'generating', 'validating', 'saving', 'completed', 'failed', 'cancelled', 'unknown'].includes(next.state)) throw new Error('Invalid generation status.')
    if (status.value?.generationID === next.generationID && BigInt(next.sequence) < BigInt(status.value.sequence)) return
    status.value = next
    blocked.value = next.executionUnknown || next.state === 'unknown' || !explicitRead && next.failureCode === 'save-uncertain'
  }

  /**
   * Reads saved content while preserving the prior complete result on failure.
   * @param explicit Whether this read is an explicit uncertainty-recovery boundary.
   */
  async function readSaved(explicit: boolean): Promise<void> {
    const epoch = ++readEpoch
    pending.value = true
    error.value = ''
    try {
      const next = await readGeneration<T>(prID, feature, lifetime.signal)
      if (lifetime.signal.aborted || epoch !== readEpoch) return
      if (next.prID !== prID || !/^(0|[1-9][0-9]*)$/.test(next.version) || BigInt(next.version) > 18446744073709551615n) throw new Error('Invalid saved result.')
      if (feature === 'quiz' && !('quiz' in next) || feature === 'semantic-review' && !('review' in next)) throw new Error('Mismatched saved feature.')
      if (result.value && BigInt(next.version) < BigInt(result.value.version)) return
      accept(next.generation, explicit)
      result.value = next
      if (active.value && generationActive(status.value)) observe()
    } catch (cause) {
      if (!lifetime.signal.aborted && epoch === readEpoch) { error.value = errorMessage(cause); blocked.value = true }
    } finally { if (epoch === readEpoch) pending.value = false }
  }

  /** Explicitly refreshes saved state, never generation admission. */
  async function read(): Promise<void> { await readSaved(true) }

  /** Polls one admitted active generation, at most once per second and one request in flight. */
  function observe(): void {
    if (timer || observation || !active.value || !generationActive(status.value) || lifetime.signal.aborted) return
    const original = status.value!
    timer = setTimeout(async (): Promise<void> => {
      timer = null
      const controller = new AbortController()
      observation = controller
      try {
        const next = await generationStatus(prID, feature, original, false, controller.signal)
        if (lifetime.signal.aborted || controller.signal.aborted || status.value?.generationID !== original.generationID) return
        if (next.generationID !== original.generationID || next.revisionID !== original.revisionID) throw new Error('Mismatched generation observation.')
        accept(next)
        if (next.state === 'completed') await readSaved(false)
      } catch (cause) {
        if (!lifetime.signal.aborted && !controller.signal.aborted) { error.value = `${errorMessage(cause)} Refresh saved state to reconnect observation; do not resend generation.`; blocked.value = true }
      } finally {
        if (observation === controller) observation = null
        if (!error.value) observe()
      }
    }, 1000)
  }

  /** Explicitly admits generation once against the last successfully read predecessor. */
  async function start(): Promise<void> {
    if (!canGenerate.value || !source.value || !result.value) return
    const pinned = source.value
    starting.value = true
    error.value = ''
    stopObservation()
    try {
      const next = await generate(prID, feature, pinned.revision, result.value.version)
      if (lifetime.signal.aborted) return
      if (next.revisionID !== pinned.revisionID) throw new Error('Uncertain generation admission.')
      accept(next)
      observe()
    } catch (cause) {
      if (!lifetime.signal.aborted) { error.value = errorMessage(cause); blocked.value = !(cause instanceof APIError) || cause.status >= 500 || cause.status === 409 }
    } finally { starting.value = false }
  }

  /** Requests cancellation of the exact accepted generation, not rollback proof. */
  async function cancel(): Promise<void> {
    const original = status.value
    if (!original || !generationActive(original) || cancelling.value || original.cancelRequested) return
    cancelling.value = true
    error.value = ''
    try {
      const next = await generationStatus(prID, feature, original, true)
      if (lifetime.signal.aborted || status.value?.generationID !== original.generationID) return
      if (next.generationID !== original.generationID || next.revisionID !== original.revisionID) throw new Error('Uncertain cancellation.')
      accept(next)
      if (next.state === 'completed') await readSaved(false)
      observe()
    } catch (cause) { if (!lifetime.signal.aborted) { error.value = errorMessage(cause); blocked.value = true } }
    finally { cancelling.value = false }
  }

  const busy = computed((): boolean => starting.value || cancelling.value || generationActive(status.value))
  const canGenerate = computed((): boolean => !!source.value && !!result.value && !pending.value && !busy.value && !blocked.value)
  watch(active, async (visible): Promise<void> => {
    if (!visible) stopObservation()
    else if (!result.value) await read()
    else if (generationActive(status.value) && !blocked.value) observe()
  }, { immediate: true })
  onBeforeUnmount((): void => { lifetime.abort(); stopObservation() })
  return { result, status, pending, error, blocked, busy, canGenerate, read, start, cancel }
}
