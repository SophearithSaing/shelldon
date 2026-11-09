import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { generate, load, open } from './helpers'

/**
 * Confirms an explicit replacement through the shared modal.
 * @param page Browser page.
 * @param kind Generation feature label.
 */
async function regenerate(page: Page, kind: 'quiz' | 'semantic review'): Promise<void> {
  await page.getByRole('button', { name: `Regenerate ${kind}`, exact: true }).click()
  await page.getByRole('dialog', { name: `Regenerate ${kind}?`, exact: true }).getByRole('button', { name: `Regenerate ${kind}`, exact: true }).click()
}

test('quiz entry reads saved state without inference; checks reveal only one key and retry does not regenerate', async ({ page }): Promise<void> => {
  await open(page, 1501)
  let generations = 0
  let checks = 0
  page.on('request', (request): void => {
    if (request.method() === 'POST' && request.url().endsWith('/quiz/generations')) generations++
    if (request.url().endsWith('/check')) checks++
  })
  await page.getByRole('button', { name: 'Quiz', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Generate quiz', exact: true })).toBeDisabled()
  expect(generations).toBe(0)
  await page.getByRole('button', { name: 'Open Files changed', exact: true }).click()
  await load(page)
  await generate(page, 'quiz')
  expect(generations).toBe(1)
  const savedResponse = await page.request.get(`${new URL(page.url()).pathname.replace('/reviews/', '/api/reviews/')}/quiz`)
  const saved = await savedResponse.json()
  expect(saved.quiz.questions).toHaveLength(5)
  expect(JSON.stringify(saved)).not.toMatch(/correctChoiceID|explanation|evidence/)
  const card = page.getByRole('article', { name: 'Quiz question 1', exact: true })
  await card.getByRole('radio', { name: 'Each always starts a separate network request.', exact: true }).check()
  await expect(card.getByRole('region', { name: 'Checked explanation', exact: true })).toHaveCount(0)
  await card.getByRole('button', { name: 'Check answer', exact: true }).click()
  await expect(card.getByRole('heading', { name: 'Not quite.', exact: true })).toBeVisible()
  await expect(card.getByRole('radio', { name: /Each always starts/ })).toBeChecked()
  expect(checks).toBe(1)
  await page.getByRole('button', { name: 'Question 5', exact: true }).click()
  await page.getByRole('button', { name: 'See results', exact: true }).click()
  await expect(page.getByRole('heading', { name: '0 of 1 checked answers correct', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  expect(generations).toBe(1)
  await page.getByRole('button', { name: /^Files changed/ }).click()
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '0')
})

test('saved quiz reopens unchecked after reload without loading source or generating', async ({ page }): Promise<void> => {
  await open(page, 1502)
  await load(page)
  await generate(page, 'quiz')
  await page.getByRole('radio', { name: 'Both await the same in-flight refresh operation.', exact: true }).check()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'That’s right.', exact: true })).toBeVisible()
  let work = 0
  page.on('request', (request): void => { if (request.method() === 'POST' && /\/(source|generations)$/.test(request.url())) work++ })
  await page.reload()
  await page.getByRole('button', { name: 'Quiz', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Both await the same in-flight refresh operation.', exact: true }).check()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View in original diff', exact: true })).toBeDisabled()
  expect(work).toBe(0)
})

test('generation replacement confirms and cancellation preserves the previous quiz and practice', async ({ page }): Promise<void> => {
  await open(page, 1503)
  await load(page)
  await generate(page, 'quiz')
  await page.getByRole('radio', { name: 'Each always starts a separate network request.', exact: true }).check()
  await page.getByRole('button', { name: 'Regenerate quiz', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep current result', exact: true }).click()
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
  await regenerate(page, 'quiz')
  await page.getByRole('button', { name: 'Cancel generation', exact: true }).click()
  await expect(page.getByText('Last generation: cancelled', { exact: false })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Each always starts a separate network request.', exact: true })).toBeChecked()
  await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
})

test('uncertain saving retains prior quiz and requires explicit saved refresh before another mutation', async ({ page }): Promise<void> => {
  await open(page, 1504)
  await load(page)
  await generate(page, 'quiz')
  await page.setExtraHTTPHeaders({ 'X-Sheldon-Scenario': 'generation-save-uncertain' })
  await regenerate(page, 'quiz')
  await expect(page.getByText('Generation or saving is uncertain.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Regenerate quiz', exact: true })).toBeDisabled()
  await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Refresh saved quiz', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Regenerate quiz', exact: true })).toBeEnabled()
})

test('quiz and semantic generation remain separate and accepted work continues across feature departure', async ({ page }): Promise<void> => {
  await open(page, 1505)
  await load(page)
  let admissions = 0
  page.on('request', (request): void => { if (request.url().endsWith('/questions')) admissions++ })
  await page.getByRole('button', { name: 'Quiz', exact: true }).click()
  await page.getByRole('button', { name: 'Generate quiz', exact: true }).click()
  await page.getByRole('button', { name: 'Semantic review', exact: true }).click()
  await page.getByRole('button', { name: 'Generate semantic review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'One refresh, many callers', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Quiz/ }).click()
  await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
  expect(admissions).toBe(0)
})

test('semantic groups share file understanding and selected-range Ask opens the original composer without dispatch', async ({ page }, info): Promise<void> => {
  await open(page, 1506)
  await load(page)
  let admissions = 0
  page.on('request', (request): void => { if (request.url().endsWith('/questions')) admissions++ })
  await generate(page, 'semantic')
  const first = page.getByRole('article', { name: 'Semantic excerpt src/auth/refresh.ts', exact: true })
  await first.getByRole('button', { name: 'Mark understood src/auth/refresh.ts', exact: true }).click()
  await page.getByRole('navigation', { name: 'Semantic groups', exact: true }).getByRole('button', { name: /Recover after a failed refresh/ }).click()
  const second = page.getByRole('article', { name: 'Semantic excerpt src/auth/refresh.ts', exact: true })
  await expect(second.getByRole('button', { name: 'Unmark understood src/auth/refresh.ts', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: info.outputPath('semantic-dark.png') })
  await second.getByRole('button', { name: 'Select head line 26', exact: true }).click()
  await second.getByRole('button', { name: 'Ask about selected range', exact: true }).click()
  const initial = page.getByRole('region', { name: 'Initial source question', exact: true })
  await expect(initial).toContainText('Head L26–26')
  await expect(initial.getByRole('textbox')).toBeFocused()
  expect(admissions).toBe(0)
  await expect(page.getByRole('progressbar', { name: 'Files marked understood' })).toHaveAttribute('value', '1')
})

test('semantic remainder retains changed-line accounting and non-text inventory', async ({ page }): Promise<void> => {
  await open(page, 1507)
  await page.setExtraHTTPHeaders({ 'X-Sheldon-Scenario': 'source-nontext' })
  await load(page, 4)
  await generate(page, 'semantic')
  await page.getByRole('navigation', { name: 'Semantic groups', exact: true }).getByRole('button', { name: /Ungrouped changes/ }).click()
  await expect(page.getByRole('article', { name: /^Remaining file / })).toHaveCount(4)
  await expect(page.getByText('5 changed lines remain outside the groups.', { exact: false })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Remaining file assets/diagram.png', exact: true })).toContainText('Binary file added.')
})

test('source refresh labels old semantic results without retargeting groups or quiz checks', async ({ page }): Promise<void> => {
  await open(page, 1508)
  await load(page)
  await generate(page, 'quiz')
  await page.getByRole('radio', { name: 'Both await the same in-flight refresh operation.', exact: true }).check()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await generate(page, 'semantic')
  await page.getByRole('button', { name: /^Files changed/ }).click()
  await page.setExtraHTTPHeaders({ 'X-Sheldon-Scenario': 'new-revision' })
  await page.getByRole('button', { name: 'Refresh source', exact: true }).click()
  await page.getByRole('button', { name: /^Semantic review/ }).click()
  await expect(page.getByText('Earlier revision', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View in original diff', exact: true }).first()).toBeDisabled()
  await page.getByRole('button', { name: /^Quiz/ }).click()
  await expect(page.getByRole('heading', { name: 'That’s right.', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View in original diff', exact: true })).toBeDisabled()
})

test('saved semantic groups reopen source-free with original quotes and disabled navigation', async ({ page }): Promise<void> => {
  await open(page, 1509)
  await load(page)
  await generate(page, 'semantic')
  let work = 0
  page.on('request', (request): void => { if (request.method() === 'POST' && /\/(source|generations)$/.test(request.url())) work++ })
  await page.reload()
  await page.getByRole('button', { name: 'Semantic review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'One refresh, many callers', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View in original diff', exact: true }).first()).toBeDisabled()
  expect(work).toBe(0)
})

test('generation busy rejection in another tab requires saved refresh, not automatic resend', async ({ page, context }): Promise<void> => {
  const other = await context.newPage()
  await open(page, 1510)
  await load(page)
  await open(other, 1510)
  await load(other)
  await page.getByRole('button', { name: 'Quiz', exact: true }).click()
  await other.getByRole('button', { name: 'Quiz', exact: true }).click()
  let mutations = 0
  other.on('request', (request): void => { if (request.method() === 'POST' && request.url().endsWith('/generations')) mutations++ })
  await page.getByRole('button', { name: 'Generate quiz', exact: true }).click()
  await other.getByRole('button', { name: 'Generate quiz', exact: true }).click()
  await expect(other.getByRole('alert')).toContainText('Another generation is active')
  await expect(other.getByRole('button', { name: 'Generate quiz', exact: true })).toBeDisabled()
  await other.getByRole('button', { name: 'Refresh saved quiz', exact: true }).click()
  await expect(other.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
  expect(mutations).toBe(1)
})

for (const kind of ['quiz', 'semantic'] as const) test(`failed ${kind} replacement preserves its complete predecessor`, async ({ page }): Promise<void> => {
  await open(page, kind === 'quiz' ? 1511 : 1512)
  await load(page)
  await generate(page, kind)
  await page.setExtraHTTPHeaders({ 'X-Sheldon-Scenario': 'generation-failed' })
  await regenerate(page, kind === 'quiz' ? 'quiz' : 'semantic review')
  await expect(page.getByText('Last generation: failed', { exact: false })).toBeVisible()
  if (kind === 'quiz') await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
  else await expect(page.getByRole('heading', { name: 'One refresh, many callers', exact: true })).toBeVisible()
})

test('large saved semantic inventory accounts for every original file', async ({ page }, info): Promise<void> => {
  await open(page, 1513)
  await page.setExtraHTTPHeaders({ 'X-Sheldon-Scenario': 'large-source' })
  await load(page, 80)
  await generate(page, 'semantic')
  await page.getByRole('navigation', { name: 'Semantic groups', exact: true }).getByRole('button', { name: /Ungrouped changes/ }).click()
  await expect(page.getByRole('article', { name: /^Remaining file / })).toHaveCount(80)
  await page.screenshot({ path: info.outputPath('large-semantic-inventory.png') })
})
