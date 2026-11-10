import type { IncomingMessage, ServerResponse } from 'node:http'
import type { LibraryCounts, LibraryQuery, LibraryResult, LibraryRow } from '../src/api/contracts/library.ts'
import type { PullRequest } from '../src/api/contracts/source.ts'
import { librarySeed, projectLibraryRow, refreshLibraryMetadata } from './fixtures/library.ts'
import type { LibraryMetadata } from './fixtures/library.ts'
import { body, RequestError, scenario, send } from './http.ts'

interface LibraryAPI {
  list: (request: IncomingMessage, response: ServerResponse, rawQuery: string) => void
  refresh: (request: IncomingMessage, response: ServerResponse, pr: PullRequest) => Promise<void>
}

/**
 * Decodes one URL-encoded query component with strict UTF-8 validation.
 * @param value Raw form component.
 * @returns Decoded component or a public query rejection.
 */
function decodeComponent(value: string): string {
  if (value.includes(';')) throw new RequestError(400, 'Invalid PR library query.')
  try { return decodeURIComponent(value.replace(/\+/g, ' ')) } catch { throw new RequestError(400, 'Invalid PR library query.') }
}

/**
 * Parses the exact bounded query accepted by the Go library endpoint.
 * @param raw Raw URL query without a leading question mark.
 * @returns Validated local library query.
 */
function parseQuery(raw: string): LibraryQuery {
  if (Buffer.byteLength(raw) > 4096) throw new RequestError(400, 'Invalid PR library query.')
  const query: LibraryQuery = { search: '', state: 'all', limit: 50, offset: 0 }
  const seen = new Set<string>()
  for (const pair of raw.split('&')) {
    if (!pair) continue
    const separator = pair.indexOf('=')
    const key = decodeComponent(separator < 0 ? pair : pair.slice(0, separator))
    const value = decodeComponent(separator < 0 ? '' : pair.slice(separator + 1))
    if (seen.has(key) || !['q', 'state', 'limit', 'offset'].includes(key)) throw new RequestError(400, 'Invalid PR library query.')
    seen.add(key)
    if (key === 'q') query.search = value.trim()
    if (key === 'state') {
      if (value !== 'all' && value !== 'open' && value !== 'merged') throw new RequestError(400, 'Invalid PR library query.')
      query.state = value
    }
    if (key === 'limit' || key === 'offset') {
      if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new RequestError(400, 'Invalid PR library query.')
      const number = Number(value)
      if (!Number.isSafeInteger(number) || key === 'limit' && (number < 1 || number > 100) || key === 'offset' && number > 1_000_000) throw new RequestError(400, 'Invalid PR library query.')
      query[key] = number
    }
  }
  if (Buffer.byteLength(query.search) > 256) throw new RequestError(400, 'Invalid PR library query.')
  return query
}

/**
 * Applies backend-compatible search, counts, filtering, ordering and pagination.
 * @param rows Complete registered rows.
 * @param query Validated library query.
 * @returns Fresh page and search-scoped lifecycle counts.
 */
function select(rows: LibraryRow[], query: LibraryQuery): LibraryResult {
  const search = query.search.toLowerCase()
  const number = search.startsWith('#') ? search.slice(1) : search
  const counts: LibraryCounts = { open: 0, merged: 0, closed: 0, unknown: 0, all: 0 }
  const matches: LibraryRow[] = []
  for (const row of rows) {
    const title = row.pr.title?.toLowerCase() ?? ''
    const repository = `${row.pr.owner}/${row.pr.repository}`
    if (search && !title.includes(search) && !repository.includes(search) && (!number || !row.pr.number.includes(number))) continue
    counts.all++
    counts[row.state]++
    if (query.state === 'all' || row.state === query.state) matches.push(row)
  }
  matches.sort((a, b): number => {
    const leftRepository = `${a.pr.owner}/${a.pr.repository}`
    const rightRepository = `${b.pr.owner}/${b.pr.repository}`
    if (leftRepository !== rightRepository) return leftRepository < rightRepository ? -1 : 1
    const left = BigInt(a.pr.number)
    const right = BigInt(b.pr.number)
    if (left !== right) return left < right ? -1 : 1
    return a.pr.id === b.pr.id ? 0 : a.pr.id < b.pr.id ? -1 : 1
  })
  const start = Math.min(query.offset, matches.length)
  const end = Math.min(start + query.limit, matches.length)
  return { items: matches.slice(start, end), total: matches.length, counts, nextOffset: end < matches.length ? end : null }
}

/**
 * Creates in-memory library storage and handlers without Git, gh or source work.
 * @param reviews Shared canonical development registry.
 * @returns Collection listing and explicit metadata-refresh handlers.
 */
export function createLibraryAPI(reviews: Map<string, PullRequest>): LibraryAPI {
  const metadata = new Map<string, LibraryMetadata>()
  for (const seed of librarySeed()) {
    reviews.set(seed.pr.id, seed.pr)
    if (seed.metadata) metadata.set(seed.pr.id, seed.metadata)
  }

  /**
   * Projects one registered row from current optional metadata.
   * @param pr Registered pull request.
   * @returns Current public row.
   */
  function row(pr: PullRequest): LibraryRow {
    return projectLibraryRow(pr, metadata.get(pr.id) ?? null)
  }

  /**
   * Reads a fresh local view without touching source fixtures.
   * @param request Incoming collection request.
   * @param response HTTP response.
   * @param rawQuery Raw collection query.
   */
  function list(request: IncomingMessage, response: ServerResponse, rawQuery: string): void {
    const query = parseQuery(rawQuery)
    if (scenario(request) === 'library-failed') throw new RequestError(500, 'Cannot read PR library; existing data was preserved.')
    const result: LibraryResult = select([...reviews.values()].map(row), query)
    send(response, 200, result)
  }

  /**
   * Saves one explicit deterministic observation while retaining old data on failure.
   * @param request Incoming refresh request.
   * @param response HTTP response.
   * @param pr Registered pull request.
   */
  async function refresh(request: IncomingMessage, response: ServerResponse, pr: PullRequest): Promise<void> {
    await body(request, [])
    const mode = scenario(request)
    if (mode === 'metadata-failed') throw new RequestError(502, 'GitHub metadata unavailable; cached data was preserved.')
    if (mode === 'metadata-busy') throw new RequestError(409, 'PR metadata refresh is already active; retry explicitly.')
    const next = refreshLibraryMetadata(pr, metadata.get(pr.id) ?? null)
    metadata.set(pr.id, next)
    send(response, 200, projectLibraryRow(pr, next))
  }

  return { list, refresh }
}
