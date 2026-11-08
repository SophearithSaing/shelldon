import { expect, test, type Page } from '@playwright/test'
import { digest, registered, sourceFixture } from './runtime-fixture'
import type { QuestionAnswer } from '../src/runtime/questions'
import type { SourceResponse } from '../src/runtime/source'

test.use({ baseURL: 'http://127.0.0.1:5175' })

/** Opens deterministic renderer source without Git or live inference.
 * @param page Browser fixture.
 * @param number Distinct fixture PR.
 * @returns Source and explicit request counters.
 */
async function workspace(page: Page, number: number): Promise<{ source: SourceResponse; requests: { source: number; questions: number; observations: number } }> {
  const pr = await registered(page, number)
  const source = sourceFixture(pr, 3)
  const requests = { source: 0, questions: 0, observations: 0 }
  let answer: QuestionAnswer
  await page.route(`**/api/reviews/${pr.id}/source`, async (route): Promise<void> => { requests.source++; await route.fulfill({ json: source }) })
  await page.route(`**/api/reviews/${pr.id}/questions`, async (route): Promise<void> => {
    requests.questions++
    const input = route.request().postDataJSON()
    answer = { answerID: digest(`redesign-answer-${number}`), threadID: digest(`redesign-thread-${number}`), prID: pr.id, revisionID: source.diff!.revisionID, question: input.question, text: '', state: 'pending', stopRequested: false, executionUnknown: false, persistence: 'saved', savedVersion: '1', reference: { revisionID: source.diff!.revisionID, anchor: input.anchor } }
    await route.fulfill({ status: 202, json: answer })
  })
  await page.route(`**/api/reviews/${pr.id}/threads/*/answers/*/events`, async (route): Promise<void> => {
    requests.observations++
    await route.fulfill({ contentType: 'text/event-stream', body: `event: answer\ndata: ${JSON.stringify({ ...answer, text: 'Synthetic redesign answer, not live inference.', state: 'completed', savedVersion: '2' })}\n\n` })
  })
  await page.getByRole('button', { name: 'Load pinned source', exact: true }).click()
  await expect(page.getByRole('article', { name: /^Changed file/ })).toHaveCount(3)
  return { source, requests }
}

/** Exercises continuous reading, revision-local progress and palette-only changes.
 * @param fixtures Browser fixture.
 * @param info Screenshot output location.
 */
test('continuous files retain a pinned draft through tree, rails and both themes', async ({ page }, info): Promise<void> => {
  const f = await workspace(page, 980)
  const first = page.getByRole('article', { name: 'Changed file src/file0000.ts', exact: true })
  const second = page.getByRole('article', { name: 'Changed file src/file0001.ts', exact: true })
  await first.getByRole('button', { name: 'Select head line 1', exact: true }).click()
  await first.getByRole('button', { name: 'Ask about selection', exact: true }).click()
  const draft = first.getByRole('textbox', { name: 'Your question', exact: true })
  await draft.fill('Keep this exact original draft')
  await first.getByRole('button', { name: 'Mark understood src/file0000.ts', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
  await page.getByRole('button', { name: 'src/file0001.ts', exact: true }).click()
  await expect(second.getByRole('heading')).toBeFocused()
  await expect(page.getByRole('button', { name: 'src/file0001.ts', exact: true })).toHaveAttribute('aria-current', 'true')
  await second.getByRole('button', { name: 'Select head line 1', exact: true }).click()
  await expect(second.getByRole('button', { name: 'Ask about selection', exact: true })).toBeDisabled()
  await expect(draft).toHaveValue('Keep this exact original draft')
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  expect(f.requests.source).toBe(1)
  await page.locator('.file-disclosure > summary').click()
  await expect(page.locator('.rail-progress')).toHaveText('33%')
  await page.getByRole('button', { name: 'Open conversations panel', exact: true }).click()
  await page.getByRole('button', { name: 'Close conversation', exact: true }).click()
  await page.locator('.file-disclosure > summary').click()
  await page.getByRole('button', { name: 'src/file0000.ts', exact: true }).click()
  for (const theme of ['light', 'dark'] as const) {
    await page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(draft).toHaveValue('Keep this exact original draft')
    await page.screenshot({ path: info.outputPath(`continuous-${theme}-1440.png`) })
  }
  await first.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  await expect.poll((): number => f.requests.source).toBe(2)
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
  Object.assign(f.source, sourceFixture(f.source.pr, 3, 'f'.repeat(40)))
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '0')
  expect(f.requests.questions).toBe(0)
})

/** Proves inline and panel are views of one thread and one observer.
 * @param fixtures Browser fixture.
 * @param info Screenshot output location.
 */
test('inline and panel synchronize a canonical draft without duplicate execution', async ({ page }, info): Promise<void> => {
  const f = await workspace(page, 981)
  const first = page.getByRole('article', { name: 'Changed file src/file0000.ts', exact: true })
  await first.getByRole('button', { name: 'Select head line 1', exact: true }).click()
  await first.getByRole('button', { name: 'Ask about selection', exact: true }).click()
  await first.getByRole('textbox', { name: 'Your question', exact: true }).fill('Explain the synthetic change')
  await first.getByRole('button', { name: 'Send question', exact: true }).click()
  const inline = first.getByRole('region', { name: 'Inline conversation', exact: true })
  await expect(inline).toContainText('Synthetic redesign answer, not live inference.')
  await expect(page.getByRole('complementary', { name: 'Question conversation', exact: true })).not.toBeVisible()
  await inline.getByRole('textbox', { name: 'Follow up in this thread', exact: true }).fill('One shared unsent follow-up')
  await inline.getByRole('button', { name: 'Open in panel', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Question conversation', exact: true })
  await expect(panel.getByRole('textbox', { name: 'Follow up in this thread', exact: true })).toHaveValue('One shared unsent follow-up')
  await panel.getByRole('textbox', { name: 'Follow up in this thread', exact: true }).fill('Edited from the panel')
  await expect(inline.getByRole('textbox', { name: 'Follow up in this thread', exact: true })).toHaveValue('Edited from the panel')
  const ids = await page.locator('[id]').evaluateAll((elements): string[] => elements.map((element): string => element.id))
  expect(new Set(ids).size).toBe(ids.length)
  await first.getByRole('button', { name: 'Hide inline', exact: true }).click()
  await panel.getByRole('button', { name: 'Show inline', exact: true }).click()
  await expect(inline.getByRole('textbox', { name: 'Follow up in this thread', exact: true })).toHaveValue('Edited from the panel')
  for (const theme of ['light', 'dark'] as const) {
    await page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true }).click()
    await page.screenshot({ path: info.outputPath(`conversation-${theme}-1440.png`) })
  }
  await page.setViewportSize({ width: 700, height: 900 })
  await panel.getByRole('textbox', { name: 'Follow up in this thread', exact: true }).scrollIntoViewIfNeeded()
  await expect(panel.getByRole('textbox', { name: 'Follow up in this thread', exact: true })).toBeInViewport()
  expect(await page.evaluate((): boolean => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('conversation-700.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.evaluate((): void => { document.documentElement.style.fontSize = '200%' })
  expect(await page.evaluate((): boolean => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('conversation-text-200.png'), fullPage: true })
  expect(f.requests).toEqual({ source: 1, questions: 1, observations: 1 })
})
