import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type { PullRequest } from '../src/api/contracts/source.ts'
import { digest, parsePR, sourceFixture } from './fixtures/source.ts'

/** Represents a rejected development API request. */
class RequestError extends Error {
  /**
   * Creates an HTTP validation error.
   * @param status HTTP status.
   * @param message Public error message.
   */
  constructor(public readonly status: number, message: string) { super(message) }
}

/**
 * Writes an uncached JSON payload.
 * @param response Outgoing response.
 * @param status HTTP status.
 * @param value Public payload.
 */
function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(value))
}

/**
 * Reads bounded JSON input without accepting unsupported media types.
 * @param request Incoming request.
 * @returns Parsed object.
 */
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'Expected JSON body.')
  let data = ''
  for await (const chunk of request) {
    data += String(chunk)
    if (Buffer.byteLength(data) > 4096) throw new RequestError(413, 'Request body is too large.')
  }
  const value: unknown = JSON.parse(data)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object.')
  return value as Record<string, unknown>
}

/**
 * Installs the development-only, in-memory HTTP API.
 * @returns Vite plugin with an independently owned PR registry.
 */
export function developmentAPI(): Plugin {
  const reviews = new Map<string, PullRequest>()

  /**
   * Handles API requests without contacting a backend or external service.
   * @param request Incoming browser request.
   * @param response Outgoing response.
   */
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url!, 'http://127.0.0.1')
    if (url.search) { send(response, 400, { error: 'API query parameters are not supported.' }); return }
    if (url.pathname === '/api/health' && request.method === 'GET') { send(response, 200, { status: 'ok' }); return }
    if (url.pathname === '/api/open' && request.method === 'POST') {
      const input = await body(request)
      const pr = typeof input.url === 'string' && Object.keys(input).length === 1 ? parsePR(input.url) : null
      if (!pr) { send(response, 400, { error: 'Enter a valid GitHub pull request URL.' }); return }
      if (!reviews.has(pr.id)) {
        reviews.set(pr.id, { ...pr, title: 'Deduplicate concurrent session refreshes', author: 'alex' })
      }
      send(response, 202, { prID: pr.id, route: `/reviews/${pr.id}` })
      return
    }
    const match = /^\/api\/reviews\/([a-f0-9]{64})(\/source)?$/.exec(url.pathname)
    if (!match) { send(response, 404, { error: 'Operation not found.' }); return }
    const pr = reviews.get(match[1]!)
    if (!pr) { send(response, 404, { error: 'PR is not registered. Open its GitHub URL again.' }); return }
    if (!match[2] && request.method === 'GET') { send(response, 200, pr); return }
    if (match[2] && request.method === 'POST') {
      const input = await body(request)
      const diff = sourceFixture(pr)
      if (input.action === 'load' && Object.keys(input).length === 1) { send(response, 200, { state: 'ready', pr, diff }); return }
      if (input.action === 'refresh' && Object.keys(input).length === 2 && 'revision' in input) {
        const original = input.revision
        if (!original || typeof original !== 'object' || Object.keys(original).length !== 6 || !Object.entries(diff.revision).every(([key, value]): boolean => Reflect.get(original, key) === value)) { send(response, 409, { code: 'refresh-required', error: 'The requested revision does not match this PR.' }); return }
        send(response, 200, { state: 'ready', pr, diff, requestedRevisionID: digest([pr.id, diff.revision.baseSHA, diff.revision.headSHA, diff.revision.mergeBaseSHA].join('\n')) })
        return
      }
      send(response, 400, { error: 'Invalid source action or base selection.' })
      return
    }
    send(response, 405, { error: 'Method not allowed.' })
  }

  return {
    name: 'sheldon-development-api',
    /**
     * Mounts the API after the existing loopback security middleware.
     * @param server Vite development server.
     */
    configureServer(server): void {
      server.middlewares.use((request, response, next): void => {
        if (!request.url?.startsWith('/api/')) { next(); return }
        void handle(request, response).catch((error: unknown): void => {
          if (!response.headersSent) send(response, error instanceof RequestError ? error.status : 400, { error: error instanceof RequestError ? error.message : 'Invalid API request.' })
          else response.end()
        })
      })
    },
  }
}
