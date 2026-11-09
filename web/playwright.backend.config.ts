import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/backend',
  outputDir: './test-results/backend',
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/development/setup.ts',
  use: { baseURL: 'http://127.0.0.1:5175', viewport: { width: 1440, height: 960 }, trace: 'off' },
})
