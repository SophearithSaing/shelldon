import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let server

/** Closes only this test-owned development server. */
async function close() {
  await server?.close()
  process.disconnect()
}

process.on('message', () => { void close() })

try {
  server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
    mode: 'standalone',
    logLevel: 'silent',
    server: { port: Number(process.argv[2]), watch: null },
  })
  await server.listen()
  process.send({ origin: server.resolvedUrls.local[0], strictPort: server.config.server.strictPort })
} catch (error) {
  process.send({ error: error.message })
}
