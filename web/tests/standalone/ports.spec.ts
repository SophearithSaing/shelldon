import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

interface ServerResult {
  origin?: string
  strictPort?: boolean
  error?: string
}

/**
 * Starts an isolated child so the pinned test frontend's environment stays untouched.
 * @param port Occupied preferred port.
 * @param explicit Whether the origin was explicitly pinned.
 * @returns Child process and its startup result.
 */
function start(port: number, explicit: boolean): { child: ChildProcess; result: Promise<ServerResult> } {
  const env = { ...process.env }
  delete env.SHELDON_DEV_ORIGIN
  if (explicit) env.SHELDON_DEV_ORIGIN = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [fileURLToPath(new URL('../development/port-server.js', import.meta.url)), String(port)], { env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  child.stderr?.resume()
  const result = new Promise<ServerResult>((resolve, reject): void => {
    child.once('message', (message): void => { resolve(message as ServerResult) })
    child.once('error', reject)
    child.once('exit', (): void => { reject(new Error('Port test server exited before reporting startup.')) })
  })
  return { child, result }
}

test('default development port falls forward without weakening actual-origin protection; pinned ports stay strict', async ({ request }): Promise<void> => {
  const occupied = createServer()
  await new Promise<void>((resolve): void => { occupied.listen(0, '127.0.0.1', resolve) })
  const address = occupied.address()
  if (!address || typeof address === 'string') throw new Error('Expected numeric test listener.')
  const children: ChildProcess[] = []
  try {
    const fallback = start(address.port, false)
    children.push(fallback.child)
    const result = await fallback.result
    expect(result.error).toBeUndefined()
    expect(result.strictPort).toBe(false)
    const origin = result.origin!.replace(/\/$/, '')
    expect(Number(new URL(origin).port)).toBeGreaterThan(address.port)
    expect((await request.get(`${origin}/api/health`, { headers: { Origin: origin } })).status()).toBe(200)
    expect((await request.get(`${origin}/api/health`, { headers: { Origin: `http://127.0.0.1:${address.port}` } })).status()).toBe(403)
    expect((await request.get(`${origin}/api/health`, { headers: { Host: `127.0.0.1:${address.port}` } })).status()).toBe(403)
    const pinned = start(address.port, true)
    children.push(pinned.child)
    expect((await pinned.result).error).toContain('already in use')
  } finally {
    for (const child of children) {
      const exited = new Promise<void>((resolve): void => { child.once('exit', (): void => { resolve() }) })
      if (child.connected) child.send('close')
      else if (child.exitCode !== null) continue
      await exited
    }
    await new Promise<void>((resolve, reject): void => { occupied.close((error): void => { if (error) reject(error); else resolve() }) })
  }
})
