import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { SourceResponse } from '../../src/api/contracts/source'
import { generate, load, open } from './helpers'

/**
 * Finds a question-triggering line number in the refresh fixture.
 * @param page Current source page.
 * @param side Original or head gutter.
 * @param coordinate Original line number.
 * @returns Gutter button.
 */
function number(page: Page, side: 'old' | 'head', coordinate: number): Locator {
  return page.getByRole('article', { name: 'Changed file src/auth/refresh.ts', exact: true }).getByRole('button', { name: `Ask about ${side} line ${coordinate}`, exact: true })
}

/**
 * Begins a real mouse drag without releasing it.
 * @param page Browser page.
 * @param first First interaction target.
 * @param last Last target, possibly earlier in visual order.
 */
async function drag(page: Page, first: Locator, last: Locator): Promise<void> {
  await first.scrollIntoViewIfNeeded()
  const start = await first.boundingBox()
  const end = await last.boundingBox()
  if (!start || !end) throw new Error('Expected visible targets.')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 })
}

test('only clicking a line number opens the textbox, with no secondary Ask action', async ({ page }, info): Promise<void> => {
  await open(page, 2001)
  await load(page)
  let sent = 0
  page.on('request', (request): void => { if (request.url().endsWith('/questions')) sent++ })
  const button = number(page, 'head', 18)
  const row = button.locator('..')
  await expect(row.locator('.syntax-token').first()).toBeVisible()
  await row.locator('.syntax-token').first().click()
  await row.locator('.sign').click()
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await expect(button).toHaveCSS('cursor', 'pointer')
  await button.click()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(composer).toContainText('Head L18–18')
  await expect(composer.getByRole('textbox', { name: 'Your question', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: /^Ask about selection$|^Ask about selected range$|^Select hunk$/ })).toHaveCount(0)
  expect(sent).toBe(0)
  await page.screenshot({ path: info.outputPath('gutter-click-question-dark.png') })
})

test('gutter drag release opens the complete forward range once, never while dragging', async ({ page }, info): Promise<void> => {
  await open(page, 2002)
  await load(page)
  let sent = 0
  page.on('request', (request): void => { if (request.url().endsWith('/questions')) sent++ })
  await drag(page, number(page, 'head', 18), number(page, 'head', 22))
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await page.mouse.up()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(composer).toContainText('Head L18–22')
  await expect(page.locator('.line.selected')).toHaveCount(5)
  expect(sent).toBe(0)
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.screenshot({ path: info.outputPath('gutter-drag-question-light.png') })
  await composer.getByRole('textbox').fill('Explain this selected range.')
  const admission = page.waitForResponse((response): boolean => response.url().endsWith('/questions'))
  await composer.getByRole('button', { name: 'Send question', exact: true }).click()
  const answer = await (await admission).json()
  expect(answer.reference.anchor).toMatchObject({ kind: 'lines', side: 'new', start: 18, end: 22 })
  expect(sent).toBe(1)
})

test('reverse gutter dragging keeps the old-side coordinates', async ({ page }): Promise<void> => {
  await open(page, 2003)
  await load(page)
  await drag(page, number(page, 'old', 18), number(page, 'old', 16))
  await page.mouse.up()
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toContainText('Old L16–18')
  await expect(page.locator('.line.selected')).toHaveCount(3)
})

test('cross-column and cross-hunk gutter drags cannot open a mismatched range', async ({ page }): Promise<void> => {
  await open(page, 2004)
  await load(page)
  await number(page, 'head', 12).click()
  await expect(page.getByRole('alert')).toContainText('Select changed text')
  await drag(page, number(page, 'old', 16), number(page, 'head', 18))
  await page.mouse.up()
  await expect(page.getByRole('alert')).toContainText('same old or head column and hunk')
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await page.route('**/api/reviews/*/source', async (route): Promise<void> => {
    const source = await (await route.fetch()).json() as SourceResponse
    if (source.state !== 'ready') throw new Error('Expected source.')
    const hunk = source.diff.files[0]!.hunks![0]!
    const row = hunk.lines.find((line): boolean => line.newLine === 18)!
    hunk.lines = [row]
    source.diff.files[0]!.hunks!.push({ ...structuredClone(hunk), id: 'separate-hunk', lines: [{ ...row, id: 'separate-line', newLine: 80 }] })
    await route.fulfill({ json: source })
  })
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  await expect(number(page, 'head', 80)).toBeVisible()
  await drag(page, number(page, 'head', 18), number(page, 'head', 80))
  await page.mouse.up()
  await expect(page.getByRole('alert')).toContainText('same old or head column and hunk')
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
})

test('code and sign drags remain ordinary text interaction and never open a textbox', async ({ page }): Promise<void> => {
  await open(page, 2008)
  await load(page)
  const first = number(page, 'head', 18).locator('..')
  const last = number(page, 'head', 22).locator('..')
  await drag(page, first.locator('code'), last.locator('code'))
  await page.mouse.up()
  expect(await page.evaluate((): string => window.getSelection()?.toString() ?? '')).toContain('requestToken')
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await drag(page, first.locator('.sign'), last.locator('.sign'))
  await page.mouse.up()
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
})

test('pointer cancellation and retained drafts never create or retarget a question', async ({ page }): Promise<void> => {
  await open(page, 2005)
  await load(page)
  await drag(page, number(page, 'head', 18), number(page, 'head', 22))
  await number(page, 'head', 22).dispatchEvent('pointercancel')
  await page.mouse.up()
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await number(page, 'head', 18).click()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await composer.getByRole('textbox').fill('Keep this question anchored here.')
  await expect(number(page, 'head', 22)).toBeDisabled()
  await number(page, 'head', 22).locator('..').locator('code').click()
  await expect(composer).toContainText('Head L18–18')
  await expect(composer.getByRole('textbox')).toHaveValue('Keep this question anchored here.')
})

test('semantic line-number activation opens the original-range textbox immediately', async ({ page }): Promise<void> => {
  await open(page, 2006)
  await load(page)
  await generate(page, 'semantic')
  await page.getByRole('article', { name: 'Semantic excerpt src/auth/refresh.ts', exact: true }).getByRole('button', { name: 'Ask about head line 18', exact: true }).click()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(composer).toContainText('Head L18–18')
  await expect(composer.getByRole('textbox')).toBeFocused()
})

test('keyboard activation uses the same direct line-number action', async ({ page }): Promise<void> => {
  await open(page, 2009)
  await load(page)
  await number(page, 'head', 18).focus()
  await number(page, 'head', 18).press('Enter')
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toContainText('Head L18–18')
})

test.describe('touch line-number interaction', (): void => {
  test.use({ hasTouch: true })

  test('scroll gestures are ignored while a deliberate gutter tap opens the question', async ({ page }): Promise<void> => {
    await page.setViewportSize({ width: 700, height: 800 })
    await open(page, 2007)
    await load(page)
    const button = number(page, 'head', 18)
    await button.scrollIntoViewIfNeeded()
    const box = await button.boundingBox()
    if (!box) throw new Error('Expected visible gutter.')
    const pointer = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + 10, clientY: box.y + 10 }
    await button.dispatchEvent('pointerdown', pointer)
    await button.dispatchEvent('pointermove', { ...pointer, clientY: pointer.clientY + 40 })
    await button.dispatchEvent('pointerup', { ...pointer, clientY: pointer.clientY + 40 })
    await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
    await page.touchscreen.tap(box.x + 10, box.y + 10)
    await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toContainText('Head L18–18')
  })
})
