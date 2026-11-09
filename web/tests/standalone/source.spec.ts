import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { digest } from '../../development/fixtures/source'
import type { SourceResponse } from '../../src/api/contracts/source'

/**
 * Opens an isolated PR through the normal product entry.
 * @param page Browser page.
 * @param number Unique registered PR number.
 */
async function open(page: Page, number: number): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Open a pull request', { exact: true }).fill(`https://github.com/acme/platform/pull/${number}`)
  await page.getByRole('button', { name: 'Open PR', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Deduplicate concurrent session refreshes #${number}` })).toBeVisible()
}

/**
 * Loads source only after explicit user activation.
 * @param page Browser page.
 */
async function load(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Load pinned source', exact: true }).click()
  await expect(page.getByRole('article', { name: /^Changed file / })).toHaveCount(3)
}

test('frontend starts without backend access and source loading remains explicit', async ({ page }): Promise<void> => {
  const external: string[] = []
  let sourceRequests = 0
  page.on('request', (request): void => {
    if (!request.url().startsWith('http://127.0.0.1:5176')) external.push(request.url())
    if (request.url().endsWith('/source')) sourceRequests++
  })
  await open(page, 1301)
  expect(sourceRequests).toBe(0)
  await expect(page.getByRole('button', { name: 'Open conversations panel', exact: true })).toBeVisible()
  await load(page)
  expect(sourceRequests).toBe(1)
  expect(external).toEqual([])
  await expect(page.locator('body')).not.toContainText(/mock only|mock data|mock mode|fictional|simulated|demo mode/i)
})

test('development API uses canonical Go identity and source response shapes', async ({ request }): Promise<void> => {
  const identity = 'github.com/acme/platform/pull/1302'
  const opened = await request.post('/api/open', { data: { url: 'https://github.com/Acme/Platform/pull/1302?tab=files#diff' } })
  expect(opened.status()).toBe(202)
  expect(await opened.json()).toEqual({ prID: digest(identity), route: `/reviews/${digest(identity)}` })
  const metadata = await request.get(`/api/reviews/${digest(identity)}`)
  expect(await metadata.json()).toMatchObject({ id: digest(identity), owner: 'acme', repository: 'platform', number: '1302', url: `https://${identity}` })
  const response = await request.post(`/api/reviews/${digest(identity)}/source`, { data: { action: 'load' } })
  const result = await response.json() as SourceResponse
  expect(result.state).toBe('ready')
  if (result.state !== 'ready') throw new Error('Expected a complete comparison.')
  expect(result.diff.complete).toBe(true)
  expect(result.diff.revisionID).toBe(digest([digest(identity), result.diff.revision.baseSHA, result.diff.revision.headSHA, result.diff.revision.mergeBaseSHA].join('\n')))
  for (const file of result.diff.files) {
    expect(file.status).toBe('modified')
    for (const hunk of file.hunks ?? []) {
      expect(hunk.lines.filter((line): boolean => line.oldLine !== undefined)).toHaveLength(hunk.old.count)
      expect(hunk.lines.filter((line): boolean => line.newLine !== undefined)).toHaveLength(hunk.new.count)
    }
  }
  expect(response.headers()['cache-control']).toBe('no-store')
  expect((await request.post(`/api/reviews/${digest(identity)}/source`, { data: { action: 'load', extra: true } })).status()).toBe(400)
  expect((await request.post('/api/open', { data: { url: 'https://github.com/invalid_owner/repo/pull/1' } })).status()).toBe(400)
  expect((await request.post('/api/open', { data: { url: 'https://github.com/acme/platform/pull/0' } })).status()).toBe(400)
  expect((await request.post('/api/open', { data: { url: 'https://github.com/acme/platform/pull/01' } })).status()).toBe(400)
  expect((await request.post('/api/open', { data: { url: 'https://github.com/acme/../platform/pull/1' } })).status()).toBe(400)
  expect((await request.post('/api/open', { data: { url: 'https://github.com/acme/platform/pull/18446744073709551616' } })).status()).toBe(400)
  expect((await request.post('/api/open', { data: 'not json' })).status()).toBe(415)
  expect((await request.post('/api/open', { data: { url: 'x'.repeat(4100) } })).status()).toBe(413)
  expect((await request.get('/api/reviews')).status()).toBe(404)
})

test('tree navigation, theme and rails retain local progress without loading source', async ({ page }): Promise<void> => {
  await open(page, 1303)
  await load(page)
  let sourceRequests = 0
  page.on('request', (request): void => { if (request.url().endsWith('/source')) sourceRequests++ })
  await page.getByRole('button', { name: 'Mark understood src/auth/refresh.ts', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
  await page.getByRole('navigation', { name: 'Changed files', exact: true }).getByRole('button', { name: 'src/auth/store.ts M', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'src/auth/store.ts', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  expect(await page.locator('.icon').first().evaluate((icon): boolean => getComputedStyle(icon).maskImage !== 'none')).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Collapse files panel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open files panel', exact: true })).toBeFocused()
  await expect(page.getByText('33%', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open conversations panel', exact: true }).click()
  await expect(page.getByText('No conversations yet.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Collapse conversations panel', exact: true }).click()
  await page.getByRole('button', { name: 'Open files panel', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
  expect(sourceRequests).toBe(0)
})

test('failed refresh retains readable source and understanding until explicit retry', async ({ page }): Promise<void> => {
  await open(page, 1304)
  await load(page)
  await page.getByRole('button', { name: 'Mark understood src/auth/refresh.ts', exact: true }).click()
  await page.route('**/api/reviews/*/source', async (route): Promise<void> => { await route.fulfill({ status: 502, json: { error: 'Cannot prepare source. Retry explicitly.' } }) })
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cannot prepare source. Retry explicitly.')
  await expect(page.getByRole('article', { name: /^Changed file / })).toHaveCount(3)
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
  await page.unroute('**/api/reviews/*/source')
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
})

test('old source response cannot replace a newly routed PR', async ({ page }): Promise<void> => {
  await open(page, 1305)
  let release!: () => void
  let entered!: () => void
  let completed!: () => void
  const held = new Promise<void>((resolve): void => { release = resolve })
  const received = new Promise<void>((resolve): void => { entered = resolve })
  const finished = new Promise<void>((resolve): void => { completed = resolve })
  await page.route('**/api/reviews/*/source', async (route): Promise<void> => {
    const response = await route.fetch()
    entered()
    await held
    try { await route.fulfill({ response }) } catch {} finally { completed() }
  })
  await page.getByRole('button', { name: 'Load pinned source', exact: true }).click()
  await received
  await page.getByRole('link', { name: 'Sheldon home', exact: true }).click()
  await page.getByLabel('Open a pull request', { exact: true }).fill('https://github.com/acme/platform/pull/1306')
  await page.getByRole('button', { name: 'Open PR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Deduplicate concurrent session refreshes #1306' })).toBeVisible()
  release()
  await finished
  await expect(page.getByRole('button', { name: 'Load pinned source', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('unsupported library and Overview say Coming soon without fake operations', async ({ page }): Promise<void> => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your pull requests, together' })).toBeVisible()
  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible()
  await page.getByText('Asset licenses', { exact: true }).click()
  for (const link of await page.locator('.licenses a').all()) {
    const response = await page.request.get((await link.getAttribute('href'))!)
    expect(response.status()).toBe(200)
    expect(await response.text()).toMatch(/Apache License|SIL OPEN FONT LICENSE|MIT License/)
  }
  await open(page, 1307)
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pull request overview', exact: true })).toBeVisible()
  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible()
})

test('long literal source cannot inject markup or push file actions offscreen', async ({ page }): Promise<void> => {
  await open(page, 1311)
  const literal = '<img src="/unexpected-source-image" onerror="alert(1)"> ' + 'literal source '.repeat(250)
  await page.route('**/api/reviews/*/source', async (route): Promise<void> => {
    const result = await (await route.fetch()).json() as SourceResponse
    if (result.state !== 'ready') throw new Error('Expected ready source.')
    result.diff.files[0]!.hunks![0]!.lines[0]!.text = literal
    await route.fulfill({ json: result })
  })
  await load(page)
  const article = page.getByRole('article', { name: 'Changed file src/auth/refresh.ts', exact: true })
  await expect(article.locator('code').first()).toHaveText(literal)
  await expect(article.locator('img, script')).toHaveCount(0)
  const button = await article.getByRole('button', { name: 'Mark understood src/auth/refresh.ts', exact: true }).boundingBox()
  const bounds = await article.boundingBox()
  expect(button!.x + button!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
  await article.getByRole('button', { name: 'Mark understood src/auth/refresh.ts', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
})

test('source reopens after reload but is not automatically loaded', async ({ page }): Promise<void> => {
  await open(page, 1308)
  await load(page)
  await page.getByRole('button', { name: 'Mark understood src/auth/refresh.ts', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Load pinned source', exact: true })).toBeVisible()
  await load(page)
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '0')
})

test('disconnect clears page state and reconnects without reading real credentials', async ({ page }): Promise<void> => {
  await open(page, 1310)
  await load(page)
  await page.evaluate((): void => sessionStorage.setItem('sheldon.connection.v1', 'leave-existing-credentials-alone'))
  await page.getByRole('button', { name: 'Connected', exact: true }).click()
  await page.getByRole('button', { name: 'Disconnect backend', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByLabel('API token', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Connect backend', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Load pinned source', exact: true })).toBeVisible()
  expect(await page.evaluate((): string | null => sessionStorage.getItem('sheldon.connection.v1'))).toBe('leave-existing-credentials-alone')
})

test('desktop and narrow themes have reachable controls and local artwork', async ({ page }, info): Promise<void> => {
  await open(page, 1309)
  await load(page)
  expect(await page.locator('.brand img').evaluate((image): boolean => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true)
  await page.screenshot({ path: info.outputPath('source-dark.png') })
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.screenshot({ path: info.outputPath('source-light.png') })
  await page.setViewportSize({ width: 700, height: 1000 })
  await expect(page.getByRole('button', { name: 'Refresh source', exact: true })).toBeVisible()
  const header = await page.getByRole('region', { name: 'Pull request context', exact: true }).boundingBox()
  const navigation = await page.getByRole('navigation', { name: 'Review features', exact: true }).boundingBox()
  expect(header!.y + header!.height).toBeLessThanOrEqual(navigation!.y)
  await page.getByRole('button', { name: 'Open conversations panel', exact: true }).click()
  await page.getByRole('button', { name: 'Collapse conversations panel', exact: true }).click()
  await page.locator('main').evaluate((main): void => { main.scrollTop = 0 })
  await page.screenshot({ path: info.outputPath('source-narrow.png'), fullPage: true })
  expect(await page.evaluate((): boolean => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.addStyleTag({ content: 'html { zoom: 2; }' })
  await page.screenshot({ path: info.outputPath('source-scaled.png'), fullPage: true })
  expect(await page.evaluate((): boolean => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
