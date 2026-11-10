import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type { PullRequest, SourceDiff } from '../src/api/contracts/source.ts'
import { digest, parsePR, sourceFixture } from './fixtures/source.ts'
import { body, RequestError, sameRevision, scenario, send } from './http.ts'
import { createQuestionAPI } from './questions.ts'
import { createGenerationAPI } from './generation.ts'
import { createLibraryAPI } from './library.ts'

/**
 * Installs development-only API services with independently owned in-memory state.
 * @returns Protected Vite HTTP middleware.
 */
export function developmentAPI(): Plugin {
  const reviews = new Map<string, PullRequest>()
  const sources = new Map<string, SourceDiff>()
  const revisions = new Map<string, SourceDiff>()
  const questions = createQuestionAPI()
  const generations = createGenerationAPI()
  const library = createLibraryAPI(reviews)

  /**
   * Handles same-origin application requests without external services.
   * @param request Incoming browser request.
   * @param response HTTP response.
   */
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url!, 'http://127.0.0.1')
    if (url.pathname === '/api/reviews' && request.method === 'GET') { library.list(request, response, url.search.slice(1)); return }
    if (url.search || request.url?.includes('?')) {
      if (url.pathname.endsWith('/metadata/refresh')) throw new RequestError(404, 'Operation not found.')
      throw new RequestError(400, 'API query parameters are not supported.')
    }
    if (url.pathname === '/api/health' && request.method === 'GET') { send(response, 200, { status: 'ok' }); return }
    if (url.pathname === '/api/open' && request.method === 'POST') {
      const input = await body(request, ['url'])
      const pr = typeof input.url === 'string' ? parsePR(input.url) : null
      if (!pr) throw new RequestError(400, 'Enter a valid GitHub pull request URL.')
      if (!reviews.has(pr.id)) reviews.set(pr.id, { ...pr, title: 'Deduplicate concurrent session refreshes', author: 'alex' })
      send(response, 202, { prID: pr.id, route: `/reviews/${pr.id}` })
      return
    }
    const match = /^\/api\/reviews\/([a-f0-9]{64})(\/.*)?$/.exec(url.pathname)
    if (!match) throw new RequestError(404, 'Operation not found.')
    const pr = reviews.get(match[1]!)
    if (!pr) throw new RequestError(404, 'PR is not registered. Open its GitHub URL again.')
    const path = match[2] ?? ''
    if (path === '/metadata/refresh') {
      if (request.method !== 'POST') throw new RequestError(404, 'Operation not found.')
      await library.refresh(request, response, pr)
      return
    }
    if (!path && request.method === 'GET') { send(response, 200, pr); return }
    if (path === '/source' && request.method === 'POST') {
      const input = await body(request, ['action', 'branch', 'sha', 'revision'])
      const mode = scenario(request)
      if (mode === 'source-failed') throw new RequestError(502, 'Cannot prepare source. Retry explicitly.')
      if (input.action === 'load' && Object.keys(input).length === 1 && mode === 'source-fallback') { send(response, 200, { state: 'fallback-required', pr }); return }
      if (input.action === 'git-only' && Object.keys(input).length === 1) { send(response, 200, { state: 'base-selection-required', pr, candidates: [{ branch: 'main', sha: 'a'.repeat(40) }] }); return }
      const previous = sources.get(pr.id)
      const original = [...revisions.values()].find((diff): boolean => diff.revision.prID === pr.id && sameRevision(input.revision, diff))
      if (input.action === 'refresh' && (Object.keys(input).length !== 2 || !original)) throw new RequestError(409, 'The requested revision does not match an original comparison.')
      if (input.action === 'select-base' && (Object.keys(input).length !== 3 || input.branch !== 'main' || input.sha !== 'a'.repeat(40))) throw new RequestError(400, 'Invalid base selection.')
      if (input.action !== 'load' && input.action !== 'refresh' && input.action !== 'select-base' || input.action === 'load' && Object.keys(input).length !== 1) throw new RequestError(400, 'Invalid source action.')
      const diff = sourceFixture(pr, { headSHA: mode === 'new-revision' ? (previous?.revision.headSHA === 'e'.repeat(40) ? 'b' : 'e').repeat(40) : previous?.revision.headSHA, fileCount: mode === 'large-source' ? 80 : mode === 'source-empty' ? 0 : undefined })
      if (input.action === 'select-base' || input.action === 'refresh' && original?.revision.baseSource === 'user-selected') diff.revision.baseSource = 'user-selected'
      if (mode === 'source-nontext') diff.files.push({ id: digest(`${diff.revisionID}:image`), status: 'added', newPath: 'assets/diagram.png', oldMode: '', newMode: '100644', oldObject: '0'.repeat(40), newObject: 'd'.repeat(40), kind: 'binary', reason: 'Binary file added.', hunks: [] })
      sources.set(pr.id, diff)
      revisions.set(`${pr.id}:${diff.revisionID}`, diff)
      send(response, 200, { state: 'ready', pr, diff, ...(input.action === 'refresh' ? { requestedRevisionID: original!.revisionID } : {}) })
      return
    }
    const context = { request, response, pr, path, source: sources.get(pr.id), sources: [...revisions.values()].filter((diff): boolean => diff.revision.prID === pr.id) }
    if (await questions.handle(context) || await generations.handle(context)) return
    throw new RequestError(path ? 404 : 405, 'Operation not found.')
  }

  return {
    name: 'sheldon-development-api',
    /**
     * Mounts local handlers after loopback security and owns worker shutdown.
     * @param server Vite server.
     */
    configureServer(server): void {
      server.httpServer?.once('close', (): void => { questions.close(); generations.close() })
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
