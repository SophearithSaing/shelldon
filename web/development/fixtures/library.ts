import type { LibraryRow } from '../../src/api/contracts/library.ts'
import type { PullRequest } from '../../src/api/contracts/source.ts'
import { parsePR } from './source.ts'

export interface LibraryMetadata {
  title: string | null
  author: string | null
  state: 'open' | 'merged' | 'closed'
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  fetchedAt: string
}

export interface LibrarySeed {
  pr: PullRequest
  metadata: LibraryMetadata | null
}

/**
 * Creates one canonical development PR.
 * @param number Pull request number.
 * @param repository Repository within the acme owner.
 * @param title Legacy registry title.
 * @param author Legacy registry author.
 * @returns Valid registered identity.
 */
function fixturePR(number: number, repository: string, title: string, author: string | null): PullRequest {
  const pr = parsePR(`https://github.com/acme/${repository}/pull/${number}`)
  if (!pr) throw new Error('Invalid library fixture identity.')
  return { ...pr, title, author }
}

/**
 * Supplies deterministic registered PRs and previously cached display observations.
 * @returns Library membership with separate optional metadata.
 */
export function librarySeed(): LibrarySeed[] {
  return [
    {
      pr: fixturePR(248, 'platform', 'Deduplicate concurrent session refreshes', 'maya'),
      metadata: { title: 'Deduplicate concurrent session refreshes', author: 'maya', state: 'open', createdAt: '2026-11-09T23:40:00Z', updatedAt: '2026-11-10T00:10:00Z', mergedAt: null, fetchedAt: '2026-11-10T00:15:00Z' },
    },
    {
      pr: fixturePR(247, 'platform', 'Add cursor pagination to the activity feed', 'alex'),
      metadata: { title: 'Add cursor pagination to the activity feed', author: 'alex', state: 'open', createdAt: '2026-11-09T23:00:00Z', updatedAt: '2026-11-10T00:05:00Z', mergedAt: null, fetchedAt: '2026-11-10T00:15:00Z' },
    },
    {
      pr: fixturePR(245, 'web', 'Respect reduced motion in transitions', 'jules'),
      metadata: { title: 'Respect reduced motion in transitions', author: 'jules', state: 'open', createdAt: '2026-11-09T21:00:00Z', updatedAt: '2026-11-09T23:00:00Z', mergedAt: null, fetchedAt: '2026-11-10T00:15:00Z' },
    },
    {
      pr: fixturePR(243, 'platform', 'Validate webhook signatures before parsing', 'sam'),
      metadata: { title: 'Validate webhook signatures before parsing', author: 'sam', state: 'open', createdAt: '2026-11-08T18:00:00Z', updatedAt: '2026-11-09T20:00:00Z', mergedAt: null, fetchedAt: '2026-11-10T00:15:00Z' },
    },
    {
      pr: fixturePR(241, 'platform', 'Preserve draft context across reconnects', 'maya'),
      metadata: { title: 'Preserve draft context across reconnects', author: 'maya', state: 'merged', createdAt: '2026-11-07T12:00:00Z', updatedAt: '2026-11-09T12:00:00Z', mergedAt: '2026-11-09T12:00:00Z', fetchedAt: '2026-11-10T00:15:00Z' },
    },
    {
      pr: fixturePR(239, 'web', 'Keep source actions reachable at narrow widths', 'jules'),
      metadata: { title: 'Keep source actions reachable at narrow widths', author: 'jules', state: 'merged', createdAt: '2026-11-06T12:00:00Z', updatedAt: '2026-11-08T12:00:00Z', mergedAt: '2026-11-08T12:00:00Z', fetchedAt: '2026-11-10T00:15:00Z' },
    },
    {
      pr: fixturePR(237, 'platform', 'Remove obsolete session polling', 'alex'),
      metadata: { title: 'Remove obsolete session polling', author: 'alex', state: 'closed', createdAt: '2026-11-05T12:00:00Z', updatedAt: '2026-11-07T12:00:00Z', mergedAt: null, fetchedAt: '2026-11-10T00:15:00Z' },
    },
    { pr: fixturePR(235, 'platform', 'Retire legacy review events', null), metadata: null },
  ]
}

/**
 * Projects registry membership with optional cached metadata, preserving legacy fallback.
 * @param pr Registered pull request.
 * @param metadata Validated development observation, or null when missing.
 * @returns Public library row without source or review-progress claims.
 */
export function projectLibraryRow(pr: PullRequest, metadata: LibraryMetadata | null): LibraryRow {
  return {
    pr: { ...pr, title: metadata?.title ?? pr.title, author: metadata?.author ?? pr.author },
    route: `/reviews/${pr.id}`,
    state: metadata?.state ?? 'unknown',
    metadataStatus: metadata ? 'cached' : 'missing',
    createdAt: metadata?.createdAt ?? null,
    updatedAt: metadata?.updatedAt ?? null,
    mergedAt: metadata?.mergedAt ?? null,
    fetchedAt: metadata?.fetchedAt ?? null,
  }
}

/**
 * Produces a deterministic successful refresh while preserving known lifecycle facts.
 * @param pr Registered pull request.
 * @param previous Prior complete observation, if any.
 * @returns New cached observation with consistent lifecycle timestamps.
 */
export function refreshLibraryMetadata(pr: PullRequest, previous: LibraryMetadata | null): LibraryMetadata {
  if (previous) return { ...previous, title: previous.title ?? pr.title, author: previous.author ?? pr.author, fetchedAt: '2026-11-10T01:00:00Z' }
  return { title: pr.title, author: pr.author, state: 'open', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z', mergedAt: null, fetchedAt: '2026-11-10T01:00:00Z' }
}
