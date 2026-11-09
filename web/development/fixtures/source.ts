import { createHash } from 'node:crypto'
import type { DiffFile, DiffHunk, DiffLine, PullRequest, SourceDiff } from '../../src/api/contracts/source.ts'

/**
 * Produces a deterministic nonzero identity.
 * @param value Identity input.
 * @returns Lowercase SHA-256 digest.
 */
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Canonicalizes a GitHub PR URL using the backend identity shape.
 * @param raw User-entered URL.
 * @returns Canonical PR record, or null for unsupported input.
 */
export function parsePR(raw: string): PullRequest | null {
  if (raw.length > 2048 || /[\\\r\n\t ]/.test(raw) || /%[a-f0-9]{2}/i.test(raw.split(/[?#]/)[0]!)) return null
  let url: URL
  try { url = new URL(raw) } catch { return null }
  const rawPath = /^https:\/\/[^/?#]+(\/[^?#]*)/.exec(raw)?.[1]
  const match = rawPath ? /^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)\/pull\/([1-9][0-9]*)\/?$/.exec(rawPath) : null
  if (url.protocol !== 'https:' || url.host !== 'github.com' || url.username || url.password || !match) return null
  const owner = match[1]!
  const repository = match[2]!
  const number = match[3]!
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) || repository.length > 100 || repository === '.' || repository === '..') return null
  if (BigInt(number) > 18446744073709551615n) return null
  const identity = `github.com/${owner.toLowerCase()}/${repository.toLowerCase()}/pull/${number}`
  return { id: digest(identity), url: `https://${identity}`, owner: owner.toLowerCase(), repository: repository.toLowerCase(), number, title: null, author: null }
}

/**
 * Builds literal unified source with stable line identities.
 * @param key Revision-scoped identity prefix.
 * @param oldStart First original line.
 * @param newStart First current line.
 * @param rows Signed source lines.
 * @returns Complete hunk with side-specific coordinates.
 */
function hunk(key: string, oldStart: number, newStart: number, rows: string[]): DiffHunk {
  let oldLine = oldStart
  let newLine = newStart
  const lines: DiffLine[] = rows.map((row, index): DiffLine => {
    const sign = row.slice(0, 1) as DiffLine['sign']
    return { id: digest(`${key}:line:${index}`), sign, text: row.slice(1), ...(sign !== '+' ? { oldLine: oldLine++ } : {}), ...(sign !== '-' ? { newLine: newLine++ } : {}) }
  })
  return { id: digest(key), old: { id: digest(`${key}:old`), start: oldStart, count: oldLine - oldStart }, new: { id: digest(`${key}:new`), start: newStart, count: newLine - newStart }, section: '', lines }
}

/**
 * Creates a complete pinned comparison for a registered PR.
 * @param pr Registered PR.
 * @param options Optional comparison/inventory scenario.
 * @returns Deterministic comparison.
 */
export function sourceFixture(pr: PullRequest, options: { headSHA?: string; fileCount?: number } = {}): SourceDiff {
  const revision = { prID: pr.id, baseBranch: 'main', baseSource: 'github' as const, baseSHA: 'a'.repeat(40), headSHA: options.headSHA ?? 'b'.repeat(40), mergeBaseSHA: 'a'.repeat(40) }
  const revisionID = digest([pr.id, revision.baseSHA, revision.headSHA, revision.mergeBaseSHA].join('\n'))
  const paths = ['src/auth/refresh.ts', 'src/auth/store.ts', 'tests/auth/refresh.test.ts']
  const rows = [
    [
      ' import { sessionStore } from "./store";', ' import { requestToken } from "./client";', ' ',
      '+let inFlight: Promise<Session> | null = null;', '+',
      ' export async function refreshSession() {', '-  const session = await requestToken();', '-  sessionStore.set(session);', '-  return session;',
      '+  if (inFlight) return inFlight;', '+', '+  inFlight = requestToken()', '+    .then((session) => {', '+      sessionStore.set(session);', '+      return session;', '+    })', '+    .finally(() => {', '+      inFlight = null;', '+    });', '+', '+  return inFlight;', ' }', ' ', ' export function getSession() {', '   return sessionStore.get();', ' }',
    ],
    [
      ' import type { Session } from "./types";', ' ', ' let session: Session | null = null;', ' ', ' export const sessionStore = {',
      '   get() {', '     return session;', '   },', '-  set(value: Session) {', '+  set(value: Session | null) {', '     session = value;', '   },', '+  clear() {', '+    session = null;', '+  },', ' };',
    ],
    [
      ' import { refreshSession } from "../../src/auth/refresh";', ' import { requestToken } from "../../src/auth/client";', ' ',
      '+it("shares the refresh between concurrent callers", async () => {', '+  const first = refreshSession();', '+  const second = refreshSession();', '+', '+  expect(requestToken).toHaveBeenCalledTimes(1);', '+  expect(await first).toBe(await second);', '+});', '+', '+it("allows retry after a failed refresh", async () => {', '+  requestToken.mockRejectedValueOnce(new Error("offline"));', '+  await expect(refreshSession()).rejects.toThrow("offline");', '+  await refreshSession();', '+  expect(requestToken).toHaveBeenCalledTimes(2);', '+});',
    ],
  ]
  const files = Array.from({ length: options.fileCount ?? paths.length }, (_, index): DiffFile => {
    const path = paths[index] ?? `src/generated/file-${index}.ts`
    return { id: digest(`${revisionID}:${path}`), status: 'modified', oldPath: path, newPath: path, oldMode: '100644', newMode: '100644', oldObject: 'c'.repeat(40), newObject: 'd'.repeat(40), kind: 'text', hunks: [hunk(`${revisionID}:${path}:hunk`, index % 3 === 0 ? 12 : 1, index % 3 === 0 ? 12 : 1, rows[index % 3]!)] }
  })
  return { revision, revisionID, complete: true, files }
}
