import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { generate, load, open } from './helpers'

/**
 * Measures rendered text against the first opaque background in its ancestry.
 * @param view Diff surface containing literal rows.
 * @returns Lowest WCAG text contrast across code, syntax, and gutters.
 */
async function minimumContrast(view: Locator): Promise<number> {
  return view.evaluate((root): number => {
    /**
     * Converts a computed RGB color to WCAG relative luminance.
     * @param color Computed opaque RGB color.
     * @returns Relative luminance.
     */
    function luminance(color: string): number {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map((value): number => {
        const channel = Number(value) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
    }
    const ratios = [...root.querySelectorAll('.line code, .line .syntax-token, .line .number, .line .sign')].map((element): number => {
      let background: Element | null = element
      while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement
      if (!background) throw new Error('Missing opaque diff background.')
      const foreground = luminance(getComputedStyle(element).color)
      const fill = luminance(getComputedStyle(background).backgroundColor)
      return (Math.max(foreground, fill) + 0.05) / (Math.min(foreground, fill) + 0.05)
    })
    return Math.min(...ratios)
  })
}

for (const theme of ['dark', 'light'] as const) test(`${theme} diff rows, gutters, syntax, hover and selection retain accessible contrast`, async ({ page }, info): Promise<void> => {
  await open(page, theme === 'dark' ? 2601 : 2602)
  await load(page)
  if (theme === 'light') await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  const colors = theme === 'dark'
    ? { paper: 'rgb(24, 25, 28)', ink: 'rgb(236, 237, 239)', add: 'rgb(32, 53, 42)', addGutter: 'rgb(42, 71, 53)', del: 'rgb(58, 36, 42)', delGutter: 'rgb(81, 44, 52)', success: 'rgb(163, 200, 169)', error: 'rgb(228, 164, 156)', key: 'rgb(201, 179, 227)', str: 'rgb(168, 201, 179)', selected: 'rgb(52, 58, 63)', accent: 'rgb(177, 231, 125)', soft: 'rgb(41, 45, 49)', muted: 'rgb(170, 176, 184)', feedbackAdd: '#1d2420', feedbackDel: '#272023' }
    : { paper: 'rgb(255, 255, 255)', ink: 'rgb(32, 56, 49)', add: 'rgb(222, 242, 223)', addGutter: 'rgb(202, 231, 206)', del: 'rgb(251, 229, 226)', delGutter: 'rgb(247, 217, 212)', success: 'rgb(36, 96, 68)', error: 'rgb(160, 71, 60)', key: 'rgb(128, 90, 149)', str: 'rgb(54, 112, 90)', selected: 'rgb(228, 239, 201)', accent: 'rgb(7, 91, 70)', soft: 'rgb(232, 241, 230)', muted: 'rgb(89, 103, 95)', feedbackAdd: '#eff7ec', feedbackDel: '#fcefeb' }
  const source = page.getByRole('article', { name: 'Changed file src/auth/refresh.ts', exact: true })
  await expect(source.locator('.syntax-token').filter({ hasText: /^const$/ }).first()).toHaveCSS('color', colors.key)
  await expect(source.locator('.syntax-token').filter({ hasText: /"\.\/store"/ }).first()).toHaveCSS('color', colors.str)
  await expect(source.locator('.line:not(.added):not(.removed)').first()).toHaveCSS('background-color', colors.paper)
  for (const [kind, fill, gutter, ink] of [['added', colors.add, colors.addGutter, colors.success], ['removed', colors.del, colors.delGutter, colors.error]]) {
    const row = source.locator(`.line.${kind}`).first()
    await expect(row).toHaveCSS('background-color', fill!)
    await expect(row).toHaveCSS('min-height', '27px')
    await expect(row.locator('code')).toHaveCSS('font-size', '11px')
    await expect(row.locator('code')).toHaveCSS('color', colors.ink)
    for (const cell of await row.locator('.number, .sign').all()) {
      await expect(cell).toHaveCSS('background-color', gutter!)
      await expect(cell).toHaveCSS('color', ink!)
    }
    await expect(row.locator('.number').first()).toHaveCSS('border-radius', '0px')
    await expect(row.locator('.sign')).toHaveCSS('font-weight', '700')
  }
  expect(await minimumContrast(source)).toBeGreaterThanOrEqual(4.5)
  const feedback = await page.evaluate((): string[] => {
    const style = getComputedStyle(document.documentElement)
    return ['--added-bg', '--removed-bg'].map((token): string => style.getPropertyValue(token).trim())
  })
  expect(feedback).toEqual([colors.feedbackAdd, colors.feedbackDel])
  await page.screenshot({ path: info.outputPath(`files-${theme}.png`) })
  await generate(page, 'semantic')
  await expect(page.locator('.excerpt').first()).toBeVisible()
  for (const excerpt of await page.locator('.excerpt').all()) expect(await minimumContrast(excerpt)).toBeGreaterThanOrEqual(4.5)
  await expect(page.locator('.excerpt .added').first()).toHaveCSS('background-color', colors.add)
  await page.screenshot({ path: info.outputPath(`semantic-${theme}.png`) })
  await page.getByRole('button', { name: /^Files changed/ }).click()
  const number = source.getByRole('button', { name: 'Ask about head line 15', exact: true })
  await number.hover()
  await expect(number).toHaveCSS('background-color', colors.soft)
  await expect(number).toHaveCSS('color', colors.accent)
  await page.mouse.down()
  await expect(source.locator('.line.selected')).toHaveCount(1)
  await expect(number).toHaveCSS('background-color', colors.soft)
  await expect(number).toHaveCSS('color', colors.accent)
  await page.mouse.up()
  await page.mouse.move(0, 0)
  const selected = source.locator('.line.selected')
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveCSS('background-color', colors.selected)
  await expect(selected).toHaveCSS('box-shadow', `${colors.accent} 3px 0px 0px 0px inset`)
  for (const cell of await selected.locator('.number, .sign').all()) await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(number).toHaveCSS('color', colors.muted)
  await expect(selected.locator('.sign')).toHaveCSS('color', colors.success)
  expect(await minimumContrast(source)).toBeGreaterThanOrEqual(4.5)
  await expect(number).toBeDisabled()
  await page.screenshot({ path: info.outputPath(`selection-${theme}.png`) })
  await page.getByRole('button', { name: 'Discard draft', exact: true }).first().click()
  await source.getByRole('button', { name: 'Ask about old line 16', exact: true }).click()
  await page.mouse.move(0, 0)
  const deletedSelection = source.locator('.line.removed.selected')
  await expect(deletedSelection).toHaveCSS('background-color', colors.selected)
  await expect(deletedSelection.locator('.sign')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(deletedSelection.locator('.sign')).toHaveCSS('color', colors.error)
  await expect(deletedSelection.locator('.number').first()).toHaveCSS('color', colors.muted)
  expect(await minimumContrast(source)).toBeGreaterThanOrEqual(4.5)
})
