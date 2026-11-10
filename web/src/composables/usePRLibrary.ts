import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { errorMessage } from '../api/client'
import { listReviews, refreshReviewMetadata } from '../api/reviews'
import type { LibraryCounts, LibraryFilter, LibraryQuery, LibraryRow } from '../api/contracts/library'

interface PRLibraryState {
  search: Ref<string>
  state: Ref<LibraryFilter>
  items: ShallowRef<LibraryRow[]>
  counts: ShallowRef<LibraryCounts>
  total: Ref<number>
  nextOffset: Ref<number | null>
  canLoadMore: ComputedRef<boolean>
  loaded: Ref<boolean>
  pending: Ref<boolean>
  refreshingID: Ref<string>
  error: Ref<string>
  load: (append?: boolean) => Promise<void>
  selectState: (state: LibraryFilter) => Promise<void>
  refresh: (row: LibraryRow) => Promise<void>
}

/**
 * Coordinates explicit local-library reads and per-row GitHub metadata refreshes.
 * @returns Filtered, paginated library state with retained rows on failures.
 */
export function usePRLibrary(): PRLibraryState {
  const search = ref('')
  const state = ref<LibraryFilter>('all')
  const items = shallowRef<LibraryRow[]>([])
  const counts = shallowRef<LibraryCounts>({ open: 0, merged: 0, closed: 0, unknown: 0, all: 0 })
  const total = ref(0)
  const nextOffset = ref<number | null>(null)
  const loaded = ref(false)
  const pending = ref(false)
  const refreshingID = ref('')
  const error = ref('')
  const loadedQuery = shallowRef<LibraryQuery | null>(null)
  const canLoadMore = computed((): boolean => nextOffset.value !== null && !pending.value && !error.value && loadedQuery.value?.search === search.value.trim() && loadedQuery.value.state === state.value)
  let listController: AbortController | null = null
  let refreshController: AbortController | null = null
  let epoch = 0

  /**
   * Reads the current query or appends its next page without starting source work.
   * @param append Whether to append the advertised next offset.
   */
  async function load(append = false): Promise<void> {
    if (append && !canLoadMore.value) return
    const query: LibraryQuery = append && loadedQuery.value
      ? { ...loadedQuery.value, offset: nextOffset.value! }
      : { search: search.value.trim(), state: state.value, limit: 50, offset: 0 }
    listController?.abort()
    const controller = new AbortController()
    listController = controller
    const requestEpoch = ++epoch
    pending.value = true
    error.value = ''
    try {
      const result = await listReviews(query, controller.signal)
      if (requestEpoch !== epoch || controller.signal.aborted) return
      items.value = append ? [...items.value, ...result.items] : result.items
      counts.value = result.counts
      total.value = result.total
      nextOffset.value = result.nextOffset
      loadedQuery.value = query
      loaded.value = true
    } catch (cause) {
      if (requestEpoch === epoch && !controller.signal.aborted) error.value = errorMessage(cause)
    } finally {
      if (requestEpoch === epoch) pending.value = false
    }
  }

  /**
   * Applies a lifecycle filter while preserving the current search text.
   * @param next Requested backend lifecycle filter.
   */
  async function selectState(next: LibraryFilter): Promise<void> {
    if (state.value === next && loaded.value) return
    state.value = next
    await load()
  }

  /**
   * Refreshes one row's display metadata, then rereads the current filtered view.
   * @param row Registered library row selected by the user.
   */
  async function refresh(row: LibraryRow): Promise<void> {
    if (refreshingID.value) return
    refreshController?.abort()
    const controller = new AbortController()
    refreshController = controller
    refreshingID.value = row.pr.id
    error.value = ''
    try {
      await refreshReviewMetadata(row.pr.id, controller.signal)
      if (controller.signal.aborted) return
      await load()
      if (error.value && !controller.signal.aborted) error.value = 'Metadata was saved, but the library could not be reread. Reload the library before refreshing again.'
    } catch (cause) {
      if (!controller.signal.aborted) error.value = errorMessage(cause)
    } finally {
      if (refreshController === controller) refreshingID.value = ''
    }
  }

  onBeforeUnmount((): void => {
    epoch++
    listController?.abort()
    refreshController?.abort()
  })
  void load()
  return { search, state, items, counts, total, nextOffset, canLoadMore, loaded, pending, refreshingID, error, load, selectState, refresh }
}
