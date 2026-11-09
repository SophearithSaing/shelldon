import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Opens an isolated development PR through the product form.
 * @param page Browser page.
 * @param number Unique PR number.
 */
export async function open(page: Page, number: number): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Open a pull request', { exact: true }).fill(`https://github.com/acme/platform/pull/${number}`)
  await page.getByRole('button', { name: 'Open PR', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Deduplicate concurrent session refreshes #${number}` })).toBeVisible()
}

/**
 * Loads source explicitly and waits for its complete inventory.
 * @param page Browser page.
 * @param count Expected changed file count.
 */
export async function load(page: Page, count = 3): Promise<void> {
  await page.getByRole('button', { name: 'Load pinned source', exact: true }).click()
  await expect(page.getByRole('article', { name: /^Changed file / })).toHaveCount(count)
}

/**
 * Opens a question beneath a specific changed head line.
 * @param page Browser page.
 * @param line Changed head line.
 * @returns Exact initial composer region.
 */
export async function compose(page: Page, line = 15): Promise<Locator> {
  const file = page.getByRole('article', { name: 'Changed file src/auth/refresh.ts', exact: true })
  await file.getByRole('button', { name: `Ask about head line ${line}`, exact: true }).click()
  return page.getByRole('region', { name: 'Initial source question', exact: true })
}

/**
 * Admits one source question through its initial composer.
 * @param page Browser page.
 * @param text Submitted text.
 * @returns Canonical visible inline conversation.
 */
export async function ask(page: Page, text = 'Why clear the shared refresh promise in finally?'): Promise<Locator> {
  const initial = await compose(page)
  await initial.getByRole('textbox', { name: 'Your question', exact: true }).fill(text)
  await initial.getByRole('button', { name: 'Send question', exact: true }).click()
  const inline = page.getByRole('region', { name: 'Inline conversation', exact: true })
  await expect(inline).toBeVisible()
  return inline
}

/**
 * Waits for execution and saving as separate terminal conditions.
 * @param view Canonical conversation view.
 */
export async function completed(view: Locator): Promise<void> {
  await expect(view.getByText('Execution: completed', { exact: true }).last()).toBeVisible()
  await expect(view.getByText('Saving: saved', { exact: true }).last()).toBeVisible()
}

/**
 * Starts a feature explicitly and waits for saved content.
 * @param page Browser page.
 * @param feature Independent generation feature.
 */
export async function generate(page: Page, feature: 'quiz' | 'semantic'): Promise<void> {
  await page.getByRole('navigation', { name: 'Review features', exact: true }).getByRole('button', { name: feature === 'quiz' ? /^Quiz/ : /^Semantic review/ }).click()
  await page.getByRole('button', { name: `Generate ${feature === 'quiz' ? 'quiz' : 'semantic review'}`, exact: true }).click()
  if (feature === 'quiz') await expect(page.getByRole('article', { name: 'Quiz question 1', exact: true })).toBeVisible()
  else await expect(page.getByRole('heading', { name: 'One refresh, many callers', exact: true })).toBeVisible()
}
