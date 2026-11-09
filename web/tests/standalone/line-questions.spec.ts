import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { SourceResponse } from '../../src/api/contracts/source'
import { generate, load, open } from './helpers'

/**
 * Finds the actual code row rather than its gutter selection control.
 * @param page Current source page.
 * @param side Original or head coordinate.
 * @param coordinate Original line number.
 * @returns Literal code row in the refresh fixture.
 */
function codeRow(page: Page, side: 'old' | 'head', coordinate: number): Locator {
  return page.getByRole('article', { name: 'Changed file src/auth/refresh.ts', exact: true }).getByRole('button', { name: `Select ${side} line ${coordinate}`, exact: true }).locator('..')
}

/**
 * Begins a real mouse selection across syntax-token spans without releasing it.
 * @param page Browser page.
 * @param first First code row.
 * @param last Last code row, possibly earlier in visual order.
 */
async function drag(page: Page, first: Locator, last: Locator): Promise<void> {
  await first.scrollIntoViewIfNeeded()
  const start = await first.locator('code').boundingBox()
  const end = await last.locator('code').boundingBox()
  if (!start || !end) throw new Error('Expected visible source rows.')
  await page.mouse.move(start.x + 6, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + Math.min(100, end.width - 2), end.y + end.height / 2, { steps: 10 })
}

test('clicking highlighted code immediately opens a single-line question without inference', async ({ page }, info): Promise<void> => {
  await open(page, 2001)
  await load(page)
  let sent = 0
  page.on('request', (request): void => { if (request.url().endsWith('/questions')) sent++ })
  const row = codeRow(page, 'head', 18)
  await expect(row.locator('.syntax-token').first()).toBeVisible()
  await row.locator('.syntax-token').first().click()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(composer).toContainText('Head L18–18')
  await expect(composer.getByRole('textbox', { name: 'Your question', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Ask about selection', exact: true })).toHaveCount(0)
  await expect(composer.getByRole('button', { name: 'Send question', exact: true })).toBeDisabled()
  expect(sent).toBe(0)
  await page.screenshot({ path: info.outputPath('click-line-question-dark.png') })
})

test('drag release opens the complete forward range once, never while dragging', async ({ page }, info): Promise<void> => {
  await open(page, 2002)
  await load(page)
  let sent = 0
  page.on('request', (request): void => { if (request.url().endsWith('/questions')) sent++ })
  await drag(page, codeRow(page, 'head', 18), codeRow(page, 'head', 22))
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await page.mouse.up()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(composer).toContainText('Head L18–22')
  await expect(page.locator('.line.selected')).toHaveCount(5)
  expect(sent).toBe(0)
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.screenshot({ path: info.outputPath('drag-range-question-light.png') })
  await composer.getByRole('textbox').fill('Explain this selected range.')
  const admission = page.waitForResponse((response): boolean => response.url().endsWith('/questions'))
  await composer.getByRole('button', { name: 'Send question', exact: true }).click()
  const answer = await (await admission).json()
  expect(answer.reference.anchor).toMatchObject({ kind: 'lines', side: 'new', start: 18, end: 22 })
  expect(sent).toBe(1)
})

test('reverse dragging removed rows keeps the old-side coordinates', async ({ page }): Promise<void> => {
  await open(page, 2003)
  await load(page)
  await drag(page, codeRow(page, 'old', 18), codeRow(page, 'old', 16))
  await page.mouse.up()
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toContainText('Old L16–18')
  await expect(page.locator('.line.selected')).toHaveCount(3)
})

test('mixed-side and cross-hunk drags do not silently drop source or open a stale selection', async ({ page }): Promise<void> => {
  await open(page, 2004)
  await load(page)
  await codeRow(page, 'head', 15).getByRole('button', { name: 'Select head line 15', exact: true }).click()
  await codeRow(page, 'head', 12).locator('code').click()
  await expect(page.getByRole('alert')).toContainText('Select changed text')
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await drag(page, codeRow(page, 'old', 16), codeRow(page, 'head', 18))
  await page.mouse.up()
  await expect(page.getByRole('alert')).toContainText('one side within one hunk')
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
  await expect(codeRow(page, 'head', 80)).toBeVisible()
  await drag(page, codeRow(page, 'head', 18), codeRow(page, 'head', 80))
  await page.mouse.up()
  await expect(page.getByRole('alert')).toContainText('one side within one hunk')
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
})

test('pointer cancellation and retained drafts never create or retarget a question', async ({ page }): Promise<void> => {
  await open(page, 2005)
  await load(page)
  await drag(page, codeRow(page, 'head', 18), codeRow(page, 'head', 22))
  await codeRow(page, 'head', 22).dispatchEvent('pointercancel')
  await page.mouse.up()
  await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
  await codeRow(page, 'head', 18).locator('code').click()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await composer.getByRole('textbox').fill('Keep this question anchored here.')
  await codeRow(page, 'head', 22).locator('code').click()
  await expect(composer).toContainText('Head L18–18')
  await expect(composer.getByRole('textbox')).toHaveValue('Keep this question anchored here.')
  await expect(page.getByRole('button', { name: 'Refresh source', exact: true })).toBeDisabled()
})

test('semantic code clicks open the original-range composer without an extra Ask action', async ({ page }): Promise<void> => {
  await open(page, 2006)
  await load(page)
  await generate(page, 'semantic')
  const excerpt = page.getByRole('article', { name: 'Semantic excerpt src/auth/refresh.ts', exact: true })
  await excerpt.getByRole('button', { name: 'Select head line 18', exact: true }).locator('..').locator('code').click()
  const composer = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(composer).toContainText('Head L18–18')
  await expect(composer.getByRole('textbox')).toBeFocused()
})

test.describe('touch line interaction', (): void => {
  test.use({ hasTouch: true })

  test('scroll gestures are ignored while a deliberate tap opens the question', async ({ page }): Promise<void> => {
    await page.setViewportSize({ width: 700, height: 800 })
    await open(page, 2007)
    await load(page)
    const code = codeRow(page, 'head', 18).locator('code')
    await code.scrollIntoViewIfNeeded()
    const box = await code.boundingBox()
    if (!box) throw new Error('Expected visible source.')
    const pointer = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + 10, clientY: box.y + 10 }
    await code.dispatchEvent('pointerdown', pointer)
    await code.dispatchEvent('pointermove', { ...pointer, clientY: pointer.clientY + 40 })
    await code.dispatchEvent('pointerup', { ...pointer, clientY: pointer.clientY + 40 })
    await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toHaveCount(0)
    await page.touchscreen.tap(box.x + 10, box.y + 10)
    await expect(page.getByRole('region', { name: 'Initial source question', exact: true })).toContainText('Head L18–18')
  })
})
