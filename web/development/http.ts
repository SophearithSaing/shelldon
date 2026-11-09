import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PullRequest, SourceDiff } from '../src/api/contracts/source.ts'

export interface DevelopmentRequest {
  request: IncomingMessage
  response: ServerResponse
  pr: PullRequest
  source: SourceDiff | undefined
  sources: SourceDiff[]
  path: string
}

/** Represents a rejected development HTTP operation. */
export class RequestError extends Error {
  /**
   * Creates a fixed public rejection.
   * @param status HTTP status.
   * @param message Recovery message.
   */
  constructor(public readonly status: number, message: string) { super(message) }
}

/**
 * Sends an uncached JSON payload.
 * @param response HTTP response.
 * @param status HTTP status.
 * @param value Public data.
 */
export function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}

/**
 * Reads bounded JSON and rejects extra top-level fields.
 * @param request HTTP request.
 * @param keys Permitted keys.
 * @param limit Byte limit.
 * @returns Parsed object.
 */
export async function body(request: IncomingMessage, keys: string[], limit = 4096): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'JSON body required.')
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > limit) throw new RequestError(413, 'Request body is too large.')
    chunks.push(buffer)
  }
  let input: unknown
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) } catch { throw new RequestError(400, 'Invalid JSON body.') }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key): boolean => !keys.includes(key))) throw new RequestError(400, 'Invalid request fields.')
  return input as Record<string, unknown>
}

/**
 * Reads an opt-in development scenario without adding product controls.
 * @param request HTTP request.
 * @returns Scenario selected by test tooling or the development environment.
 */
export function scenario(request: IncomingMessage): string {
  const header = request.headers['x-sheldon-scenario']
  return typeof header === 'string' ? header : process.env.SHELDON_WEB_SCENARIO ?? ''
}

/**
 * Checks an exact pinned revision, independent of object property order.
 * @param value Submitted revision.
 * @param diff Authoritative development source.
 * @returns Whether every revision field matches.
 */
export function sameRevision(value: unknown, diff: SourceDiff): boolean {
  return !!value && typeof value === 'object' && Object.keys(value).length === 6 && Object.entries(diff.revision).every(([key, expected]): boolean => Reflect.get(value, key) === expected)
}
