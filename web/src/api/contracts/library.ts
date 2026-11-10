import type { PullRequest } from './source'

export type LibraryFilter = 'all' | 'open' | 'merged'
export type LibraryLifecycle = Exclude<LibraryFilter, 'all'> | 'closed' | 'unknown'
export type MetadataStatus = 'missing' | 'cached' | 'unavailable'

export interface LibraryRow {
  pr: PullRequest
  route: string
  state: LibraryLifecycle
  metadataStatus: MetadataStatus
  createdAt: string | null
  updatedAt: string | null
  mergedAt: string | null
  fetchedAt: string | null
}

export interface LibraryCounts {
  open: number
  merged: number
  closed: number
  unknown: number
  all: number
}

export interface LibraryResult {
  items: LibraryRow[]
  total: number
  counts: LibraryCounts
  nextOffset: number | null
}

export interface LibraryQuery {
  search: string
  state: LibraryFilter
  limit: number
  offset: number
}
