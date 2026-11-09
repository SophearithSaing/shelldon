import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLight from 'shiki/themes/github-light.mjs'
import ayuDark from 'shiki/themes/ayu-dark.mjs'
import { loadLanguage } from './languages'

export interface SyntaxToken {
  text: string
  classes: string[]
}

const highlighter = createHighlighterCore({ engine: createJavaScriptRegexEngine(), themes: [githubLight, ayuDark], langs: [] })
const languages = new Map<string, Promise<void>>()
const cache = new Map<string, SyntaxToken[][]>()
let cachedCharacters = 0

/**
 * Converts trusted theme token styles into external stylesheet classes, never inline CSS.
 * @param variant Light or dark theme selector.
 * @param color Shiki foreground color.
 * @param italic Shiki font style.
 * @param weight Shiki font weight.
 * @param decoration Shiki text decoration.
 * @returns Theme-specific token classes.
 */
function classes(variant: string, color?: string, italic?: string, weight?: string, decoration?: string): string[] {
  const result = /^#[\da-f]{6}([\da-f]{2})?$/i.test(color ?? '') ? [`${variant}-${color!.slice(1).toLowerCase()}`] : []
  if (italic === 'italic') result.push(`${variant}-italic`)
  if (weight === 'bold') result.push(`${variant}-bold`)
  if (decoration?.includes('underline')) result.push(`${variant}-underline`)
  if (decoration?.includes('line-through')) result.push(`${variant}-strike`)
  return result
}

/**
 * Tokenizes a bounded contiguous source excerpt with both pinned palettes.
 * @param language Explicit path-derived language.
 * @param text Literal source without diff markers.
 * @returns Per-line tokens with CSS classes, or null when highlighting is unsupported.
 */
export async function highlightSource(language: string, text: string): Promise<SyntaxToken[][] | null> {
  if (text.length > 64 << 10) return null
  const lines = text.split('\n')
  if (lines.length > 1000 || lines.some((line): boolean => line.length > 2000)) return null
  const key = `${language}\0${text}`
  const found = cache.get(key)
  if (found) { cache.delete(key); cache.set(key, found); return found }
  const engine = await highlighter
  if (!languages.has(language)) {
    const loading = loadLanguage(language).then(async (grammar): Promise<void> => { await engine.loadLanguage(grammar) }).catch((error: unknown): never => { languages.delete(language); throw error })
    languages.set(language, loading)
  }
  await languages.get(language)
  const warmed = cache.get(key)
  if (warmed) return warmed
  const tokens = engine.codeToTokens(text, { lang: language, themes: { light: 'github-light', dark: 'ayu-dark' } }).tokens.map((line): SyntaxToken[] => line.map((token): SyntaxToken => {
    const style = token.htmlStyle ?? {}
    return { text: token.content, classes: [...classes('light', style.color, style['font-style'], style['font-weight'], style['text-decoration']), ...classes('dark', style['--shiki-dark'], style['--shiki-dark-font-style'], style['--shiki-dark-font-weight'], style['--shiki-dark-text-decoration'])] }
  }))
  while (cache.size >= 64 || cachedCharacters + key.length > 256 << 10) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cachedCharacters -= oldest.length
    cache.delete(oldest)
  }
  if (!cache.has(key)) { cache.set(key, tokens); cachedCharacters += key.length }
  return tokens
}
