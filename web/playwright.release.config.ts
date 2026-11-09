import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/current-release',
  outputDir: './test-results/release',
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/release/setup.ts',
  use: { viewport: { width: 1440, height: 1080 }, trace: 'off' },
})
