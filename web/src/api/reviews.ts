import { json } from './client'
import type { OpenResult, PullRequest, SourceRequest, SourceResponse } from './contracts/source'
import type { LibraryQuery, LibraryResult, LibraryRow } from './contracts/library'

/**
 * Registers or reopens a canonical PR without loading its source.
 * @param url GitHub PR URL.
 * @param signal Request cancellation.
 * @returns Registered review route.
 */
export function openReview(url: string, signal?: AbortSignal): Promise<OpenResult> {
  return json('/api/open', { method: 'POST', body: JSON.stringify({ url }), signal })
}

/**
 * Reads registered PR metadata without source work.
 * @param id Registered PR identity.
 * @param signal Request cancellation.
 * @returns PR metadata.
 */
export function readReview(id: string, signal?: AbortSignal): Promise<PullRequest> {
  return json(`/api/reviews/${id}`, { signal })
}

/**
 * Explicitly requests pinned source or base selection.
 * @param id Registered PR identity.
 * @param input Source action.
 * @param signal Request cancellation.
 * @returns Complete source or a required base decision.
 */
export function loadSource(id: string, input: SourceRequest, signal?: AbortSignal): Promise<SourceResponse> {
  return json(`/api/reviews/${id}/source`, { method: 'POST', body: JSON.stringify(input), signal })
}

/**
 * Reads one fresh, locally stored library view without loading source.
 * @param query Bounded search, lifecycle and pagination query.
 * @param signal Request cancellation.
 * @returns Matching registered rows and search-scoped counts.
 */
export function listReviews(query: LibraryQuery, signal?: AbortSignal): Promise<LibraryResult> {
  const parameters = new URLSearchParams({ state: query.state, limit: String(query.limit), offset: String(query.offset) })
  if (query.search.trim()) parameters.set('q', query.search.trim())
  return json(`/api/reviews?${parameters.toString()}`, { signal })
}

/**
 * Explicitly refreshes one registered PR's cached GitHub display metadata.
 * @param id Registered PR identity.
 * @param signal Request cancellation.
 * @returns Newly saved library row, without a source-freshness claim.
 */
export function refreshReviewMetadata(id: string, signal?: AbortSignal): Promise<LibraryRow> {
  return json(`/api/reviews/${id}/metadata/refresh`, { method: 'POST', body: '{}', signal })
}
