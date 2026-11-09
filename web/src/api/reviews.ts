import { json } from './client'
import type { OpenResult, PullRequest, SourceRequest, SourceResponse } from './contracts/source'

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
