import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/standalone',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5176',
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:web',
    url: 'http://127.0.0.1:5176',
    reuseExistingServer: false,
    env: { SHELDON_DEV_ORIGIN: 'http://127.0.0.1:5176' },
  },
})
