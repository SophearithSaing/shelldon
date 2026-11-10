import { expect, test } from '@playwright/test'
import { parsePR } from '../../development/fixtures/source'
import type { LibraryResult } from '../../src/api/contracts/library'

test('library searches and filters real registered rows before opening without source work', async ({ page }): Promise<void> => {
  let sourceRequests = 0
  page.on('request', (request): void => { if (request.url().endsWith('/source')) sourceRequests++ })
  await page.goto('/')
  const library = page.locator('.pr-library')
  const rows = library.locator('.pr-row')
  await expect(rows.first()).toBeVisible()
  await expect(library.getByRole('navigation', { name: 'PR status', exact: true }).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
  await library.getByRole('searchbox', { name: 'Search pull requests', exact: true }).fill('acme/web')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(rows).toHaveCount(2)
  const filters = library.getByRole('navigation', { name: 'PR status', exact: true })
  await expect(filters.getByRole('button', { name: /^All/ })).toContainText('2')
  await expect(filters.getByRole('button', { name: /^Open/ })).toContainText('1')
  await expect(filters.getByRole('button', { name: /^Merged/ })).toContainText('1')
  await filters.getByRole('button', { name: /^Open/ }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Respect reduced motion in transitions')
  await filters.getByRole('button', { name: /^Merged/ }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Keep source actions reachable at narrow widths')
  await filters.getByRole('button', { name: /^All/ }).click()
  await expect(rows).toHaveCount(2)
  await library.getByRole('searchbox').fill('#245')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(rows).toHaveCount(1)
  const pr = parsePR('https://github.com/acme/web/pull/245')!
  await rows.first().locator('.pr-link').click()
  await expect(page).toHaveURL(new RegExp(`/reviews/${pr.id}$`))
  await expect(page.getByRole('heading', { name: 'Respect reduced motion in transitions #245', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load pinned source', exact: true })).toBeVisible()
  expect(sourceRequests).toBe(0)
})

test('new registration remains discoverable as unknown until explicit metadata refresh', async ({ page }): Promise<void> => {
  await page.goto('/')
  await page.getByLabel('Open a pull request', { exact: true }).fill('https://github.com/isolated/library/pull/2201')
  await page.getByRole('button', { name: 'Open PR', exact: true }).click()
  await page.getByRole('link', { name: 'Sheldon home', exact: true }).click()
  const library = page.locator('.pr-library')
  await library.getByRole('searchbox').fill('#2201')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  const row = library.locator('.pr-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Unknown')
  await expect(row).toContainText('Metadata not fetched')
  let refreshes = 0
  let sourceRequests = 0
  page.on('request', (request): void => {
    if (request.url().endsWith('/metadata/refresh')) refreshes++
    if (request.url().endsWith('/source')) sourceRequests++
  })
  await row.getByRole('button', { name: 'Refresh metadata for Deduplicate concurrent session refreshes', exact: true }).click()
  await expect(row).toContainText('Open')
  await expect(row).toContainText('Checked Nov 10, 2026')
  await expect(row).not.toContainText('Metadata not fetched')
  expect(refreshes).toBe(1)
  expect(sourceRequests).toBe(0)
})

test('library and refresh failures retain rows and recover only through explicit reads', async ({ page }): Promise<void> => {
  await page.goto('/')
  const library = page.locator('.pr-library')
  await library.getByRole('searchbox').fill('acme/web')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  const rows = library.locator('.pr-row')
  await expect(rows).toHaveCount(2)
  await page.route('**/api/reviews/*/metadata/refresh', async (route): Promise<void> => {
    await route.fulfill({ status: 502, json: { error: 'GitHub metadata unavailable; cached data was preserved.' } })
  })
  await rows.first().getByRole('button', { name: /^Refresh metadata for/ }).click()
  await expect(page.getByRole('alert')).toContainText('cached data was preserved')
  await expect(rows).toHaveCount(2)
  await page.unroute('**/api/reviews/*/metadata/refresh')
  await page.route('**/api/reviews?*', async (route): Promise<void> => {
    await route.fulfill({ status: 500, json: { error: 'Cannot read PR library; existing data was preserved.' } })
  })
  await page.getByRole('button', { name: 'Reload library', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('existing data was preserved')
  await expect(rows).toHaveCount(2)
  await page.unroute('**/api/reviews?*')
  await page.getByRole('button', { name: 'Reload library', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(rows).toHaveCount(2)
})

test('development library enforces public query, refresh and cache-preservation contracts', async ({ request }): Promise<void> => {
  const pr = parsePR('https://github.com/isolated/library/pull/2202')!
  expect((await request.post('/api/open', { data: { url: pr.url } })).status()).toBe(202)
  const initialResponse = await request.get('/api/reviews?q=%232202&state=all&limit=50&offset=0')
  const initial = await initialResponse.json() as LibraryResult
  expect(initialResponse.status()).toBe(200)
  expect(initialResponse.headers()['cache-control']).toBe('no-store')
  expect(initial.total).toBe(1)
  expect(initial.counts).toEqual({ open: 0, merged: 0, closed: 0, unknown: 1, all: 1 })
  expect(initial.items[0]).toMatchObject({ route: `/reviews/${pr.id}`, state: 'unknown', metadataStatus: 'missing', createdAt: null, fetchedAt: null })
  const path = `/api/reviews/${pr.id}/metadata/refresh`
  const refreshed = await request.post(path, { data: {} })
  expect(refreshed.status()).toBe(200)
  const saved = await refreshed.json() as LibraryResult['items'][number]
  expect(saved).toMatchObject({ state: 'open', metadataStatus: 'cached', fetchedAt: '2026-11-10T01:00:00Z' })
  expect((await request.post(path, { data: {}, headers: { 'X-Sheldon-Scenario': 'metadata-failed' } })).status()).toBe(502)
  expect((await request.post(path, { data: {}, headers: { 'X-Sheldon-Scenario': 'metadata-busy' } })).status()).toBe(409)
  expect((await request.get('/api/reviews', { headers: { 'X-Sheldon-Scenario': 'library-failed' } })).status()).toBe(500)
  const reread = await (await request.get('/api/reviews?q=%232202')).json() as LibraryResult
  expect(reread.items[0]).toEqual(saved)
  expect((await request.post(path + '?x=1', { data: {} })).status()).toBe(404)
  expect((await request.post(`/api/reviews/${'a'.repeat(64)}/metadata/refresh`, { data: {} })).status()).toBe(404)
  expect((await request.post(path, { data: '{} {}', headers: { 'Content-Type': 'application/json' } })).status()).toBe(400)
  expect((await request.post(path, { data: { extra: true } })).status()).toBe(400)
  expect((await request.post(path, { data: '{}' + ' '.repeat(4096), headers: { 'Content-Type': 'application/json' } })).status()).toBe(413)
  expect((await request.post(path, { data: '{}', headers: { 'Content-Type': 'text/plain' } })).status()).toBe(415)
  for (const query of ['q=x&q=y', 'state=closed', 'state=', 'unknown=1', 'limit=0', 'limit=101', 'limit=01', 'limit=%2B1', 'offset=-1', 'offset=1000001', 'q=%ff', 'q=%', 'q=x;y', `q=${'x'.repeat(257)}`]) {
    expect((await request.get(`/api/reviews?${query}`)).status(), query).toBe(400)
  }
})

test('library pagination uses numeric PR ordering and advertised offsets', async ({ request }): Promise<void> => {
  await Promise.all([10, 2, 20, 1, 3].map(async (number): Promise<void> => {
    expect((await request.post('/api/open', { data: { url: `https://github.com/isolated/pagination/pull/${number}` } })).status()).toBe(202)
  }))
  const first = await (await request.get('/api/reviews?q=isolated/pagination&limit=2')).json() as LibraryResult
  expect(first.items.map((row): string => row.pr.number)).toEqual(['1', '2'])
  expect(first).toMatchObject({ total: 5, nextOffset: 2, counts: { all: 5, unknown: 5 } })
  const second = await (await request.get(`/api/reviews?q=isolated/pagination&limit=2&offset=${first.nextOffset}`)).json() as LibraryResult
  expect(second.items.map((row): string => row.pr.number)).toEqual(['3', '10'])
  expect(second.nextOffset).toBe(4)
  const last = await (await request.get(`/api/reviews?q=isolated/pagination&limit=2&offset=${second.nextOffset}`)).json() as LibraryResult
  expect(last.items.map((row): string => row.pr.number)).toEqual(['20'])
  expect(last.nextOffset).toBeNull()
})

test('load more stays bound to the successful query through search edits and failed reads', async ({ page, request }): Promise<void> => {
  await Promise.all(Array.from({ length: 52 }, async (_, index): Promise<void> => {
    expect((await request.post('/api/open', { data: { url: `https://github.com/isolated/query-pages/pull/${index + 1}` } })).status()).toBe(202)
  }))
  await page.goto('/')
  const library = page.locator('.pr-library')
  const search = library.getByRole('searchbox')
  const rows = library.locator('.pr-row')
  const more = library.getByRole('button', { name: 'Load more', exact: true })
  await search.fill('isolated/query-pages')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(rows).toHaveCount(50)
  await expect(more).toBeVisible()
  await search.fill('acme/web')
  await expect(more).toHaveCount(0)
  await search.fill('isolated/query-pages')
  await expect(more).toBeVisible()
  await more.click()
  await expect(rows).toHaveCount(52)
  await expect(rows.last()).toContainText('#52')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(rows).toHaveCount(50)
  await expect(more).toBeVisible()
  await page.route('**/api/reviews?*', async (route): Promise<void> => {
    await route.fulfill({ status: 500, json: { error: 'Cannot read PR library; existing data was preserved.' } })
  })
  await search.fill('acme/web')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(library.getByRole('alert')).toBeVisible()
  await expect(rows).toHaveCount(50)
  await search.fill('isolated/query-pages')
  await expect(more).toHaveCount(0)
  await page.unroute('**/api/reviews?*')
  await search.fill('acme/web')
  await library.getByRole('button', { name: 'Reload library', exact: true }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Keep source actions reachable at narrow widths')
  await expect(more).toHaveCount(0)
})

test('library presentation stays readable in both themes and narrow layouts', async ({ page }, info): Promise<void> => {
  await page.goto('/')
  const library = page.locator('.pr-library')
  await library.getByRole('searchbox').fill('acme/web')
  await library.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(library.locator('.pr-row')).toHaveCount(2)
  await library.scrollIntoViewIfNeeded()
  await library.screenshot({ path: info.outputPath('library-dark.png') })
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await library.screenshot({ path: info.outputPath('library-light.png') })
  await page.setViewportSize({ width: 700, height: 900 })
  await library.screenshot({ path: info.outputPath('library-narrow.png') })
  expect(await page.evaluate((): boolean => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(library.locator('.pr-link').first()).toBeVisible()
  await expect(library.locator('.row-action').first()).toBeVisible()
})
