import { readonly, ref } from 'vue'
import { json, setCredential } from '../api/client'
import { allowPageLeave } from './navigation'

const connected = ref(false)
const checking = ref(false)
const error = ref('')
const storageKey = 'sheldon.connection.v1'
const requiresCredential = !(import.meta.env.DEV && __STANDALONE__)

/**
 * Encodes bytes as unpadded URL-safe base64.
 * @param bytes Bytes to encode.
 * @returns Encoded value.
 */
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/**
 * Verifies backend possession before sending a user credential.
 * @param token Local instance API token.
 */
export async function connect(token: string): Promise<void> {
  if (checking.value) return
  checking.value = true
  error.value = ''
  connected.value = false
  setCredential('')
  try {
    if (!requiresCredential) {
      await json('/api/health')
      connected.value = true
      return
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid credential.')
    const challenge = base64url(crypto.getRandomValues(new Uint8Array(32)))
    const response = await fetch('/instance-proof', { headers: { 'X-Sheldon-Challenge': challenge }, cache: 'no-store', credentials: 'omit', redirect: 'error' })
    if (!response.ok) throw new Error('Verification failed.')
    const proof: unknown = await response.json()
    if (!proof || typeof proof !== 'object' || !('origin' in proof) || typeof proof.origin !== 'string' || !('proof' in proof) || typeof proof.proof !== 'string') throw new Error('Invalid proof.')
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`sheldon-instance-v1\n${proof.origin}\n${challenge}`))
    if (base64url(new Uint8Array(signed)) !== proof.proof) throw new Error('Verification failed.')
    setCredential(token)
    await json('/api/health')
    connected.value = true
    try { sessionStorage.setItem(storageKey, token) } catch {}
  } catch {
    setCredential('')
    error.value = requiresCredential ? 'Cannot verify the local backend. Start Sheldon and enter its API token.' : 'Could not connect. Restart the web development server and retry.'
    if (requiresCredential) { try { sessionStorage.removeItem(storageKey) } catch {} }
  } finally {
    checking.value = false
  }
}

/** Disconnects browser access without cancelling accepted backend work. */
export function disconnect(): void {
  if (!allowPageLeave()) return
  connected.value = false
  setCredential('')
  if (requiresCredential) { try { sessionStorage.removeItem(storageKey) } catch {} }
}

/** Initializes the selected transport without exposing credentials in the URL. */
export async function initializeConnection(): Promise<void> {
  const fragment = new URLSearchParams(location.hash.slice(1))
  const incoming = fragment.get('token')
  if (incoming) history.replaceState(null, '', `${location.pathname}${location.search}`)
  if (!requiresCredential) { await connect(''); return }
  let saved: string | null = null
  try { saved = sessionStorage.getItem(storageKey) } catch {}
  if (incoming || saved) await connect(incoming ?? saved!)
}

export const connection = { connected: readonly(connected), checking: readonly(checking), error: readonly(error), requiresCredential }
