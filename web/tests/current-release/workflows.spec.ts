import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { offlineCLI } from '../release/offline'
import type { OfflineCLI, NativeAudit } from '../release/offline'
import type { Answer } from '../../src/api/contracts/questions'
import type { SourceResponse } from '../../src/api/contracts/source'
import { preserveResponseBodies } from '../response-bodies'

/**
 * Reads native prompt records without exposing credentials or protocol bodies.
 * @param fixture Owned offline tools.
 * @returns Prompt dispatch audit records.
 */
async function prompts(fixture: OfflineCLI): Promise<NativeAudit[]> {
  return (await fixture.nativeAudit()).filter((entry): boolean => entry.method === 'POST' && !!entry.path?.endsWith('/prompt'))
}

/**
 * Loads real pinned Git source through the embedded app.
 * @param page Authenticated release page.
 * @returns Authoritative source response.
 */
async function load(page: Page): Promise<SourceResponse> {
  const received = page.waitForResponse((response): boolean => response.request().method() === 'POST' && response.url().endsWith('/source'))
  await page.getByRole('button', { name: 'Load pinned source', exact: true }).click()
  const response = await received
  expect(response.status()).toBe(200)
  return await response.json() as SourceResponse
}

/**
 * Checks separate execution/saving completion in a canonical transcript.
 * @param view Conversation region.
 */
async function completed(view: Locator): Promise<void> {
  await expect(view.getByText('Execution: completed', { exact: true }).last()).toBeVisible()
  await expect(view.getByText('Saving: saved', { exact: true }).last()).toBeVisible()
}

test('clean embedded release serves local assets/licenses and contains no development API', async ({ page }): Promise<void> => {
  const record = JSON.parse((await readFile(process.env.SHELDON_RELEASE_STATE!)).subarray(1).toString()) as { url: string; token: string }
  const failures: string[] = []
  const scripts: string[] = []
  page.on('console', (message): void => { if (message.type() === 'error') failures.push(message.text()) })
  page.on('pageerror', (error): void => { failures.push(error.message) })
  page.on('response', (response): void => { if (new URL(response.url()).pathname.endsWith('.js')) scripts.push(response.url()) })
  const response = await page.goto(`${record.url}/#token=${record.token}`)
  expect(response?.headers()['content-security-policy']).not.toContain('unsafe-inline')
  await expect(page.getByRole('button', { name: 'Connected', exact: true })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
  await page.evaluate(async (): Promise<void> => { await Promise.all([document.fonts.load('400 13px "Shelldon Sans"'), document.fonts.load('400 11px "Shelldon Mono"')]); await document.fonts.ready })
  expect(await page.evaluate((): boolean => document.fonts.check('400 13px "Shelldon Sans"') && document.fonts.check('400 11px "Shelldon Mono"'))).toBe(true)
  expect(await page.locator('.brand img').evaluate((image): boolean => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true)
  expect(await page.locator('.icon').first().evaluate((icon): boolean => getComputedStyle(icon).maskImage !== 'none')).toBe(true)
  await page.getByText('Asset licenses', { exact: true }).click()
  for (const link of await page.locator('.licenses a').all()) {
    const license = await page.request.get(new URL((await link.getAttribute('href'))!, record.url).href)
    expect(license.headers()['content-type']).toContain('text/plain')
    expect((await license.text()).length).toBeGreaterThan(4000)
  }
  for (const script of scripts) expect(await (await page.request.get(script)).text()).not.toMatch(/sheldon-development-api|Deduplicate concurrent session refreshes|requestToken.mockRejectedValueOnce/)
  expect(failures).toEqual([])
})

test('real Git, durable questions, targeted Stop and exact-session restart work through the embedded UI', async ({ page }): Promise<void> => {
  test.setTimeout(120000)
  const fixture = await offlineCLI({ questions: true, nativePersistence: true })
  await preserveResponseBodies(page)
  try {
    await page.goto(await fixture.start('https://github.com/fixture/repo/pull/31'))
    const loaded = await load(page)
    if (loaded.state !== 'ready') throw new Error('Expected real pinned source.')
    expect(loaded.diff.revision.headSHA).toBe(fixture.firstHead)
    expect(loaded.diff.revision.mergeBaseSHA).toBe(fixture.mergeBase)
    await page.getByRole('navigation', { name: 'Changed files', exact: true }).getByRole('button', { name: /^shared.txt/ }).click()
    const file = page.getByRole('article', { name: 'Changed file shared.txt', exact: true })
    await file.getByRole('button', { name: 'Select head line 1', exact: true }).click()
    await file.getByRole('button', { name: 'Ask about selection', exact: true }).click()
    await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('Explain the original pinned change.')
    const admission = page.waitForResponse((response): boolean => response.url().endsWith('/questions'))
    await page.getByRole('button', { name: 'Send question', exact: true }).click()
    const answer = await (await admission).json() as Answer
    const inline = page.getByRole('region', { name: 'Inline conversation', exact: true })
    await expect(inline).toContainText('Synthetic fixture ')
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(1)
    const saved = JSON.parse(await readFile(join(dirname(fixture.stateFile), 'reviews', answer.prID, 'threads.json'), 'utf8'))
    expect(saved.threads[0].answers[0]).toMatchObject({ question: answer.question, state: 'pending', text: '' })
    await fixture.answer(1, 'succeeded')
    await completed(inline)
    await expect(inline).toContainText('Synthetic fixture answer <script>literal</script>.')
    await expect(inline.locator('script')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(/DO NOT DISPLAY FOREIGN TEXT|DO NOT DISPLAY HIDDEN REASONING/)
    await page.reload()
    await page.getByRole('button', { name: 'Questions', exact: true }).click()
    await page.getByRole('navigation', { name: 'Saved question threads', exact: true }).getByRole('button').click()
    const view = page.getByRole('region', { name: 'Conversation', exact: true })
    await expect(view).toContainText('Synthetic fixture answer <script>literal</script>.')
    await expect(view.getByRole('button', { name: 'Show inline', exact: true })).toBeDisabled()
    await view.getByRole('textbox').fill('Continue this exact original thread.')
    await view.getByRole('textbox').press('Enter')
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(2)
    await view.getByRole('button', { name: 'Stop this answer', exact: true }).click()
    await expect(view.getByText('Execution: interrupted', { exact: true })).toBeVisible()
    const originalPath = (await prompts(fixture))[0]!.path
    expect((await prompts(fixture))[1]!.path).toBe(originalPath)
    await fixture.stop()
    await page.goto(await fixture.start('https://github.com/fixture/repo/pull/31'))
    await page.getByRole('button', { name: 'Questions', exact: true }).click()
    await page.getByRole('navigation', { name: 'Saved question threads', exact: true }).getByRole('button').click()
    const restarted = page.getByRole('region', { name: 'Conversation', exact: true })
    await expect(restarted).toContainText('Synthetic fixture answer <script>literal</script>.')
    const continued = page.waitForResponse((response): boolean => response.url().endsWith('/answers'))
    await restarted.getByRole('textbox').fill('Verify explicit continuation after restart.')
    await restarted.getByRole('textbox').press('Enter')
    expect((await continued).status()).toBe(202)
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(3)
    expect((await prompts(fixture))[2]!.path).toBe(originalPath)
    expect((await fixture.nativeAudit()).filter((entry): boolean => entry.method === 'POST' && entry.path === '/api/session')).toHaveLength(1)
    await fixture.answer(3, 'succeeded')
    await expect(restarted.getByText('Execution: completed', { exact: true })).toHaveCount(2)
  } finally { await fixture.close() }
})

test('real quiz generation/check/cancellation persist and reopen without original cache or native tools', async ({ page }): Promise<void> => {
  test.setTimeout(120000)
  const fixture = await offlineCLI({ quizzes: true })
  await preserveResponseBodies(page)
  try {
    await page.goto(await fixture.start('https://github.com/fixture/repo/pull/31'))
    const loaded = await load(page)
    if (loaded.state !== 'ready') throw new Error('Expected source.')
    await page.getByRole('button', { name: 'Quiz', exact: true }).click()
    await page.getByRole('button', { name: 'Generate quiz', exact: true }).click()
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(1)
    await fixture.answer(1, 'succeeded')
    await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('radio').first().check()
    const checked = page.waitForResponse((response): boolean => response.url().endsWith('/check'))
    await page.getByRole('button', { name: 'Check answer', exact: true }).click()
    expect((await checked).status()).toBe(200)
    await expect(page.getByRole('region', { name: 'Checked explanation', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Regenerate quiz', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Regenerate quiz', exact: true }).click()
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(2)
    await page.getByRole('button', { name: 'Cancel generation', exact: true }).click()
    await expect(page.getByText('Last generation: cancelled', { exact: false })).toBeVisible({ timeout: 15000 })
    const audit = await fixture.nativeAudit()
    const gitAudit = await fixture.audit()
    await fixture.stop()
    await rename(fixture.cache, `${fixture.cache}-unavailable`)
    await rename(join(fixture.directory, 'tools', 'opencode'), join(fixture.directory, 'tools', 'opencode-unavailable'))
    await page.goto(await fixture.start('https://github.com/fixture/repo/pull/31'))
    await page.getByRole('button', { name: 'Quiz', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await page.getByRole('radio').first().check()
    await page.getByRole('button', { name: 'Check answer', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Checked explanation', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'View in original diff', exact: true }).first()).toBeDisabled()
    expect(await fixture.nativeAudit()).toHaveLength(audit.length)
    expect(await fixture.audit()).toHaveLength(gitAudit.length)
  } finally { await fixture.close() }
})

test('real semantic generation anchors questions and retains source-free saved grouping', async ({ page }): Promise<void> => {
  test.setTimeout(120000)
  const fixture = await offlineCLI({ semantics: true })
  await preserveResponseBodies(page)
  try {
    await page.goto(await fixture.start('https://github.com/fixture/repo/pull/31'))
    await load(page)
    await page.getByRole('button', { name: 'Semantic review', exact: true }).click()
    await page.getByRole('button', { name: 'Generate semantic review', exact: true }).click()
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(1)
    await fixture.answer(1, 'succeeded')
    await expect(page.getByRole('heading', { name: 'Synthetic related change', exact: true })).toBeVisible({ timeout: 15000 })
    const excerpt = page.getByRole('article', { name: /^Semantic excerpt / }).first()
    await excerpt.getByRole('button', { name: /Select (old|head) line/ }).first().click()
    await excerpt.getByRole('button', { name: 'Ask about selected range', exact: true }).click()
    expect((await prompts(fixture)).length).toBe(1)
    await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('Explain this original semantic range.')
    await page.getByRole('button', { name: 'Send question', exact: true }).click()
    await completed(page.getByRole('region', { name: 'Inline conversation', exact: true }))
    await expect.poll(async (): Promise<number> => (await prompts(fixture)).length).toBe(2)
    expect((await prompts(fixture))[1]!.pid).not.toBe((await prompts(fixture))[0]!.pid)
    const audit = await fixture.nativeAudit()
    await fixture.stop()
    await rename(fixture.cache, `${fixture.cache}-unavailable`)
    await rename(join(fixture.directory, 'tools', 'opencode'), join(fixture.directory, 'tools', 'opencode-unavailable'))
    await page.goto(await fixture.start('https://github.com/fixture/repo/pull/31'))
    await page.getByRole('button', { name: 'Semantic review', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Synthetic related change', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'View in original diff', exact: true }).first()).toBeDisabled()
    expect(await fixture.nativeAudit()).toHaveLength(audit.length)
  } finally { await fixture.close() }
})
