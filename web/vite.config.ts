import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { backendProxy, loopbackOrigin, protectedDevelopmentServer } from './development/server.ts'

/**
 * Vite configuration for the Sheldon frontend.
 * @param options Vite command context.
 * @returns Vite configuration.
 */
export default defineConfig(async ({ command, mode }): Promise<UserConfig> => {
  if (command !== 'serve') return { plugins: [vue()], define: { __STANDALONE__: 'false' } }
  const frontend = loopbackOrigin(process.env.SHELDON_DEV_ORIGIN ?? 'http://127.0.0.1:5173')
  const backend = process.env.SHELDON_BACKEND_URL ?? 'http://127.0.0.1:7331'
  const standalone = mode === 'standalone'
  const api = standalone ? (await import('./development/api.ts')).developmentAPI() : undefined
  return {
    plugins: [protectedDevelopmentServer(), ...(api ? [api] : []), vue()],
    define: { __STANDALONE__: JSON.stringify(standalone) },
    server: {
      host: frontend.hostname.replace(/^\[|\]$/g, ''),
      port: Number(frontend.port),
      strictPort: true,
      cors: false,
      allowedHosts: [frontend.hostname],
      fs: {
        allow: [
          fileURLToPath(new URL('.', import.meta.url)),
          dirname(dirname(fileURLToPath(import.meta.resolve('vue/package.json')))),
        ],
      },
      proxy: standalone ? undefined : {
        '^/api(?:/|$)': backendProxy(backend),
        '^/instance-proof(?:\\?|$)': backendProxy(backend),
      },
    },
  }
})
