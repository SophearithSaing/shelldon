let credential = ''

/** Represents an HTTP rejection without exposing request credentials. */
export class APIError extends Error {
  /**
   * Creates a public API error.
   * @param status HTTP status.
   * @param message Public recovery message.
   */
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * Changes the verified credential used by subsequent API requests.
 * @param token Verified local instance token, or empty on disconnect.
 */
export function setCredential(token: string): void {
  credential = token
}

/**
 * Sends a same-origin API request without redirects or cached responses.
 * @param path Application-owned API path.
 * @param init Request options.
 * @returns Successful HTTP response.
 */
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/api/')) throw new Error('Invalid API path.')
  const headers = new Headers(init.headers)
  if (credential) headers.set('Authorization', `Bearer ${credential}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'omit', cache: 'no-store', redirect: 'error' })
  if (!response.ok) {
    let message = `Request failed (${response.status}). Retry explicitly.`
    try {
      const body: unknown = await response.json()
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') message = body.error
    } catch {
      throw new APIError(response.status, message)
    }
    throw new APIError(response.status, message)
  }
  return response
}

/**
 * Reads a JSON response through the shared transport.
 * @param path Application-owned API path.
 * @param init Request options.
 * @returns Parsed response payload.
 */
export async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await request(path, init)).json() as Promise<T>
}

/**
 * Produces a safe user-facing error message.
 * @param error Rejected operation.
 * @returns Public error text.
 */
export function errorMessage(error: unknown): string {
  return error instanceof APIError ? error.message : 'Could not reach the local service. Check the connection and retry explicitly.'
}
