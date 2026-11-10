import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/**
 * Reads only the isolated offline Go test server's credential.
 * @returns Private fixture connection record.
 */
async function connection(): Promise<{ token: string; url: string }> {
  return JSON.parse(await readFile(process.env.SHELDON_TEST_STATE!, 'utf8')) as { token: string; url: string }
}

test('real Go verification, registration and tab-scoped reconnect use the same frontend', async ({ page }): Promise<void> => {
  const state = await connection()
  await page.goto(`/#token=${state.token}`)
  await expect(page.getByRole('button', { name: 'Connected', exact: true })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
  await page.getByRole('button', { name: 'Open a PR', exact: true }).click()
  await page.getByLabel('Open a pull request', { exact: true }).fill('https://github.com/contract/native/pull/1701')
  await page.getByRole('button', { name: 'Open PR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pull request #1701', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load pinned source', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pull request #1701', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load pinned source', exact: true })).toBeVisible()
})

test('real backend capability failure never falls back to development source or fixture titles', async ({ page }): Promise<void> => {
  const state = await connection()
  await page.goto(`/#token=${state.token}`)
  await expect(page.getByRole('alert')).toContainText('PR library is unavailable')
  await expect(page.locator('.pr-library')).not.toContainText('Deduplicate concurrent session refreshes')
  await page.getByRole('button', { name: 'Open a PR', exact: true }).click()
  await page.getByLabel('Open a pull request', { exact: true }).fill('https://github.com/contract/native/pull/1702')
  await page.getByRole('button', { name: 'Open PR', exact: true }).click()
  await page.getByRole('button', { name: 'Load pinned source', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('source loading is unavailable')
  await expect(page.getByRole('article', { name: /^Changed file / })).toHaveCount(0)
  await expect(page.getByText('Deduplicate concurrent session refreshes', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible()
})

test('failed instance proof transmits no bearer token and clears saved credentials', async ({ page }): Promise<void> => {
  const state = await connection()
  let bearerRequests = 0
  page.on('request', (request): void => { if (request.headers().authorization) bearerRequests++ })
  await page.route('**/instance-proof', async (route): Promise<void> => { await route.fulfill({ json: { origin: state.url, proof: 'untrusted' } }) })
  await page.goto(`/#token=${state.token}`)
  await expect(page.getByRole('alert')).toContainText('Cannot verify the local backend')
  expect(new URL(page.url()).hash).toBe('')
  expect(bearerRequests).toBe(0)
  expect(await page.evaluate((): string | null => sessionStorage.getItem('sheldon.connection.v1'))).toBe(null)
})
