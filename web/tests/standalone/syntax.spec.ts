import { expect, test } from '@playwright/test'
import type { SourceResponse } from '../../src/api/contracts/source'
import { ask, completed, generate, load, open } from './helpers'

test('diff tokens use Ayu Dark and GitHub Light without inline styles or changed source text', async ({ page }, info): Promise<void> => {
  await open(page, 1901)
  const received = page.waitForResponse((response): boolean => response.url().endsWith('/source'))
  await load(page)
  const source = await (await received).json() as SourceResponse
  if (source.state !== 'ready') throw new Error('Expected pinned source.')
  const file = page.getByRole('article', { name: 'Changed file src/auth/refresh.ts', exact: true })
  const keyword = file.locator('.syntax-token').filter({ hasText: /^const$/ }).first()
  await expect(keyword).toHaveCSS('color', 'rgb(255, 143, 64)')
  expect(await file.locator('code').allTextContents()).toEqual(source.diff.files[0]!.hunks![0]!.lines.map((line): string => line.text))
  await expect(file.locator('.syntax-token[style]')).toHaveCount(0)
  await expect(file.locator('.added').first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await page.screenshot({ path: info.outputPath('syntax-ayu-dark.png') })
  const text = await file.locator('code').allTextContents()
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await expect(keyword).toHaveCSS('color', 'rgb(215, 58, 73)')
  expect(await file.locator('code').allTextContents()).toEqual(text)
  await page.screenshot({ path: info.outputPath('syntax-github-light.png') })
})

test('old and new grammar states stay separate and highlighted HTML stays literal', async ({ page }): Promise<void> => {
  await open(page, 1902)
  await page.route('**/api/reviews/*/source', async (route): Promise<void> => {
    const source = await (await route.fetch()).json() as SourceResponse
    if (source.state !== 'ready') throw new Error('Expected source.')
    source.diff.files[0]!.hunks![0]!.lines = [
      { id: 'old-open', sign: '-', oldLine: 1, text: '/* old comment' },
      { id: 'new-code', sign: '+', newLine: 1, text: 'const current = "safe"' },
      { id: 'context', sign: ' ', oldLine: 2, newLine: 2, text: 'still_open' },
      { id: 'old-close', sign: '-', oldLine: 3, text: '*/' },
      { id: 'new-html', sign: '+', newLine: 3, text: 'const html = "<script>literal</script>"' },
      { id: 'end', sign: ' ', oldLine: 4, newLine: 4, text: 'const done = true' },
    ]
    await route.fulfill({ json: source })
  })
  await load(page)
  await expect(page.locator('[data-line="old-open"] .syntax-token').first()).toHaveCSS('color', 'rgb(90, 102, 115)')
  await expect(page.locator('[data-line="new-code"] .syntax-token').first()).toHaveCSS('color', 'rgb(255, 143, 64)')
  await expect(page.locator('[data-line="context"] .syntax-token').first()).not.toHaveCSS('color', 'rgb(90, 102, 115)')
  await expect(page.locator('[data-line="old-close"] .syntax-token').first()).toHaveCSS('color', 'rgb(90, 102, 115)')
  await expect(page.locator('[data-line="new-html"] code')).toHaveText('const html = "<script>literal</script>"')
  await expect(page.locator('.pinned-diff script, .pinned-diff img')).toHaveCount(0)
})

test('unsupported paths, oversized lines and grammar delivery failures retain plain text', async ({ page }): Promise<void> => {
  await open(page, 1903)
  await page.route('**/api/reviews/*/source', async (route): Promise<void> => {
    const source = await (await route.fetch()).json() as SourceResponse
    if (source.state !== 'ready') throw new Error('Expected source.')
    source.diff.files[0]!.oldPath = 'notes.unknown'
    source.diff.files[0]!.newPath = 'notes.unknown'
    source.diff.files[1]!.hunks![0]!.lines[0]!.text = 'x'.repeat(2001)
    await route.fulfill({ json: source })
  })
  await page.route('**/src/syntax/highlighter.ts*', async (route): Promise<void> => { await route.abort() })
  await load(page)
  const unknown = page.getByRole('article', { name: 'Changed file notes.unknown', exact: true })
  await expect(unknown.locator('code').first()).toContainText('sessionStore')
  await expect(unknown.locator('.syntax-token')).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Changed file src/auth/store.ts', exact: true }).locator('code').first()).toHaveText('x'.repeat(2001))
  await expect(page.locator('.pinned-diff .syntax-token')).toHaveCount(0)
})

test('pinned context, semantic excerpts and quiz evidence share the token renderer', async ({ page }): Promise<void> => {
  await open(page, 1904)
  await load(page)
  const inline = await ask(page)
  await completed(inline)
  await inline.getByText('Pinned context', { exact: true }).click()
  await expect(inline.locator('.quote .syntax-token').first()).toBeVisible()
  await generate(page, 'semantic')
  await expect(page.locator('.excerpt .syntax-token').first()).toBeVisible()
  await generate(page, 'quiz')
  await page.getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await expect(page.locator('.evidence .syntax-token').first()).toBeVisible()
})

test('all supported lazy grammars preserve literal source and honor highlighting limits', async ({ page }): Promise<void> => {
  await page.goto('/')
  const result = await page.evaluate(async (): Promise<{ languages: string[]; oversized: boolean }> => {
    const modulePath = '/src/syntax/highlighter.ts'
    const { highlightSource } = await import(modulePath) as typeof import('../../src/syntax/highlighter')
    const samples: Record<string, string> = {
      typescript: 'const x: string = "hello"', tsx: 'const x = <div>Hello</div>', javascript: 'const x = "hello"', jsx: 'const x = <div>Hello</div>',
      vue: '<template><div>{{ text }}</div></template>', go: 'package main\nfunc main() {}', python: 'def greet():\n    return "hello"', rust: 'fn main() {}',
      json: '{"hello": true}', jsonc: '// comment\n{"hello": true}', yaml: 'hello: true', toml: 'hello = true', html: '<div>Hello</div>', css: 'div { color: red; }',
      scss: '$color: red; div { color: $color; }', markdown: '# Hello', shellscript: 'echo "hello"', sql: 'SELECT * FROM users;', java: 'class Hello {}',
      c: 'int main() { return 0; }', cpp: 'int main() { return 0; }', ruby: 'def hello\n  puts "hello"\nend', dockerfile: 'FROM node:26', graphql: 'query { user { id } }',
    }
    const valid: string[] = []
    for (const [language, text] of Object.entries(samples)) {
      const highlighted = await highlightSource(language, text)
      if (highlighted && highlighted.map((line): string => line.map((token): string => token.text).join('')).join('\n') === text && highlighted.some((line): boolean => line.some((token): boolean => token.classes.length > 0))) valid.push(language)
    }
    return { languages: valid, oversized: await highlightSource('typescript', 'x'.repeat(2001)) === null && await highlightSource('typescript', 'x\n'.repeat(1001)) === null && await highlightSource('typescript', 'x\n'.repeat(33000)) === null }
  })
  expect(result.languages).toHaveLength(24)
  expect(result.oversized).toBe(true)
})
